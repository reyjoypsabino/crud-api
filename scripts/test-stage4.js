const assert = require('node:assert/strict');
const { classifySupportMessage } = require('../src/llm/triage');

async function run() {
  // Case 1: Transient 503 on first call -> retries once -> succeeds
  let transientCalls = 0;
  const transientClient = {
    chat: {
      completions: {
        create: async () => {
          transientCalls += 1;
          if (transientCalls === 1) {
            const err = new Error('Service Unavailable');
            err.status = 503;
            throw err;
          }
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    category: 'bug',
                    urgency: 'high',
                    confidence: 0.91,
                    reason: 'Customer reported an application crash.',
                  }),
                },
              },
            ],
          };
        },
      },
    },
  };

  const recovered = await classifySupportMessage('App crashes on login', {
    client: transientClient,
    model: 'mock-model',
    maxRetries: 1,
    baseDelayMs: 10,
  });
  assert.equal(transientCalls, 2);
  assert.equal(recovered.result.category, 'bug');
  console.log('PASS Case 1: transient 503 retried once and succeeded (2 calls)');

  // Case 2: Non-retryable 401 -> fails immediately with zero retries (1 call)
  let authCalls = 0;
  const authErrorClient = {
    chat: {
      completions: {
        create: async () => {
          authCalls += 1;
          const err = new Error('Unauthorized');
          err.status = 401;
          throw err;
        },
      },
    },
  };

  let authStatus = null;
  try {
    await classifySupportMessage('Billing question', {
      client: authErrorClient,
      model: 'mock-model',
      maxRetries: 1,
      baseDelayMs: 10,
    });
  } catch (err) {
    authStatus = err.status;
  }
  assert.equal(authCalls, 1);
  assert.equal(authStatus, 401);
  console.log('PASS Case 2: non-retryable 401 stopped immediately with 0 retries (1 call)');

  // Case 3: Slow call exceeding timeoutMs -> throws LLM_TIMEOUT
  const slowClient = {
    chat: {
      completions: {
        create: () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  choices: [{ message: { content: '{}' } }],
                }),
              200
            )
          ),
      },
    },
  };

  let timeoutCode = null;
  try {
    await classifySupportMessage('Slow request test', {
      client: slowClient,
      model: 'mock-model',
      timeoutMs: 40,
      maxRetries: 0,
    });
  } catch (err) {
    timeoutCode = err.code;
  }
  assert.equal(timeoutCode, 'LLM_TIMEOUT');
  console.log('PASS Case 3: slow call aborted at timeoutMs with code ->', timeoutCode);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});