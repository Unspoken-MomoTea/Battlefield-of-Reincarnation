import { registerOpeningComponent } from './registry.js';

registerOpeningComponent('bloodline', {
  mount(root) {
    root.dataset.openingBloodline = 'ready';
  },
});
