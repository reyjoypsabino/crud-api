const assert = require('node:assert/strict');
const { classifySupportMessage } = require('../src/llm/triage');

function makeMockClient(responses) {
  let calls = 0;
  return {
    getCallCount: () => calls,
    chat: {
      completions: {
        create: async () => {
          const content = responses[calls] ?? '';
          calls += 1;
          return { choices: [{ message: { content } }] };
        },
      },
    },
  };
}

async function run() {
  // Case 1: Bad category on attempt 1 -> repaired on attempt 2
  const recoveringClient = makeMockClient([
    '{"category":"refunds","urgency":"high","confidence":0.9,"reason":"Duplicate invoice."}',
    '{"category":"billing","urgency":"high","confidence":0.9,"reason":"Duplicate invoice."}',
  ]);

  const repairedOut = await classifySupportMessage('Charged twice', {
    client: recoveringClient,
    model: 'mock-model',
  });
  assert.equal(recoveringClient.getCallCount(), 2);
  assert.equal(repairedOut.repaired, true);
  assert.equal(repairedOut.result.category, 'billing');
  console.log('PASS Case 1: invalid first response repaired in 1 retry ->', repairedOut.result);

  // Case 2: Invalid output on both attempts -> throws INVALID_MODEL_OUTPUT (422 in route, max 2 calls)
  const failingClient = makeMockClient([
    'not even json',
    '{"category":"unknown_queue","urgency":"urgent","confidence":5,"reason":""}',
  ]);

  let caughtCode = null;
  try {
    await classifySupportMessage('Help me', {
      client: failingClient,
      model: 'mock-model',
    });
  } catch (err) {
    caughtCode = err.code;
  }
  assert.equal(failingClient.getCallCount(), 2);
  assert.equal(caughtCode, 'INVALID_MODEL_OUTPUT');
  console.log('PASS Case 2: second invalid response stopped at 2 calls with code ->', caughtCode);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});