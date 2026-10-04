# System & Software Prerequisites

Before starting the **Multimodal Document Intelligence (AskMyNotes)** project, ensure the following software components are installed and configured on your system:

---

## 1. Node.js Environment
- **Node.js**: Version `18.x` or higher (Recommended: LTS 20.x or 22.x).
- **npm**: Version `9.x` or higher.
- Download: [https://nodejs.org](https://nodejs.org)
- Check installation:
  ```bash
  node --version
  npm --version
  ```

---

## 2. MongoDB Database
The application requires a MongoDB database instance for user session storage, document metadata, and quiz persistence.

### Option A: Local MongoDB (Recommended for offline use)
- **MongoDB Community Server**: Version 7.x or 8.x
- Download: [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
- Or install via Windows Package Manager (`winget`):
  ```powershell
  winget install MongoDB.Server --silent
  ```
- Start MongoDB Service:
  ```powershell
  Get-Service MongoDB
  ```

### Option B: MongoDB Atlas (Cloud)
- Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
- Get the connection URI string: `mongodb+srv://<username>:<password>@cluster0.mongodb.net/askmynotes`

---

## 3. AI Providers (Choose at least one)

### Option A: Local Offline AI with Ollama (Zero Cost, No Rate Limits)
- Download and install **Ollama**: [https://ollama.com](https://ollama.com)
- Pull a lightweight model suited for study notes & question generation:
  ```bash
  # Fast, highly recommended for standard PCs (8GB+ RAM):
  ollama run qwen3-fast
  # Or:
  ollama run llama3.2
  ```
- Verify Ollama is running at `http://127.0.0.1:11434`.

### Option B: MiniMax API (Cloud)
- Sign up and get your API key from [MiniMax Platform](https://platform.minimaxi.com).
- Model: `MiniMax-Text-01` or `abab6.5s-chat`.

### Option C: OpenRouter Cloud (Cloud)
- Get your API key from [OpenRouter](https://openrouter.ai/keys).

---

## 4. Quick Start Checklist

1. **Clone repository**:
   ```bash
   git clone https://github.com/Pratham-Taikar/multimodal-document-intelligence.git
   cd multimodal-document-intelligence
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   Copy `.env.example` to `.env` and fill in your configuration:
   ```bash
   cp .env.example .env
   ```

4. **Run test suite**:
   ```bash
   npm test
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.
