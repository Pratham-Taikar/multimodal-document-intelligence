const assert = require("node:assert/strict");
const { test, afterEach } = require("node:test");
const DocumentChunk = require("../models/DocumentChunk");
const { setProviderImplementations } = require("../services/aiService");
const { generateSummary } = require("../services/summaryService");
const { generateFlashcards } = require("../services/flashcardService");

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

function mockChunks() {
  return [
    { originalName: "lecture1.pdf", chunkIndex: 0, content: "Virtual memory maps virtual addresses to physical frames." },
    { originalName: "slides.pptx", chunkIndex: 1, content: "Paging uses page tables and TLBs to accelerate translation." }
  ];
}

test("1. generateSummary returns structured study summary with verified sources", async () => {
  DocumentChunk.find = () => ({
    lean: async () => mockChunks()
  });

  process.env.AI_PROVIDER_ORDER = "groq";
  process.env.GROQ_API_KEY = "mock-groq-key";

  setProviderImplementations({
    groq: async () => ({
      text: "### Summary\n- Virtual memory enables memory isolation.\n- TLBs accelerate address translation."
    })
  });

  const res = await generateSummary("sub123", "user123", "medium");
  assert.equal(res.type, "medium");
  assert.equal(res.summary.includes("Virtual memory"), true);
  assert.deepEqual(res.sources, ["lecture1.pdf", "slides.pptx"]);
});

test("2. generateSummary returns error when no documents exist", async () => {
  DocumentChunk.find = () => ({
    lean: async () => []
  });

  const res = await generateSummary("sub_empty", "user123");
  assert.equal(!!res.error, true);
  assert.equal(res.error.includes("No documents uploaded"), true);
});

test("3. generateFlashcards returns valid card deck with front and back fields", async () => {
  DocumentChunk.find = () => ({
    lean: async () => mockChunks()
  });

  process.env.AI_PROVIDER_ORDER = "groq";
  process.env.GROQ_API_KEY = "mock-groq-key";

  const mockCards = [
    {
      id: 1,
      front: "What is a TLB?",
      back: "A translation lookaside buffer caches recent virtual-to-physical address mappings.",
      category: "Hardware",
      citation: "slides.pptx"
    },
    {
      id: 2,
      front: "Define Paging",
      back: "A memory management scheme dividing physical memory into fixed-sized blocks.",
      category: "Concept",
      citation: "lecture1.pdf"
    }
  ];

  setProviderImplementations({
    groq: async () => ({
      text: JSON.stringify({ flashcards: mockCards })
    })
  });

  const res = await generateFlashcards("sub123", "user123", 2);
  assert.equal(res.count, 2);
  assert.equal(res.flashcards[0].front, "What is a TLB?");
  assert.equal(res.flashcards[0].category, "Hardware");
  assert.equal(res.flashcards[1].front, "Define Paging");
});

test("4. generateFlashcards handles markdown code fence wrapping cleanly", async () => {
  DocumentChunk.find = () => ({
    lean: async () => mockChunks()
  });

  process.env.AI_PROVIDER_ORDER = "groq";
  process.env.GROQ_API_KEY = "mock-groq-key";

  const jsonContent = JSON.stringify({
    flashcards: [
      { id: 1, front: "Cache Miss", back: "Data not found in cache.", category: "Memory", citation: "notes.pdf" }
    ]
  });

  setProviderImplementations({
    groq: async () => ({
      text: "```json\n" + jsonContent + "\n```"
    })
  });

  const res = await generateFlashcards("sub123", "user123", 1);
  assert.equal(res.count, 1);
  assert.equal(res.flashcards[0].front, "Cache Miss");
});
