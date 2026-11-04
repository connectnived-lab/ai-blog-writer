import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../src/shared/text.js';
import * as C from '../../src/shared/config.js';
import { createLLMClient, LLMError, chatUrl, buildChatRequest, extractContent } from '../../src/shared/llm.js';

function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _m: m,
  };
}

const okJson = (content) => ({
  ok: true, status: 200,
  json: async () => ({ choices: [{ message: { role: 'assistant', content } }] }),
  text: async () => '',
});

describe('text helpers', () => {
  test('normalizeSpace collapses whitespace', () => {
    assert.equal(T.normalizeSpace('  a \n\t b  '), 'a b');
  });
  test('normalizeSpace handles null', () => {
    assert.equal(T.normalizeSpace(null), '');
  });
  test('words lowercases and keeps apostrophes', () => {
    assert.deepEqual(T.words("Don't stop, GO!"), ["don't", 'stop', 'go']);
  });
  test('countWords counts unicode words', () => {
    assert.equal(T.countWords('കേരളം is nice'), 3);
  });
  test('sentences splits on terminal punctuation and newlines', () => {
    assert.deepEqual(T.sentences('One. Two! Three?\nFour'), ['One.', 'Two!', 'Three?', 'Four']);
  });
  test('paragraphs splits on blank lines', () => {
    assert.deepEqual(T.paragraphs('a\n\nb\n\n\nc'), ['a', 'b', 'c']);
  });
  test('contentWords drops stopwords and short words', () => {
    assert.deepEqual(T.contentWords('the cat is on a mat'), ['cat', 'mat']);
  });
  test('topKeywords ranks by frequency then alphabetically', () => {
    assert.deepEqual(T.topKeywords('pizza pasta pizza soup pasta pizza', 2), ['pizza', 'pasta']);
  });
  test('countPhrase counts whole-phrase matches case-insensitively', () => {
    assert.equal(T.countPhrase('Coffee beats coffeemaker. coffee!', 'coffee'), 2);
  });
  test('countPhrase handles multi-word phrases and regex characters', () => {
    assert.equal(T.countPhrase('Cold brew (fast) and cold brew.', 'cold brew (fast)'), 1);
  });
  test('countPhrase of empty phrase is 0', () => {
    assert.equal(T.countPhrase('anything', '   '), 0);
  });
  test('slugify makes url slugs', () => {
    assert.equal(T.slugify('  Hello, World! 2026 '), 'hello-world-2026');
  });
  test('clip keeps short text and cuts long text at a word', () => {
    assert.equal(T.clip('short', 10), 'short');
    const out = T.clip('the quick brown fox jumps over', 15);
    assert.ok(out.length <= 15, out);
    assert.ok(out.endsWith('…'));
  });
  test('countSyllables estimates common words', () => {
    assert.equal(T.countSyllables('cat'), 1);
    assert.equal(T.countSyllables('banana'), 3);
    assert.equal(T.countSyllables(''), 0);
  });
  test('fleschReadingEase is high for short plain sentences and 0 for empty', () => {
    assert.ok(T.fleschReadingEase('The cat sat. The dog ran. We ate.') > 80);
    assert.equal(T.fleschReadingEase(''), 0);
  });
  test('titleCase capitalises each word', () => {
    assert.equal(T.titleCase('hello big world'), 'Hello Big World');
  });
});

