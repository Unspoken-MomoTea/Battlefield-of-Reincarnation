export function createAdminApi(request, requestRaw) {
  return {
    listAdminProjects({ query = '', category = '', reviewStatus = '', offset = 0 } = {}) {
      const params = new URLSearchParams({ limit: '48', offset: String(offset) });
      if (query.trim()) params.set('query', query.trim());
      if (category) params.set('category', category);
      if (reviewStatus) params.set('review_status', reviewStatus);
      return request(`/api/admin/projects?${params}`, {}, true);
    },

    listPendingProjects() {
      return request('/api/admin/pending', {}, true);
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
  };
}
