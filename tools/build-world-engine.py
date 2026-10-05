from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'script' / '世界推进系统.js'
PARTS = (
    '@src/WorldEngine/core/WorldEngineFoundation.part.js',
    '@src/WorldEngine/core/WorldSharedUtilities.part.js',
    '@src/WorldEngine/core/WorldEngineRuntimeConstants.part.js',
    '@src/WorldEngine/ui/WorldThemeCatalog.part.js',
    '@src/WorldEngine/domains/WorldTokenTelemetry.part.js',
    '@src/WorldEngine/domains/WorldProseExtractor.part.js',
    '@src/WorldEngine/prompts/WorldBasePromptDefaults.part.js',
    '@src/WorldEngine/domains/WorldKnowledgeSelectionPolicy.part.js',
    '@src/WorldEngine/domains/WorldStateModel.part.js',
    '@src/WorldEngine/domains/WorldStateFactory.part.js',
    '@src/WorldEngine/domains/WorldPatchPolicy.part.js',
    '@src/WorldEngine/domains/WorldTimePolicy.part.js',
    '@src/WorldEngine/domains/WorldDueEventPolicy.part.js',
    '@src/WorldEngine/domains/WorldActivityPolicy.part.js',
    '@src/WorldEngine/domains/WorldTimelinePolicy.part.js',
    '@src/WorldEngine/domains/WorldSoftMaintenancePolicy.part.js',
    '@src/WorldEngine/domains/WorldChronologyPolicy.part.js',
    '@src/WorldEngine/domains/WorldLifecycleService.part.js',
    '@src/WorldEngine/domains/WorldPersonActivityService.part.js',
    '@src/WorldEngine/domains/WorldTaskAwarenessService.part.js',
    '@src/WorldEngine/domains/WorldNpcAuditService.part.js',
    '@src/WorldEngine/domains/WorldStateNormalizer.part.js',
    '@src/WorldEngine/domains/WorldCausalService.part.js',
    '@src/WorldEngine/domains/WorldResultVocabulary.part.js',
    '@src/WorldEngine/domains/WorldRelationSyncPolicy.part.js',
    '@src/WorldEngine/domains/WorldAssetMaterializationPolicy.part.js',
    '@src/WorldEngine/domains/WorldExplorationService.part.js',
    '@src/WorldEngine/domains/WorldResultContract.part.js',
    '@src/WorldEngine/domains/WorldResultNormalizer.part.js',
    '@src/WorldEngine/domains/WorldResultPatchCompilationService.part.js',
    '@src/WorldEngine/domains/WorldRumorService.part.js',
    '@src/WorldEngine/domains/WorldStateIntegrityPolicy.part.js',
    '@src/WorldEngine/domains/WorldPatchApplicationService.part.js',
    '@src/WorldEngine/domains/WorldStateMaterializationService.part.js',
    '@src/WorldEngine/domains/WorldResultMaterializer.part.js',
    '@src/WorldEngine/domains/WorldRetryGuidanceService.part.js',
    '@src/WorldEngine/domains/WorldResultStagingService.part.js',
    '@src/WorldEngine/domains/WorldResultReplyParser.part.js',
    '@src/WorldEngine/domains/WorldValidationPolicy.part.js',
    '@src/WorldEngine/ui/WorldEngineStyles.part.js',
    '@src/WorldEngine/core/WorldHostAdapter.part.js',
    '@src/WorldEngine/core/WorldEngineConfigService.part.js',
    '@src/WorldEngine/core/WorldRunScheduler.part.js',
    '@src/WorldEngine/core/SamsaraWorldEngine.part.js',
    '@src/WorldEngine/core/WorldEngineLifecycleController.part.js',
    '@src/WorldEngine/prompts/WorldPromptDefaults.part.js',
    '@src/WorldEngine/domains/WorldRuntimeContextService.part.js',
    '@src/WorldEngine/domains/WorldKnowledgeService.part.js',
    '@src/WorldEngine/domains/WorldRequestBuilder.part.js',
    '@src/WorldEngine/domains/WorldHistoryMemoryPolicy.part.js',
    '@src/WorldEngine/domains/WorldHistoryService.part.js',
    '@src/WorldEngine/domains/WorldStateProjector.part.js',
    '@src/WorldEngine/domains/WorldResultCompiler.part.js',
    '@src/WorldEngine/domains/WorldValidationService.part.js',
    '@src/WorldEngine/domains/WorldCommitService.part.js',
    '@src/WorldEngine/domains/WorldMutationService.part.js',
    '@src/WorldEngine/domains/WorldSnapshotService.part.js',
    '@src/WorldEngine/domains/WorldEventService.part.js',
    '@src/WorldEngine/domains/WorldRequestService.part.js',
    '@src/WorldEngine/domains/WorldApiTransportService.part.js',
    '@src/WorldEngine/domains/WorldPromptDocumentService.part.js',
    '@src/WorldEngine/domains/WorldRunOrchestrator.part.js',
    '@src/WorldEngine/domains/WorldRequestFeature.part.js',
    '@src/WorldEngine/domains/WorldManualAdvanceFeature.part.js',
    '@src/WorldEngine/domains/WorldAutoProgressController.part.js',
    '@src/WorldEngine/domains/WorldReplayService.part.js',
    '@src/WorldEngine/domains/WorldTimeOwnershipFeature.part.js',
    '@src/WorldEngine/domains/WorldNpcAuditPolicy.part.js',
    '@src/WorldEngine/domains/WorldHistoryLifecycle.part.js',
    '@src/WorldEngine/domains/WorldSoftMaintenanceFeature.part.js',
    '@src/WorldEngine/domains/WorldIntegrityRequestFeature.part.js',
    '@src/WorldEngine/domains/WorldActivityRequestFeature.part.js',
    '@src/WorldEngine/domains/WorldDueEventFeature.part.js',
    '@src/WorldEngine/domains/WorldTaskAwarenessFeature.part.js',
    '@src/WorldEngine/domains/WorldChronologyFeature.part.js',
    '@src/WorldEngine/domains/WorldRumorRequestFeature.part.js',
    '@src/WorldEngine/domains/WorldNpcAuditPromptFeature.part.js',
    '@src/WorldEngine/prompts/WorldPromptRegistry.part.js',
    '@src/WorldEngine/prompts/WorldPromptIntegrationService.part.js',
    '@src/WorldEngine/ui/views/WorldOverviewView.part.js',
    '@src/WorldEngine/ui/views/WorldPeopleView.part.js',
    '@src/WorldEngine/ui/views/WorldExplorationView.part.js',
    '@src/WorldEngine/ui/views/WorldAssetView.part.js',
    '@src/WorldEngine/ui/views/WorldEventArchiveView.part.js',
    '@src/WorldEngine/ui/views/WorldRumorView.part.js',
    '@src/WorldEngine/ui/views/WorldHistoryView.part.js',
    '@src/WorldEngine/ui/views/WorldSettingsView.part.js',
    '@src/WorldEngine/ui/views/WorldPromptView.part.js',
    '@src/WorldEngine/ui/views/WorldRequestInspectorView.part.js',
    '@src/WorldEngine/ui/WorldEngineViewRegistry.part.js',
    '@src/WorldEngine/ui/WorldPanelController.part.js',
    '@src/WorldEngine/ui/WorldPanelRenderer.part.js',
    '@src/WorldEngine/ui/WorldEditorController.part.js',
    '@src/WorldEngine/ui/WorldApiPresetController.part.js',
    '@src/WorldEngine/ui/WorldCausalOverviewController.part.js',
    '@src/WorldEngine/core/WorldEngineFeatureRegistry.part.js',
    '@src/WorldEngine/core/WorldEngineServiceContainer.part.js',
    '@src/WorldEngine/ui/WorldPromptWorkspaceController.part.js',
    '@src/WorldEngine/core/WorldEngineClassBridge.part.js',
    '@src/WorldEngine/core/WorldEngineBootstrap.part.js',
)


def part_path(name: str) -> Path:
    if not name.startswith('@'):
        raise SystemExit('world-engine PARTS must use @src paths after legacy source removal: ' + name)
    return ROOT / name[1:]


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
