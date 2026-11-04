// Pure logic: brief validation, offline article builder, prompt builder and SEO scorecard. No DOM.
import { countWords, countPhrase, normalizeSpace, clip, fleschReadingEase } from '../shared/text.js';

export const TONES = ['Friendly', 'Professional', 'Expert', 'Playful'];
export const LENGTHS = { short: 4, medium: 5, long: 6 };
export const LENGTH_WORDS = { short: 350, medium: 400, long: 450 };
export const LENGTH_LABELS = {
  short: 'Short (about 350 words)',
  medium: 'Medium (about 400 words)',
  long: 'Long (about 450 words)',
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const TONE_OPENERS = {
  Friendly: "Here's the thing:",
  Professional: 'In practice, the basics matter most.',
  Expert: 'Experienced teams know this one already:',
  Playful: "Let's be honest, this is where most people trip:",
};

const TITLES = {
  Friendly: (k) => `${cap(k)} made simple: a practical guide`,
  Professional: (k) => `${cap(k)}: a practical guide for you`,
  Expert: (k) => `${cap(k)}: what works and what does not`,
  Playful: (k) => `${cap(k)}, minus the jargon`,
};

const HEADINGS = [
  (k) => `What ${k} really means`,
  (k, t, a) => `Why ${k} matters for ${a}`,
  () => 'How to get started',
  () => 'Common mistakes to avoid',
  () => 'Tools and habits that help',
  () => 'How to measure progress',
];

const BODY = [
  (t) => [`${cap(t)} works best when you are clear about the goal first.`, 'Write the goal in one sentence before you choose any method.', 'If the goal is vague, every later choice will feel like guesswork.'],
  (t, a) => ['The payoff is time and clarity, not just more activity.', `Teams like yours who track that payoff tend to keep the habit going.`, `Ask ${a} what they would miss most if the routine stopped, and let that answer guide you.`],
  (t) => [`Start small: pick one routine connected to ${t} and run it for a week.`, 'Write down what you did, what changed, and what you would repeat.', 'A short trial with a clear end date is easier to judge than an open-ended change.'],
  (t) => ['Most problems come from trying everything at once.', 'Cut the list to the two changes that touch your biggest pain point.', 'Drop anything that adds a meeting without removing a task.'],
  (t, a) => ['Simple tools help, but only when they fit how you already work.', `Choose the one that removes a step for ${a} instead of adding a new one.`, 'Keep the tool stack small enough that everyone can explain it in a minute.'],
  (t) => ['Progress is easiest to see when you pick two numbers to watch.', `Review them once a month and adjust the routine, not the goal for ${t}.`, 'Write the review down so the next month starts from facts, not memory.'],
];

export function normalizeBrief(input = {}) {
  return {
    topic: normalizeSpace(input.topic),
    keyword: normalizeSpace(input.keyword),
    audience: normalizeSpace(input.audience) || 'readers',
    tone: input.tone,
    length: input.length,
  };
}

export function validateBrief(input = {}) {
  const b = normalizeBrief(input);
  const errors = [];
  if (!b.topic) errors.push('Add a topic.');
  if (!b.keyword) errors.push('Add a target keyword.');
  if (b.keyword.length > 80) errors.push('Keep the keyword under 80 characters.');
  if (b.topic.length > 400) errors.push('Keep the topic under 400 characters.');
  if (!TONES.includes(b.tone)) errors.push('Pick a tone from the list.');
  if (!Object.prototype.hasOwnProperty.call(LENGTHS, b.length)) errors.push('Pick a length.');
  return errors;
}

export function buildArticle(input = {}) {
  const b = normalizeBrief(input);
  const errors = validateBrief(b);
  if (errors.length) throw new Error(errors.join(' '));
  const kw = b.keyword.toLowerCase();
  const title = clip(TITLES[b.tone](kw, b.audience), 60);
  const meta = clip(`${cap(kw)} explained in plain steps: what it is, why it matters, and how to start for ${b.audience}.`, 155);
  const count = LENGTHS[b.length];
  const sections = HEADINGS.slice(0, count).map((h, i) => {
    const body = BODY[i](b.topic.toLowerCase(), b.audience);
    const paras = i === 0 ? [TONE_OPENERS[b.tone], ...body] : body;
    return { heading: h(kw, b.topic.toLowerCase(), b.audience), paragraphs: paras };
  });
  const faq = [
    { q: `What is ${kw}?`, a: `${cap(kw)} is the practice of ${b.topic.toLowerCase()}. Start with one clear goal and a simple routine.` },
    { q: 'How long does it take to see results?', a: 'It depends on your starting point. Many readers notice early changes within a few weeks of a steady routine.' },
    { q: 'Do I need special tools?', a: 'No. Start with what you already use, and add a tool only when it removes a step you repeat.' },
  ];
  const intro = `If you are looking into ${kw} for ${b.audience}, this guide covers what it means, how to start, and what to avoid.`;
  const conclusion = `${cap(kw)} is not a one-time project. Pick one step from this guide, try it this week, and check the result honestly.`;

  const lines = [`# ${title}`, '', `Meta description: ${meta}`, '', intro, ''];
  for (const s of sections) {
    lines.push(`## ${s.heading}`, '', ...s.paragraphs.flatMap((p) => [p, '']));
  }
  lines.push('## Frequently asked questions', '');
  for (const f of faq) lines.push(`### ${f.q}`, '', f.a, '');
  lines.push('## Wrapping up', '', conclusion, '');
  const markdown = lines.join('\n');
  return {
    title, metaDescription: meta, slug: kw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    sections, faq, markdown, wordCount: countWords(markdown),
    brief: b,
  };
}

export function parseMarkdown(md) {
  const lines = String(md ?? '').split('\n');
  const title = (lines.find((l) => /^#\s+/.test(l)) || '').replace(/^#\s+/, '').trim();
  const metaLine = lines.find((l) => /^meta description:/i.test(l)) || '';
  const meta = metaLine.replace(/^meta description:\s*/i, '').trim();
  const h2 = lines.filter((l) => /^##\s+/.test(l)).map((l) => l.replace(/^##\s+/, '').trim());
  const body = lines.filter((l) => !/^#/.test(l) && !/^meta description:/i.test(l)).join('\n');
  return { title, meta, h2, body };
}

function check(id, label, pass, detail = '') {
  return { id, label, pass: Boolean(pass), detail };
}

export function scoreMarkdown(md, keyword) {
  const kw = normalizeSpace(keyword).toLowerCase();
  const p = parseMarkdown(md);
  const bodyWords = countWords(p.body);
  const density = bodyWords ? (countPhrase(p.body, kw) / bodyWords) * 100 : 0;
  const first100 = p.body.split(/\s+/).slice(0, 100).join(' ');
  const readability = fleschReadingEase(p.body);
  const checks = [
    check('title-keyword', 'Keyword appears in the title', countPhrase(p.title, kw) > 0, p.title),
    check('title-length', 'Title is 30 to 60 characters', p.title.length >= 30 && p.title.length <= 60, `${p.title.length} characters`),
    check('meta-length', 'Meta description is 120 to 155 characters', p.meta.length >= 120 && p.meta.length <= 155, `${p.meta.length} characters`),
    check('meta-keyword', 'Keyword appears in the meta description', countPhrase(p.meta, kw) > 0),
    check('intro-keyword', 'Keyword appears in the first 100 words', countPhrase(first100, kw) > 0),
    check('subheadings', 'At least three H2 sections', p.h2.length >= 3, `${p.h2.length} sections`),
    check('heading-keyword', 'Keyword appears in an H2 heading', p.h2.some((h) => countPhrase(h, kw) > 0)),
    check('density', 'Keyword density is 0.5% to 2.5%', density >= 0.5 && density <= 2.5, `${density.toFixed(1)}%`),
    check('length', 'At least 300 words', bodyWords >= 300, `${bodyWords} words`),
    check('readability', 'Readability (Flesch) at least 50', readability >= 50, `${readability}`),
  ];
  const passed = checks.filter((c) => c.pass).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    checks,
    title: p.title,
    meta: p.meta,
    wordCount: bodyWords,
    density: Math.round(density * 10) / 10,
  };
}

export function buildPrompt(input = {}) {
  const b = normalizeBrief(input);
  const system = 'You are an experienced SEO content writer. You write clear, accurate, helpful articles in Markdown. You never invent statistics, studies or quotes.';
  const user = [
    'Write a blog article.',
    `Topic: ${b.topic}`,
    `Target keyword: ${b.keyword}`,
    `Audience: ${b.audience}`,
    `Tone: ${b.tone}`,
    `Length: about ${LENGTH_WORDS[b.length] ?? LENGTH_WORDS.medium} words`,
    'Format rules:',
    '- First line: "# " followed by a title of 30 to 60 characters that contains the keyword.',
    '- Second line: "Meta description: " followed by 120 to 155 characters that contain the keyword.',
    '- Then an intro, 3 to 6 "## " sections, a "## Frequently asked questions" section with 3 questions as "### " headings, and a short "## Wrapping up" section.',
    '- Use the keyword naturally (about 1 to 2 percent of words), never stuff it.',
    '- Do not invent statistics, studies or quotes. Return only the Markdown article.',
  ].join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
