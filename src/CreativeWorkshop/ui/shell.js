export function createWorkshopShell(doc, version) {
  const VERSION = version;
  const style = doc.createElement('style');
  style.dataset.reincarnationWorkshop = 'style';
  style.textContent = `
    .rw-launcher{position:fixed;right:24px;bottom:92px;width:52px;height:52px;border-radius:50%;border:1px solid rgba(255,215,145,.42);background:linear-gradient(145deg,#251a2b,#111018);color:#f3d7ae;box-shadow:0 8px 26px rgba(0,0,0,.42),0 0 18px rgba(164,89,191,.22);z-index:2147483400;cursor:pointer;font:700 21px/1 KaiTi,serif}
    .rw-launcher:hover{filter:brightness(1.12)}
    .rw-overlay{position:fixed;inset:0;z-index:2147483390;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(8,8,12,.66);backdrop-filter:blur(8px);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#eee}
    .rw-overlay.is-open{display:flex}.rw-panel{width:min(1080px,97vw);height:min(760px,94vh);background:linear-gradient(180deg,#1d1822,#111116);border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.55);overflow:hidden;display:flex;flex-direction:column}
    .rw-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.09)}.rw-title{font-weight:750;font-size:18px;flex:1}.rw-version{opacity:.55;font-size:12px}
    .rw-close,.rw-button,.rw-tab,.rw-input,.rw-select{border:1px solid rgba(255,255,255,.13);background:#29242f;color:#f6f0f7;border-radius:9px}.rw-close,.rw-button,.rw-tab{padding:8px 12px;cursor:pointer}.rw-button.primary{background:#7652a8}.rw-button.good{background:#315d45}.rw-button.danger{background:#673942}.rw-button:disabled{opacity:.45;cursor:not-allowed}
    .rw-tabs{display:flex;gap:8px;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.07);overflow:auto}.rw-tab.is-active{background:#7652a8}.rw-tab[hidden]{display:none}
    .rw-body{padding:16px;overflow:auto;display:grid;gap:14px}.rw-toolbar,.rw-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.rw-input,.rw-select{padding:9px 11px;min-width:130px}.rw-input.grow{flex:1;min-width:180px}.rw-textarea{width:100%;min-height:76px;resize:vertical;border:1px solid rgba(255,255,255,.13);background:#17141b;color:#f6f0f7;border-radius:9px;padding:9px;box-sizing:border-box}
    .rw-card{border:1px solid rgba(255,255,255,.09);border-radius:13px;background:rgba(255,255,255,.035);padding:14px;display:grid;gap:9px}.rw-card h3{margin:0;font-size:15px}.rw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}.rw-muted{opacity:.65;font-size:13px;line-height:1.55}.rw-meta{display:flex;gap:8px;flex-wrap:wrap;font-size:12px;opacity:.75}.rw-pill{border:1px solid rgba(255,255,255,.13);border-radius:999px;padding:3px 7px}.rw-status{font-size:13px}.rw-status.ok{color:#9be4b0}.rw-status.bad{color:#ffaaa1}.rw-section[hidden]{display:none}.rw-empty{padding:28px;text-align:center;opacity:.6;border:1px dashed rgba(255,255,255,.13);border-radius:12px}.rw-account{font-size:13px;opacity:.8}.rw-detail{white-space:pre-wrap;word-break:break-word;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;max-height:220px;overflow:auto;background:#0f0e12;border-radius:9px;padding:10px}
    @media(max-width:600px){.rw-launcher{width:46px;height:46px;right:14px;bottom:82px}.rw-overlay{padding:0}.rw-panel{width:100vw;height:100dvh;border-radius:0}.rw-body{padding:12px}.rw-grid{grid-template-columns:1fr}}
  `;
  doc.head.appendChild(style);

  const launcher = doc.createElement('button');
  launcher.className = 'rw-launcher';
  launcher.type = 'button';
  launcher.title = '打开轮回战场创意工坊';
  launcher.textContent = '坊';
  doc.body.appendChild(launcher);

  const overlay = doc.createElement('div');
  overlay.className = 'rw-overlay';
  overlay.innerHTML = `
    <section class="rw-panel" role="dialog" aria-modal="true" aria-label="轮回战场创意工坊">
      <header class="rw-head">
        <div class="rw-title">轮回战场 · 创意工坊</div>
        <div class="rw-account" data-role="account">未登录</div>
        <div class="rw-version">v${VERSION}</div>
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
        <section class="rw-card">
          <div class="rw-row"><strong>服务状态</strong><span class="rw-status" data-role="health">尚未检查</span></div>
        </section>
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
            <label class="rw-button" style="display:inline-flex;align-items:center">
              导入离线包
              <input data-action="import-offline" type="file" accept=".rwpack,application/json" hidden>
            </label>
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
            <select class="rw-select" data-field="admin-status">
              <option value="">全部审核状态</option>
              <option value="pending">审核中</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
              <option value="draft">未提交审核</option>
            </select>
            <select class="rw-select" data-field="admin-category">
              <option value="">全部类型</option>
              <option value="worldbook">世界书</option>
              <option value="regex">正则</option>
              <option value="preset">预设</option>
              <option value="data">数据包</option>
              <option value="mixed">混合包</option>
            </select>
            <button class="rw-button" data-action="admin-search" type="button">筛选</button>
          </div>
          <div class="rw-grid" data-role="pending-list"></div>
        </section>
      </main>
    </section>
  `;
  doc.body.appendChild(overlay);

  const nodes = {
    health: overlay.querySelector('[data-role="health"]'),
    account: overlay.querySelector('[data-role="account"]'),
    login: overlay.querySelector('[data-action="login"]'),
    logout: overlay.querySelector('[data-action="logout"]'),
    adminTab: overlay.querySelector('[data-tab="admin"]'),
    search: overlay.querySelector('[data-field="search"]'),
    category: overlay.querySelector('[data-field="category"]'),
    tag: overlay.querySelector('[data-field="tag"]'),
    discoverList: overlay.querySelector('[data-role="discover-list"]'),
    installedList: overlay.querySelector('[data-role="installed-list"]'),
    offlineInput: overlay.querySelector('[data-action="import-offline"]'),
    myList: overlay.querySelector('[data-role="my-list"]'),
    pendingList: overlay.querySelector('[data-role="pending-list"]'),
    adminSearch: overlay.querySelector('[data-field="admin-search"]'),
    adminStatus: overlay.querySelector('[data-field="admin-status"]'),
    adminCategory: overlay.querySelector('[data-field="admin-category"]'),
    detailCard: overlay.querySelector('[data-role="detail-card"]'),
    detailTitle: overlay.querySelector('[data-role="detail-title"]'),
    detailSummary: overlay.querySelector('[data-role="detail-summary"]'),
    detailManifest: overlay.querySelector('[data-role="detail-manifest"]'),
    createForm: overlay.querySelector('[data-form="create-project"]'),
  };
  return { style, launcher, overlay, nodes };
}
