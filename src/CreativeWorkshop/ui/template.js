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
      <button class="rw-tab" data-tab="admin" type="button" hidden>管理</button>
    </nav>
    <main class="rw-body">
      <section class="rw-card"><div class="rw-row"><strong>服务状态</strong><span class="rw-status" data-role="health">尚未检查</span></div></section>
      <section class="rw-section" data-section="discover">
        <div class="rw-toolbar">
          <input class="rw-input grow" data-field="search" placeholder="搜索作品名称或简介">
          <select class="rw-select" data-field="category"><option value="">全部类型</option><option value="extension">扩展</option><option value="character">角色</option></select>
          <input class="rw-input" data-field="tag" maxlength="24" placeholder="标签">
          <button class="rw-button" data-action="search" type="button">搜索</button>
        </div>
        <div class="rw-grid" data-role="discover-list"></div>
        <div class="rw-card" data-role="detail-card" hidden><h3 data-role="detail-title"></h3><div class="rw-muted" data-role="detail-summary"></div><pre class="rw-detail" data-role="detail-manifest"></pre></div>
      </section>
      <section class="rw-section" data-section="installed" hidden>
        <div class="rw-toolbar">
          <div class="rw-muted grow">这里记录已下载的作品包。安装前会校验 manifest、大小与 SHA-256；包含酒馆助手脚本的作品只有在你点击安装后才会写入并启用脚本。</div>
          <button class="rw-button" data-action="check-all-updates" type="button">检查全部更新</button>
          <button class="rw-button" data-action="storage-manager" type="button">存储管理</button>
          <label class="rw-button" style="display:inline-flex;align-items:center">导入离线包<input data-action="import-offline" type="file" accept=".rwpack,application/json" hidden></label>
        </div>
        <div class="rw-grid" data-role="installed-list"></div>
      </section>
      <section class="rw-section" data-section="mine" hidden>
        <div class="rw-page-head">
          <div class="rw-page-head-copy"><small>CREATOR</small><h2>我的作品</h2><p>创建、更新并跟踪你的发布内容。</p></div>
          <button class="rw-button primary" type="button" data-action="create-project-open">发布作品</button>
        </div>
        <form class="rw-card rw-create-form" data-form="create-project" hidden>
          <h3>创建作品</h3>
          <div class="rw-row"><input class="rw-input grow" name="name" required maxlength="80" placeholder="作品名称"><select class="rw-select" name="category"><option value="extension">扩展</option><option value="character">角色</option></select></div>
          <textarea class="rw-textarea" name="summary" maxlength="2000" placeholder="作品简介"></textarea>
          <input class="rw-input" name="tags" maxlength="300" placeholder="标签：剧情, boss, 原创（逗号分隔）">
          <input class="rw-input" name="dependencies" maxlength="1200" placeholder="依赖：项目ID@最低版本，多个用逗号分隔">
          <div class="rw-create-assets">
            <div class="rw-field">
              <span>作品内容</span>
              <label class="rw-button rw-file-drop-button" data-drop-target="create-version">
                选择或拖入版本文件 · JSON / TXT / JS
                <input data-field="create-version" type="file" accept=".json,.txt,.js,application/json,text/plain,text/javascript,application/javascript" hidden>
              </label>
              <div class="rw-file-state" data-role="create-version-state">未选择版本文件；不选择则只创建草稿。</div>
            </div>
            <div class="rw-field">
              <span>封面（可选）</span>
              <label class="rw-button rw-file-drop-button" data-drop-target="create-cover">
                选择或拖入封面 · PNG / JPEG / WebP
                <input data-field="create-cover" type="file" accept="image/png,image/jpeg,image/webp" hidden>
              </label>
              <div class="rw-file-state" data-role="create-cover-state">未选择封面。</div>
            </div>
            <label class="rw-field" data-role="create-artifact-kind">
              <span>上传内容类型</span>
              <select class="rw-select" name="artifact_kind">
                <option value="worldbook">世界书</option>
                <option value="regex">正则</option>
                <option value="script">酒馆助手脚本</option>
                <option value="preset">预设</option>
                <option value="data">数据</option>
              </select>
            </label>
            <label class="rw-field" data-role="create-script-scope" hidden>
              <span>脚本作用域</span>
              <select class="rw-select" name="script_scope">
                <option value="character">当前角色</option>
                <option value="preset">当前预设</option>
                <option value="global">全局</option>
              </select>
            </label>
          </div>
          <div class="rw-row">
            <button class="rw-button primary" type="submit">下一步</button>
            <button class="rw-button" type="button" data-action="create-project-cancel">取消</button>
          </div>
        </form>
        <div class="rw-grid" data-role="my-list"></div>
      </section>
      <section class="rw-section" data-section="admin" hidden>
        <div class="rw-tabs">
          <button class="rw-tab is-active" data-admin-view="projects" type="button">作品</button>
          <button class="rw-tab" data-admin-view="reports" type="button">举报</button>
          <button class="rw-tab" data-admin-view="users" type="button">用户</button>
        </div>

        <div data-admin-section="projects">
          <div class="rw-toolbar">
            <input class="rw-input grow" data-field="admin-search" placeholder="搜索作品或作者">
            <select class="rw-select" data-field="admin-status"><option value="">全部审核状态</option><option value="pending">审核中</option><option value="approved">已通过</option><option value="rejected">已拒绝</option><option value="draft">未提交审核</option></select>
            <select class="rw-select" data-field="admin-category"><option value="">全部类型</option><option value="extension">扩展</option><option value="character">角色</option></select>
            <button class="rw-button" data-action="admin-search" type="button">筛选</button>
          </div>
          <div class="rw-grid" data-role="pending-list"></div>
        </div>

        <div data-admin-section="reports" hidden>
          <div class="rw-toolbar">
            <select class="rw-select" data-field="admin-report-status">
              <option value="open">待处理</option>
              <option value="">全部</option>
              <option value="resolved">已处理</option>
              <option value="dismissed">已忽略</option>
            </select>
            <button class="rw-button" data-action="admin-report-refresh" type="button">刷新举报</button>
          </div>
          <div class="rw-grid" data-role="report-list"></div>
        </div>

        <div data-admin-section="users" hidden>
          <div class="rw-toolbar">
            <input class="rw-input grow" data-field="admin-user-search" placeholder="搜索昵称、用户名或 Discord ID">
            <select class="rw-select" data-field="admin-user-banned">
              <option value="">全部用户</option>
              <option value="1">已封禁</option>
              <option value="0">未封禁</option>
            </select>
            <button class="rw-button" data-action="admin-user-search" type="button">搜索用户</button>
          </div>
          <div class="rw-grid" data-role="user-list"></div>
        </div>
      </section>
    </main>
  </section>`;
}
