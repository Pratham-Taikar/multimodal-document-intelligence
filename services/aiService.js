const DEFAULT_PROVIDER_ORDER = ['gemini', 'openrouter', 'minimax', 'ollama'];
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503]);
const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.0-flash-exp:free';
const DEFAULT_OPENROUTER_FALLBACK_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct:free'
];
const DEFAULT_OLLAMA_MODEL = 'llama3.2:1b';
const DEFAULT_MINIMAX_MODEL = 'MiniMax-Text-01';

class AIProviderError extends Error {
  constructor(provider, error, retryable) {
    super(error.message || `${provider} request failed`);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.status = getStatusCode(error);
    this.retryable = retryable;
    this.code = error.code;
  }
}

function getStatusCode(error) {
  const status = error && (
    error.status ||
    error.statusCode ||
    error.response?.status ||
    error.cause?.status
  );

  const numericStatus = Number(status);
  return Number.isInteger(numericStatus) ? numericStatus : undefined;
}

function isTransientError(error) {
  const status = getStatusCode(error);
  if (status !== undefined) return TRANSIENT_STATUS_CODES.has(status);

  const code = String(error?.code || error?.cause?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return [
    'etimedout',
    'econnreset',
    'econnrefused',
    'eai_again',
    'enetwork',
    'fetch failed',
    'network error',
    'timeout',
    'timed out'
  ].some(value => code.includes(value) || message.includes(value));
}

function providerOrder() {
  const validProviders = new Set(['gemini', 'openrouter', 'minimax', 'ollama']);
  const configured = String(process.env.AI_PROVIDER_ORDER || '')
    .split(',')
    .map(provider => provider.trim().toLowerCase())
    .filter(provider => validProviders.has(provider));

  return configured.length > 0 ? configured : DEFAULT_PROVIDER_ORDER;
}

function getOpenRouterModels() {
  const primary = process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  const configuredFallbacks = String(process.env.OPENROUTER_FALLBACK_MODELS || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);
  const fallbacks = configuredFallbacks.length > 0
    ? configuredFallbacks
    : DEFAULT_OPENROUTER_FALLBACK_MODELS;

  return [primary, ...fallbacks.filter(model => model !== primary)];
}

function hasProviderKey(provider, options = {}) {
  if (options.providers?.[provider] || options.implementations?.[provider]) return true;
  if (provider === 'gemini') return Boolean(options.apiKey || options.geminiApiKey || process.env.GEMINI_API_KEY);
  if (provider === 'openrouter') return Boolean(process.env.OPENROUTER_API_KEY);
  if (provider === 'minimax') return Boolean(process.env.MINIMAX_API_KEY);
  if (provider === 'ollama') {
    return Boolean(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL || process.env.AI_PROVIDER_ORDER?.includes('ollama'));
  }
  return false;
}

function responseError(provider, response) {
  const error = new Error(`${provider} returned HTTP ${response.status}`);
  error.status = response.status;
  return error;
}

async function readJsonResponse(provider, response) {
  if (!response.ok) throw responseError(provider, response);
  return response.json();
}

const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];

function normalizeGeminiModel(rawModel) {
  if (!rawModel) return DEFAULT_GEMINI_MODEL;
  const cleaned = String(rawModel).trim().replace(/^models\//, '');
  if (cleaned.includes('1.5') || cleaned.includes('2.5') || cleaned.includes('1.0') || cleaned.includes('2.0')) {
    return DEFAULT_GEMINI_MODEL;
  }
  return cleaned;
}

async function generateWithGemini(prompt, modelOverride, options = {}) {
  const primaryModel = normalizeGeminiModel(modelOverride || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);
  const modelsToTry = [primaryModel, ...GEMINI_FALLBACK_MODELS.filter(m => m !== primaryModel)];
  const rawKey = options.apiKey || options.geminiApiKey || process.env.GEMINI_API_KEY;
  const apiKey = String(rawKey || '').trim();
  if (!apiKey) {
    throw new Error("Missing Gemini API Key. Please provide one in Dashboard or .env file.");
  }

  let lastError;
  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      const data = await readJsonResponse('gemini', response);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return {
        text,
        model
      };
    } catch (err) {
      lastError = err;
      if (err.status === 404 || err.status === 503 || err.status === 429) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("All Gemini model endpoints failed.");
}

async function generateWithOllama(prompt, modelOverride) {
  const model = modelOverride || process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1').replace(/\/+$/, '');
  
  const payload = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    stream: false
  };

  if (prompt.includes('JSON') || prompt.includes('questions')) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await readJsonResponse('ollama', response);
  return {
    text: data.choices?.[0]?.message?.content || '',
    model: data.model || model
  };
}

