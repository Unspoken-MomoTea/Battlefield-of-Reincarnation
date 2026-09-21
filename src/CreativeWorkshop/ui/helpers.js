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

  function confirmDialog({
    title = '确认操作',
    message = '',
    confirmText = '确定',
    cancelText = '取消',
    danger = false,
  } = {}) {
    return new Promise(resolve => {
      const backdrop = element('div', 'rw-confirm-backdrop');
      const panel = element('section', 'rw-confirm-dialog');
      panel.setAttribute('role', 'alertdialog');
      panel.setAttribute('aria-modal', 'true');

      const head = element('div', 'rw-confirm-head');
      const icon = element('span', danger ? 'rw-confirm-icon danger' : 'rw-confirm-icon', danger ? '!' : '?');
      const copy = element('div', 'rw-confirm-copy');
      copy.append(
        element('strong', '', title),
        element('div', 'rw-confirm-message', message),
      );
      head.append(icon, copy);

      const actions = element('div', 'rw-confirm-actions');
      const cancel = element('button', 'rw-button', cancelText);
      cancel.type = 'button';
      const confirm = element('button', `rw-button ${danger ? 'danger' : 'primary'}`, confirmText);
      confirm.type = 'button';
      actions.append(cancel, confirm);
      panel.append(head, actions);
      backdrop.appendChild(panel);

      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        host.removeEventListener?.('keydown', onKeyDown);
        backdrop.remove();
        resolve(Boolean(value));
      };
      const onKeyDown = event => {
        if (event.key === 'Escape') finish(false);
        if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) finish(true);
      };

      cancel.addEventListener('click', () => finish(false));
      confirm.addEventListener('click', () => finish(true));
      backdrop.addEventListener('click', event => {
        if (event.target === backdrop) finish(false);
      });

      host.addEventListener?.('keydown', onKeyDown);
      mount.appendChild(backdrop);
      host.setTimeout?.(() => cancel.focus(), 0);
    });
  }

  function openModal(title, { wide = false, extraWide = false, onClose = null, confirmDiscard = false } = {}) {
    const backdrop = element('div', 'rw-modal-backdrop');
    const panel = element(
      'section',
      `rw-modal${extraWide ? ' rw-modal--xl' : wide ? ' rw-modal--wide' : ''}`,
    );
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
    let dirty = false;
    const close = ({ force = false } = {}) => {
      if (closed) return;
      if (!force && confirmDiscard && dirty) {
        const confirmed = typeof host.confirm === 'function'
          ? host.confirm('有未提交的修改，确定放弃吗？')
          : true;
        if (!confirmed) return;
      }
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
    if (confirmDiscard) {
      panel.addEventListener('input', event => {
        if (event.target.closest('form,input,textarea,select')) dirty = true;
      });
      panel.addEventListener('change', event => {
        if (event.target.closest('form,input,textarea,select')) dirty = true;
      });
    }
    host.addEventListener?.('keydown', onKeyDown);
    mount.appendChild(backdrop);
    return {
      root: backdrop,
      panel,
      body,
      close,
      markDirty() { dirty = true; },
      markClean() { dirty = false; },
      isDirty() { return dirty; },
    };
  }

  return { element, button, notifyError, empty, confirmDialog, openModal };
}
