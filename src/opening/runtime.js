import './components/bootstrap.js';
import './components/character.js';
import './components/partner.js';
import './components/store.js';
import './components/worldbook.js';
import './components/bloodline.js';
import './components/equipment.js';
import './components/attribute.js';
import './components/skill.js';
import './components/selection.js';
import '../opening/data/state-bridge.js';
import '../opening/data/state-receiver.js';
import '../opening/data/host-adapter.js';
import { getOpeningComponent } from './components/registry.js';

const root = document.getElementById('opening-root');

const openingModules = [
  'bootstrap',
  'character',
  'partner',
  'store',
  'worldbook',
  'bloodline',
  'equipment',
  'attribute',
  'skill',
  'selection',
];

export function mountOpening() {
  if (!root) return;

  for (const name of openingModules) {
    const component = getOpeningComponent(name);
    if (component?.mount) component.mount(root);
  }

  window.dispatchEvent(new CustomEvent('opening:mounted', {
    detail: { root, modules: openingModules },
  }));
}

mountOpening();
