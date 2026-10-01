import './components/bootstrap.js';
import { getOpeningComponent } from './components/registry.js';

const root = document.getElementById('opening-root');

export function mountOpening() {
  if (!root) return;

  const component = getOpeningComponent('bootstrap');
  if (component?.mount) {
    component.mount(root);
  }

  window.dispatchEvent(new CustomEvent('opening:mounted', {
    detail: { root },
  }));
}

mountOpening();
