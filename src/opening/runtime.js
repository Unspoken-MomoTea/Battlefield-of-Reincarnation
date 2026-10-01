import './components/bootstrap.js';
import './components/character.js';
import './components/partner.js';
import './components/store.js';
import './components/worldbook.js';
import { getOpeningComponent } from './components/registry.js';

const root = document.getElementById('opening-root');

const openingModules = [
  'bootstrap',
  'character',
  'partner',
  'store',
  'worldbook',
];

export function mountOpening() {
  if (!root) return;

  for (const name of openingModules) {
    const component = getOpeningComponent(name);
    if (component?.mount) {
      component.mount(root);
    }
  }

  window.dispatchEvent(new CustomEvent('opening:mounted', {
    detail: { root, modules: openingModules },
  }));
}

mountOpening();