async function generateWithMiniMax(prompt, modelOverride) {
  const model = modelOverride || process.env.MINIMAX_MODEL || DEFAULT_MINIMAX_MODEL;
  const baseUrl = (process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await readJsonResponse('minimax', response);
  return {
    text: data.choices?.[0]?.message?.content || '',
    model: data.model || model
  };
}

async function generateWithOpenRouter(prompt, modelOverride) {
  const models = getOpenRouterModels();
  const selectedModel = modelOverride || models[0];
  const response = await fetch(`${process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
      'X-Title': 'AskMyNotes'
    },
    body: JSON.stringify({
      model: selectedModel,
      models,
      route: 'fallback',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await readJsonResponse('openrouter', response);
  return {
    text: data.choices?.[0]?.message?.content || '',
    model: data.model || selectedModel
  };
}

const providerImplementations = {
  gemini: generateWithGemini,
  ollama: generateWithOllama,
  minimax: generateWithMiniMax,
  openrouter: generateWithOpenRouter
};

function retryDelay(retryCount) {
  const baseDelay = Number(process.env.AI_RETRY_BASE_DELAY_MS || 250);
  const jitter = Math.floor(Math.random() * Math.max(1, baseDelay));
  return (baseDelay * (2 ** retryCount)) + jitter;
}

function logFailure(provider, model, retryCount, error) {
  console.warn('AI provider failure', {
    provider,
    model,
    retryCount,
    status: getStatusCode(error),
    reason: error.code || error.name || 'request_failed'
  });
}

async function generateText(prompt, options = {}) {
  const maxRetries = Math.min(Math.max(Number(process.env.AI_MAX_RETRIES || 2), 0), 3);
  const failures = [];

  for (const provider of options.providerOrder || providerOrder()) {
    if (!hasProviderKey(provider, options) && !options.providers?.[provider]) {
      console.info('AI provider skipped', { provider, reason: 'missing_api_key' });
      continue;
    }

    let model;
    if (provider === 'gemini') {
      model = options.models?.[provider] || options.model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    } else if (provider === 'openrouter') {
      model = getOpenRouterModels()[0];
    } else if (provider === 'ollama') {
      model = options.models?.[provider] || options.model || process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
    } else if (provider === 'minimax') {
      model = options.models?.[provider] || options.model || process.env.MINIMAX_MODEL || DEFAULT_MINIMAX_MODEL;
    } else {
      model = options.models?.[provider] || options.model;
    }
    const generate = options.providers?.[provider] || providerImplementations[provider];
    let retryCount = 0;

    while (true) {
      console.info('AI provider attempt', { provider, model, retryCount });
      try {
        const result = await generate(prompt, model, options);
        const text = typeof result === 'string' ? result : result.text;
        console.info('AI provider success', {
          provider,
          model,
          successfulModel: typeof result === 'string' ? model : result.model,
          retryCount
        });
        return text;
      } catch (error) {
        const retryable = isTransientError(error);
        const providerError = new AIProviderError(provider, error, retryable);
        logFailure(provider, model, retryCount, providerError);
        failures.push(providerError);

        if (!retryable) {
          throw new Error(`AI provider ${provider} failed with a non-retryable configuration or request error (${providerError.status || providerError.code || 'unknown'}).`);
        }

        if (retryCount >= maxRetries) break;
        await new Promise(resolve => setTimeout(resolve, retryDelay(retryCount)));
        retryCount += 1;
      }
    }
  }

  const attempted = failures.map(failure => `${failure.provider}: ${failure.status || failure.code || 'transient failure'}`).join('; ');
  throw new Error(`All configured AI providers failed. ${attempted || 'No provider API keys are configured.'}`);
}

function setProviderImplementations(implementations) {
  Object.assign(providerImplementations, implementations);
}

module.exports = {
  generateText,
  isTransientError,
  setProviderImplementations
};