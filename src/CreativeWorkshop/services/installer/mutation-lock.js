import { resolveHostWindow } from '../../config.js';

const QUEUE = Symbol.for('reincarnation-workshop.mutation-queue');
const ACTIVE = Symbol.for('reincarnation-workshop.mutation-token');

// One queue for every project, installer instance and hot-loaded client on this page.
// Web Locks additionally serialize cooperating tabs on the same origin.
export function withWorkshopMutation(action, token) {
  const host = resolveHostWindow();
  if (token && host[ACTIVE] === token) return action(token);
  const invoke = async () => {
    const current = {};
    host[ACTIVE] = current;
    try { return await action(current); }
    finally { delete host[ACTIVE]; }
  };
  const run = () => host.navigator?.locks?.request
    ? host.navigator.locks.request('reincarnation-workshop.resources', invoke)
    : invoke();
  const result = (host[QUEUE] ?? Promise.resolve()).then(run);
  host[QUEUE] = result.catch(() => {});
  return result;
}
