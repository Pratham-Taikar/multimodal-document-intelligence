const assert = require("node:assert/strict");
const { test, afterEach } = require("node:test");
const DocumentChunk = require("../models/DocumentChunk");
const { setProviderImplementations } = require("../services/aiService");
const {
  generateMCQs,
  generateShortAnswer,
} = require("../services/questionService");
const { answerQuestion } = require("../services/ragService");

const originalFind = DocumentChunk.find;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalEnv = { ...process.env };

afterEach(() => {
  DocumentChunk.find = originalFind;
  process.env.GEMINI_API_KEY = originalGeminiKey;
  for (const k of Object.keys(process.env)) {
    if (!(k in originalEnv)) delete process.env[k];
  }
  Object.assign(process.env, originalEnv);
  setProviderImplementations({});
});

function mockChunks() {
  return [
    { originalName: "notes.pdf", content: "Photosynthesis uses light energy." },
  ];
}

function makeQuestion(i, overrides) {
  const base = {
    question: "Question " + i + " text?",
    options: ["A) Opt1-" + i, "B) Opt2-" + i, "C) Opt3-" + i, "D) Opt4-" + i],
    correct: "A",
    explanation: "Explanation for question " + i + ".",
    citation: "notes.pdf",
  };
  if (overrides) Object.assign(base, overrides);
  return base;
}

function makeMCQResponse(questions) {
  return JSON.stringify({ questions: questions });
}

function seq(responses) {
  const list = responses.slice();
  let i = 0;
  return function () {
    if (i >= list.length) return list[list.length - 1];
    const r = list[i];
    i += 1;
    return r;
  };
}

function setupProvider(nextRespFn) {
  setProviderImplementations({
    openrouter: async function () {
      const r = await nextRespFn();
      return typeof r === "string" ? { text: r, model: "mock" } : r;
    },
  });
}

function setupMCQEnv(opts) {
  var count = opts && opts.count != null ? opts.count : 5;
  var attempts = opts && opts.attempts != null ? opts.attempts : 3;
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.MCQ_REQUESTED_COUNT = String(count);
  process.env.MCQ_MAX_ATTEMPTS = String(attempts);
  process.env.AI_RETRY_BASE_DELAY_MS = "0";
  process.env.AI_MAX_RETRIES = "0";
  DocumentChunk.find = function () {
    return {
      lean: async function () {
        return mockChunks();
      },
    };
  };
}

test("1. valid 5-question response accepted on first attempt", async function () {
  setupMCQEnv({ count: 5, attempts: 3 });
  var qs = [];
  for (var k = 1; k <= 5; k++) qs.push(makeQuestion(k));
  setupProvider(seq([makeMCQResponse(qs)]));

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(!!result.error, false);
  assert.equal(result.questions.length, 5);
  assert.equal(result.questions[0].correct, "A");
});

test("2. valid 3-question response accepted", async function () {
  setupMCQEnv({ count: 3, attempts: 3 });
  var qs = [];
  for (var k = 1; k <= 3; k++) qs.push(makeQuestion(k));
  setupProvider(seq([makeMCQResponse(qs)]));

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(!!result.error, false);
  assert.equal(result.questions.length, 3);
});

test("3. malformed JSON retries then succeeds on second attempt", async function () {
  setupMCQEnv({ count: 3, attempts: 3 });
  var good = [];
  for (var k = 1; k <= 3; k++) good.push(makeQuestion(k));
  setupProvider(seq(["not json at all {{{", makeMCQResponse(good)]));

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(
    !!result.error,
    false,
    "Expected success on retry, got: " + (result.error || ""),
  );
  assert.equal(result.questions.length, 3);
});

test("4. persistent malformed JSON leads to clear error", async function () {
  setupMCQEnv({ count: 2, attempts: 2 });
  setupProvider(seq(["garbage{{{", "still garbage"]));

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(!!result.error, true);
  assert.match(result.error, /invalid JSON/);
  assert.match(result.error, /after 2 attempts/);
});

test("5. only 1 question when 3 requested retries then succeeds", async function () {
  setupMCQEnv({ count: 3, attempts: 3 });
  var good = [];
  for (var k = 1; k <= 3; k++) good.push(makeQuestion(k));
  setupProvider(
    seq([makeMCQResponse([makeQuestion(1)]), makeMCQResponse(good)]),
  );

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(
    !!result.error,
    false,
    "Expected success on retry, got: " + (result.error || ""),
  );
  assert.equal(result.questions.length, 3);
});

test("6. repeatedly fewer than requested leads to clear error not partial", async function () {
  setupMCQEnv({ count: 3, attempts: 2 });
  setupProvider(
    seq([
      makeMCQResponse([makeQuestion(1)]),
      makeMCQResponse([makeQuestion(1), makeQuestion(2)]),
    ]),
  );

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(!!result.error, true);
  assert.match(result.error, /expected 3 questions/);
  assert.match(result.error, /after 2 attempts/);
});

test("7. invalid correct answer Z retries then succeeds", async function () {
  setupMCQEnv({ count: 2, attempts: 3 });
  var bad = [makeQuestion(1), makeQuestion(2, { correct: "Z" })];
  var good = [makeQuestion(1), makeQuestion(2)];
  setupProvider(seq([makeMCQResponse(bad), makeMCQResponse(good)]));

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(
    !!result.error,
    false,
    "Expected success on retry, got: " + (result.error || ""),
  );
  assert.equal(result.questions.length, 2);
});

