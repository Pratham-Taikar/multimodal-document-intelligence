const assert = require("node:assert/strict");
const { test, afterEach } = require("node:test");
const DocumentChunk = require("../models/DocumentChunk");
const { setProviderImplementations } = require("../services/aiService");
const { analyzeResearchPaper } = require("../services/researchPaperService");

const originalFind = DocumentChunk.find;
const originalEnv = { ...process.env };

afterEach(() => {
  DocumentChunk.find = originalFind;
  for (const k of Object.keys(process.env)) {
    if (!(k in originalEnv)) delete process.env[k];
  }
  Object.assign(process.env, originalEnv);
  setProviderImplementations({});
});

function mockPaperChunks() {
  return [
    { originalName: "attention_is_all_you_need.pdf", chunkIndex: 0, content: "We propose the Transformer, a model architecture eschewing recurrence and instead relying entirely on an attention mechanism to draw global dependencies between input and output. Figure 1 shows the model architecture." },
    { originalName: "attention_is_all_you_need.pdf", chunkIndex: 1, content: "The Transformer allows for significantly more parallelization and can reach a new state of the art in translation quality after being trained for as little as twelve hours on eight P100 GPUs." }
  ];
}

test("1. analyzeResearchPaper returns breakdown with diagram grounding", async () => {
  DocumentChunk.find = () => ({
    lean: async () => mockPaperChunks()
  });

  process.env.AI_PROVIDER_ORDER = "groq";
  process.env.GROQ_API_KEY = "mock-groq-key";

  setProviderImplementations({
    groq: async () => ({
      text: "### Executive Research Summary\nThe paper introduces the Transformer architecture relying solely on self-attention.\n\n**📊 Diagram Reference:** [attention_is_all_you_need.pdf, Figure 1: The Transformer - model architecture]\n**📊 Diagram Analysis & Explanation:** Multi-Head Attention connected to Feed-Forward networks."
    })
  });

  const res = await analyzeResearchPaper("sub123", "user123", "breakdown");
  assert.equal(res.success, true);
  assert.equal(res.mode, "breakdown");
  assert.equal(res.filename, "attention_is_all_you_need.pdf");
  assert.equal(res.result.includes("Diagram Reference"), true);
});

test("2. analyzeResearchPaper handles citations mode cleanly", async () => {
  DocumentChunk.find = () => ({
    lean: async () => mockPaperChunks()
  });

  process.env.AI_PROVIDER_ORDER = "groq";
  process.env.GROQ_API_KEY = "mock-groq-key";

  setProviderImplementations({
    groq: async () => ({
      text: "```bibtex\n@article{vaswani2017attention,\n  title={Attention is all you need},\n  author={Vaswani, Ashish et al.},\n  year={2017}\n}\n```"
    })
  });

  const res = await analyzeResearchPaper("sub123", "user123", "citations");
  assert.equal(res.success, true);
  assert.equal(res.mode, "citations");
  assert.equal(res.result.includes("@article"), true);
});

test("3. analyzeResearchPaper fails gracefully when no document exists", async () => {
  DocumentChunk.find = () => ({
    lean: async () => []
  });

  const res = await analyzeResearchPaper("sub_empty", "user123", "methodology");
  assert.equal(!!res.error, true);
  assert.equal(res.error.includes("No documents uploaded"), true);
});
