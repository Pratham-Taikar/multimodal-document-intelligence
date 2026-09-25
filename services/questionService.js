const DocumentChunk = require("../models/DocumentChunk");
const { generateText } = require("./aiService");

const MCQ_REQUESTED_COUNT_DEFAULT = 5;
const MCQ_MAX_ATTEMPTS_DEFAULT = 3;
const MCQ_VALID_CORRECT_VALUES = new Set(["A", "B", "C", "D"]);

function cleanMCQText(raw) {
  if (typeof raw !== "string") throw new Error("MCQ response is not a string");
  let cleanText = raw.trim();
  if (cleanText.length === 0) throw new Error("MCQ response is empty");
  cleanText = cleanText.replace(/```json/gi, "");
  cleanText = cleanText.replace(/```/g, "");
  cleanText = cleanText.replace(/^\s*[^{]*/, "");
  cleanText = cleanText.replace(/[^}]*\s*$/, "");
  return cleanText;
}

function normalizeQuestionText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function validateMCQQuestions(questions, requestedCount) {
  if (!Array.isArray(questions)) {
    return ["questions is not an array"];
  }
  if (questions.length !== requestedCount) {
    return [`expected ${requestedCount} questions but got ${questions.length}`];
  }

  const errors = [];
  const seenTexts = new Map();

  questions.forEach((q, idx) => {
    const label = `question[${idx}]`;
    if (!q || typeof q !== "object") {
      errors.push(`${label} is not an object`);
      return;
    }

    const questionText =
      typeof q.question === "string" ? q.question.trim() : "";
    if (!questionText) {
      errors.push(`${label}.question is missing or empty`);
    } else {
      const key = normalizeQuestionText(questionText);
      if (key.length === 0) {
        errors.push(`${label}.question is empty after normalization`);
      } else if (seenTexts.has(key)) {
        errors.push(
          `${label}.question duplicates question[${seenTexts.get(key)}]`,
        );
      } else {
        seenTexts.set(key, idx);
      }
    }

    if (!Array.isArray(q.options)) {
      errors.push(`${label}.options is not an array`);
    } else if (q.options.length !== 4) {
      errors.push(
        `${label}.options must have exactly 4 items (got ${q.options.length})`,
      );
    } else {
      q.options.forEach((opt, optIdx) => {
        if (typeof opt !== "string" || !opt.trim()) {
          errors.push(`${label}.options[${optIdx}] is missing or empty`);
        }
      });
    }

    if (!MCQ_VALID_CORRECT_VALUES.has(q.correct)) {
      if (typeof q.correct === 'string') {
        const match = q.correct.match(/[A-D]/i);
        if (match) {
          q.correct = match[0].toUpperCase();
        } else {
          errors.push(`${label}.correct must be A, B, C, or D (got ${JSON.stringify(q.correct)})`);
        }
      } else {
        errors.push(`${label}.correct must be A, B, C, or D (got ${JSON.stringify(q.correct)})`);
      }
    }

    const explanation =
      typeof q.explanation === "string" ? q.explanation.trim() : "";
    if (!explanation) {
      q.explanation = "Based on provided study notes.";
    }

    const citation = typeof q.citation === "string" ? q.citation.trim() : "";
    if (!citation) {
      q.citation = "notes.pdf";
    }
  });

  return errors;
}

function buildMCQPrompt(context, requestedCount) {
  return `You are creating practice questions from study notes.

Context:
${context}

Generate exactly ${requestedCount} multiple-choice questions based on the notes above.

Return ONLY a JSON object in this format (no markdown, no extra text):
{
  "questions": [
    {
      "question": "question text here",
      "options": ["A) first option", "B) second option", "C) third option", "D) fourth option"],
      "correct": "A",
      "explanation": "brief explanation here",
      "citation": "filename.pdf"
    }
  ]
}

Rules:
1. Base questions strictly on the provided notes
2. Include exactly 4 options (A, B, C, D)
3. Mark correct answer as A, B, C, or D
4. Keep explanations brief
5. Cite the source filename
6. Return exactly ${requestedCount} distinct questions. Fewer than ${requestedCount} is not acceptable.
7. Every question must have a unique question text.`;
}

