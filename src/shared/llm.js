// Minimal OpenAI-compatible chat-completions client. The fetch implementation is injectable so tests can mock it.
export class LLMError extends Error {
  constructor(message, { status = null, cause = null } = {}) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.cause = cause;
  }
}

export function chatUrl(baseUrl) {
  const base = String(baseUrl ?? '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/i.test(base)) throw new LLMError('The base URL is not a valid http(s) URL.');
  return `${base}/chat/completions`;
}

export function buildChatRequest({ config, messages, temperature = 0.4, maxTokens = 1200 }) {
  return {
    url: chatUrl(config.baseUrl),
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, messages, temperature, max_tokens: maxTokens }),
    },
  };
}

export function extractContent(json) {
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new LLMError('The model returned an empty answer.');
  }
  return content.trim();
}

export function createLLMClient({ fetchImpl = globalThis.fetch, config }) {
  async function chat(messages, options = {}) {
    if (!config?.apiKey || !config?.baseUrl || !config?.model) {
      throw new LLMError('Live mode needs a base URL, an API key and a model. Open Settings to add them.');
    }
    const { url, init } = buildChatRequest({ config, messages, ...options });
    let res;
    try {
      res = await fetchImpl(url, init);
    } catch (cause) {
      throw new LLMError(`Could not reach the model endpoint (${cause?.message ?? 'network error'}).`, { cause });
    }
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 160); } catch { detail = ''; }
      throw new LLMError(`The model endpoint answered ${res.status}.${detail ? ' ' + detail : ''}`, { status: res.status });
    }
    let json;
    try {
      json = await res.json();
    } catch (cause) {
      throw new LLMError('The model endpoint did not return JSON.', { cause });
    }
    return extractContent(json);
  }
  return { chat };
}
