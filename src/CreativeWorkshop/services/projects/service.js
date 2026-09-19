import { workshopApi } from '../api.js';
import { workshopInstaller } from '../installer.js';
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
  installed() { return listCachedProjects(); }
  apply(projectId) { return workshopInstaller.apply(projectId); }
  uninstall(projectId) { return workshopInstaller.uninstall(projectId); }
  removeCached(projectId) { return removeCachedProject(projectId); }
}

export const projectService = new ProjectService();
