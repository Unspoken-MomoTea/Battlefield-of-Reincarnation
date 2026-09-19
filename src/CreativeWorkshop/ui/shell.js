import { collectWorkshopNodes } from './nodes.js';
import { WORKSHOP_CSS } from './styles.js';
import { workshopTemplate } from './template.js';

export function createWorkshopShell(doc, version) {
  const style = doc.createElement('style');
  style.dataset.reincarnationWorkshop = 'style';
  style.textContent = WORKSHOP_CSS;
  doc.head.appendChild(style);

  const launcher = doc.createElement('button');
  launcher.className = 'rw-launcher';
  launcher.type = 'button';
  launcher.title = '打开轮回战场创意工坊';
  launcher.textContent = '坊';
  doc.body.appendChild(launcher);

  const overlay = doc.createElement('div');
  overlay.className = 'rw-overlay';
  overlay.innerHTML = workshopTemplate(version);
  doc.body.appendChild(overlay);

  return { style, launcher, overlay, nodes: collectWorkshopNodes(overlay) };
}
