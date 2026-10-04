const DocumentChunk = require('../models/DocumentChunk');
const User = require('../models/User');
const { generateText } = require('./aiService');

/**
 * Generate interactive study flashcards
 */
async function generateFlashcards(subjectId, userId, count = 8) {
  try {
    const allChunks = await DocumentChunk.find({ subjectId, userId }).lean();
    if (!allChunks || allChunks.length === 0) {
      return { error: 'No documents uploaded for this subject yet.' };
    }

    const user = await User.findById(userId).lean().catch(() => null);
    const userApiKey = user?.customApiKey;
    const userGroqApiKey = user?.customGroqApiKey;

    const chunks = allChunks.slice(0, 10);
    const context = chunks.map((c, i) => `[Source ${i + 1}: ${c.originalName}]\n${c.content}`).join('\n\n');

    const prompt = `You are an expert educator creating high-retention study flashcards strictly from the academic notes below.

CONTEXT:
${context}

TASK:
Generate exactly ${count} flashcards for high-yield study revision.
Each flashcard must contain:
1. "front": A clear concept, term, or probing question (e.g. "What is Amdahl's Law?", "Define Polymorphism")
2. "back": A clear, concise, 2-3 sentence answer/explanation.
3. "category": Topic tag (e.g. "Definition", "Formula", "Mechanism", "Concept")
4. "citation": Source filename

Return ONLY valid JSON matching this schema (no markdown formatting, no extra commentary):
{
  "flashcards": [
    {
      "id": 1,
      "front": "Front of card (Concept or Question)",
      "back": "Back of card (Clear explanation and key details)",
      "category": "Definition",
      "citation": "Source.pdf"
    }
  ]
}`;

    const raw = await generateText(prompt, {
      apiKey: userApiKey,
      groqApiKey: userGroqApiKey,
      models: {
        gemini: process.env.GEMINI_FLASHCARD_MODEL || 'gemini-2.5-flash',
        groq: 'llama-3.1-8b-instant'
      }
    });

    let clean = raw.trim();
    clean = clean.replace(/```json/gi, '').replace(/```/g, '');
    clean = clean.replace(/^\s*[^{]*/, '').replace(/[^}]*\s*$/, '');

    const parsed = JSON.parse(clean);
    const flashcards = parsed.flashcards || (Array.isArray(parsed) ? parsed : []);

    return {
      flashcards,
      count: flashcards.length,
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('Error generating flashcards:', error);
    return { error: error.message };
  }
}

module.exports = {
  generateFlashcards
};
