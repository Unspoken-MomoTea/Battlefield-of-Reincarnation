const STORAGE_KEY = 'reincarnation-workshop:launcher-position';
const DRAG_THRESHOLD = 4;
const CLICK_SUPPRESS_MS = 350;

function finite(value) {
  return Number.isFinite(Number(value));
}

export function bindWorkshopLauncher({ launcher, overlay, host, open, close }) {
  let drag = null;
  let suppressClickUntil = 0;

  const viewportSize = () => ({
    width: Math.max(
      Number(host.innerWidth) || 0,
      Number(launcher.ownerDocument?.documentElement?.clientWidth) || 0,
    ),
    height: Math.max(
      Number(host.innerHeight) || 0,
      Number(launcher.ownerDocument?.documentElement?.clientHeight) || 0,
    ),
  });

  const clampPosition = (left, top) => {
    const rect = launcher.getBoundingClientRect();
    const viewport = viewportSize();
    return {
      left: Math.min(Math.max(0, Number(left) || 0), Math.max(0, viewport.width - rect.width)),
      top: Math.min(Math.max(0, Number(top) || 0), Math.max(0, viewport.height - rect.height)),
    };
  };

  const applyPosition = (left, top, { persist = false } = {}) => {
    const next = clampPosition(left, top);
    launcher.style.left = `${Math.round(next.left)}px`;
    launcher.style.top = `${Math.round(next.top)}px`;
    launcher.style.right = 'auto';
    launcher.style.bottom = 'auto';

    if (persist) {
      try {
        host.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
    }
    return next;
  };

  const restorePosition = () => {
    try {
      const saved = JSON.parse(host.localStorage?.getItem(STORAGE_KEY) || 'null');
      if (!saved || !finite(saved.left) || !finite(saved.top)) return;
      applyPosition(saved.left, saved.top);
    } catch {}
  };

  const finishDrag = (event, { cancelled = false } = {}) => {
    if (!drag || event.pointerId !== drag.pointerId) return;

    if (drag.moved) {
      const rect = launcher.getBoundingClientRect();
      applyPosition(rect.left, rect.top, { persist: true });
      if (!cancelled) suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
    }

    try {
      if (launcher.hasPointerCapture?.(drag.pointerId)) {
        launcher.releasePointerCapture(drag.pointerId);
      }
    } catch {}

    launcher.classList.remove('is-dragging');
    drag = null;
  };

  const onPointerDown = event => {
    if (event.button !== 0 || event.isPrimary === false) return;
    const rect = launcher.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      moved: false,
    };
    try { launcher.setPointerCapture?.(event.pointerId); } catch {}
  };

  const onPointerMove = event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      launcher.classList.add('is-dragging');
    }

    event.preventDefault();
    applyPosition(drag.startLeft + dx, drag.startTop + dy);
  };

  const onClick = event => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (overlay.classList.contains('is-open')) close();
    else open();
  };

  const onResize = () => {
    if (!launcher.style.left || !launcher.style.top) return;
    const rect = launcher.getBoundingClientRect();
    applyPosition(rect.left, rect.top, { persist: true });
  };

  launcher.addEventListener('pointerdown', onPointerDown);
  launcher.addEventListener('pointermove', onPointerMove);
  launcher.addEventListener('pointerup', finishDrag);
  launcher.addEventListener('pointercancel', event => finishDrag(event, { cancelled: true }));
  launcher.addEventListener('click', onClick);
  host.addEventListener?.('resize', onResize);

  const schedule = host.requestAnimationFrame || (callback => host.setTimeout(callback, 0));
  schedule(restorePosition);

  return () => {
    launcher.removeEventListener('pointerdown', onPointerDown);
    launcher.removeEventListener('pointermove', onPointerMove);
    launcher.removeEventListener('pointerup', finishDrag);
    launcher.removeEventListener('pointercancel', finishDrag);
    launcher.removeEventListener('click', onClick);
    host.removeEventListener?.('resize', onResize);
  };
}
