const DocumentChunk = require('../models/DocumentChunk');
const User = require('../models/User');
const { generateText } = require('./aiService');

/**
 * Analyze research papers grounded in uploaded subject documents.
 * Modes: 'breakdown', 'methodology', 'critique', 'citations'
 */
async function analyzeResearchPaper(subjectId, userId, mode = 'breakdown') {
  try {
    // Prioritize dedicated research paper uploaded specifically in Research Studio
    let allChunks = await DocumentChunk.find({ subjectId, userId, isResearchPaper: true }).lean();
    if (!allChunks || allChunks.length === 0) {
      allChunks = await DocumentChunk.find({ subjectId, userId }).lean();
    }
    if (!allChunks || allChunks.length === 0) {
      return { error: 'No documents uploaded for this subject yet. Please upload a research paper (PDF, DOCX).' };
    }

    const user = await User.findById(userId).lean().catch(() => null);
    const userApiKey = user?.customApiKey;
    const userGroqApiKey = user?.customGroqApiKey;

    // Use up to 14 representative chunks
    const chunks = allChunks.slice(0, 14);
    const context = chunks.map((c, i) => `[Source: ${c.originalName} - Section ${c.chunkIndex + 1}]\n${c.content}`).join('\n\n');

    let modePrompt = '';
    if (mode === 'methodology') {
      modePrompt = `You are a Principal AI & Systems Research Scientist. Perform an in-depth METHODOLOGICAL & ARCHITECTURAL DEEP-DIVE into this paper.

Structure your analysis with these clear sections:
1. Proposed Algorithm & Architectural Pipeline (Step-by-step breakdown of how the method executes)
2. Mathematical Formulations & Theoretical Foundations (Core equations, loss functions, or mathematical properties described)
3. 📊 Visual Architecture & Diagram Analysis:
   - Identify any architecture diagram, flowchart, pipeline, or schematic mentioned in the text.
   - Specifically cite it: "**📊 Visual Architecture Reference:** [Document, Figure/Diagram Name]"
   - Provide a separate breakdown of: (a) Input representations, (b) intermediate processing layers/modules, (c) output/decision boundaries.
4. Implementation Details & Hyperparameters (Optimization algorithms, learning rates, hardware, frameworks mentioned).`;
    } else if (mode === 'critique') {
      modePrompt = `You are an expert Area Chair and Senior Reviewer for top peer-reviewed conferences (NeurIPS/ICLR/IEEE/ACM). Perform a rigorous CRITICAL PEER-REVIEW CRITIQUE of this research paper.

Structure your critique with these clear sections:
1. Summary of Contributions (Concise 2-sentence synopsis of what the paper claims)
2. Key Strengths & Novelty (Methodological rigor, empirical thoroughness, clarity)
3. Critical Weaknesses & Gaps (Missing baseline comparisons, potential benchmark overfitting, unaddressed edge cases)
4. Threats to Validity (Internal validity, dataset bias, generalizability, scalability)
5. Reviewer Recommendation & Questions for the Authors (Score: Accept/Weak Accept/Revise, plus 3 targeted defense questions).`;
    } else if (mode === 'citations') {
      modePrompt = `You are an academic bibliography specialist. Generate ACCURATE CITATIONS & BIBLIOGRAPHY EXPORTS based on the paper's title, authors, institutions, and findings found in the text.

Provide citations in all standard formats:
1. BibTeX Format (Ready to copy-paste into LaTeX with citation key, title, author, booktitle/journal, year)
2. APA 7th Edition Format
3. IEEE Citation Format
4. MLA 9th Edition Format
5. In-Text Citation Snippet (e.g., "(Author et al., 2024)")`;
    } else {
      // Default: Comprehensive Executive Paper Breakdown
      modePrompt = `You are an expert Research Scientist and Academic Intelligence Assistant. Perform a COMPREHENSIVE EXECUTIVE RESEARCH BREAKDOWN of this paper.

Structure your analysis with these clean, visually appealing sections:
1. Research Objective & Problem Statement (What core limitation in the literature is this paper trying to solve?)
2. Proposed Method & Novel Contribution (What is the core novel idea or mechanism?)
3. 📊 Visual Diagram & Schematic Breakdown:
   - Cite any figure, diagram, or flowchart found in the text: "**📊 Diagram Reference:** [Document, Figure #/Section]"
   - Explain its visual structure and flow separately so researchers understand how the components interconnect.
4. Experimental Setup, Benchmarks & Baselines (What datasets, baseline models, and evaluation metrics were used?)
5. Quantitative Results & Key Findings (Specific numerical improvements, throughput, accuracy, or efficiency gains)
6. Acknowledged Limitations & Future Research Directions.`;
    }

    const prompt = `You are an elite academic research intelligence system. Ground your response STRICTLY on the research paper text provided below.

RESEARCH PAPER CONTEXT:
${context}

TASK:
${modePrompt}

PRESENTATION RULES:
1. Maintain rigorous academic clarity and high visual appeal.
2. Use clean bullet points, bold key technical terms, and structured sections.
3. If figures or diagrams are present or referenced, ALWAYS cite and explain them separately under a dedicated "📊 Diagram & Visual Reference" header.
4. Do NOT output unparsed raw hashtag symbols on the same line as text. Use clean markdown formatting with double line breaks before headers.`;

    const analysis = await generateText(prompt, {
      apiKey: userApiKey,
      groqApiKey: userGroqApiKey,
      models: { gemini: process.env.GEMINI_MODEL || 'gemini-2.5-flash' }
    });

    const sources = [...new Set(chunks.map(c => c.originalName))];

    return {
      success: true,
      mode,
      analysis,
      result: analysis,
      sources,
      filename: sources[0] || null,
      chunksUsed: chunks.length
    };
  } catch (error) {
    console.error('Research paper analysis service error:', error);
    return { error: error.message };
  }
}

module.exports = {
  analyzeResearchPaper
};
