export function createUiHelpers(doc, host, mount = doc.body) {
  function element(tag, className, text) {
    const value = doc.createElement(tag);
    if (className) value.className = className;
    if (text !== undefined) value.textContent = text;
    return value;
  }

  function button(text, className, handler) {
    const value = element('button', `rw-button ${className || ''}`.trim(), text);
    value.type = 'button';
    value.addEventListener('click', async () => {
      value.disabled = true;
      try {
        await handler();
      } catch (error) {
        notifyError(error);
      } finally {
        value.disabled = false;
      }
    });
    return value;
  }

  function notifyError(error) {
    console.error('[轮回战场创意工坊]', error);
    const message = error instanceof Error ? error.message : String(error);
    try {
      host.toastr?.error?.(message, '创意工坊');
    } catch {}
  }

  function empty(container, text) {
    container.replaceChildren(element('div', 'rw-empty', text));
  }

  function openModal(title, { wide = false, onClose = null } = {}) {
    const backdrop = element('div', 'rw-modal-backdrop');
    const panel = element('section', `rw-modal${wide ? ' rw-modal--wide' : ''}`);
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');

    const head = element('header', 'rw-modal-head');
    const heading = element('h2', '', title);
    const closeButton = button('×', 'rw-modal-close', () => close());
    closeButton.setAttribute('aria-label', '关闭');
    head.append(heading, closeButton);

    const body = element('div', 'rw-modal-body');
    panel.append(head, body);
    backdrop.appendChild(panel);

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      host.removeEventListener?.('keydown', onKeyDown);
      backdrop.remove();
      try { onClose?.(); } catch {}
    };
    const onKeyDown = event => {
      if (event.key === 'Escape') close();
    };
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) close();
    });
    host.addEventListener?.('keydown', onKeyDown);
    mount.appendChild(backdrop);
    return { root: backdrop, panel, body, close };
  }

  return { element, button, notifyError, empty, openModal };
}
