const DocumentChunk = require('../models/DocumentChunk');
const User = require('../models/User');
const { generateText } = require('./aiService');

/**
 * Generate grounded summary for a subject (short, medium, or detailed)
 */
async function generateSummary(subjectId, userId, summaryType = 'medium') {
  try {
    const allChunks = await DocumentChunk.find({ subjectId, userId }).lean();
    if (!allChunks || allChunks.length === 0) {
      return { error: 'No documents uploaded for this subject yet.' };
    }

    const user = await User.findById(userId).lean().catch(() => null);
    const userApiKey = user?.customApiKey;
    const userGroqApiKey = user?.customGroqApiKey;

    // Select representative chunks (up to 12 chunks)
    const chunks = allChunks.slice(0, 12);
    const context = chunks.map((c, i) => `[Source: ${c.originalName} - Section ${c.chunkIndex + 1}]\n${c.content}`).join('\n\n');

    let styleInstruction = '';
    if (summaryType === 'short') {
      styleInstruction = `Create an EXECUTIVE REVISION SUMMARY:
- 3 to 5 high-impact bullet points capturing core essentials
- 1 single-sentence "Core Takeaway"
- Keep it concise, rapid, and test-oriented.`;
    } else if (summaryType === 'detailed') {
      styleInstruction = `Create a COMPREHENSIVE STUDY MASTER GUIDE:
- Overview & Background
- Core Concepts & Detailed Explanations
- Critical Formulas, Rules, or Definitions (if applicable)
- Key Relationships & Practical Examples
- Exam Revision Checklist`;
    } else {
      styleInstruction = `Create a CONCEPTUAL STUDY SUMMARY:
- High-level Concept Overview
- Key Principles & Frameworks
- Crucial Definitions & Terminology
- Common Pitfalls or Exam Focus Points`;
    }

    const prompt = `You are an elite academic AI tutor grounding your response STRICTLY on the notes provided below.

STUDY CONTEXT:
${context}

TASK:
${styleInstruction}

FORMAT RULES:
1. Base all points directly on the provided context.
2. If certain facts are not present, do not invent them.
3. Use clean markdown formatting (headings, bullet points, bold key terms).
4. Include source citations in brackets (e.g. [Document.pdf]).`;

    const summary = await generateText(prompt, {
      apiKey: userApiKey,
      groqApiKey: userGroqApiKey,
      models: {
        gemini: process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash',
        groq: 'llama-3.3-70b-versatile'
      }
    });

    const sources = [...new Set(chunks.map(c => c.originalName))];

    return {
      type: summaryType,
      summary,
      sources,
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('Error generating summary:', error);
    return { error: error.message };
  }
}

module.exports = {
  generateSummary
};
