import { registerOpeningComponent } from './registry.js';
import { getOpeningSelection, setOpeningSelection } from '../data/selection-store.js';

const skill = {
  mount(root) {
    const selection = getOpeningSelection();
    if (!Array.isArray(selection.selected.skills)) {
      setOpeningSelection('selected.skills', []);
    }

    const panel = document.createElement('section');
    panel.dataset.openingModule = 'skill';
    panel.textContent = '技能选择模块已加载';
    root.appendChild(panel);
  },
};

registerOpeningComponent('skill', skill);
