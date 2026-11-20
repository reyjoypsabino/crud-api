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

async function classifySupportMessage(text) {
  const client = createClient();

  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `<support_message>\n${text}\n</support_message>` },
    ],
  });

  const rawContent = response.choices?.[0]?.message?.content ?? '';
  const checked = parseAndValidateModelOutput(rawContent);

  if (!checked.ok) {
    const err = new Error(checked.error);
    err.code = 'INVALID_MODEL_OUTPUT';
    throw err;
  }

  return {
    result: checked.data,
    promptVersion: PROMPT_VERSION,
  };
}

module.exports = {
  PROMPT_VERSION,
  classifySupportMessage,
  parseAndValidateModelOutput,
};