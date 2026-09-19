export const DATABASE_CHANNEL_NAME = 'reincarnation-workshop-db';
export const DATABASE_UPGRADE_EVENT = 'reincarnation-workshop-database-upgrade';

function upgradeEvent(version) {
  if (typeof CustomEvent === 'function') {
    return new CustomEvent(DATABASE_UPGRADE_EVENT, { detail: { version } });
  }
  const event = new Event(DATABASE_UPGRADE_EVENT);
  event.version = version;
  return event;
}

export function createDatabaseCoordinator({
  host,
  BroadcastChannelCtor = globalThis.BroadcastChannel,
  onClose,
}) {
  const close = () => {
    try { onClose?.(); } catch {}
  };
  const onLocalUpgrade = () => close();
  host?.addEventListener?.(DATABASE_UPGRADE_EVENT, onLocalUpgrade);

  let channel = null;
  if (typeof BroadcastChannelCtor === 'function') {
    try {
      channel = new BroadcastChannelCtor(DATABASE_CHANNEL_NAME);
      channel.onmessage = event => {
        if (event?.data?.type === 'close-for-upgrade') close();
      };
    } catch {
      channel = null;
    }
  }

  return {
    requestCloseForUpgrade(version) {
      try { host?.dispatchEvent?.(upgradeEvent(version)); } catch { close(); }
      try { channel?.postMessage?.({ type: 'close-for-upgrade', version }); } catch {}
    },
    dispose() {
      try { host?.removeEventListener?.(DATABASE_UPGRADE_EVENT, onLocalUpgrade); } catch {}
      try { channel?.close?.(); } catch {}
      channel = null;
    },
  };
}
