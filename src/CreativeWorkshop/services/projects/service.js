import { workshopApi } from '../api.js';
import { workshopInstaller } from '../installer.js';
import { storageManager } from '../storage/manager.js';
import { updateChecker } from './update-check.js';
import {
  cacheRemoteProject, checkCachedProjectUpdate, exportCachedProject,
  importOfflineProject, listCachedProjects, removeCachedProject, saveLocalTestProject, updateRemoteProject,
} from './cache.js';
import { reconcileAppliedOpeningData } from './opening-reconcile.js';
import { filterAndPageCatalog } from './catalog.js';

export class ProjectService {
  constructor() {
    this.catalogCache = null;
    this.catalogPromise = null;
    this.catalogFetchedAt = 0;
    this.catalogTtlMs = 5 * 60 * 1000;
  }

  async catalog(force = false) {
    const expired = this.catalogCache
      && Date.now() - this.catalogFetchedAt >= this.catalogTtlMs;
    if (force || expired) {
      this.catalogCache = null;
      this.catalogPromise = null;
      this.catalogFetchedAt = 0;
    }
    if (this.catalogCache) return this.catalogCache;
    if (!this.catalogPromise) {
      this.catalogPromise = workshopApi.getProjectCatalog()
        .then(result => {
          this.catalogCache = result && Array.isArray(result.items) ? result : { items: [] };
          this.catalogFetchedAt = Date.now();
          return this.catalogCache;
        })
        .finally(() => { this.catalogPromise = null; });
    }
    return this.catalogPromise;
  }

  async list(query = '', category = '', offset = 0, tag = '', sort = 'latest', kind = '') {
    const catalog = await this.catalog();
    return filterAndPageCatalog(catalog.items, {
      query, category, offset, tag, sort, kind, limit: 24,
    });
  }

  refreshCatalog() { return this.catalog(true); }

  async favorites(offset = 0, limit = 100) {
    const [favoriteRefs, catalog] = await Promise.all([
      workshopApi.listFavoriteProjects(offset, limit),
      this.catalog(),
    ]);
    const byId = new Map((catalog?.items || []).map(item => [String(item.id), item]));
    return {
      items: (favoriteRefs?.items || [])
        .map(entry => byId.get(String(entry.project_id)))
        .filter(Boolean),
      next_offset: favoriteRefs?.next_offset ?? null,
    };
  }

  detail(projectId) { return workshopApi.getProject(projectId); }
  cache(projectId) { return cacheRemoteProject(workshopApi, projectId); }
  importOffline(file) { return importOfflineProject(file); }
  exportCached(projectId) { return exportCachedProject(projectId); }
  saveLocalTest(project) { return saveLocalTestProject(project); }
  checkUpdate(projectId) { return checkCachedProjectUpdate(workshopApi, projectId); }
  updateLatest(projectId) { return updateRemoteProject(workshopApi, workshopInstaller, projectId); }
  checkAllUpdates(force = false) { return updateChecker.checkAll(force); }
  installed() { return listCachedProjects(); }
  preflight(projectId) { return workshopInstaller.preflight(projectId); }
  apply(projectId) { return workshopInstaller.apply(projectId); }
  inspectInstallation(projectId) { return workshopInstaller.inspect(projectId); }
  repair(projectId) { return workshopInstaller.repair(projectId); }
  uninstall(projectId) { return workshopInstaller.uninstall(projectId); }
  removeCached(projectId) { return removeCachedProject(projectId); }
  storageEstimate() { return storageManager.estimate(); }
  cleanupCacheOnly() { return storageManager.cleanupCacheOnly(); }
  reconcileOpeningData() { return reconcileAppliedOpeningData(); }
}

export const projectService = new ProjectService();
