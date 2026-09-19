import { buildUploadBundle } from '../services/upload.js';
import { CATEGORY_LABELS, STATUS_LABELS } from '../ui/constants.js';
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
    host: context.host,
  };
  return {
    discover: createDiscoverView({
      ...common,
      projectService: context.projectService,
      workshopApi: context.workshopApi,
      categoryLabels: CATEGORY_LABELS,
      getAuth: context.getAuth,
    }),
    installed: createInstalledView({
      ...common,
      projectService: context.projectService,
      doc: context.doc,
      categoryLabels: CATEGORY_LABELS,
    }),
    author: createAuthorView({
      ...common,
      workshopApi: context.workshopApi,
      buildUploadBundle,
      doc: context.doc,
      categoryLabels: CATEGORY_LABELS,
      statusLabels: STATUS_LABELS,
      getAuth: context.getAuth,
    }),
    admin: createAdminView({
      ...common,
      workshopApi: context.workshopApi,
      categoryLabels: CATEGORY_LABELS,
      getAuth: context.getAuth,
    }),
  };
}
