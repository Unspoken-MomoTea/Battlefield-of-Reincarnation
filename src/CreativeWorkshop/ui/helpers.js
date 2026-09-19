export function createUiHelpers(doc, host) {
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
  return { element, button, notifyError, empty };
}
