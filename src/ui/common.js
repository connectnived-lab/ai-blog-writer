import { isLiveReady } from '../shared/config.js';

export function setMode(badge, cfg) {
  const live = isLiveReady(cfg);
  badge.textContent = live ? 'Live mode · your model' : 'Demo mode · offline';
  badge.className = `badge ${live ? 'live' : 'demo'}`;
}

export function setOutput(el, text) {
  el.textContent = text;
  el.hidden = false;
}

export function setStatus(el, msg) {
  el.textContent = msg;
}

export function wireCopy(button, getText, status) {
  button.addEventListener('click', async () => {
    const text = getText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Copied.';
    } catch {
      status.textContent = 'Copy is not available here; select the text and copy it.';
    }
  });
}
