export function createAdminApi(request, requestRaw) {
  return {
    listAdminProjects({ query = '', category = '', reviewStatus = '', offset = 0 } = {}) {
      const params = new URLSearchParams({ limit: '48', offset: String(offset) });
      if (query.trim()) params.set('query', query.trim());
      if (category) params.set('category', category);
      if (reviewStatus) params.set('review_status', reviewStatus);
      return request(`/api/admin/projects?${params}`, {}, true);
    },

    listAdminUpdates({ offset = 0 } = {}) {
      const params = new URLSearchParams({ limit: '50', offset: String(offset) });
      return request(`/api/admin/updates?${params}`, {}, true);
    },

    getPendingReview(projectId) {
      return request(`/api/admin/projects/${encodeURIComponent(projectId)}/review`, {}, true);
    },

    async getAdminProjectCover(projectId) {
      const response = await requestRaw(
        `/api/admin/projects/${encodeURIComponent(projectId)}/cover`,
        {},
        true,
      );
      return response.blob();
    },

    reviewProject(projectId, decision, note = '') {
      return request(
        `/api/admin/projects/${encodeURIComponent(projectId)}/review`,
        { method: 'POST', body: JSON.stringify({ decision, note }) },
        true,
      );
    },

    deleteAdminProject(projectId) {
      return request(
        `/api/admin/projects/${encodeURIComponent(projectId)}`,
        { method: 'DELETE' },
        true,
      );
    },

    setAdminProjectState(projectId, action, note = '') {
      return request(
        `/api/admin/projects/${encodeURIComponent(projectId)}/state`,
        { method: 'POST', body: JSON.stringify({ action, note }) },
        true,
      );
    },

    listAdminLogs(projectId = '') {
      const params = new URLSearchParams({ limit: '100' });
      if (projectId) params.set('project_id', projectId);
      return request(`/api/admin/logs?${params}`, {}, true);
    },

    listAdminUsers({ query = '', banned = '', offset = 0 } = {}) {
      const params = new URLSearchParams({ limit: '50', offset: String(offset) });
      if (query.trim()) params.set('query', query.trim());
      if (banned !== '') params.set('banned', String(banned));
      return request(`/api/admin/users?${params}`, {}, true);
    },

    setUserBan(userId, banned, reason = '') {
      return request(
        `/api/admin/users/${encodeURIComponent(userId)}/state`,
        { method: 'POST', body: JSON.stringify({ banned, reason }) },
        true,
      );
    },

    listAdminReports({ status = 'open', offset = 0 } = {}) {
      const params = new URLSearchParams({ limit: '50', offset: String(offset) });
      if (status) params.set('status', status);
      return request(`/api/admin/reports?${params}`, {}, true);
    },

    resolveProjectReport(reportId, status, note = '') {
      return request(
        `/api/admin/reports/${encodeURIComponent(reportId)}`,
        { method: 'POST', body: JSON.stringify({ status, note }) },
        true,
      );
    },
  };
}
