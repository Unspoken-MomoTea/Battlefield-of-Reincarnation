import './components/registry.js';

const root = document.getElementById('opening-root');

export function mountOpening() {
  if (!root) return;
  root.innerHTML = '<div id="opening-loading">开局系统加载中...</div>';

  const event = new CustomEvent('opening:mounted', {
    detail: { root },
  });
  window.dispatchEvent(event);
}

mountOpening();
