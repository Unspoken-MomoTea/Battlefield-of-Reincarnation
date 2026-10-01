import { registerOpeningComponent } from './registry.js';

registerOpeningComponent('worldbook', {
  mount(root) {
    const section = document.createElement('section');
    section.dataset.openingComponent = 'worldbook';
    section.textContent = '世界书角色模块';
    root.appendChild(section);
  },
});
