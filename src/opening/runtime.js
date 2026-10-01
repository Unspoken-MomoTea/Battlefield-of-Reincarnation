// Opening runtime entry.
// The legacy Regular/开局.html migration will be moved here module by module.

const root = document.getElementById('opening-root');

export function mountOpening() {
  if (!root) return;
  root.innerHTML = '<div id="opening-loading">开局系统加载中...</div>';
}

mountOpening();
