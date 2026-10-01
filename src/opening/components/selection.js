import { getOpeningSelection, setOpeningSelection } from '../data/selection-store.js';
import { registerOpeningComponent } from './registry.js';

registerOpeningComponent('selection', {
  mount(root) {
    root?.dataset && (root.dataset.openingSelection = 'ready');
    window.OpeningSelection = {
      get: getOpeningSelection,
      set: setOpeningSelection,
    };
  },
});
