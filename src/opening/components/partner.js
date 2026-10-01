import { registerOpeningComponent } from './registry.js';

registerOpeningComponent('partner', {
  mount(root) {
    const section = document.createElement('section');
    section.dataset.openingComponent = 'partner';
    section.textContent = '伙伴构筑模块';
    root.appendChild(section);
  },
});
