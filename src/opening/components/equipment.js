import { registerOpeningComponent } from './registry.js';

registerOpeningComponent('equipment', {
  mount(root) {
    root.dataset.openingEquipment = 'ready';
  },
});
