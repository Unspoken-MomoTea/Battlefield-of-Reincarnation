import { registerOpeningComponent } from './registry.js';

registerOpeningComponent('store', {
  mount(root) {
    const section = document.createElement('section');
    section.dataset.openingComponent = 'store';
    section.textContent = '开局商店模块';
    root.appendChild(section);
  },
});
