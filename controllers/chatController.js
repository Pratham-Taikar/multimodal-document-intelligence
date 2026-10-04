// controllers/chatController.js
const Subject = require("../models/Subject");
const DocumentChunk = require("../models/DocumentChunk");
const { answerQuestion } = require("../services/ragService");

exports.sendMessage = async (req, res) => {
    try {
        const { chatId, conversation } = req.body;
        const userId = req.session.userId;

        // Validate conversation array
        if (
            !conversation ||
            !Array.isArray(conversation) ||
            conversation.length === 0
        ) {
            return res.status(400).json({
                answer: "Conversation array is required",
                confidence: "Low",
                citations: [],
                evidence: [],
            });
        }

        // Find subject for this user
        const subject = await Subject.findOne({
            _id: chatId,
            userId,
        });

        if (!subject) {
            return res.status(404).json({
                answer: "Subject not found",
                confidence: "Low",
                citations: [],
                evidence: [],
            });
        }

        // Ensure there are document chunks uploaded
        const chunkCount = await DocumentChunk.countDocuments({
            subjectId: chatId,
            userId,
        });

        if (chunkCount === 0) {
            return res.json({
                answer: "Please upload notes before asking questions. No documents found for this subject.",
                confidence: "Low",
                citations: [],
                evidence: [],
            });
        }

        // Call service with full conversation array
        const result = await answerQuestion(
            chatId,
            userId,
            conversation, // <-- pass entire conversation for context
            subject.name,
        );

        // Return structured JSON for frontend
        res.json({
            answer: result.answer || "",
            confidence: result.confidence || "Unknown",
            citations: result.citations || [],
            evidence: result.evidence || [],
        });
    } catch (error) {
        console.error("Chat error:", error);
        res.json({
            answer: `Error: ${error.message}`,
            confidence: "Low",
            citations: [],
            evidence: [],
        });
    }
};

module.exports = exports;