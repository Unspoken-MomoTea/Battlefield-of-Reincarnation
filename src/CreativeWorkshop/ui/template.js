export function workshopTemplate(version) {
  return `
  <section class="rw-panel" role="dialog" aria-modal="true" aria-label="轮回战场创意工坊">
    <header class="rw-head">
      <div class="rw-title">创意工坊</div>
      <div class="rw-head-discover-tools" data-role="discover-head-tools">
        <input class="rw-input grow" data-field="search" placeholder="搜索项目、作者、简介或标签">
        <select class="rw-select" data-field="sort" aria-label="作品排序">
          <option value="latest">最新</option>
          <option value="popular">热门</option>
          <option value="downloads">下载最多</option>
          <option value="favorites">收藏最多</option>
          <option value="likes">点赞最多</option>
        </select>
        <button class="rw-button" data-action="search" type="button">搜索</button>
      </div>
      <div class="rw-head-actions">
        <button class="rw-button" type="button" data-action="refresh-workshop" title="清除作品列表缓存并重新读取工坊">刷新</button>
        <button class="rw-button rw-maintenance-trigger" type="button" data-action="maintenance">修复</button>
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
      </div>
    </header>
    <nav class="rw-tabs">
      <div class="rw-nav-label">浏览</div>
      <button class="rw-tab is-active" data-tab="discover" type="button">发现</button>
      <div class="rw-nav-divider"></div>
      <button class="rw-tab rw-nav-filter" data-category-filter="" data-kind-filter="" type="button">全部项目</button>
      <button class="rw-tab rw-nav-filter" data-category-filter="extension" data-kind-filter="extension" type="button">扩展</button>
      <button class="rw-tab rw-nav-filter" data-character-home type="button">角色</button>
      <button class="rw-tab rw-nav-filter" data-category-filter="extension" data-kind-filter="store_catalog" type="button">开局商店</button>
      <div class="rw-nav-divider"></div>
      <div class="rw-nav-label" data-role="market-nav-label" hidden>交易</div>
      <button class="rw-tab rw-market-tab" data-tab="market" type="button" hidden>空间集市 <span class="rw-market-test-badge">TEST</span></button>
      <div class="rw-nav-divider" data-role="market-nav-divider" hidden></div>
      <div class="rw-nav-label">个人</div>
      <button class="rw-tab" data-tab="favorites" type="button" hidden>我的收藏</button>
      <button class="rw-tab" data-tab="installed" type="button">本地库</button>
      <div class="rw-nav-connection">● 已连接 SillyTavern</div>
    </nav>
    <main class="rw-body">
      <section class="rw-section" data-section="discover">
        <div class="rw-discover-home" data-role="discover-home">
          <section class="rw-showcase">
            <div class="rw-showcase-head"><div><small>FOR YOU</small><h2>发现推荐</h2></div></div>
            <div class="rw-showcase-row" data-role="discover-featured"></div>
          </section>
          <section class="rw-showcase">
            <div class="rw-showcase-head"><div><small>LATEST</small><h2>最新发布</h2></div></div>
            <div class="rw-showcase-row" data-role="discover-latest"></div>
          </section>
          <section class="rw-showcase">
            <div class="rw-showcase-head"><div><small>PLAYER PICKS</small><h2>玩家好评</h2></div></div>
            <div class="rw-showcase-row" data-role="discover-liked"></div>
          </section>
          <section class="rw-showcase">
            <div class="rw-showcase-head"><div><small>MOST DOWNLOADED</small><h2>下载最多</h2></div></div>
            <div class="rw-showcase-row" data-role="discover-downloaded"></div>
          </section>
        </div>
        <div class="rw-discover-home" data-role="character-home" hidden>
          <section class="rw-showcase">
            <div class="rw-showcase-head"><div><small>WORLD BOOK</small><h2>世界书角色</h2></div></div>
            <div class="rw-showcase-row" data-role="character-world"></div>
          </section>
          <section class="rw-showcase">
            <div class="rw-showcase-head"><div><small>OPENING</small><h2>开局角色</h2></div></div>
            <div class="rw-showcase-row" data-role="character-opening"></div>
          </section>
          <section class="rw-showcase">
            <div class="rw-showcase-head"><div><small>PARTNER</small><h2>开局伙伴</h2></div></div>
            <div class="rw-showcase-row" data-role="character-partner"></div>
          </section>
        </div>
        <div class="rw-catalog" data-role="discover-catalog" hidden>
          <div class="rw-page-head">
            <div class="rw-page-head-copy"><small>CATALOG</small><h2 data-role="catalog-title">全部项目</h2><p>浏览角色与扩展，按排序和关键词查找作品。</p></div>
            <div class="rw-page-head-meta" data-role="discover-count">正在载入</div>
          </div>
          <input type="hidden" data-field="category" value="">
          <input type="hidden" data-field="kind" value="">
          <div class="rw-grid rw-project-grid" data-role="discover-list"></div>
          <div class="rw-load-more-wrap"><button class="rw-button" data-action="discover-more" type="button" hidden>加载更多</button></div>
        </div>
      </section>
      <section class="rw-section" data-section="favorites" hidden>
        <div class="rw-page-head">
          <div class="rw-page-head-copy"><small>FAVORITES</small><h2>我的收藏</h2><p>收藏跟随你的工坊账号同步，不会自动下载或启用作品。</p></div>
          <div class="rw-page-head-meta" data-role="favorites-count">正在载入</div>
        </div>
        <div class="rw-grid rw-project-grid" data-role="favorites-list"></div>
        <div class="rw-load-more-wrap"><button class="rw-button" data-action="favorites-more" type="button" hidden>加载更多</button></div>
      </section>
      <section class="rw-section rw-market-page rw-auction-house" data-section="market" hidden>
        <div class="rw-ah-head">
          <div class="rw-ah-title">
            <div class="rw-ah-kicker">SPACE BAZAAR <span class="rw-market-test-badge">TEST</span></div>
            <h2>空间集市</h2>
            <p>参考拍卖行的信息架构：先找商品，再看最低价与库存，最后在右侧完成购买。</p>
          </div>
          <div class="rw-ah-account-strip" data-role="market-summary"></div>
        </div>

        <div class="rw-ah-tabs" role="tablist" aria-label="空间集市">
          <button class="rw-ah-tab is-active" data-market-mode="browse" type="button">浏览</button>
          <button class="rw-ah-tab" data-market-mode="sell" type="button">出售</button>
          <button class="rw-ah-tab" data-market-mode="mine" type="button">我的拍卖</button>
          <div class="rw-ah-tab-spacer"></div>
          <span class="rw-ah-region-note">主神空间可交易 · 任务世界仅浏览</span>
        </div>

        <div class="rw-ah-panel" data-market-panel="browse">
          <div class="rw-ah-toolbar">
            <div class="rw-ah-search">
              <span aria-hidden="true">⌕</span>
              <input class="rw-input" data-field="market-search" placeholder="搜索物品名称">
            </div>
            <select class="rw-select" data-field="market-sort" aria-label="集市排序">
              <option value="price_asc">最低价优先</option>
              <option value="latest">最新上架</option>
              <option value="price_desc">最高价优先</option>
            </select>
            <button class="rw-button primary" data-action="market-search" type="button">搜索</button>
            <div class="rw-ah-result-count" data-role="market-count">正在载入</div>
          </div>

          <div class="rw-ah-browser">
            <aside class="rw-ah-categories" aria-label="商品分类">
              <div class="rw-ah-side-title">分类</div>
              <button class="rw-ah-category is-active" data-market-kind="" type="button"><span>全部商品</span><small>ALL</small></button>
              <button class="rw-ah-category" data-market-kind="equipment" type="button"><span>装备</span><small>EQUIP</small></button>
              <button class="rw-ah-category" data-market-kind="item" type="button"><span>道具</span><small>ITEM</small></button>
              <button class="rw-ah-category" data-market-kind="skill" type="button"><span>技能</span><small>SKILL</small></button>
              <div class="rw-ah-side-rule"></div>
              <div class="rw-ah-side-help">商品来自玩家本地存档。测试版不声明防作弊认证。</div>
            </aside>

            <section class="rw-ah-results">
              <div class="rw-ah-table-head">
                <span>物品</span>
                <span>类型</span>
                <span>品质</span>
                <span>库存</span>
                <span>单价</span>
              </div>
              <div class="rw-ah-list" data-role="market-list"></div>
            </section>

            <aside class="rw-ah-inspector" data-role="market-inspector">
              <div class="rw-ah-empty-inspector">
                <div class="rw-ah-empty-icon">◇</div>
                <strong>选择一个商品</strong>
                <span>右侧会显示详情、卖家与购买数量。</span>
              </div>
            </aside>
          </div>
        </div>

        <div class="rw-ah-panel" data-market-panel="sell" hidden>
          <div class="rw-ah-sell-layout">
            <section class="rw-ah-inventory-pane">
              <div class="rw-ah-pane-head">
                <div><small>INVENTORY</small><h3>选择要出售的资产</h3></div>
                <span data-role="market-sell-count">—</span>
              </div>
              <div class="rw-ah-inventory-list" data-role="market-sell-list"></div>
            </section>
            <section class="rw-ah-sell-editor" data-role="market-sell-editor">
              <div class="rw-ah-empty-inspector">
                <div class="rw-ah-empty-icon">＋</div>
                <strong>从左侧选择资产</strong>
                <span>选择后设置数量与一口价。</span>
              </div>
            </section>
          </div>
        </div>

        <div class="rw-ah-panel" data-market-panel="mine" hidden>
          <div class="rw-ah-mine-toolbar">
            <div>
              <small>ACCOUNT</small>
              <h3>我的拍卖</h3>
            </div>
            <button class="rw-button" data-action="market-mine-refresh" type="button">刷新</button>
          </div>
          <div class="rw-ah-mine-content" data-role="market-mine-content"></div>
        </div>
      </section>
      <section class="rw-section" data-section="installed" hidden>
        <div class="rw-page-head">
          <div class="rw-page-head-copy"><small>LIBRARY</small><h2>本地库</h2><p>下载只会保存到本地；点击“安装到酒馆”后作品才会真正启用。</p></div>
          <div class="rw-page-actions">
            <button class="rw-button" data-action="check-all-updates" type="button">检查全部更新</button>
            <button class="rw-button" data-action="storage-manager" type="button">存储管理</button>
            <label class="rw-button rw-inline-file">导入离线包<input data-action="import-offline" type="file" accept=".rwpack,application/json" hidden></label>
          </div>
        </div>
        <div class="rw-local-note">这里保存下载、本地测试与离线包。已启用作品可直接停用并还原；只有发现新版本时才显示更新操作。</div>
        <div class="rw-grid rw-local-grid" data-role="installed-list"></div>
      </section>
      <section class="rw-section" data-section="mine" hidden>
        <div class="rw-page-head">
          <div class="rw-page-head-copy"><small>CREATOR</small><h2>我的作品</h2><p>创建、更新并跟踪你的发布内容。</p></div>
          <div class="rw-row"><button class="rw-button" type="button" data-action="create-heretic-open" hidden>上传当前角色到异端库</button><button class="rw-button primary" type="button" data-action="create-project-open">创建作品</button></div>
        </div>
        <form class="rw-create-form" data-form="create-heretic" hidden>
          <div class="rw-publish-form-head"><div class="rw-publish-form-title"><span>◈</span><div><strong>异端库 · 当前角色快照</strong><small>读取当前 MVU 角色的原始构筑；派生属性、道具、货币、任务等不会上传。</small></div></div><button class="rw-modal-close" type="button" data-action="create-heretic-cancel">×</button></div>
          <div class="rw-publish-grid">
            <section class="rw-publish-column">
              <label class="rw-field"><span>作品名称 *</span><input class="rw-input" name="name" required maxlength="80" placeholder="默认使用当前角色姓名"></label>
              <label class="rw-field"><span>简介</span><textarea class="rw-textarea" name="summary" maxlength="2000" placeholder="这个角色的特色与玩法。"></textarea></label>
              <label class="rw-field"><span>性格 *</span><textarea class="rw-textarea" name="personality" required maxlength="1200" placeholder="发布前补充角色稳定的人格与行为倾向。"></textarea></label>
              <label class="rw-field"><span>喜爱 *</span><textarea class="rw-textarea" name="likes" required maxlength="800" placeholder="偏好、兴趣、厌恶等。"></textarea></label>
              <label class="rw-field"><span>背景故事 *</span><textarea class="rw-textarea" name="background" required maxlength="3000" placeholder="角色经历与关键背景。"></textarea></label>
            </section>
            <section class="rw-publish-column">
              <div class="rw-publish-step-title"><span>LIVE</span><div><strong>当前构筑预览</strong><small>只显示会上传的字段。</small></div></div>
              <div class="rw-local-note" data-role="heretic-build-preview">打开后读取当前 MVU。</div>
              <div class="rw-publish-upload-block">
                <span class="rw-field-label">封面图 *</span>
                <label class="rw-cover-dropzone" data-drop-target="heretic-cover">
                  <img data-role="heretic-cover-preview" alt="封面预览" hidden>
                  <div class="rw-cover-dropzone-empty">
                    <span>▧</span>
                    <strong>拖入或选择封面</strong>
                    <small>PNG / JPEG / WebP · 建议人物主体清晰可见</small>
                  </div>
                  <input data-field="heretic-cover" type="file" accept="image/png,image/jpeg,image/webp" hidden>
                </label>
                <div class="rw-file-state" data-role="heretic-cover-state">必需。选择后会立即预览。</div>
              </div>
            </section>
          </div>
          <footer class="rw-publish-footer"><div class="rw-publish-footer-note">异端仍复用角色项目的审核、版本、更新和举报系统，但不会出现在普通角色创建模板中。</div><div class="rw-row"><button class="rw-button" type="button" data-action="create-heretic-cancel">取消</button><button class="rw-button primary" type="submit">提交异端审核</button></div></footer>
        </form>
        <form class="rw-create-form" data-form="create-project" hidden>
          <div class="rw-publish-form-head">
            <div class="rw-publish-form-title">
              <span>☁</span>
              <div><strong>创建项目</strong><small>可先保存到本地测试，确认无误后再提交审核。</small></div>
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
                <input class="rw-input" name="name" required maxlength="80" placeholder="请输入作品名称">
              </label>

              <label class="rw-field">
                <span>作品简介</span>
                <textarea class="rw-textarea rw-publish-summary" name="summary" maxlength="2000" placeholder="简单介绍作品内容、适用场景和主要功能。"></textarea>
              </label>

              <div class="rw-publish-divider"></div>

              <div class="rw-publish-step-title">
                <span>02</span>
                <div><strong>分类与标签</strong><small>统一选择扩展、角色或开局商店；角色再选择子类型。</small></div>
              </div>

              <label class="rw-field">
                <span>分类 *</span>
                <select class="rw-select" name="category">
                  <option value="extension">扩展</option>
                  <option value="character">角色</option>
                  <option value="store_catalog">开局商店</option>
                </select>
                <small>分类统一在这里选择；只有“角色”会继续出现角色子类型。</small>
              </label>

              <label class="rw-field" data-role="character-kind-field" hidden>
                <span>角色用途 *</span>
                <select class="rw-select" name="character_kind">
                  <option value="world_character">世界书角色</option>
                  <option value="opening_character">开局角色</option>
                  <option value="opening_partner">开局伙伴</option>
                </select>
                <small>世界书人物用于剧情设定；开局角色与开局伙伴会进入新版开局对应选择库。</small>
              </label>

              <label class="rw-field">
                <span>标签（可选）</span>
                <input class="rw-input" name="tags" maxlength="300" placeholder="例如：剧情, boss, 原创">
              </label>

              <details class="rw-publish-advanced">
                <summary>高级：项目依赖（可选）</summary>
                <div data-role="create-dependencies"></div>
              </details>
            </section>

            <section class="rw-publish-column rw-publish-upload-column">
              <div class="rw-publish-step-title">
                <span>03</span>
                <div><strong data-role="publish-content-title">作品内容</strong><small data-role="publish-content-help">根据作品用途填写对应内容。</small></div>
              </div>

              <div data-publish-panel="extension">
                <div class="rw-publish-upload-block">
                  <span class="rw-field-label">扩展文件 *</span>
                  <div class="rw-publish-upload-slots">
                    <label class="rw-smart-dropzone rw-smart-dropzone--compact" data-drop-target="create-worldbook">
                      <span class="rw-smart-dropzone-icon">书</span>
                      <strong>世界书</strong>
                      <small>选择世界书 JSON</small>
                      <input data-field="create-worldbook" type="file" multiple accept=".json,application/json" hidden>
                    </label>
                    <label class="rw-smart-dropzone rw-smart-dropzone--compact" data-drop-target="create-regex">
                      <span class="rw-smart-dropzone-icon">正</span>
                      <strong>正则</strong>
                      <small>选择 SillyTavern 正则 JSON</small>
                      <input data-field="create-regex" type="file" multiple accept=".json,application/json" hidden>
                    </label>
                    <label class="rw-smart-dropzone rw-smart-dropzone--compact" data-drop-target="create-script">
                      <span class="rw-smart-dropzone-icon">JS</span>
                      <strong>酒馆助手脚本</strong>
                      <small>选择 JS 或 ScriptTree JSON</small>
                      <input data-field="create-script" type="file" multiple accept=".js,.mjs,.json,application/json,text/javascript,application/javascript" hidden>
                    </label>
                  </div>
                  <input data-field="create-version" type="file" multiple hidden>
                  <div class="rw-file-state" data-role="create-version-state">选择世界书、正则或酒馆助手脚本；已添加内容会显示在下方。</div>
                  <div class="rw-artifact-list rw-smart-artifact-list" data-role="create-artifact-list" hidden></div>
                </div>
              </div>

              <div data-role="dedicated-editor-host" hidden></div>

              <div data-role="publish-resource-section">
                <div class="rw-publish-divider"></div>
                <div class="rw-publish-step-title">
                  <span>04</span>
                  <div><strong>原版资源</strong><small>仅通用扩展可设置原世界书 / 正则 / 脚本的启用状态。</small></div>
                </div>
                <div data-role="create-resource-states"></div>
              </div>

              <div class="rw-publish-divider"></div>

              <div class="rw-publish-upload-block">
                <span class="rw-field-label" data-role="create-cover-label">封面图 *</span>
                <label class="rw-cover-dropzone" data-drop-target="create-cover">
                  <img data-role="create-cover-preview" alt="封面预览" hidden>
                  <div class="rw-cover-dropzone-empty">
                    <span>▧</span>
                    <strong>拖入或选择封面</strong>
                    <small data-role="create-cover-hint">PNG / JPEG / WebP · 建议 16:9</small>
                  </div>
                  <input data-field="create-cover" type="file" accept="image/png,image/jpeg,image/webp" hidden>
                </label>
                <div class="rw-file-state" data-role="create-cover-state">必需。建议 16:9，选择后会立即预览。</div>
              </div>
            </section>
          </div>

          <footer class="rw-publish-footer">
            <div class="rw-publish-footer-note">● 本地测试只保存在当前浏览器，不上传、不计访问、不进审核；提交审核才会创建线上项目。</div>
            <div class="rw-row">
              <button class="rw-button" type="button" data-action="create-project-cancel">取消</button>
              <button class="rw-button" type="button" data-action="create-project-local-test">保存本地测试（不上传）</button>
              <button class="rw-button primary" type="submit">提交审核（上传）</button>
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
          <button class="rw-tab" data-admin-view="updates" type="button">更新动态</button>
          <button class="rw-tab" data-admin-view="reports" type="button">举报处理</button>
          <button class="rw-tab" data-admin-view="users" type="button">用户管理</button>
          <button class="rw-tab" data-admin-view="storage" type="button">容量</button>
        </div>

        <div data-admin-section="projects">
          <div class="rw-toolbar">
            <input class="rw-input grow" data-field="admin-search" placeholder="搜索作品或作者">
            <select class="rw-select" data-field="admin-status"><option value="pending" selected>审核中</option><option value="">全部审核状态</option><option value="approved">已通过</option><option value="rejected">已拒绝</option></select>
            <select class="rw-select" data-field="admin-category"><option value="">全部类型</option><option value="extension">扩展</option><option value="character">角色</option></select>
            <button class="rw-button" data-action="admin-search" type="button">筛选</button>
          </div>
          <div class="rw-grid" data-role="pending-list"></div>
        </div>

        <div data-admin-section="updates" hidden>
          <div class="rw-toolbar">
            <div class="rw-muted grow">已通过首次审核的作品后续由作者直接发布；这里显示当前最新的作者自助更新。</div>
            <button class="rw-button" data-action="admin-update-refresh" type="button">刷新更新</button>
          </div>
          <div class="rw-grid" data-role="update-list"></div>
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

        <div data-admin-section="storage" hidden>
          <div class="rw-toolbar">
            <div class="rw-muted grow">Free 模式容量监控：R2 硬限制 9.5 GB，D1 参考 Free 单库 500 MB。</div>
            <button class="rw-button" data-action="admin-storage-refresh" type="button">刷新容量</button>
          </div>
          <div data-role="admin-storage-list"></div>
        </div>
      </section>
    </main>
  </section>`;
}
