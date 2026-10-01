import { registerOpeningComponent } from './registry.js';

registerOpeningComponent('character', {
  mount(root) {
    const panel = document.createElement('section');
    panel.id = 'opening-character-panel';
    panel.textContent = '角色构筑模块加载中...';
    root.append(panel);
  },
});
