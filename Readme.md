# Multimodal Document Intelligence (AskMyNotes Studio)

An AI-powered academic and multimodal document intelligence platform designed to ingest complex documents (PDF, DOCX, PPTX, TXT), extract structured evidence, and provide high-fidelity answers and learning synthesis with verifiable citations.

---

## 🚀 Key Features

### 1. Multi-Tier Cascading AI Engine
- **Google Gemini (Multi-Key Auto-Rotation)**: High-intelligence reasoning with seamless failover across comma-separated API keys when rate limits (`429`) occur.
- **Groq Cloud API (Free & Blazing Fast)**: Ultra-fast ~500 tokens/sec LPU inference (`llama-3.1-8b-instant`) that automatically takes over if Gemini is exhausted.
- **Ollama Offline Mode (Optimized for Low-End PC & CPU)**: Zero rate limits, offline safety net running lightweight `llama3.2:1b` (runs smoothly on CPU with ~1.3GB RAM).
- **OpenRouter Cloud**: Additional free model cascade (`google/gemini-2.0-flash-exp:free`, `meta-llama/llama-3.3-70b-instruct:free`).

### 2. Strict Grounded RAG & Visual Citation Coordinate Inspector
- Grounded answers with cosine similarity confidence scoring (`High`, `Medium`, `Low`).
- **Interactive Citation & Coordinate Inspector**: Click any citation pill `[file.pdf #1]` to inspect exact document page numbers, visual bounding box coordinates `[ymin, xmin, ymax, xmax]`, and highlighted grounded excerpts.
- Automatic diagram extraction, grounding citations, and disclaimer filtering.

### 3. Dedicated Research Paper Studio (`🔬 Research Studio`)
- Dedicated, isolated research paper upload separate from standard notes.
- **Comprehensive Paper Breakdown**: Core hypothesis, methodology summary, mathematical formulas, and empirical findings.
- **Architecture & Methodology Deep-Dive**: Step-by-step algorithms, loss functions, and dataset splits.
- **Critical Peer-Review Critique**: Identification of limitations, unaddressed edge cases, and future work.
- **Citation Exporter**: Instant BibTeX, IEEE, and APA academic citation generator.

### 4. Academic Gamification Engine
- **XP & Level Progression**: Earn XP across quizzes (+50 XP, +25 bonus for ≥80%), flashcards (+30 XP), research analysis (+40 XP), summaries (+25 XP), and citation inspection (+15 XP).
- **Daily Study Streak Tracking**: Consecutive day streak counter with consistency indicators.
- **Achievement Badges Showcase**:
  - 🌱 *Scholar Initiate*: Began academic knowledge synthesis.
  - 🏆 *Quiz Master*: Scored 80% or higher on an MCQ practice assessment.
  - ⚡ *Flashcard Prodigy*: Mastered a full interactive 3D flashcard deck.
  - 🔬 *Research Scholar*: Executed deep breakdown on a research paper.
  - 📖 *Executive Briefer*: Synthesized structured revision summaries.
  - 🔥 *Consistency Champion*: Maintained a multi-day study streak.

### 5. Learning Studio Drills
- **Executive Summarizer**: Short, medium, or detailed revision notes.
- **Interactive 3D Flashcards**: 3D flip animation (`Spacebar`, arrow navigation) with front/back concepts and source citations.
- **MCQ Practice Arena**: Validated 5-question multiple choice quizzes with explanations and score celebration.
- **Short Answer Drills**: Conceptual exam questions with collapsible model answers.

---

## 💻 Recommended Local Models for Low-End PC (Ollama)

If you are offline or prefer local execution on a consumer laptop without a dedicated GPU:

| Model | Command | RAM Footprint | Best For |
| :--- | :--- | :--- | :--- |
| **Llama 3.2 (1B)** *(Recommended)* | `ollama run llama3.2:1b` | ~1.3 GB | **Fastest on CPU**, minimal memory usage, zero PC freeze. |
| **Qwen 2.5 (1.5B)** | `ollama run qwen2.5:1.5b` | ~1.8 GB | Great reasoning & multilingual speed on low RAM. |
| **Llama 3.2 (3B)** | `ollama run llama3.2` | ~2.5 GB | Good balance if you have 8GB+ RAM. |

---

## 🛠️ Quick Setup & Running Locally

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)
- Optional free keys: [Groq](https://console.groq.com/keys) or [Gemini](https://aistudio.google.com/app/apikey)
- Optional: [Ollama](https://ollama.com/) for 100% offline fallback

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure `.env`:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/askmynotes
SESSION_SECRET=your_secure_session_secret

# AI Cascade Configuration
AI_PROVIDER_ORDER=gemini,groq,openrouter,ollama
GEMINI_API_KEY=your_gemini_key_1,your_gemini_key_2
GROQ_API_KEY=your_groq_api_key
OLLAMA_MODEL=llama3.2:1b
```

### 4. Run Test Suite
```bash
npm test
```
*All 44 automated unit tests for AI cascading, MCQ recovery, summaries, flashcards, research papers, and gamification pass.*

### 5. Start the Server
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.
