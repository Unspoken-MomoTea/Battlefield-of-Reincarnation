const STORAGE_KEY = 'reincarnation-workshop:launcher-position';
const DRAG_THRESHOLD = 4;
const CLICK_SUPPRESS_MS = 350;
const MOBILE_BREAKPOINT = 760;
const MOBILE_EDGE_MARGIN = 16;

function finite(value) {
  return Number.isFinite(Number(value));
}

export function bindWorkshopLauncher({ launcher, overlay, host, open, close }) {
  let drag = null;
  let suppressClickUntil = 0;

  const viewportMetrics = () => {
    const viewport = host.visualViewport;
    const docEl = launcher.ownerDocument?.documentElement;
    const width = Number(viewport?.width)
      || Number(docEl?.clientWidth)
      || Number(host.innerWidth)
      || 0;
    const height = Number(viewport?.height)
      || Number(docEl?.clientHeight)
      || Number(host.innerHeight)
      || 0;
    return {
      left: Number(viewport?.offsetLeft) || 0,
      top: Number(viewport?.offsetTop) || 0,
      width,
      height,
    };
  };

  const isMobileViewport = () => {
    const viewport = viewportMetrics();
    const coarsePointer = Boolean(host.matchMedia?.('(pointer: coarse)')?.matches)
      || Number(host.navigator?.maxTouchPoints || 0) > 0;
    return coarsePointer || viewport.width <= MOBILE_BREAKPOINT;
  };

  const clampPosition = (left, top) => {
    const rect = launcher.getBoundingClientRect();
    const viewport = viewportMetrics();
    const minLeft = viewport.left;
    const minTop = viewport.top;
    const maxLeft = Math.max(minLeft, viewport.left + viewport.width - rect.width);
    const maxTop = Math.max(minTop, viewport.top + viewport.height - rect.height);
    return {
      left: Math.min(Math.max(minLeft, Number(left) || 0), maxLeft),
      top: Math.min(Math.max(minTop, Number(top) || 0), maxTop),
    };
  };

  const applyPosition = (left, top, { persist = false } = {}) => {
    const next = clampPosition(left, top);
    launcher.style.left = `${Math.round(next.left)}px`;
    launcher.style.top = `${Math.round(next.top)}px`;
    launcher.style.right = 'auto';
    launcher.style.bottom = 'auto';

    if (persist && !isMobileViewport()) {
      try {
        host.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
    }
    return next;
  };

  const pinToMobileViewport = () => {
    const viewport = viewportMetrics();
    const rect = launcher.getBoundingClientRect();
    applyPosition(
      viewport.left + viewport.width - rect.width - MOBILE_EDGE_MARGIN,
      viewport.top + viewport.height - rect.height - MOBILE_EDGE_MARGIN,
    );
  };

  const restorePosition = () => {
    if (isMobileViewport()) {
      // 手机/WebView 的 layout viewport 往往比真实可视区大，桌面端保存的位置会被恢复到屏幕外。
      // 移动端始终先落在 visualViewport 右下角，保证悬浮入口可见。
      pinToMobileViewport();
      return;
    }

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

  const onViewportChange = () => {
    if (isMobileViewport()) {
      pinToMobileViewport();
      return;
    }
    if (!launcher.style.left || !launcher.style.top) return;
    const rect = launcher.getBoundingClientRect();
    applyPosition(rect.left, rect.top, { persist: true });
  };

  const onPointerCancel = event => finishDrag(event, { cancelled: true });

  launcher.addEventListener('pointerdown', onPointerDown);
  launcher.addEventListener('pointermove', onPointerMove);
  launcher.addEventListener('pointerup', finishDrag);
  launcher.addEventListener('pointercancel', onPointerCancel);
  launcher.addEventListener('click', onClick);
  host.addEventListener?.('resize', onViewportChange);
  host.visualViewport?.addEventListener?.('resize', onViewportChange);
  host.visualViewport?.addEventListener?.('scroll', onViewportChange);

  const schedule = host.requestAnimationFrame || (callback => host.setTimeout(callback, 0));
  schedule(restorePosition);

  return () => {
    launcher.removeEventListener('pointerdown', onPointerDown);
    launcher.removeEventListener('pointermove', onPointerMove);
    launcher.removeEventListener('pointerup', finishDrag);
    launcher.removeEventListener('pointercancel', onPointerCancel);
    launcher.removeEventListener('click', onClick);
    host.removeEventListener?.('resize', onViewportChange);
    host.visualViewport?.removeEventListener?.('resize', onViewportChange);
    host.visualViewport?.removeEventListener?.('scroll', onViewportChange);
  };
}