describe('config', () => {
  test('loadConfig returns defaults when nothing stored', () => {
    assert.deepEqual(C.loadConfig(memStorage()), C.DEFAULTS);
  });
  test('loadConfig tolerates corrupt JSON', () => {
    assert.deepEqual(C.loadConfig(memStorage({ [C.STORAGE_KEY]: '{nope' })), C.DEFAULTS);
  });
  test('saveConfig then loadConfig round-trips and trims', () => {
    const s = memStorage();
    C.saveConfig(s, { baseUrl: ' https://x.test/v1 ', apiKey: 'k', model: 'm', live: true });
    assert.deepEqual(C.loadConfig(s), { baseUrl: 'https://x.test/v1', apiKey: 'k', model: 'm', live: true });
  });
  test('clearConfig removes stored settings', () => {
    const s = memStorage();
    C.saveConfig(s, { baseUrl: 'https://x.test', apiKey: 'k', model: 'm', live: true });
    C.clearConfig(s);
    assert.equal(s.getItem(C.STORAGE_KEY), null);
  });
  test('validateConfig lists every missing piece', () => {
    assert.equal(C.validateConfig({}).length, 3);
  });
  test('validateConfig rejects non-http base URLs', () => {
    const p = C.validateConfig({ baseUrl: 'ftp://x', apiKey: 'k', model: 'm' });
    assert.ok(p.some((x) => x.includes('https://')));
  });
  test('isLiveReady needs live ticked and a valid config', () => {
    const good = { baseUrl: 'https://x.test/v1', apiKey: 'k', model: 'm' };
    assert.equal(C.isLiveReady({ ...good, live: false }), false);
    assert.equal(C.isLiveReady({ ...good, live: true }), true);
    assert.equal(C.isLiveReady({ baseUrl: 'https://x.test', live: true }), false);
  });
  test('modeOf reports demo or live', () => {
    assert.equal(C.modeOf({}), 'demo');
    assert.equal(C.modeOf({ baseUrl: 'https://a.b', apiKey: 'k', model: 'm', live: true }), 'live');
  });
});

describe('llm client', () => {
  const config = { baseUrl: 'https://api.test/v1/', apiKey: 'secret', model: 'demo-model', live: true };

  test('chatUrl strips trailing slashes and appends the path', () => {
    assert.equal(chatUrl('https://api.test/v1//'), 'https://api.test/v1/chat/completions');
  });
  test('chatUrl rejects non-URLs', () => {
    assert.throws(() => chatUrl('notaurl'), LLMError);
  });
  test('buildChatRequest sets bearer auth, model and messages', () => {
    const { url, init } = buildChatRequest({ config, messages: [{ role: 'user', content: 'hi' }] });
    assert.equal(url, 'https://api.test/v1/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer secret');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'demo-model');
    assert.equal(body.messages[0].content, 'hi');
  });
  test('extractContent returns trimmed text', () => {
    assert.equal(extractContent({ choices: [{ message: { content: '  yes  ' } }] }), 'yes');
  });
  test('extractContent rejects empty or missing content', () => {
    assert.throws(() => extractContent({ choices: [{ message: { content: '  ' } }] }), LLMError);
    assert.throws(() => extractContent({}), LLMError);
  });
  test('chat returns the model text and posts once', async () => {
    const calls = [];
    const llm = createLLMClient({ config, fetchImpl: async (u, i) => { calls.push([u, i]); return okJson('Hello there'); } });
    assert.equal(await llm.chat([{ role: 'user', content: 'x' }]), 'Hello there');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'https://api.test/v1/chat/completions');
  });
  test('chat refuses to call without settings', async () => {
    let called = false;
    const llm = createLLMClient({ config: { baseUrl: '', apiKey: '', model: '' }, fetchImpl: async () => { called = true; return okJson('x'); } });
    await assert.rejects(() => llm.chat([]), LLMError);
    assert.equal(called, false);
  });
  test('chat turns a network failure into LLMError', async () => {
    const llm = createLLMClient({ config, fetchImpl: async () => { throw new Error('offline'); } });
    await assert.rejects(() => llm.chat([]), (e) => e instanceof LLMError && /offline/.test(e.message));
  });
  test('chat reports a non-2xx status with its code', async () => {
    const llm = createLLMClient({ config, fetchImpl: async () => ({ ok: false, status: 401, text: async () => 'bad key' }) });
    await assert.rejects(() => llm.chat([]), (e) => e.status === 401 && /401/.test(e.message));
  });
  test('chat survives an unreadable error body', async () => {
    const llm = createLLMClient({ config, fetchImpl: async () => ({ ok: false, status: 500, text: async () => { throw new Error('x'); } }) });
    await assert.rejects(() => llm.chat([]), (e) => e.status === 500);
  });
  test('chat reports a non-JSON answer', async () => {
    const llm = createLLMClient({ config, fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } }) });
    await assert.rejects(() => llm.chat([]), /not return JSON/);
  });
  test('chat reports an empty model answer', async () => {
    const llm = createLLMClient({ config, fetchImpl: async () => okJson('') });
    await assert.rejects(() => llm.chat([]), /empty answer/);
  });
});
