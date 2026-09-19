export function createProjectApi(request) {
  return {
    listProjects(query = '', category = '', offset = 0, tag = '') {
      const params = new URLSearchParams({ limit: '24', offset: String(offset) });
      if (query.trim()) params.set('query', query.trim());
      if (category) params.set('category', category);
      if (tag.trim()) params.set('tag', tag.trim());
      return request(`/api/projects?${params}`);
    },

    getProject(projectId) {
      return request(`/api/projects/${encodeURIComponent(projectId)}`);
    },

    getProjectVersion(projectId) {
      return request(`/api/projects/${encodeURIComponent(projectId)}/version`);
    },

    downloadProject(projectId) {
      return request(`/api/projects/${encodeURIComponent(projectId)}/download`);
    },

    listOwnProjects() {
      return request('/api/my/projects', {}, true);
    },

    createProject(input) {
      return request('/api/projects', { method: 'POST', body: JSON.stringify(input) }, true);
    },

    updateProject(projectId, input) {
      return request(
        `/api/projects/${encodeURIComponent(projectId)}`,
        { method: 'PATCH', body: JSON.stringify(input) },
        true,
      );
    },

    uploadProjectVersion(projectId, input) {
      return request(
        `/api/projects/${encodeURIComponent(projectId)}/versions`,
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    submitProject(projectId) {
      return request(`/api/projects/${encodeURIComponent(projectId)}/submit`, { method: 'POST' }, true);
    },

    getProjectEngagement(projectId) {
      return request(`/api/projects/${encodeURIComponent(projectId)}/engagement`, {}, true);
    },

    setProjectEngagement(projectId, kind, enabled) {
      return request(
        `/api/projects/${encodeURIComponent(projectId)}/engagement`,
        { method: 'POST', body: JSON.stringify({ kind, enabled }) },
        true,
      );
    },
  };
}