async function generateMCQs(subjectId, userId, subjectName) {
  try {
    console.log("=== MCQ Generation Started ===");

    const allChunks = await DocumentChunk.find({
      subjectId,
      userId,
    }).lean();

    if (allChunks.length === 0) {
      return { error: "No documents found for this subject" };
    }

    const user = await require("../models/User").findById(userId).lean().catch(() => null);
    const userApiKey = user?.customApiKey;

    const relevantChunks = allChunks.slice(0, 10);
    const context = relevantChunks
      .map(
        (chunk, idx) =>
          `Source ${idx + 1} from ${chunk.originalName}:\n${chunk.content}`,
      )
      .join("\n\n");

    const requestedCountRaw = Number(
      process.env.MCQ_REQUESTED_COUNT || MCQ_REQUESTED_COUNT_DEFAULT,
    );
    const requestedCount = Math.max(
      1,
      Math.min(
        20,
        Number.isInteger(requestedCountRaw)
          ? requestedCountRaw
          : MCQ_REQUESTED_COUNT_DEFAULT,
      ),
    );
    const maxAttempts = Math.max(
      1,
      Math.min(
        5,
        Number(process.env.MCQ_MAX_ATTEMPTS) || MCQ_MAX_ATTEMPTS_DEFAULT,
      ),
    );

    let lastErrors = [];
    let lastRaw = "";

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      console.log(`MCQ generation attempt ${attempt + 1}/${maxAttempts}`);
      const prompt = buildMCQPrompt(context, requestedCount);

      let text;
      try {
        text = await generateText(prompt, {
          apiKey: userApiKey,
          models: {
            gemini: process.env.GEMINI_MCQ_MODEL || "gemini-1.5-flash",
          },
        });
      } catch (providerError) {
        lastErrors = [`AI provider error: ${providerError.message}`];
        if (attempt === maxAttempts - 1) break;
        continue;
      }

      try {
        lastRaw = text;
        const cleanText = cleanMCQText(text);
        const parsed = JSON.parse(cleanText);
        const questions =
          parsed && Array.isArray(parsed.questions)
            ? parsed.questions
            : Array.isArray(parsed)
              ? parsed
              : null;
        const validationErrors = validateMCQQuestions(
          questions,
          requestedCount,
        );
        if (validationErrors.length === 0) {
          console.log("=== MCQ Generation Success ===");
          return { questions };
        }
        lastErrors = validationErrors;
      } catch (parseError) {
        lastErrors = [`invalid JSON: ${parseError.message}`];
      }

      if (attempt < maxAttempts - 1) {
        const hint = lastErrors
          .slice(0, 3)
          .map((e, i) => `${i + 1}. ${e}`)
          .join("; ");
        console.warn(`MCQ attempt ${attempt + 1} rejected. Issues: ${hint}`);
      }
    }

    const summary = lastErrors.join("; ");
    const msg = `Unable to generate exactly ${requestedCount} valid MCQs after ${maxAttempts} attempts. Last issues: ${summary}`;
    console.error("Error in generateMCQs:", msg);
    return { error: msg };
  } catch (error) {
    console.error("Error in generateMCQs:", error);
    return {
      error: error.message,
    };
  }
}

async function generateShortAnswer(subjectId, userId, subjectName) {
  try {
    console.log("=== Short Answer Generation Started ===");

    const allChunks = await DocumentChunk.find({
      subjectId,
      userId,
    }).lean();

    if (allChunks.length === 0) {
      return { error: "No documents found for this subject" };
    }

    const user = await require("../models/User").findById(userId).lean().catch(() => null);
    const userApiKey = user?.customApiKey;

    const relevantChunks = allChunks.slice(0, 10);

    const context = relevantChunks
      .map(
        (chunk, idx) =>
          `Source ${idx + 1} from ${chunk.originalName}:\n${chunk.content}`,
      )
      .join("\n\n");

    const prompt = `You are creating practice questions from study notes.

Context:
${context}

Generate exactly 3 short-answer questions with detailed model answers based on the notes above.

Return ONLY a JSON object in this format (no markdown, no extra text):
{
  "questions": [
    {
      "question": "question text here",
      "answer": "detailed model answer in 3-5 sentences",
      "citation": "filename.pdf"
    }
  ]
}

Rules:
1. Base questions strictly on the provided notes
2. Provide detailed answers (3-5 sentences)
3. Cite the source filename`;

    const text = await generateText(prompt, {
      apiKey: userApiKey,
      models: {
        gemini: process.env.GEMINI_SHORT_ANSWER_MODEL || "gemini-1.5-flash",
      },
    });

    let cleanText = text.trim();
    cleanText = cleanText.replace(/```json/g, "");
    cleanText = cleanText.replace(/```/g, "");
    cleanText = cleanText.replace(/^\s*[^{]*/, "");
    cleanText = cleanText.replace(/[^}]*\s*$/, "");

    const parsed = JSON.parse(cleanText);

    console.log("=== Short Answer Generation Success ===");
    return parsed;
  } catch (error) {
    console.error("Error in generateShortAnswer:", error);
    return {
      error: error.message,
    };
  }
}

module.exports = {
  generateMCQs,
  generateShortAnswer,
};
