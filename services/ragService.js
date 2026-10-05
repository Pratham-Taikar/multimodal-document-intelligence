const DocumentChunk = require('../models/DocumentChunk');
const { generateText } = require('./aiService');

function calculateSimilarity(query, text) {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const textWords = text.toLowerCase().split(/\s+/);
  
  let matches = 0;
  for (const word of queryWords) {
    if (textWords.some(tw => tw.includes(word) || word.includes(tw))) {
      matches++;
    }
  }
  
  return queryWords.length > 0 ? matches / queryWords.length : 0;
}

async function retrieveRelevantChunks(subjectId, userId, query) {
  const allChunks = await DocumentChunk.find({ 
    subjectId, 
    userId 
  }).lean();

  if (allChunks.length === 0) {
    return [];
  }

  const chunksWithScore = allChunks.map(chunk => ({
    ...chunk,
    score: calculateSimilarity(query, chunk.content)
  }));

  chunksWithScore.sort((a, b) => b.score - a.score);

  return chunksWithScore.slice(0, 5);
}

function getConfidence(chunks) {
  if (chunks.length === 0) return 'Low';
  
  const avgScore = chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length;
  
  if (avgScore > 0.5) return 'High';
  if (avgScore > 0.3) return 'Medium';
  return 'Low';
}

function formatCleanAnswer(text) {
  if (!text) return '';

  let formatted = String(text).trim();

  // If text has inline markdown headings without newlines (e.g., "word --- ### 2. Heading"), fix spacing
  formatted = formatted.replace(/---\s*(#{1,4}\s+)/g, '\n\n---\n\n$1');
  formatted = formatted.replace(/([^\n])\s*(#{1,4}\s+)/g, '$1\n\n$2');

  // Convert raw ### headings into clean bold headings with proper spacing if requested
  formatted = formatted.replace(/^#{1,4}\s+(.+)$/gm, '\n**$1**\n');

  // Ensure bullet points have clean newlines
  formatted = formatted.replace(/([^\n])\s*([•\-])\s+/g, '$1\n\n- ');

  // Clean excessive multiple line breaks (normalize to double line breaks)
  formatted = formatted.replace(/\n{3,}/g, '\n\n').trim();

  return formatted;
}

async function answerQuestion(subjectId, userId, conversation, subjectName) {
  try {
    // Get last user question for RAG search
    const lastUserMsg = conversation.slice().reverse().find(msg => msg.role === "user");
    const lastQuestion = lastUserMsg ? lastUserMsg.text : '';

    // Retrieve relevant chunks from notes
    const relevantChunks = await retrieveRelevantChunks(subjectId, userId, lastQuestion);

    if (relevantChunks.length === 0 || relevantChunks[0].score < 0.15) {
      return {
        answer: `Not found in your notes for ${subjectName}`,
        confidence: 'Low',
        citations: [],
        evidence: []
      };
    }

    const confidence = getConfidence(relevantChunks);

    // Build context string
    const context = relevantChunks.map((chunk, idx) =>
      `Source ${idx + 1} from ${chunk.originalName} section ${chunk.chunkIndex + 1}:\n${chunk.content}`
    ).join('\n\n');

    // Build conversation-aware prompt with clean formatting & diagram rules
    let prompt = `You are AskMyNotes, an elite AI tutor providing visually appealing, structured, and strictly grounded answers.

FORMATTING & VISUAL PRESENTATION RULES:
1. Base your answer STRICTLY on the provided context. Never invent facts.
2. Structure your response with clean visual appeal:
   - Use clean, distinct paragraphs with proper line spacing.
   - Use clean bullet points ("- ") for lists, mechanisms, and key takeaways.
   - Bold key technical terms when first introduced.
   - DO NOT output messy raw hashtag symbols (e.g. avoid raw inline "###", "##"). Use clean bold headings like "**1. Topic Title**".
   - If mathematical formulas appear, write them clearly (e.g. 2^r >= m + r + 1) without broken delimiters.

DIAGRAM & VISUAL GROUNDING RULE:
- If any diagram, figure, flowchart, architecture, or visual illustration is mentioned or depicted in the source notes:
  1. Specifically cite it: "**📊 Diagram Reference:** [Document Name, Figure/Diagram Name or Section Number]".
  2. Provide a dedicated section:
     "**📊 Diagram Analysis & Explanation:**"
     - **Visual Structure & Components:** Describe the entities, blocks, and symbols shown.
     - **Step-by-Step Flow:** Explain how data, control, or packets move through the diagram.
     - **Takeaway:** Why this diagram is important to understand the concept.

CONVERSATION HISTORY:\n`;

    conversation.forEach(msg => {
      if (msg.role === "user") prompt += `User: ${msg.text}\n`;
      else if (msg.role === "assistant") prompt += `Assistant: ${msg.text}\n`;
    });

    prompt += "\nCONTEXT NOTES:\n" + (context || "No notes available") + "\n\nAssistant (structured, visually clean, with diagram citations if relevant):";

    const user = await require('../models/User').findById(userId).lean().catch(() => null);
    const userApiKey = user?.customApiKey;
    const userGroqApiKey = user?.customGroqApiKey;

    const rawAnswer = await generateText(prompt, {
      apiKey: userApiKey,
      groqApiKey: userGroqApiKey,
      models: { gemini: process.env.GEMINI_MODEL || 'gemini-1.5-flash' }
    });
    const answer = formatCleanAnswer(rawAnswer);

    // Build citations and evidence
    const citations = relevantChunks.map(chunk => ({
      filename: chunk.originalName,
      chunkIndex: chunk.chunkIndex + 1,
      score: chunk.score.toFixed(3)
    }));

    const evidence = relevantChunks.slice(0, 3).map(chunk => ({
      text: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
      source: chunk.originalName,
      chunk: chunk.chunkIndex + 1
    }));

    return {
      answer,
      confidence,
      citations,
      evidence
    };

  } catch (error) {
    console.error('Error in answerQuestion:', error);
    return {
      answer: `Error: ${error.message}`,
      confidence: 'Low',
      citations: [],
      evidence: []
    };
  }
}

module.exports = {
  answerQuestion
};
