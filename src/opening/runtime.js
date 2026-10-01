import './components/bootstrap.js';
import './components/character.js';
import { getOpeningComponent } from './components/registry.js';

const root = document.getElementById('opening-root');

export function mountOpening() {
  if (!root) return;

  const bootstrap = getOpeningComponent('bootstrap');
  if (bootstrap?.mount) {
    bootstrap.mount(root);
  }

  const character = getOpeningComponent('character');
  if (character?.mount) {
    character.mount(root);
  }

  window.dispatchEvent(new CustomEvent('opening:mounted', {
    detail: { root },
  }));
}

mountOpening();
