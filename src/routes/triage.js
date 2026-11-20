const express = require('express');
const { TriageInputSchema, TriageOutputSchema } = require('../llm/schema');
const { classifySupportMessage } = require('../llm/triage');

const router = express.Router();

function buildStubTriage(text) {
  const lower = text.toLowerCase();

  let category = 'other';
  let urgency = 'normal';
  let confidence = 0.55;
  let reason = 'Stub response: message does not match a specific queue.';

  if (lower.includes('charge') || lower.includes('invoice') || lower.includes('bill')) {
    category = 'billing';
    urgency = 'high';
    confidence = 0.92;
    reason = 'Stub response: customer reported a billing or payment issue.';
  } else if (lower.includes('crash') || lower.includes('error') || lower.includes('bug')) {
    category = 'bug';
    urgency = 'high';
    confidence = 0.9;
    reason = 'Stub response: customer reported a software defect.';
  } else if (lower.includes('feature') || lower.includes('dark mode') || lower.includes('add')) {
    category = 'feature';
    urgency = 'low';
    confidence = 0.88;
    reason = 'Stub response: customer requested a product enhancement.';
  }

  return TriageOutputSchema.parse({
    category,
    urgency,
    confidence,
    reason,
  });
}

router.post('/triage', async (req, res) => {
  // 1. Validate input before touching the model
  const parsedInput = TriageInputSchema.safeParse(req.body);
  if (!parsedInput.success) {
    return res.status(400).json({
      error: 'Invalid request body',
      details: parsedInput.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      })),
    });
  }

  const { text } = parsedInput.data;

  // 2. Stub mode: zero model calls spent while building and testing
  if (process.env.LLM_STUB === 'true') {
    const stubResult = buildStubTriage(text);
    return res.status(200).json(stubResult);
  }

  // 3. Live model call
// 3. Live model call
  try {
    const { result } = await classifySupportMessage(text);
    return res.status(200).json(result);
  } catch (err) {
    if (err.code === 'INVALID_MODEL_OUTPUT') {
      return res.status(422).json({
        error: 'Model returned invalid output that failed schema validation.',
      });
    }

    if (err.code === 'LLM_TIMEOUT') {
      console.error('[triage] Upstream LLM timeout:', err.message);
      return res.status(504).json({
        error: 'Upstream LLM provider timed out.',
      });
    }

    console.error('[triage] Upstream LLM error:', err.message);
    return res.status(502).json({
      error: 'Upstream LLM provider request failed.',
    });
  }
});

module.exports = router;