import { registerOpeningComponent } from './registry.js';
import { getOpeningSelection, setOpeningSelection } from '../data/selection-store.js';

const attribute = {
  mount(root) {
    const selection = getOpeningSelection();
    const character = selection.selected.character || {};
    if (!character.attributes) {
      setOpeningSelection('selected.character', {
        ...character,
        attributes: {},
      });
    }

    const panel = document.createElement('section');
    panel.dataset.openingModule = 'attribute';
    panel.textContent = '属性构筑模块已加载';
    root.appendChild(panel);
  },
};

registerOpeningComponent('attribute', attribute);
