const DEFAULT_PROVIDER_ORDER = ['openrouter'];
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503]);
const DEFAULT_OPENROUTER_MODEL = 'google/gemma-4-31b-it:free';
const DEFAULT_OPENROUTER_FALLBACK_MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'qwen/qwen3.8-27b:free'
];

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
  const configured = String(process.env.AI_PROVIDER_ORDER || '')
    .split(',')
    .map(provider => provider.trim().toLowerCase())
    .filter(provider => DEFAULT_PROVIDER_ORDER.includes(provider));

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

function hasProviderKey(provider) {
  return provider === 'openrouter' && Boolean(process.env.OPENROUTER_API_KEY);
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

async function generateWithOpenRouter(prompt) {
  const models = getOpenRouterModels();
  const response = await fetch(`${process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
    },
    body: JSON.stringify({
      model: models[0],
      models,
      route: 'fallback',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await readJsonResponse('openrouter', response);
  return {
    text: data.choices?.[0]?.message?.content || '',
    model: data.model || models[0]
  };
}

const providerImplementations = {
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
    if (!hasProviderKey(provider) && !options.providers?.[provider]) {
      console.info('AI provider skipped', { provider, reason: 'missing_api_key' });
      continue;
    }

    const model = provider === 'openrouter'
      ? getOpenRouterModels()[0]
      : options.models?.[provider] || options.model;
    const generate = options.providers?.[provider] || providerImplementations[provider];
    let retryCount = 0;

    while (true) {
      console.info('AI provider attempt', { provider, model, retryCount });
      try {
        const result = await generate(prompt, model);
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