import { registerOpeningComponent } from './registry.js';
import { getOpeningState } from '../data/opening-state.js';

const attribute = {
  mount(root) {
    const state = getOpeningState();
    state.character.attributes = state.character.attributes || {};
    const panel = document.createElement('section');
    panel.dataset.openingModule = 'attribute';
    panel.textContent = '属性构筑模块已加载';
    root.appendChild(panel);
  },
};

registerOpeningComponent('attribute', attribute);
