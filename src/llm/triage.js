const fs = require('node:fs');
const path = require('node:path');
const OpenAI = require('openai');
const { TriageOutputSchema } = require('./schema');

const PROMPT_VERSION = 'triage-v1';
const PROMPT_PATH = path.join(__dirname, '..', '..', 'prompts', `${PROMPT_VERSION}.md`);
const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, 'utf8');

function createClient() {
  return new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
  });
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
  const client = options.client || createClient();
  const model = options.model || process.env.LLM_MODEL;

  const baseMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `<support_message>\n${text}\n</support_message>` },
  ];

  // Attempt 1: Initial model call
  const firstResponse = await client.chat.completions.create({
    model,
    temperature: 0,
    messages: baseMessages,
  });

  const firstRaw = firstResponse.choices?.[0]?.message?.content ?? '';
  const firstCheck = parseAndValidateModelOutput(firstRaw);

  if (firstCheck.ok) {
    return {
      result: firstCheck.data,
      promptVersion: PROMPT_VERSION,
      repaired: false,
    };
  }

  // Attempt 2 (bounded to 1 repair): Hand the model its own validation error
  const repairResponse = await client.chat.completions.create({
    model,
    temperature: 0,
    messages: [
      ...baseMessages,
      { role: 'assistant', content: firstRaw },
      { role: 'user', content: buildRepairPrompt(firstRaw, firstCheck.error) },
    ],
  });

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
};