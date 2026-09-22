import { createInstallSnapshot } from './snapshot.js';
import { syncOriginalWorldbookConflicts } from './original-conflicts.js';
import { syncOriginalRegexConflicts } from './original-regexes.js';
import { syncOriginalScriptConflicts } from './original-scripts.js';

// Reuse the real ownership/state rules against snapshots, discarding all writes.
// This rejects opposite claims before enabling any new mod script.
export async function validateOriginalStates(context, installed, plan) {
  if (!plan.originalConflicts.length && !plan.originalRegexConflicts.length && !plan.originalScriptConflicts.length) return;
  const adapter = {
    ...context.adapter,
    createOrReplaceWorldbook: () => {},
    replaceCharacterRegexes: () => {},
    replaceScriptTrees: () => {},
  };
  const characterNeeded = Boolean(plan.originalConflicts.length || plan.originalRegexConflicts.length ||
    plan.originalScriptConflicts.some(item => item.target.scope === 'character'));
  const state = await createInstallSnapshot(adapter, installed, plan, characterNeeded);
  const readonly = { ...context, adapter };
  await syncOriginalWorldbookConflicts(readonly, installed, plan, state);
  await syncOriginalRegexConflicts(readonly, installed, plan);
  await syncOriginalScriptConflicts(readonly, installed, plan, state);
}
