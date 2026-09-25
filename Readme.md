# Multimodal Document Intelligence (AskMyNotes)

An AI-powered document intelligence and study notes assistant. Upload PDFs and notes, generate comprehensive MCQs, short answers, and ask questions via RAG (Retrieval-Augmented Generation).

---

## 🚀 Features

- **Multi-Provider AI Architecture**:
  - **Ollama (Local & Offline)**: Zero rate limits, runs 100% offline on standard PCs.
  - **MiniMax API**: High-quality cloud model compatible with OpenAI standard chat formats.
  - **OpenRouter**: Cloud aggregator fallback supporting free and premium models.
- **RAG Document Search**: Intelligent semantic and chunk-based retrieval across study materials.
- **MCQ & Practice Quiz Generation**: Rigorous validation, duplicate prevention, and automatic recovery.
- **Secure Authentication**: Express session authentication with MongoDB storage.

---

## 💻 Recommended Local Models for PC (Ollama)

You can run these fast, highly optimized models on standard consumer hardware (8GB+ RAM, with or without a dedicated GPU):

| Model | Command | Best For |
| :--- | :--- | :--- |
| **Llama 3.2 (3B)** *(Recommended)* | `ollama run llama3.2` | Fast, lightweight, low RAM footprint (~2.5GB VRAM/RAM). Great for notes & MCQs. |
| **Qwen 2.5 (3B / 7B)** | `ollama run qwen2.5:3b` | Excellent reasoning and multilingual document understanding. |
| **Mistral (7B)** | `ollama run mistral` | High fidelity structured outputs. |

---

## 🛠️ Quick Setup Guide

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)
- [Ollama](https://ollama.com/) (Optional for 100% offline AI)

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

#### Option A: Offline AI with Ollama (Zero API Costs & No Rate Limits)
1. Install [Ollama](https://ollama.com/) and run:
   ```bash
   ollama run llama3.2
   ```
2. Set in `.env`:
   ```env
   AI_PROVIDER_ORDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434/v1
   OLLAMA_MODEL=llama3.2
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
