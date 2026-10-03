import { getApiBase } from '../../config.js';

export function createProjectApi(request, requestRaw, { submitTimeoutMs = 10_000 } = {}) {
  async function submitWithRecovery(projectId, { localBackupConfirmed = false } = {}) {
    const path = `/api/projects/${encodeURIComponent(projectId)}/submit`;
    const timeoutMs = Math.max(100, Number(submitTimeoutMs) || 10_000);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      let timer = null;
      const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          const error = new Error('提交审核响应超时，正在确认服务器状态');
          error.code = 'request_timeout';
          reject(error);
          try { controller?.abort(); } catch {}
        }, timeoutMs);
      });

      try {
        return await Promise.race([
          request(
            path,
            {
              method: 'POST',
              body: JSON.stringify({ local_backup_confirmed: Boolean(localBackupConfirmed) }),
              ...(controller ? { signal: controller.signal } : {}),
            },
            true,
          ),
          timeout,
        ]);
      } catch (error) {
        if (error?.code !== 'request_timeout' || attempt > 0) throw error;
      } finally {
        if (timer != null) clearTimeout(timer);
      }
    }
    throw new Error('提交审核失败');
  }

  return {
    getProjectCatalog() {
      return request('/api/projects/catalog', { cache: 'no-store' });
    },

    listProjects(query = '', category = '', offset = 0, tag = '', sort = 'latest', kind = '') {
      const params = new URLSearchParams({ limit: '24', offset: String(offset), sort });
      if (query.trim()) params.set('query', query.trim());
      if (category) params.set('category', category);
      if (kind) params.set('kind', kind);
      if (tag.trim()) params.set('tag', tag.trim());
      return request(`/api/projects?${params}`, { cache: 'no-store' });
    },

    getProject(projectId) {
      return request(`/api/projects/${encodeURIComponent(projectId)}`);
    },

    getProjectVersion(projectId) {
      return request(`/api/projects/${encodeURIComponent(projectId)}/version`);
    },

    getProjectVersions(ids) {
      return request('/api/projects/versions/batch', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
    },

    downloadProject(projectId, version = null, { cacheBust = false } = {}) {
      const params = new URLSearchParams();
      const normalizedVersion = Number(version);
      if (Number.isInteger(normalizedVersion) && normalizedVersion > 0) {
        params.set('version', String(normalizedVersion));
      }
      if (cacheBust) params.set('_', String(Date.now()));
      const query = params.size ? `?${params}` : '';
      return request(`/api/projects/${encodeURIComponent(projectId)}/download${query}`);
    },

    listOwnProjects() {
      return request('/api/my/projects', {}, true);
    },

    createProject(input) {
      return request('/api/projects', { method: 'POST', body: JSON.stringify(input) }, true);
    },

    getOwnProjectEditor(projectId) {
      return request(
        `/api/projects/${encodeURIComponent(projectId)}/edit`,
        {},
        true,
      );
    },

    async getOwnProjectCover(projectId) {
      const response = await requestRaw(
        `/api/projects/${encodeURIComponent(projectId)}/edit-cover`,
        {},
        true,
      );
      return response.blob();
    },

    setProjectVisibility(projectId, hidden) {
      return request(
        `/api/projects/${encodeURIComponent(projectId)}/visibility`,
        { method: 'POST', body: JSON.stringify({ hidden: Boolean(hidden) }) },
        true,
      );
    },

    updateProject(projectId, input) {
      return request(
        `/api/projects/${encodeURIComponent(projectId)}`,
        { method: 'PATCH', body: JSON.stringify(input) },
        true,
      );
    },

    deleteProject(projectId) {
      return request(
        `/api/projects/${encodeURIComponent(projectId)}`,
        { method: 'DELETE' },
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

    submitProject(projectId, options = {}) {
      return submitWithRecovery(projectId, options);
    },

    uploadProjectCover(projectId, file) {
      if (!file?.type) throw new Error('请选择有效的封面图片');
      return request(
        `/api/projects/${encodeURIComponent(projectId)}/cover`,
        {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        },
        true,
      );
    },

    getProjectCoverUrl(projectId) {
      return `${getApiBase()}/api/projects/${encodeURIComponent(projectId)}/cover`;
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

    reportProject(projectId, reason, details = '') {
      return request(
        `/api/projects/${encodeURIComponent(projectId)}/report`,
        { method: 'POST', body: JSON.stringify({ reason, details }) },
        true,
      );
    },
  };
}
