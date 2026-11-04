# AI Blog Writer

One-line pitch: Turn a topic and a target keyword into a structured, SEO-checked blog draft, offline or with your own model.

## Description
AI Blog Writer takes a topic, a target keyword, an audience, a tone and a length, and produces a complete article draft with a title, meta description, headings and body copy. Every draft is scored against a checklist of on-page SEO rules: keyword in the title, title and meta description lengths, keyword in the first 100 words, H2 coverage, keyword density, word count and readability. The default demo mode is fully offline and deterministic, so the whole flow works with no key and no network. A Settings panel lets you point the same features at any OpenAI-compatible chat endpoint, where the key lives only in your browser's local storage. The app is plain HTML, CSS and ES modules with no build step, and the core logic is covered by unit tests and an end-to-end browser smoke test.

## Tech used
Plain HTML, CSS and ES modules; Node.js built-in test runner; Python Playwright for end-to-end checks; GitHub Actions for CI.

## 30-second demo
Open the page, click "Load sample", then "Write article". Point at the SEO scorecard, then open Settings, add an OpenAI-compatible endpoint, and write again to see the live model path.

## Resume bullets
- Built a browser-based blog drafting tool with an offline deterministic mode and an optional OpenAI-compatible live mode, with the API key kept in local storage only.
- Implemented an on-page SEO checker (title, meta description, keyword placement, density, headings, readability) and covered the rules with node unit tests.
- Wrote an end-to-end Playwright smoke suite that checks desktop and mobile layouts, the main flow in both modes, horizontal overflow and console errors.

## LinkedIn draft
I built a small AI Blog Writer as one of my 25 mini-projects. Give it a topic and a keyword, and it writes a structured draft and scores it against SEO basics: title, meta description, keyword placement, density and readability. It works fully offline in demo mode, and you can plug in any OpenAI-compatible model in Settings. The code, tests and browser smoke checks are open source under MIT. Feedback welcome.
