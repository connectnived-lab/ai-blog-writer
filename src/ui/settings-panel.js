import { loadConfig, saveConfig, clearConfig, validateConfig, normalizeConfig } from '../shared/config.js';

// Mounts the Settings panel into `root`. Returns { getConfig }.
export function mountSettings(root, { storage = globalThis.localStorage, onChange = () => {} } = {}) {
  root.innerHTML = `
    <details class="settings" id="settings">
      <summary>Settings &middot; live mode (optional)</summary>
      <p class="hint">Demo mode works offline with no key. To use your own model, enter any OpenAI-compatible chat endpoint.
        The key is saved only in this browser and is sent only to the base URL you enter.</p>
      <label for="cfg-base">API base URL</label>
      <input id="cfg-base" type="text" placeholder="https://api.example.com/v1" autocomplete="off">
      <label for="cfg-key">API key</label>
      <input id="cfg-key" type="password" autocomplete="off">
      <label for="cfg-model">Model</label>
      <input id="cfg-model" type="text" placeholder="model-name" autocomplete="off">
      <label class="check"><input id="cfg-live" type="checkbox"> Use my model (live mode)</label>
      <div class="row">
        <button type="button" id="cfg-save">Save settings</button>
        <button type="button" class="ghost" id="cfg-clear">Clear</button>
      </div>
      <p id="cfg-status" class="hint" role="status" aria-live="polite"></p>
    </details>`;

  const $ = (id) => root.querySelector(`#${id}`);
  let cfg = loadConfig(storage);
  $('cfg-base').value = cfg.baseUrl;
  $('cfg-key').value = cfg.apiKey;
  $('cfg-model').value = cfg.model;
  $('cfg-live').checked = cfg.live;

  const status = (msg) => { $('cfg-status').textContent = msg; };

  $('cfg-save').addEventListener('click', () => {
    const draft = normalizeConfig({
      baseUrl: $('cfg-base').value,
      apiKey: $('cfg-key').value,
      model: $('cfg-model').value,
      live: $('cfg-live').checked,
    });
    if (draft.live) {
      const problems = validateConfig(draft);
      if (problems.length) {
        status(problems.join(' '));
        return;
      }
    }
    cfg = saveConfig(storage, draft);
    status(cfg.live ? 'Saved. Live mode is on.' : 'Saved. Demo mode stays on until live mode is ticked.');
    onChange(cfg);
  });

  $('cfg-clear').addEventListener('click', () => {
    cfg = clearConfig(storage);
    $('cfg-base').value = '';
    $('cfg-key').value = '';
    $('cfg-model').value = '';
    $('cfg-live').checked = false;
    status('Cleared. Demo mode is on.');
    onChange(cfg);
  });

  return { getConfig: () => cfg };
}
