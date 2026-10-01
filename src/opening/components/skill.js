import { registerOpeningComponent } from './registry.js';
import { getOpeningState } from '../data/opening-state.js';

const skill = {
  mount(root) {
    const state = getOpeningState();
    state.selections.skills ||= [];
    const panel = document.createElement('section');
    panel.dataset.openingModule = 'skill';
    panel.textContent = '技能选择模块已加载';
    root.appendChild(panel);
  },
};

registerOpeningComponent('skill', skill);
