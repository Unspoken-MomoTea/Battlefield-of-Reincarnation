export function createWorkshopBridge({ version, open, close, refresh, workshopApi, projectService }) {
  return {
    version, open, close, refresh,
    login: () => workshopApi.login(),
    logout: () => workshopApi.logout(),
    getSession: () => workshopApi.getStoredAuth(),
    listInstalled: () => projectService.installed(),
    cacheProject: projectId => projectService.cache(projectId),
    checkProjectUpdate: projectId => projectService.checkUpdate(projectId),
    applyProject: projectId => projectService.apply(projectId),
    uninstallProject: projectId => projectService.uninstall(projectId),
    exportProject: projectId => projectService.exportCached(projectId),
    importProject: file => projectService.importOffline(file),
  };
}
