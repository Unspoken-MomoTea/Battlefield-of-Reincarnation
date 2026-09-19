export function workshopTemplate(version) {
  return `
  <section class="rw-panel" role="dialog" aria-modal="true" aria-label="轮回战场创意工坊">
    <header class="rw-head">
      <div class="rw-title">轮回战场 · 创意工坊</div>
      <div class="rw-account" data-role="account">未登录</div>
      <div class="rw-version">v${version}</div>
      <button class="rw-button primary" type="button" data-action="login">Discord 登录</button>
      <button class="rw-button danger" type="button" data-action="logout" hidden>退出</button>
      <button class="rw-close" type="button" data-action="close">关闭</button>
    </header>
    <nav class="rw-tabs">
      <button class="rw-tab is-active" data-tab="discover" type="button">发现</button>
      <button class="rw-tab" data-tab="installed" type="button">本地</button>
      <button class="rw-tab" data-tab="mine" type="button">我的作品</button>
      <button class="rw-tab" data-tab="admin" type="button" hidden>审核</button>
    </nav>
    <main class="rw-body">
      <section class="rw-card"><div class="rw-row"><strong>服务状态</strong><span class="rw-status" data-role="health">尚未检查</span></div></section>
      <section class="rw-section" data-section="discover">
        <div class="rw-toolbar">
          <input class="rw-input grow" data-field="search" placeholder="搜索作品名称或简介">
          <select class="rw-select" data-field="category"><option value="">全部类型</option><option value="worldbook">世界书</option><option value="regex">正则</option><option value="preset">预设</option><option value="data">数据包</option><option value="mixed">混合包</option></select>
          <input class="rw-input" data-field="tag" maxlength="24" placeholder="标签">
          <button class="rw-button" data-action="search" type="button">搜索</button>
        </div>
        <div class="rw-grid" data-role="discover-list"></div>
        <div class="rw-card" data-role="detail-card" hidden><h3 data-role="detail-title"></h3><div class="rw-muted" data-role="detail-summary"></div><pre class="rw-detail" data-role="detail-manifest"></pre></div>
      </section>
      <section class="rw-section" data-section="installed" hidden>
        <div class="rw-toolbar">
          <div class="rw-muted grow">这里记录下载到 IndexedDB 的作品包。下载时会按 manifest 校验大小与 SHA-256；远程内容不会获得任意 JavaScript 执行权限。</div>
          <label class="rw-button" style="display:inline-flex;align-items:center">导入离线包<input data-action="import-offline" type="file" accept=".rwpack,application/json" hidden></label>
        </div>
        <div class="rw-grid" data-role="installed-list"></div>
      </section>
      <section class="rw-section" data-section="mine" hidden>
        <form class="rw-card" data-form="create-project">
          <h3>创建作品</h3>
          <div class="rw-row"><input class="rw-input grow" name="name" required maxlength="80" placeholder="作品名称"><select class="rw-select" name="category"><option value="worldbook">世界书</option><option value="regex">正则</option><option value="preset">预设</option><option value="data">数据包</option><option value="mixed">混合包</option></select></div>
          <textarea class="rw-textarea" name="summary" maxlength="2000" placeholder="作品简介"></textarea>
          <input class="rw-input" name="tags" maxlength="300" placeholder="标签：剧情, boss, 原创（逗号分隔）">
          <div><button class="rw-button primary" type="submit">创建草稿</button></div>
        </form>
        <div class="rw-grid" data-role="my-list"></div>
      </section>
      <section class="rw-section" data-section="admin" hidden>
        <div class="rw-toolbar">
          <input class="rw-input grow" data-field="admin-search" placeholder="搜索作品或作者">
          <select class="rw-select" data-field="admin-status"><option value="">全部审核状态</option><option value="pending">审核中</option><option value="approved">已通过</option><option value="rejected">已拒绝</option><option value="draft">未提交审核</option></select>
          <select class="rw-select" data-field="admin-category"><option value="">全部类型</option><option value="worldbook">世界书</option><option value="regex">正则</option><option value="preset">预设</option><option value="data">数据包</option><option value="mixed">混合包</option></select>
          <button class="rw-button" data-action="admin-search" type="button">筛选</button>
        </div>
        <div class="rw-grid" data-role="pending-list"></div>
      </section>
    </main>
  </section>`;
}
