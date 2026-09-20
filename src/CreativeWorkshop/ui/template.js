export function workshopTemplate(version) {
  return `
  <section class="rw-panel" role="dialog" aria-modal="true" aria-label="轮回战场创意工坊">
    <header class="rw-head">
      <div class="rw-title">创意工坊</div>
      <div class="rw-head-discover-tools" data-role="discover-head-tools">
        <input class="rw-input grow" data-field="search" placeholder="搜索项目、作者或简介">
        <select class="rw-select" data-field="sort" aria-label="作品排序">
          <option value="latest">最新</option>
          <option value="popular">热门</option>
          <option value="downloads">下载最多</option>
          <option value="favorites">收藏最多</option>
          <option value="likes">点赞最多</option>
        </select>
        <button class="rw-button" data-action="search" type="button">搜索</button>
      </div>
      <button class="rw-button rw-maintenance-trigger" type="button" data-action="maintenance">DLC 修复</button>
      <span class="rw-health-chip" data-role="health" title="工坊服务状态">连接中</span>
      <div class="rw-version">v${version}</div>
      <div class="rw-account-wrap" data-role="account-wrap">
        <button class="rw-account" data-role="account" data-action="account-menu-toggle" type="button" hidden>账户</button>
        <div class="rw-account-dropdown" data-role="account-menu" hidden>
          <button type="button" data-action="mine-menu">我的项目</button>
          <button type="button" data-action="upload-menu">上传 / 发布</button>
          <button type="button" data-action="admin-menu" hidden>管理</button>
          <button type="button" class="danger" data-action="logout" hidden>登出</button>
        </div>
      </div>
      <button class="rw-button primary" type="button" data-action="login">Discord 登录</button>
      <button class="rw-close" type="button" data-action="close">关闭</button>
    </header>
    <nav class="rw-tabs">
      <div class="rw-nav-label">浏览</div>
      <button class="rw-tab is-active" data-tab="discover" type="button">发现</button>
      <div class="rw-nav-divider"></div>
      <button class="rw-tab rw-nav-filter is-filter-active" data-category-filter="" type="button">全部项目</button>
      <button class="rw-tab rw-nav-filter" data-category-filter="extension" type="button">扩展</button>
      <button class="rw-tab rw-nav-filter" data-category-filter="character" type="button">角色</button>
      <div class="rw-nav-divider"></div>
      <button class="rw-tab" data-tab="installed" type="button">已安装</button>
      <div class="rw-nav-connection">● 已连接 SillyTavern</div>
    </nav>
    <main class="rw-body">
      <section class="rw-section" data-section="discover">
        <div class="rw-page-head">
          <div class="rw-page-head-copy"><small>DISCOVER</small><h2>发现作品</h2><p>浏览角色与扩展，下载后再由你决定是否安装到酒馆。</p></div>
          <div class="rw-page-head-meta" data-role="discover-count">正在载入</div>
        </div>
        <input type="hidden" data-field="category" value="">
        <div class="rw-discover-subtools">
          <input class="rw-input rw-tag-input" data-field="tag" maxlength="24" placeholder="精确标签（可选）">
          <span class="rw-muted">分类从左侧切换；搜索与排序在顶部。</span>
        </div>
        <div class="rw-grid rw-project-grid" data-role="discover-list"></div>
        <div class="rw-load-more-wrap"><button class="rw-button" data-action="discover-more" type="button" hidden>加载更多</button></div>
      </section>
      <section class="rw-section" data-section="installed" hidden>
        <div class="rw-page-head">
          <div class="rw-page-head-copy"><small>LIBRARY</small><h2>本地作品</h2><p>下载只是缓存；安装、升级和卸载仍由你明确触发。</p></div>
          <div class="rw-page-actions">
            <button class="rw-button" data-action="check-all-updates" type="button">检查全部更新</button>
            <button class="rw-button" data-action="storage-manager" type="button">存储管理</button>
            <label class="rw-button rw-inline-file">导入离线包<input data-action="import-offline" type="file" accept=".rwpack,application/json" hidden></label>
          </div>
        </div>
        <div class="rw-local-note">工坊会在安装前校验 manifest、大小与 SHA-256；酒馆助手脚本只有在主动安装后才会写入并启用。</div>
        <div class="rw-grid rw-local-grid" data-role="installed-list"></div>
      </section>
      <section class="rw-section" data-section="mine" hidden>
        <div class="rw-page-head">
          <div class="rw-page-head-copy"><small>CREATOR</small><h2>我的作品</h2><p>创建、更新并跟踪你的发布内容。</p></div>
          <button class="rw-button primary" type="button" data-action="create-project-open">发布作品</button>
        </div>
        <form class="rw-create-form" data-form="create-project" hidden>
          <div class="rw-publish-form-head">
            <div class="rw-publish-form-title">
              <span>☁</span>
              <div><strong>发布项目</strong><small>上传文件，剩下的交给工坊识别。</small></div>
            </div>
            <button class="rw-modal-close" type="button" data-action="create-project-cancel" aria-label="关闭">×</button>
          </div>

          <div class="rw-publish-grid">
            <section class="rw-publish-column">
              <div class="rw-publish-step-title">
                <span>01</span>
                <div><strong>基本资料</strong><small>先告诉大家这是什么。</small></div>
              </div>

              <label class="rw-field">
                <span>作品名称 *</span>
                <input class="rw-input" name="name" required maxlength="80" placeholder="例如：命定之诗与黄昏之歌">
              </label>

              <label class="rw-field">
                <span>作品简介</span>
                <textarea class="rw-textarea rw-publish-summary" name="summary" maxlength="2000" placeholder="简单介绍作品内容、适用场景和主要功能。"></textarea>
              </label>

              <div class="rw-publish-divider"></div>

              <div class="rw-publish-step-title">
                <span>02</span>
                <div><strong>分类与标签</strong><small>作品顶层只分为角色和扩展。</small></div>
              </div>

              <label class="rw-field">
                <span>分类 *</span>
                <select class="rw-select" name="category">
                  <option value="extension">扩展</option>
                  <option value="character">角色</option>
                </select>
              </label>

              <label class="rw-field">
                <span>标签（可选）</span>
                <input class="rw-input" name="tags" maxlength="300" placeholder="例如：剧情, boss, 原创">
              </label>

              <details class="rw-publish-advanced">
                <summary>高级：项目依赖（可选）</summary>
                <label class="rw-field">
                  <span>依赖项目</span>
                  <input class="rw-input" name="dependencies" maxlength="1200" placeholder="项目ID@最低版本，多个用逗号分隔">
                </label>
                <small class="rw-muted">普通作品一般不需要填写；仅在必须先安装其他工坊项目时使用。</small>
              </details>
            </section>

            <section class="rw-publish-column rw-publish-upload-column">
              <div class="rw-publish-step-title">
                <span>03</span>
                <div><strong>上传内容</strong><small>直接拖入文件，系统会自动判断它们是什么。</small></div>
              </div>

              <div class="rw-publish-upload-block">
                <span class="rw-field-label">作品文件 *</span>
                <label class="rw-smart-dropzone" data-drop-target="create-version">
                  <span class="rw-smart-dropzone-icon">↥</span>
                  <strong>拖入或选择文件</strong>
                  <small>支持世界书 JSON、正则 JSON、酒馆助手脚本 JS / JSON、预设 JSON 和完整 bundle</small>
                  <input data-field="create-version" type="file" multiple accept=".json,.txt,.js,.mjs,application/json,text/plain,text/javascript,application/javascript" hidden>
                </label>
                <div class="rw-file-state" data-role="create-version-state">拖入文件即可，系统会自动识别世界书、正则、脚本和预设。</div>
                <div class="rw-artifact-list rw-smart-artifact-list" data-role="create-artifact-list" hidden></div>
              </div>

              <div class="rw-publish-divider"></div>

              <div class="rw-publish-upload-block">
                <span class="rw-field-label">封面图（可选）</span>
                <label class="rw-cover-dropzone" data-drop-target="create-cover">
                  <img data-role="create-cover-preview" alt="封面预览" hidden>
                  <div class="rw-cover-dropzone-empty">
                    <span>▧</span>
                    <strong>拖入或选择封面</strong>
                    <small>PNG / JPEG / WebP · 建议 16:9</small>
                  </div>
                  <input data-field="create-cover" type="file" accept="image/png,image/jpeg,image/webp" hidden>
                </label>
                <div class="rw-file-state" data-role="create-cover-state">可选。建议 16:9，选择后会立即预览。</div>
              </div>
            </section>
          </div>

          <footer class="rw-publish-footer">
            <div class="rw-publish-footer-note">● 系统会先检查文件，然后再让你选择是否需要屏蔽/替换原版世界书或脚本。</div>
            <div class="rw-row">
              <button class="rw-button" type="button" data-action="create-project-cancel">取消</button>
              <button class="rw-button primary" type="submit">下一步</button>
            </div>
          </footer>
        </form>
        <div class="rw-grid" data-role="my-list"></div>
      </section>
      <section class="rw-section" data-section="admin" hidden>
        <div class="rw-page-head">
          <div class="rw-page-head-copy"><small>ADMIN</small><h2>工坊管理</h2><p>审核作品、处理举报，并管理作者账号状态。</p></div>
        </div>
        <div class="rw-admin-tabs">
          <button class="rw-tab is-active" data-admin-view="projects" type="button">作品审核</button>
          <button class="rw-tab" data-admin-view="reports" type="button">举报处理</button>
          <button class="rw-tab" data-admin-view="users" type="button">用户管理</button>
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
