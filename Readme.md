# Multimodal Document Intelligence (AskMyNotes)

An AI-powered document intelligence and study notes assistant. Upload PDFs and notes, generate comprehensive MCQs, short answers, and ask questions via RAG (Retrieval-Augmented Generation).

---

## 🚀 Features

- **Multi-Provider Cascading AI Architecture**:
  - **Google Gemini (Multi-Key Auto-Rotation)**: High-intelligence responses with seamless failover between multiple keys when rate limits (429) hit.
  - **Groq Cloud API (Free & Blazing Fast)**: Ultra-fast ~500 tokens/sec LPU inference (Llama 3.1 8B Instant) that automatically takes over if Gemini is exhausted.
  - **Ollama (Optimized for Low-End PC & Offline)**: Zero rate limits, offline safety net running lightweight `llama3.2:1b` (runs smoothly on CPU with ~1.3GB RAM).
  - **OpenRouter Cloud**: Additional free model cascade (`google/gemini-2.0-flash-exp:free`, `meta-llama/llama-3.3-70b-instruct:free`).
- **RAG Document Search**: Intelligent semantic and chunk-based retrieval across study materials.
- **MCQ & Practice Quiz Generation**: Rigorous validation, duplicate prevention, and automatic recovery.
- **Secure Authentication**: Express session authentication with MongoDB storage.

---

## 💻 Recommended Local Models for Low-End PC (Ollama)

If you are offline or choose local execution on a standard consumer laptop or PC without a dedicated GPU:

| Model | Command | RAM Footprint | Best For |
| :--- | :--- | :--- | :--- |
| **Llama 3.2 (1B)** *(Recommended for Low-End PC)* | `ollama run llama3.2:1b` | ~1.3 GB | **Fastest on CPU**, minimal memory usage, zero PC freeze. |
| **Qwen 2.5 (1.5B)** | `ollama run qwen2.5:1.5b` | ~1.8 GB | Great reasoning & multilingual speed on low RAM. |
| **Llama 3.2 (3B)** | `ollama run llama3.2` | ~2.5 GB | Good balance if you have 8GB+ RAM. |

---

## 🛠️ Quick Setup Guide

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)
- [Groq API Key](https://console.groq.com/keys) (Free & instant) or [Gemini API Key](https://aistudio.google.com/app/apikey)
- [Ollama](https://ollama.com/) (Optional for 100% offline fallback)

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your `.env`:

#### Recommended: Multi-Tier Cascade (Gemini + Groq + Ollama)
```env
AI_PROVIDER_ORDER=gemini,groq,openrouter,ollama
GEMINI_API_KEY=your_gemini_key_1,your_gemini_key_2
GROQ_API_KEY=your_groq_api_key
OLLAMA_MODEL=llama3.2:1b
```

#### Option B: MiniMax AI
1. Set in `.env`:
   ```env
   AI_PROVIDER_ORDER=minimax
   MINIMAX_API_KEY=your_minimax_api_key
   MINIMAX_BASE_URL=https://api.minimax.chat/v1
   MINIMAX_MODEL=MiniMax-Text-01
   ```

#### Option C: OpenRouter Cloud (or Automatic Multi-Fallback)
You can chain multiple providers together so that if one fails, it automatically cascades to the next:
```env
AI_PROVIDER_ORDER=ollama,minimax,openrouter
OPENROUTER_API_KEY=your_openrouter_api_key
```

### 4. Run Tests
```bash
npm test
```

### 5. Start the Application
```bash
npm run dev
# or
npm start
```
Access the application at `http://localhost:3000`.
