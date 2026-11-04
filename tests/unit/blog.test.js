import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TONES, LENGTHS, validateBrief, buildArticle, parseMarkdown, scoreMarkdown, buildPrompt, normalizeBrief } from '../../src/core/blog.js';
import { renderMarkdown } from '../../src/shared/markdown.js';

const brief = (over = {}) => ({
  topic: 'remote work for small teams', keyword: 'remote team productivity',
  audience: 'small business owners', tone: 'Professional', length: 'medium', ...over,
});

describe('validateBrief', () => {
  test('a complete brief has no errors', () => {
    assert.deepEqual(validateBrief(brief()), []);
  });
  test('flags an empty topic', () => {
    assert.ok(validateBrief(brief({ topic: '   ' })).some((e) => /topic/.test(e)));
  });
  test('flags an empty keyword', () => {
    assert.ok(validateBrief(brief({ keyword: '' })).some((e) => /keyword/.test(e)));
  });
  test('flags a keyword longer than 80 characters', () => {
    assert.ok(validateBrief(brief({ keyword: 'x'.repeat(81) })).some((e) => /80/.test(e)));
  });
  test('flags a topic longer than 400 characters', () => {
    assert.ok(validateBrief(brief({ topic: 'x '.repeat(250) })).some((e) => /400/.test(e)));
  });
  test('flags an unknown tone', () => {
    assert.ok(validateBrief(brief({ tone: 'Angry' })).some((e) => /tone/.test(e)));
  });
  test('flags an unknown length', () => {
    assert.ok(validateBrief(brief({ length: 'epic' })).some((e) => /length/.test(e)));
  });
  test('normalizeBrief defaults the audience to readers', () => {
    assert.equal(normalizeBrief(brief({ audience: '  ' })).audience, 'readers');
  });
});

