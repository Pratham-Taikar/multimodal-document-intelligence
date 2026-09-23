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

function sanitizeAnswer(text) {
  if (!text) return '';
  
  // Remove Markdown symbols: **, __, _, ~, ` etc.
  let sanitized = text.replace(/[*_~`]/g, '');
  
  // Remove extra line breaks for a single-sentence style
  sanitized = sanitized.replace(/\n+/g, ' ').trim();
  
  return sanitized;
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

    // Build conversation-aware prompt
    let prompt = `You are an AI tutor. Continue the conversation based on the context below.\n\n`;

    conversation.forEach(msg => {
      if (msg.role === "user") prompt += `User: ${msg.text}\n`;
      else if (msg.role === "assistant") prompt += `Assistant: ${msg.text}\n`;
    });

    prompt += "\nContext:\n" + (context || "No notes available") + "\n\nAssistant:";

    const rawAnswer = await generateText(prompt, {
      models: { gemini: process.env.GEMINI_MODEL || 'gemini-2.5-flash' }
    });
    const answer = sanitizeAnswer(rawAnswer);

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
