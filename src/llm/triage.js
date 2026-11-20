const fs = require('node:fs');
const path = require('node:path');
const OpenAI = require('openai');
const { TriageOutputSchema } = require('./schema');

const PROMPT_VERSION = 'triage-v1';
const PROMPT_PATH = path.join(__dirname, '..', '..', 'prompts', `${PROMPT_VERSION}.md`);
const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, 'utf8');

function getTimeoutMs() {
  const parsed = Number(process.env.LLM_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
}

function createClient(timeoutMs) {
  return new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
    timeout: timeoutMs,
    maxRetries: 0, // Disable hidden SDK retries so our policy controls every call
  });
}

function isTimeoutError(err) {
  if (!err) return false;
  return (
    err.name === 'APIConnectionTimeoutError' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ABORT_ERR' ||
    /timed out|timeout/i.test(err.message || '')
  );
}

function isTransientError(err) {
  if (!err) return false;
  if (isTimeoutError(err)) return true;

  // Retry only rate limits (429), upstream server errors (5xx), or transient network errors.
  // Never retry 400, 401, 403, or 404.
  if (err.status === 429) return true;
  if (typeof err.status === 'number' && err.status >= 500) return true;

  const transientNetworkCodes = ['ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'];
  return transientNetworkCodes.includes(err.code);
}

async function withTimeout(promiseFactory, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promiseFactory(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(`LLM request timed out after ${timeoutMs}ms`);
          err.code = 'ETIMEDOUT';
          reject(err);
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function callWithRetry(fn, { maxRetries = 1, baseDelayMs = 400 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries || !isTransientError(err)) {
        if (isTimeoutError(err)) {
          err.code = 'LLM_TIMEOUT';
        }
        throw err;
      }

      attempt += 1;
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function stripMarkdownFences(rawText) {
  return rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseAndValidateModelOutput(rawText) {
  if (typeof rawText !== 'string' || rawText.trim() === '') {
    return {
      ok: false,
      error: 'Model returned an empty response.',
    };
  }

  const cleaned = stripMarkdownFences(rawText);

  let parsedJson;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (err) {
    return {
      ok: false,
      error: `Invalid JSON from model: ${err.message}`,
    };
  }

  const validated = TriageOutputSchema.safeParse(parsedJson);
  if (!validated.success) {
    const issues = validated.error.issues
      .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
      .join('; ');
    return {
      ok: false,
      error: `Schema validation failed: ${issues}`,
    };
  }

  return {
    ok: true,
    data: validated.data,
  };
}

function buildRepairPrompt(invalidOutput, validationError) {
  return [
    'Your previous response failed JSON/schema validation.',
    `Validation error: ${validationError}`,
    'Previous invalid response:',
    invalidOutput || '(empty response)',
    '',
    'Fix the response and return ONLY valid JSON matching this exact schema (no markdown fences, no extra text):',
    '{"category":"billing|bug|feature|other","urgency":"low|normal|high","confidence":0.0,"reason":"one short sentence"}',
  ].join('\n');
}

async function classifySupportMessage(text, options = {}) {
  const timeoutMs = options.timeoutMs || getTimeoutMs();
  const maxRetries = options.maxRetries ?? 1;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const client = options.client || createClient(timeoutMs);
  const model = options.model || process.env.LLM_MODEL;

  const baseMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `<support_message>\n${text}\n</support_message>` },
  ];

  // Attempt 1: Initial model call with timeout and transient-only retry
  const firstResponse = await callWithRetry(
    () =>
      withTimeout(
        () =>
          client.chat.completions.create({
            model,
            temperature: 0,
            messages: baseMessages,
          }),
        timeoutMs
      ),
    { maxRetries, baseDelayMs }
  );

  const firstRaw = firstResponse.choices?.[0]?.message?.content ?? '';
  const firstCheck = parseAndValidateModelOutput(firstRaw);

  if (firstCheck.ok) {
    return {
      result: firstCheck.data,
      promptVersion: PROMPT_VERSION,
      repaired: false,
    };
  }

  // Attempt 2 (bounded to 1 schema repair): Hand the model its own validation error
  const repairResponse = await callWithRetry(
    () =>
      withTimeout(
        () =>
          client.chat.completions.create({
            model,
            temperature: 0,
            messages: [
              ...baseMessages,
              { role: 'assistant', content: firstRaw },
              { role: 'user', content: buildRepairPrompt(firstRaw, firstCheck.error) },
            ],
          }),
        timeoutMs
      ),
    { maxRetries, baseDelayMs }
  );

  const repairRaw = repairResponse.choices?.[0]?.message?.content ?? '';
  const repairCheck = parseAndValidateModelOutput(repairRaw);

  if (!repairCheck.ok) {
    const err = new Error(`Model output invalid after repair: ${repairCheck.error}`);
    err.code = 'INVALID_MODEL_OUTPUT';
    throw err;
  }

  return {
    result: repairCheck.data,
    promptVersion: PROMPT_VERSION,
    repaired: true,
  };
}

module.exports = {
  PROMPT_VERSION,
  classifySupportMessage,
  parseAndValidateModelOutput,
  isTransientError,
  isTimeoutError,
};