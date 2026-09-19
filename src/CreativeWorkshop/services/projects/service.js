import { workshopApi } from '../api.js';
import { workshopInstaller } from '../installer.js';
import { storageManager } from '../storage/manager.js';
import { updateChecker } from './update-check.js';
import {
  cacheRemoteProject, checkCachedProjectUpdate, exportCachedProject,
  importOfflineProject, listCachedProjects, removeCachedProject,
} from './cache.js';

export class ProjectService {
  list(query = '', category = '', offset = 0, tag = '') {
    return workshopApi.listProjects(query, category, offset, tag);
  }
  detail(projectId) { return workshopApi.getProject(projectId); }
  cache(projectId) { return cacheRemoteProject(workshopApi, projectId); }
  importOffline(file) { return importOfflineProject(file); }
  exportCached(projectId) { return exportCachedProject(projectId); }
  checkUpdate(projectId) { return checkCachedProjectUpdate(workshopApi, projectId); }
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
}

export const projectService = new ProjectService();
