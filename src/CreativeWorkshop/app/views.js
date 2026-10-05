import { ARTIFACT_LABELS, CATEGORY_LABELS, PROJECT_KIND_LABELS, STATUS_LABELS } from '../ui/constants.js';
import { createAdminView } from '../views/admin.js';
import { createAuthorView } from '../views/author.js';
import { createDiscoverView } from '../views/discover.js';
import { createInstalledView } from '../views/installed.js';
import { createMarketView } from '../views/market.js';
import { createMaintenanceView } from '../views/maintenance.js';

export function createWorkshopViews(context) {
  const common = {
    nodes: context.nodes,
    element: context.ui.element,
    button: context.ui.button,
    empty: context.ui.empty,
    notifyError: context.ui.notifyError,
    confirmDialog: context.ui.confirmDialog,
    openModal: context.ui.openModal,
    host: context.host,
  };
  const author = createAuthorView({
    ...common,
    workshopApi: context.workshopApi,
    projectService: context.projectService,
    doc: context.doc,
    categoryLabels: CATEGORY_LABELS,
    artifactLabels: ARTIFACT_LABELS,
    statusLabels: STATUS_LABELS,
    getAuth: context.getAuth,
  });
  const installed = createInstalledView({
    ...common,
    projectService: context.projectService,
    workshopApi: context.workshopApi,
    doc: context.doc,
    categoryLabels: CATEGORY_LABELS,
    editLocalTest: (project, onSaved) => author.editLocalTest(project, onSaved),
  });
  return {
    discover: createDiscoverView({
      ...common,
      projectService: context.projectService,
      workshopApi: context.workshopApi,
      categoryLabels: CATEGORY_LABELS,
      kindLabels: PROJECT_KIND_LABELS,
      artifactLabels: ARTIFACT_LABELS,
      getAuth: context.getAuth,
      doc: context.doc,
    }),
    installed,
    market: createMarketView({
      ...common,
      marketService: context.marketService,
      getAuth: context.getAuth,
      doc: context.doc,
    }),
    author,
    maintenance: createMaintenanceView({
      ...common,
      projectService: context.projectService,
      selfUpdater: context.selfUpdater,
      worldEngineUpdater: context.worldEngineUpdater,
      statusBarUpdater: context.statusBarUpdater,
      calculatorUpdater: context.calculatorUpdater,
      version: context.version,
      currentSha: context.currentSha,
      hotUpdateClient: context.hotUpdateClient,
    }),
    admin: createAdminView({
      ...common,
      workshopApi: context.workshopApi,
      doc: context.doc,
      categoryLabels: CATEGORY_LABELS,
      kindLabels: PROJECT_KIND_LABELS,
      artifactLabels: ARTIFACT_LABELS,
      getAuth: context.getAuth,
    }),
  };
}
