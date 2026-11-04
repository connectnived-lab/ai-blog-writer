import { loadConfig, modeOf } from './shared/config.js';
import { createLLMClient, LLMError } from './shared/llm.js';
import { renderMarkdown } from './shared/markdown.js';
import { countWords } from './shared/text.js';
import { mountSettings } from './ui/settings-panel.js';
import { setMode, wireCopy } from './ui/common.js';
import { TONES, LENGTH_LABELS, validateBrief, buildArticle, buildPrompt, scoreMarkdown, normalizeBrief } from './core/blog.js';

const $ = (id) => document.getElementById(id);
const storage = window.localStorage;
let cfg = loadConfig(storage);
let currentMarkdown = '';

mountSettings($('settings-root'), {
  storage,
  onChange: (c) => { cfg = c; setMode($('mode-badge'), cfg); },
});
setMode($('mode-badge'), cfg);

for (const t of TONES) $('tone').append(new Option(t, t));
for (const [v, label] of Object.entries(LENGTH_LABELS)) $('length').append(new Option(label, v));
$('tone').value = 'Friendly';
$('length').value = 'medium';

function readBrief() {
  return {
    topic: $('topic').value,
    keyword: $('keyword').value,
    audience: $('audience').value,
    tone: $('tone').value,
    length: $('length').value,
  };
}

function showError(msg) {
  $('error').textContent = msg;
  $('error').hidden = !msg;
}

function drawScorecard(md, keyword) {
  const s = scoreMarkdown(md, keyword);
  const box = $('scorecard');
  box.replaceChildren();
  const head = document.createElement('p');
  head.className = 'score';
  head.textContent = `SEO score ${s.score}/100`;
  box.append(head);
  const list = document.createElement('ul');
  list.className = 'checks';
  for (const c of s.checks) {
    const li = document.createElement('li');
    li.className = c.pass ? 'pass' : 'fail';
    li.textContent = `${c.pass ? '✓' : '✗'} ${c.label}${c.detail ? ` (${c.detail})` : ''}`;
    list.append(li);
  }
  box.append(list);
  box.hidden = false;
}

function render(md, keyword, live) {
  currentMarkdown = md;
  $('output').innerHTML = renderMarkdown(md);
  $('output').hidden = false;
  drawScorecard(md, keyword);
  $('stat').textContent = `${countWords(md)} words · ${live ? 'written by your model' : 'built offline'}`;
}

function setBusy(busy) {
  const btn = $('generate');
  btn.disabled = busy;
  btn.textContent = busy ? 'Writing…' : 'Write article';
}

$('sample').addEventListener('click', () => {
  $('topic').value = 'remote work for small teams';
  $('keyword').value = 'remote team productivity';
  $('audience').value = 'small business owners';
  $('tone').value = 'Professional';
  $('length').value = 'medium';
});

$('brief-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const brief = readBrief();
  const errors = validateBrief(brief);
  showError(errors.join(' '));
  if (errors.length) return;
  const live = modeOf(cfg) === 'live';
  setBusy(true);
  try {
    const md = live
      ? await createLLMClient({ config: cfg }).chat(buildPrompt(brief), { maxTokens: 2200, temperature: 0.7 })
      : buildArticle(brief).markdown;
    render(md, normalizeBrief(brief).keyword, live);
  } catch (e) {
    showError(e instanceof LLMError ? e.message : 'Something went wrong writing the article. Please try again.');
  } finally {
    setBusy(false);
  }
});

wireCopy($('copy'), () => currentMarkdown, $('copy-status'));
