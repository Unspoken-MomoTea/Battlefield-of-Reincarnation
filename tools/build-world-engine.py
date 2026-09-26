from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'script' / 'world-engine-src'
OUTPUT = ROOT / 'script' / '世界推进系统.js'
PARTS = (
    '00-foundation-prompt.part.js',
    '10-world-state.part.js',
    '20-world-result.part.js',
    '30-context-protocol.part.js',
    'ui/00-styles.part.js',
    'ui/10-world-tab.part.js',
    'ui/20-people-tab.part.js',
    'ui/30-exploration-tab.part.js',
    'ui/40-archive-tabs.part.js',
    'ui/50-settings-tab.part.js',
    'ui/60-prompt-tab.part.js',
    'ui/70-request-inspector.part.js',
    '40-engine-runtime.part.js',
    '50-engine-ui.part.js',
    '55-policy-compat.part.js',
    '55-npc-narrative-audit.part.js',
    '56-rumor-liveliness.part.js',
    '57-task-awareness.part.js',
    '58-chronology-guard.part.js',
    '59-auto-progress.part.js',
    '59-auto-trigger-rebuild.part.js',
    '59-soft-maintenance.part.js',
    '59-world-integrity-guard.part.js',
    '59-world-time-daypart-aliases.part.js',
    '59-causal-stability-gate.part.js',
    '59-world-time-ownership.part.js',
    '59-world-replay-persistence.part.js',
    'editor/00-world-mutations.part.js',
    'editor/10-event-editor.part.js',
    'editor/20-person-editor.part.js',
    '59-reprocess-immediate-retry.part.js',
    '59-alien-activity-normalization.part.js',
    '59-rumor-throttle.part.js',
    '59-rumor-world-source.part.js',
    '59-rumor-world-facts.part.js',
    '59-rumor-world-request.part.js',
    '59-rumor-world-system.part.js',
    '59-editable-module-prompts.part.js',
    '59-world-activity-delivery.part.js',
    '59-causal-overview-ui.part.js',
    '59-causal-offset-editor.part.js',
    '59-api-preset-selection.part.js',
    '59-history-memory.part.js',
    '59-history-memory-editor.part.js',
    '@src/WorldEngine/domains/WorldMutationService.part.js',
    '@src/WorldEngine/domains/WorldEventService.part.js',
    '@src/WorldEngine/domains/WorldPersonActivityService.part.js',
    '@src/WorldEngine/domains/WorldHistoryService.part.js',
    '@src/WorldEngine/domains/WorldCausalService.part.js',
    '@src/WorldEngine/domains/WorldExplorationService.part.js',
    '@src/WorldEngine/domains/WorldRumorService.part.js',
    '@src/WorldEngine/domains/WorldRequestService.part.js',
    '@src/WorldEngine/domains/WorldRequestFeature.part.js',
    '@src/WorldEngine/domains/WorldSoftMaintenanceFeature.part.js',
    '@src/WorldEngine/domains/WorldIntegrityRequestFeature.part.js',
    '@src/WorldEngine/domains/WorldActivityRequestFeature.part.js',
    '@src/WorldEngine/domains/WorldDueEventFeature.part.js',
    '@src/WorldEngine/domains/WorldTaskAwarenessFeature.part.js',
    '@src/WorldEngine/domains/WorldChronologyFeature.part.js',
    '@src/WorldEngine/domains/WorldRumorRequestFeature.part.js',
    '@src/WorldEngine/domains/WorldNpcAuditPromptFeature.part.js',
    '@src/WorldEngine/prompts/WorldPromptRegistry.part.js',
    '@src/WorldEngine/ui/WorldEngineViewRegistry.part.js',
    '@src/WorldEngine/ui/WorldEditorController.part.js',
    '@src/WorldEngine/ui/WorldApiPresetController.part.js',
    '@src/WorldEngine/ui/WorldCausalOverviewController.part.js',
    '@src/WorldEngine/core/WorldEngineFeatureRegistry.part.js',
    '@src/WorldEngine/runtime/WorldAutoProgressFeature.part.js',
    '@src/WorldEngine/runtime/WorldAutoTriggerReplayFeature.part.js',
    '@src/WorldEngine/runtime/WorldReplayPersistenceFeature.part.js',
    '@src/WorldEngine/runtime/WorldImmediateReprocessRetryFeature.part.js',
    '@src/WorldEngine/runtime/WorldTimeOwnershipFeature.part.js',
    '@src/WorldEngine/runtime/WorldNpcAuditPolicyFeature.part.js',
    '@src/WorldEngine/runtime/WorldHistoryMemoryFeature.part.js',
    '@src/WorldEngine/core/WorldEngineServiceContainer.part.js',
    '@src/WorldEngine/ui/WorldPromptWorkspaceController.part.js',
    '59-due-event-relaxation.part.js',
    '@src/WorldEngine/core/WorldEngineClassBridge.part.js',
    '60-bootstrap.part.js',
)


def part_path(name: str) -> Path:
    if name.startswith('@'):
        return ROOT / name[1:]
    return SOURCE_DIR / name


def assembled_source() -> str:
    missing = [name for name in PARTS if not part_path(name).is_file()]
    if missing:
        raise SystemExit('missing world-engine source parts: ' + ', '.join(missing))
    return ''.join(part_path(name).read_text(encoding='utf-8') for name in PARTS)


def main() -> int:
    parser = argparse.ArgumentParser(description='Assemble the single-file Tavern world engine delivery script.')
    parser.add_argument('--check', action='store_true', help='fail if the checked-in delivery file is not identical to the source parts')
    args = parser.parse_args()
    built = assembled_source()
    if args.check:
        current = OUTPUT.read_text(encoding='utf-8') if OUTPUT.is_file() else ''
        if current != built:
            raise SystemExit('script/世界推进系统.js is out of date; run: python tools/build-world-engine.py')
        print(f'world-engine build is synchronized: {len(PARTS)} parts, {len(built)} chars')
        return 0
    OUTPUT.write_text(built, encoding='utf-8')
    print(f'built {OUTPUT.relative_to(ROOT)} from {len(PARTS)} parts ({len(built)} chars)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
