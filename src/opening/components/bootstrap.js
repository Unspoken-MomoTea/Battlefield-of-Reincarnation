import { registerOpeningComponent } from './registry.js';

registerOpeningComponent('bootstrap', {
  mount(root) {
    root.innerHTML = `
      <section class="opening-panel">
        <h1>轮回建档协议</h1>
        <p>开局模块迁移中。</p>
      </section>
    `;
  },
});
