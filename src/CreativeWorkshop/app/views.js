import { ARTIFACT_LABELS, CATEGORY_LABELS, STATUS_LABELS } from '../ui/constants.js';
import { createAdminView } from '../views/admin.js';
import { createAuthorView } from '../views/author.js';
import { createDiscoverView } from '../views/discover.js';
import { createInstalledView } from '../views/installed.js';

export function createWorkshopViews(context) {
  const common = {
    nodes: context.nodes,
    element: context.ui.element,
    button: context.ui.button,
    empty: context.ui.empty,
    notifyError: context.ui.notifyError,
    openModal: context.ui.openModal,
    host: context.host,
  };
  return {
    discover: createDiscoverView({
      ...common,
      projectService: context.projectService,
      workshopApi: context.workshopApi,
      categoryLabels: CATEGORY_LABELS,
      artifactLabels: ARTIFACT_LABELS,
      getAuth: context.getAuth,
    }),
    installed: createInstalledView({
      ...common,
      projectService: context.projectService,
      workshopApi: context.workshopApi,
      doc: context.doc,
      categoryLabels: CATEGORY_LABELS,
    }),
    author: createAuthorView({
      ...common,
      workshopApi: context.workshopApi,
      doc: context.doc,
      categoryLabels: CATEGORY_LABELS,
      artifactLabels: ARTIFACT_LABELS,
      statusLabels: STATUS_LABELS,
      getAuth: context.getAuth,
    }),
    admin: createAdminView({
      ...common,
      workshopApi: context.workshopApi,
      categoryLabels: CATEGORY_LABELS,
      artifactLabels: ARTIFACT_LABELS,
      getAuth: context.getAuth,
    }),
  };
}
