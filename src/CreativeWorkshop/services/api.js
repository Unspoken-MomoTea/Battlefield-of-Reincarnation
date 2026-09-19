import { createAdminApi } from './api/admin.js';
import { createAuthApi } from './api/auth.js';
import { createProjectApi } from './api/projects.js';
import { request, WorkshopApiError } from './api/transport.js';

export { WorkshopApiError };

export const workshopApi = {
  request,
  health: () => request('/api/health'),
  ...createAuthApi(request),
  ...createProjectApi(request),
  ...createAdminApi(request),
};
