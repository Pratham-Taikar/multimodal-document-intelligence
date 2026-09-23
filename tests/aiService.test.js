const assert = require("node:assert/strict");
const { test, beforeEach, afterEach } = require("node:test");
const { generateText } = require("../services/aiService");

const FREE_PRIMARY = "google/gemma-4-31b-it:free";
const FREE_FALLBACK_1 = "google/gemma-4-26b-a4b-it:free";
const FREE_FALLBACK_2 = "qwen/qwen3.8-27b:free";
const MODEL_CHAIN = [FREE_PRIMARY, FREE_FALLBACK_1, FREE_FALLBACK_2];

const originalEnvironment = { ...process.env };
const originalFetch = global.fetch;
let logs;
let errorLogs;

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  process.env.OPENROUTER_BASE_URL = "https://openrouter.test/api/v1";
  process.env.OPENROUTER_MODEL = FREE_PRIMARY;
  process.env.OPENROUTER_FALLBACK_MODELS = `${FREE_FALLBACK_1},${FREE_FALLBACK_2}`;
  process.env.AI_PROVIDER_ORDER = "openrouter";
  process.env.AI_MAX_RETRIES = "1";
  process.env.AI_RETRY_BASE_DELAY_MS = "0";
  logs = [];
  errorLogs = [];
  console.info = (...args) => logs.push(args);
  console.warn = (...args) => logs.push(args);
  console.error = (...args) => errorLogs.push(args);
});

afterEach(() => {
  global.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) delete process.env[key];
  }
  Object.assign(process.env, originalEnvironment);
});

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("1. Free primary model succeeds with native fallback chain and :free suffix preserved", async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url, options: { ...options, body: JSON.parse(options.body) } };
    return response({
      model: FREE_PRIMARY,
      choices: [{ message: { content: "primary free result" } }],
    });
  };

  assert.equal(await generateText("prompt"), "primary free result");
  assert.equal(request.url, "https://openrouter.test/api/v1/chat/completions");
  assert.deepEqual(request.options.body.models, MODEL_CHAIN);
  assert.equal(request.options.body.model, FREE_PRIMARY);
  assert.equal(request.options.body.route, "fallback");
  assert.equal(
    request.options.headers.Authorization,
    "Bearer test-openrouter-key",
  );
});

test("2. Primary fails internally, OpenRouter reports fallback 1 was used (model field reflects fallback)", async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url, options: { ...options, body: JSON.parse(options.body) } };
    return response({
      model: FREE_FALLBACK_1,
      choices: [{ message: { content: "fallback 1 result" } }],
    });
  };

  const result = await generateText("prompt");
  assert.equal(result, "fallback 1 result");
  assert.deepEqual(request.options.body.models, MODEL_CHAIN);
  const successLog = logs.find(
    ([, details]) => details?.successfulModel === FREE_FALLBACK_1,
  );
  assert.equal(!!successLog, true);
});

test("3. Primary and fallback 1 fail internally, OpenRouter reports fallback 2 was used", async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url, options: { ...options, body: JSON.parse(options.body) } };
    return response({
      model: FREE_FALLBACK_2,
      choices: [{ message: { content: "fallback 2 result" } }],
    });
  };

  const result = await generateText("prompt");
  assert.equal(result, "fallback 2 result");
  assert.deepEqual(request.options.body.models, MODEL_CHAIN);
  const successLog = logs.find(
    ([, details]) => details?.successfulModel === FREE_FALLBACK_2,
  );
  assert.equal(!!successLog, true);
});

test("4. All three models fail (non-retryable 402 payment required) -> clean error", async () => {
  process.env.AI_MAX_RETRIES = "0";
  global.fetch = async () =>
    response(
      {
        error: {
          message:
            "Payment required: credits exhausted or free daily limit reached",
        },
      },
      402,
    );

  await assert.rejects(
    generateText("prompt"),
    /non-retryable configuration or request error \(402\)/,
  );
});

test("5. Transient 503 is retried and succeeds on second attempt", async () => {
  let attempts = 0;
  global.fetch = async () => {
    attempts += 1;
    return attempts === 1
      ? response({ error: { message: "gateway unavailable" } }, 503)
      : response({
          model: FREE_PRIMARY,
          choices: [{ message: { content: "recovered" } }],
        });
  };

  assert.equal(await generateText("prompt"), "recovered");
  assert.equal(attempts, 2);
});

test("6. No API key is logged on success path", async () => {
  global.fetch = async () =>
    response({
      model: FREE_PRIMARY,
      choices: [{ message: { content: "done" } }],
    });

  await generateText("prompt");

  const logged = JSON.stringify(logs);
  assert.equal(logged.includes("test-openrouter-key"), false);
  assert.equal(logged.includes("Bearer "), false);
});

test("7. No API key is logged on failure path", async () => {
  process.env.AI_MAX_RETRIES = "0";
  global.fetch = async () => response({ error: { message: "bad" } }, 400);

  await assert.rejects(generateText("prompt"), /non-retryable/);

  const logged = JSON.stringify([...logs, ...errorLogs]);
  assert.equal(logged.includes("test-openrouter-key"), false);
});

test("8. aiService contains only OpenRouter endpoint, no direct Gemini/OpenAI/Anthropic API domains", async () => {
  const fs = require("node:fs");
  const source = fs.readFileSync(
    require.resolve("../services/aiService"),
    "utf8",
  );
  assert.equal(source.includes("openrouter.ai/api/v1"), true);
  assert.equal(source.includes("api.openai.com"), false);
  assert.equal(source.includes("api.anthropic.com"), false);
  assert.equal(source.includes("generativelanguage.googleapis.com"), false);
});

test("9. Environment overrides are preferred over defaults; :free suffix propagated exactly", async () => {
  process.env.OPENROUTER_MODEL = "custom/model:free";
  process.env.OPENROUTER_FALLBACK_MODELS = "fallback/a:free,fallback/b:free";
  let request;
  global.fetch = async (url, options) => {
    request = { body: JSON.parse(options.body) };
    return response({
      model: "custom/model:free",
      choices: [{ message: { content: "ok" } }],
    });
  };

  await generateText("p");
  assert.deepEqual(request.body.models, [
    "custom/model:free",
    "fallback/a:free",
    "fallback/b:free",
  ]);
  assert.equal(request.body.model, "custom/model:free");
});