test("8. persistent invalid correct answer mentions correct field in error", async function () {
  setupMCQEnv({ count: 2, attempts: 2 });
  var bad = [makeQuestion(1), makeQuestion(2, { correct: 7 })];
  setupProvider(seq([makeMCQResponse(bad), makeMCQResponse(bad)]));

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(!!result.error, true);
  assert.match(result.error, /correct must be A, B, C, or D/);
});

test("9. fewer than 4 options retries then succeeds", async function () {
  setupMCQEnv({ count: 2, attempts: 3 });
  var bad = [
    makeQuestion(1, { options: ["A) only", "B) only", "C) only"] }),
    makeQuestion(2),
  ];
  var good = [makeQuestion(1), makeQuestion(2)];
  setupProvider(seq([makeMCQResponse(bad), makeMCQResponse(good)]));

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(
    !!result.error,
    false,
    "Expected success on retry, got: " + (result.error || ""),
  );
  assert.equal(result.questions[0].options.length, 4);
});

test("10. persistent fewer than 4 options mentions options length in error", async function () {
  setupMCQEnv({ count: 2, attempts: 2 });
  var bad = [
    makeQuestion(1, { options: ["A) one", "B) two"] }),
    makeQuestion(2),
  ];
  setupProvider(seq([makeMCQResponse(bad), makeMCQResponse(bad)]));

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(!!result.error, true);
  assert.match(result.error, /options must have exactly 4/);
});

test("11. duplicate questions detected as validation error", async function () {
  setupMCQEnv({ count: 2, attempts: 2 });
  var dupes = [
    makeQuestion(1, { question: "What is the capital of France?" }),
    makeQuestion(2, { question: "What is the capital of France?!" }),
  ];
  setupProvider(seq([makeMCQResponse(dupes), makeMCQResponse(dupes)]));

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(!!result.error, true);
  assert.match(result.error, /duplicates question\[0\]/);
});

test("12. duplicates on first attempt then clean set accepted on retry", async function () {
  setupMCQEnv({ count: 2, attempts: 3 });
  var dupes = [
    makeQuestion(1, { question: "Same q?" }),
    makeQuestion(2, { question: "Same q?" }),
  ];
  var good = [
    makeQuestion(1, { question: "First unique?" }),
    makeQuestion(2, { question: "Second unique?" }),
  ];
  setupProvider(seq([makeMCQResponse(dupes), makeMCQResponse(good)]));

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(
    !!result.error,
    false,
    "Expected success on retry, got: " + (result.error || ""),
  );
  assert.equal(result.questions.length, 2);
});

test("13. existing MCQ parsing compat single-question legacy shape with count=1", async function () {
  setupMCQEnv({ count: 1, attempts: 2 });
  var legacy = JSON.stringify({
    questions: [
      {
        question: "What powers photosynthesis?",
        options: ["A) Light", "B) Sound", "C) Heat", "D) Motion"],
        correct: "A",
        explanation: "Light energy powers the process.",
        citation: "notes.pdf",
      },
    ],
  });
  setupProvider(seq([legacy]));

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(!!result.error, false);
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].correct, "A");
  assert.deepEqual(result.questions[0].options, [
    "A) Light",
    "B) Sound",
    "C) Heat",
    "D) Motion",
  ]);
});

test("14. markdown code fence wrapping still parses cleanly", async function () {
  setupMCQEnv({ count: 2, attempts: 1 });
  var inner = makeMCQResponse([makeQuestion(1), makeQuestion(2)]);
  setupProvider(seq(["```json\n" + inner + "\n```"]));

  var result = await generateMCQs("sid", "uid", "Bio");
  assert.equal(
    !!result.error,
    false,
    "Markdown fence stripping failed: " + (result.error || ""),
  );
  assert.equal(result.questions.length, 2);
});

test("15. short-answer generation preserved unchanged", async function () {
  DocumentChunk.find = function () {
    return {
      lean: async function () {
        return mockChunks();
      },
    };
  };
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.AI_MAX_RETRIES = "0";
  setProviderImplementations({
    openrouter: async function () {
      return {
        text: JSON.stringify({
          questions: [
            {
              question: "What powers photosynthesis?",
              answer: "Light energy powers photosynthesis in plants.",
              citation: "notes.pdf",
            },
          ],
        }),
        model: "mock",
      };
    },
  });

  var result = await generateShortAnswer("subject", "user", "Biology");
  assert.equal(
    result.questions[0].answer,
    "Light energy powers photosynthesis in plants.",
  );
});

test("16. RAG answer generation preserved unchanged", async function () {
  DocumentChunk.find = function () {
    return {
      lean: async function () {
        return [
          {
            originalName: "notes.pdf",
            content: "Photosynthesis uses light energy.",
            chunkIndex: 0,
          },
        ];
      },
    };
  };
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.AI_MAX_RETRIES = "0";
  setProviderImplementations({
    openrouter: async function () {
      return {
        text: "The notes say light energy powers photosynthesis.",
        model: "mock",
      };
    },
  });

  var conv = [{ role: "user", text: "What powers photosynthesis?" }];
  var result = await answerQuestion("subject", "user", conv, "Biology");
  assert.equal(
    result.answer,
    "The notes say light energy powers photosynthesis.",
  );
  assert.equal(result.citations[0].filename, "notes.pdf");
});