describe('buildArticle', () => {
  test('throws on an invalid brief', () => {
    assert.throws(() => buildArticle(brief({ topic: '' })), /topic/);
  });
  test('title contains the keyword and is at most 60 characters for every tone', () => {
    for (const tone of TONES) {
      const a = buildArticle(brief({ tone }));
      assert.ok(a.title.toLowerCase().includes('remote team productivity'), tone);
      assert.ok(a.title.length <= 60, `${tone}: ${a.title.length}`);
    }
  });
  test('meta description is at most 155 characters and names the keyword', () => {
    const a = buildArticle(brief());
    assert.ok(a.metaDescription.length <= 155);
    assert.ok(a.metaDescription.toLowerCase().includes('remote team productivity'));
  });
  test('section count follows the length option', () => {
    for (const [len, n] of Object.entries(LENGTHS)) {
      assert.equal(buildArticle(brief({ length: len })).sections.length, n, len);
    }
  });
  test('longer lengths produce more words', () => {
    const s = buildArticle(brief({ length: 'short' })).wordCount;
    const m = buildArticle(brief({ length: 'medium' })).wordCount;
    const l = buildArticle(brief({ length: 'long' })).wordCount;
    assert.ok(s < m && m < l, `${s} ${m} ${l}`);
  });
  test('markdown starts with the H1 title and carries the meta line', () => {
    const a = buildArticle(brief());
    assert.ok(a.markdown.startsWith(`# ${a.title}`));
    assert.match(a.markdown, /^Meta description: /m);
  });
  test('includes exactly three FAQ questions', () => {
    const a = buildArticle(brief());
    assert.equal(a.faq.length, 3);
    assert.equal((a.markdown.match(/^### /gm) || []).length, 3);
  });
  test('the first section opens with the tone opener', () => {
    const a = buildArticle(brief({ tone: 'Playful' }));
    assert.equal(a.sections[0].paragraphs[0], "Let's be honest, this is where most people trip:");
  });
  test('slug is a clean kebab-case keyword', () => {
    assert.equal(buildArticle(brief()).slug, 'remote-team-productivity');
  });
  test('the same brief always gives the same article', () => {
    assert.equal(buildArticle(brief()).markdown, buildArticle(brief()).markdown);
  });
  test('uses the default audience in the markdown when none is given', () => {
    const a = buildArticle(brief({ audience: '' }));
    assert.ok(a.markdown.includes('for readers'));
  });
});

describe('parseMarkdown', () => {
  test('extracts title, meta, H2 headings and a body without headings', () => {
    const md = '# My Title\n\nMeta description: A short meta line.\n\nIntro text here.\n\n## Section One\n\nBody one.\n\n### Q?\n\nAnswer.';
    const p = parseMarkdown(md);
    assert.equal(p.title, 'My Title');
    assert.equal(p.meta, 'A short meta line.');
    assert.deepEqual(p.h2, ['Section One']);
    assert.ok(p.body.includes('Intro text here.'));
    assert.ok(!p.body.includes('## Section One'));
    assert.ok(!p.body.includes('Meta description'));
  });
  test('handles empty input', () => {
    const p = parseMarkdown('');
    assert.equal(p.title, '');
    assert.deepEqual(p.h2, []);
  });
});

describe('scoreMarkdown', () => {
  test('a generated article passes most SEO checks', () => {
    for (const len of ['short', 'medium', 'long']) {
      const a = buildArticle(brief({ length: len }));
      const s = scoreMarkdown(a.markdown, 'remote team productivity');
      assert.equal(s.checks.length, 10);
      assert.ok(s.score >= 80, `${len} scored ${s.score}: ${JSON.stringify(s.checks.filter((c) => !c.pass))}`);
    }
  });
  test('the title and H2 keyword checks pass on a generated article', () => {
    const s = scoreMarkdown(buildArticle(brief()).markdown, 'remote team productivity');
    assert.equal(s.checks.find((c) => c.id === 'title-keyword').pass, true);
    assert.equal(s.checks.find((c) => c.id === 'heading-keyword').pass, true);
  });
  test('keyword stuffing fails the density check', () => {
    const md = '# Cats and cats for cats\n\nMeta description: ' + 'cats '.repeat(30) + '\n\n## cats\n\n' + 'cats '.repeat(200);
    const s = scoreMarkdown(md, 'cats');
    assert.equal(s.checks.find((c) => c.id === 'density').pass, false);
  });
  test('a missing meta description fails the meta-length check', () => {
    const a = buildArticle(brief());
    const s = scoreMarkdown(a.markdown.replace(/^Meta description: .*$/m, ''), 'remote team productivity');
    assert.equal(s.checks.find((c) => c.id === 'meta-length').pass, false);
  });
  test('an article with no H2 sections fails the subheadings check', () => {
    const s = scoreMarkdown('# Remote team productivity made simple: a guide\n\nJust one paragraph.', 'remote team productivity');
    assert.equal(s.checks.find((c) => c.id === 'subheadings').pass, false);
  });
  test('score is the pass share of the checks', () => {
    const s = scoreMarkdown('', 'kw');
    const passed = s.checks.filter((c) => c.pass).length;
    assert.equal(s.score, Math.round((passed / s.checks.length) * 100));
  });
});

describe('buildPrompt', () => {
  test('returns a system and a user message with the brief in it', () => {
    const msgs = buildPrompt(brief());
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, 'system');
    assert.equal(msgs[1].role, 'user');
    assert.ok(msgs[1].content.includes('Target keyword: remote team productivity'));
    assert.ok(msgs[1].content.includes('Tone: Professional'));
  });
  test('states the word target for the chosen length', () => {
    assert.ok(buildPrompt(brief({ length: 'long' }))[1].content.includes('about 450 words'));
  });
  test('forbids invented statistics', () => {
    assert.ok(buildPrompt(brief())[1].content.includes('Do not invent statistics'));
  });
});

describe('renderMarkdown', () => {
  test('renders headings and paragraphs', () => {
    assert.equal(renderMarkdown('# T\n\nHello'), '<h1>T</h1>\n<p>Hello</p>');
  });
  test('renders bullet and numbered lists', () => {
    const html = renderMarkdown('- a\n- b\n\n1. x');
    assert.ok(html.includes('<ul>\n<li>a</li>\n<li>b</li>\n</ul>'));
    assert.ok(html.includes('<ol>\n<li>x</li>\n</ol>'));
  });
  test('escapes HTML from the model', () => {
    assert.equal(renderMarkdown('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
  });
  test('renders bold and italics', () => {
    assert.equal(renderMarkdown('**a** and *b*'), '<p><strong>a</strong> and <em>b</em></p>');
  });
  test('handles empty input', () => {
    assert.equal(renderMarkdown(''), '');
  });
});
