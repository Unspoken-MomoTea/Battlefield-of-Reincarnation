import { resolveHostWindow } from './config.js';
import { workshopApi } from './services/api.js';
import { projectService } from './services/project-service.js';
import { buildUploadBundle } from './services/upload.js';

const GLOBAL_NAME = 'ReincarnationWorkshop';
const VERSION = '0.7.0';
const CATEGORY_LABELS = {
  worldbook: '世界书',
  regex: '正则',
  preset: '预设',
  data: '数据包',
  mixed: '混合包',
};
const STATUS_LABELS = {
  draft: '草稿',
  pending: '审核中',
  published: '已发布',
  rejected: '已驳回',
  archived: '已归档',
};
let booted = false;

boot();

function boot() {
  if (booted) return;
  booted = true;

  const host = resolveHostWindow();
  const doc = host.document;
  if (host[GLOBAL_NAME]?.version === VERSION) return;

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
  let auth = null;
  let activeTab = 'discover';

  function element(tag, className, text) {
    const value = doc.createElement(tag);
    if (className) value.className = className;
    if (text !== undefined) value.textContent = text;
    return value;
  }

  function button(text, className, handler) {
    const value = element('button', `rw-button ${className || ''}`.trim(), text);
    value.type = 'button';
    value.addEventListener('click', async () => {
      value.disabled = true;
      try {
        await handler();
      } catch (error) {
        notifyError(error);
      } finally {
        value.disabled = false;
      }
    });
    return value;
  }

  function notifyError(error) {
    console.error('[轮回战场创意工坊]', error);
    const message = error instanceof Error ? error.message : String(error);
    try {
      host.toastr?.error?.(message, '创意工坊');
    } catch {}
  }

  function empty(container, text) {
    container.replaceChildren(element('div', 'rw-empty', text));
  }

  function setAuth(next) {
    auth = next;
    const user = auth?.user;
    nodes.account.textContent = user ? `${user.display_name || user.username}${Number(user.is_admin) ? ' · 管理员' : ''}` : '未登录';
    nodes.login.hidden = Boolean(user);
    nodes.logout.hidden = !user;
    nodes.adminTab.hidden = !Number(user?.is_admin);
    if (!user && (activeTab === 'mine' || activeTab === 'admin')) showTab('discover');
  }

  function showTab(name) {
    if (name === 'admin' && !Number(auth?.user?.is_admin)) return;
    activeTab = name;
    overlay.querySelectorAll('.rw-tab').forEach(tab => tab.classList.toggle('is-active', tab.dataset.tab === name));
    overlay.querySelectorAll('.rw-section').forEach(section => { section.hidden = section.dataset.section !== name; });
    if (name === 'discover') void refreshDiscover();
    if (name === 'installed') void refreshInstalled();
    if (name === 'mine') void refreshMine();
    if (name === 'admin') void refreshAdmin();
  }

  async function refreshHealth() {
    try {
      const result = await workshopApi.health();
      nodes.health.textContent = `在线 · ${result.version}`;
      nodes.health.className = 'rw-status ok';
    } catch (error) {
      nodes.health.textContent = `未连接 · ${error.message}`;
      nodes.health.className = 'rw-status bad';
    }
  }

  async function refreshAuth() {
    try {
      const stored = await workshopApi.getStoredAuth();
      if (!stored) return setAuth(null);
      const current = await workshopApi.me();
      setAuth({ ...stored, user: current.user });
    } catch {
      setAuth(null);
    }
  }

  function projectCard(project) {
    const card = element('article', 'rw-card');
    card.appendChild(element('h3', '', project.name));
    const meta = element('div', 'rw-meta');
    meta.append(element('span', 'rw-pill', CATEGORY_LABELS[project.category] || project.category));
    meta.append(element('span', 'rw-pill', `v${project.version}`));
    if (project.owner_name) meta.append(element('span', 'rw-pill', `作者：${project.owner_name}`));
    card.appendChild(meta);
    card.appendChild(element('div', 'rw-muted', project.summary || '暂无简介'));
    const actions = element('div', 'rw-row');
    actions.appendChild(button('详情', '', () => showDetail(project.id)));
    actions.appendChild(button('下载到本地', 'primary', async () => {
      const cached = await projectService.cache(project.id);
      try { host.toastr?.success?.(`已缓存 ${cached.name} v${cached.version}`, '创意工坊'); } catch {}
      if (activeTab === 'installed') await refreshInstalled();
    }));
    card.appendChild(actions);
    return card;
  }

  async function refreshDiscover() {
    empty(nodes.discoverList, '正在加载作品...');
    try {
      const result = await projectService.list(nodes.search.value, nodes.category.value, 0);
      if (!result.items.length) return empty(nodes.discoverList, '暂时没有符合条件的已发布作品');
      nodes.discoverList.replaceChildren(...result.items.map(projectCard));
    } catch (error) {
      empty(nodes.discoverList, `加载失败：${error.message}`);
    }
  }

  async function showDetail(projectId) {
    const detail = await projectService.detail(projectId);
    nodes.detailTitle.textContent = `${detail.project.name} · v${detail.project.version}`;
    nodes.detailSummary.textContent = `${detail.project.summary || '暂无简介'}\n更新说明：${detail.changelog || '无'}`;
    nodes.detailManifest.textContent = JSON.stringify(detail.manifest, null, 2);
    nodes.detailCard.hidden = false;
    nodes.detailCard.scrollIntoView({ block: 'nearest' });
  }

  async function refreshInstalled() {
    const installed = (await projectService.installed()).sort((a, b) => b.updatedAt - a.updatedAt);
    if (!installed.length) return empty(nodes.installedList, '还没有下载任何作品');
    const cards = installed.map(item => {
      const card = element('article', 'rw-card');
      card.appendChild(element('h3', '', item.name));
      const meta = element('div', 'rw-meta');
      meta.append(element('span', 'rw-pill', CATEGORY_LABELS[item.category] || item.category));
      meta.append(element('span', 'rw-pill', `缓存 v${item.version}`));
      if (item.applied) {
        meta.append(
          element(
            'span',
            'rw-pill',
            item.appliedVersion === item.version ? `已应用 v${item.appliedVersion}` : `已应用 v${item.appliedVersion} · 待升级`,
          ),
        );
        if (item.targetCharacterName) meta.append(element('span', 'rw-pill', `角色：${item.targetCharacterName}`));
      } else {
        meta.append(element('span', 'rw-pill', '仅缓存'));
      }
      card.appendChild(meta);
      if (item.applyError) card.appendChild(element('div', 'rw-status bad', `上次安装失败：${item.applyError}`));

      const actions = element('div', 'rw-row');
      actions.appendChild(
        button(item.applied ? (item.appliedVersion === item.version ? '重新应用' : '应用新版') : '安装到酒馆', 'primary', async () => {
          const result = await projectService.apply(item.id);
          try { host.toastr?.success?.(`已应用 ${result.name} v${result.appliedVersion}`, '创意工坊'); } catch {}
          await refreshInstalled();
        }),
      );
      if (item.applied) {
        actions.appendChild(
          button('卸载', 'danger', async () => {
            await projectService.uninstall(item.id);
            try { host.toastr?.success?.(`已卸载 ${item.name}`, '创意工坊'); } catch {}
            await refreshInstalled();
          }),
        );
      }
      actions.appendChild(button('检查更新', '', async () => {
        const result = await projectService.checkUpdate(item.id);
        if (!result.updateAvailable) {
          try { host.toastr?.info?.('本地缓存已经是服务器最新版本', item.name); } catch {}
          return;
        }
        const shouldSync = host.confirm?.(
          `服务器已有 v${result.remoteVersion}。是否立即下载最新版${item.applied ? '并重新应用到酒馆' : ''}？`,
        );
        if (!shouldSync) return;
        const wasApplied = item.applied;
        const cached = await projectService.cache(item.id);
        if (wasApplied) await projectService.apply(item.id);
        try {
          host.toastr?.success?.(
            wasApplied ? `已升级并应用到 v${cached.version}` : `已同步缓存到 v${cached.version}`,
            item.name,
          );
        } catch {}
        await refreshInstalled();
      }));
      actions.appendChild(button('导出离线包', '', async () => {
        const exported = await projectService.exportCached(item.id);
        const url = host.URL.createObjectURL(exported.blob);
        try {
          const anchor = doc.createElement('a');
          anchor.href = url;
          anchor.download = exported.filename;
          doc.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        } finally {
          host.setTimeout(() => host.URL.revokeObjectURL(url), 1000);
        }
      }));
      if (!item.applied) {
        actions.appendChild(button('删除本地缓存', 'danger', async () => {
          await projectService.removeCached(item.id);
          await refreshInstalled();
        }));
      }
      card.appendChild(actions);
      return card;
    });
    nodes.installedList.replaceChildren(...cards);
  }

  function ownProjectCard(project) {
    const card = element('article', 'rw-card');
    card.appendChild(element('h3', '', project.name));
    const meta = element('div', 'rw-meta');
    meta.append(element('span', 'rw-pill', CATEGORY_LABELS[project.category] || project.category));
    meta.append(element('span', 'rw-pill', STATUS_LABELS[project.status] || project.status));
    meta.append(element('span', 'rw-pill', `最新 v${project.latest_version}`));
    meta.append(element('span', 'rw-pill', `公开 v${project.published_version}`));
    card.appendChild(meta);
    card.appendChild(element('div', 'rw-muted', project.summary || '暂无简介'));
    if (project.status === 'rejected' && project.review_note) {
      card.appendChild(element('div', 'rw-status bad', `审核意见：${project.review_note}`));
    }

    const file = element('input', 'rw-input');
    file.type = 'file';
    file.accept = '.json,.txt,application/json,text/plain';
    const changelog = element('input', 'rw-input grow');
    changelog.placeholder = '版本更新说明';
    changelog.maxLength = 2000;
    const kind = element('select', 'rw-select');
    for (const value of ['worldbook', 'regex', 'preset', 'data']) {
      const option = doc.createElement('option');
      option.value = value;
      option.textContent = CATEGORY_LABELS[value];
      if (value === project.category) option.selected = true;
      kind.appendChild(option);
    }
    kind.hidden = project.category !== 'mixed';
    card.append(file, changelog, kind);

    const actions = element('div', 'rw-row');
    actions.appendChild(button('上传新版本', 'primary', async () => {
      const selected = file.files?.[0];
      if (!selected) throw new Error('请先选择 .json 或 .txt 文件');
      const raw = await selected.text();
      const bundle = buildUploadBundle(project, selected.name, raw, kind.value);
      await workshopApi.uploadProjectVersion(project.id, {
        changelog: changelog.value,
        bundle,
      });
      await refreshMine();
    }));
    actions.appendChild(button('提交审核', 'good', async () => {
      await workshopApi.submitProject(project.id);
      await refreshMine();
    }));
    card.appendChild(actions);
    return card;
  }

  async function refreshMine() {
    if (!auth?.user) return empty(nodes.myList, '请先使用 Discord 登录');
    try {
      const result = await workshopApi.listOwnProjects();
      if (!result.items.length) return empty(nodes.myList, '你还没有创建作品');
      nodes.myList.replaceChildren(...result.items.map(ownProjectCard));
    } catch (error) {
      empty(nodes.myList, `加载失败：${error.message}`);
    }
  }

  function reviewStatusLabel(status) {
    return ({ draft: '未提交审核', pending: '审核中', approved: '已通过', rejected: '已拒绝' })[status] || status;
  }

  function formatTime(seconds) {
    if (!seconds) return '—';
    return new Date(Number(seconds) * 1000).toLocaleString();
  }

  async function refreshAdmin() {
    if (!Number(auth?.user?.is_admin)) return empty(nodes.pendingList, '需要管理员权限');
    try {
      const result = await workshopApi.listAdminProjects({
        query: nodes.adminSearch.value,
        category: nodes.adminCategory.value,
        reviewStatus: nodes.adminStatus.value,
      });
      if (!result.items.length) return empty(nodes.pendingList, '没有符合条件的上传作品');
      const cards = result.items.map(item => {
        const card = element('article', 'rw-card');
        card.appendChild(element('h3', '', `${item.name} · v${item.latest_version}`));
        const meta = element('div', 'rw-meta');
        meta.append(element('span', 'rw-pill', CATEGORY_LABELS[item.category] || item.category));
        meta.append(element('span', 'rw-pill', reviewStatusLabel(item.review_status)));
        meta.append(element('span', 'rw-pill', `公开 v${item.published_version}`));
        card.appendChild(meta);
        card.appendChild(
          element(
            'div',
            'rw-muted',
            `作者：${item.owner_name}（Discord: ${item.owner_discord_id}）\n` +
              `更新说明：${item.changelog || '无'}\n` +
              `上传：${formatTime(item.version_created_at)} · 提交：${formatTime(item.submitted_at)} · 审核：${formatTime(item.reviewed_at)}`,
          ),
        );
        if (item.review_decision) {
          const reviewText = `${item.review_decision === 'approved' ? '通过' : '拒绝'} · 审核人：${item.reviewer_name || '未知'}${item.review_note ? ` · ${item.review_note}` : ''}`;
          card.appendChild(element('div', item.review_decision === 'approved' ? 'rw-status ok' : 'rw-status bad', reviewText));
        }

        const preview = element('pre', 'rw-detail');
        preview.hidden = true;
        const actions = element('div', 'rw-row');
        actions.appendChild(button('查看内容与审核记录', '', async () => {
          if (!preview.hidden) {
            preview.hidden = true;
            return;
          }
          const detail = await workshopApi.getPendingReview(item.id);
          const artifactPreviews = detail.bundle.artifacts.map(artifact => {
            const raw = typeof artifact.content === 'string' ? artifact.content : JSON.stringify(artifact.content, null, 2);
            return {
              kind: artifact.kind,
              name: artifact.name,
              format: artifact.format,
              preview: raw.length > 6000 ? `${raw.slice(0, 6000)}\n…（界面仅预览前 6000 字符）` : raw,
            };
          });
          preview.textContent = JSON.stringify(
            {
              project: detail.project,
              versions: detail.versions,
              reviews: detail.reviews,
              manifest: detail.manifest,
              artifacts: artifactPreviews,
            },
            null,
            2,
          );
          preview.hidden = false;
        }));
        if (item.review_status === 'pending') {
          actions.appendChild(button('批准', 'good', async () => {
            const note = host.prompt?.('审核备注（可留空）', '') ?? '';
            await workshopApi.reviewProject(item.id, 'approved', note);
            await refreshAdmin();
          }));
          actions.appendChild(button('驳回', 'danger', async () => {
            const note = host.prompt?.('请输入驳回原因', '') ?? '';
            await workshopApi.reviewProject(item.id, 'rejected', note);
            await refreshAdmin();
          }));
        }
        card.append(actions, preview);
        return card;
      });
      nodes.pendingList.replaceChildren(...cards);
    } catch (error) {
      empty(nodes.pendingList, `加载失败：${error.message}`);
    }
  }

  const open = () => {
    overlay.classList.add('is-open');
    void refreshHealth();
    void refreshAuth().then(() => showTab(activeTab));
  };
  const close = () => overlay.classList.remove('is-open');

  launcher.addEventListener('click', open);
  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  overlay.querySelectorAll('.rw-tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
  overlay.querySelector('[data-action="search"]').addEventListener('click', () => void refreshDiscover());
  nodes.search.addEventListener('keydown', event => { if (event.key === 'Enter') void refreshDiscover(); });
  overlay.querySelector('[data-action="admin-search"]').addEventListener('click', () => void refreshAdmin());
  nodes.adminSearch.addEventListener('keydown', event => { if (event.key === 'Enter') void refreshAdmin(); });
  nodes.adminStatus.addEventListener('change', () => void refreshAdmin());
  nodes.adminCategory.addEventListener('change', () => void refreshAdmin());
  nodes.offlineInput.addEventListener('change', async () => {
    const selected = nodes.offlineInput.files?.[0];
    nodes.offlineInput.value = '';
    if (!selected) return;
    try {
      const imported = await projectService.importOffline(selected);
      try { host.toastr?.success?.(`已导入 ${imported.name} v${imported.version}`, '创意工坊'); } catch {}
      await refreshInstalled();
    } catch (error) {
      notifyError(error);
    }
  });

  nodes.login.addEventListener('click', async () => {
    nodes.login.disabled = true;
    nodes.login.textContent = '等待授权...';
    try {
      setAuth(await workshopApi.login());
      showTab(activeTab);
    } catch (error) {
      notifyError(error);
    } finally {
      nodes.login.disabled = false;
      nodes.login.textContent = 'Discord 登录';
    }
  });

  nodes.logout.addEventListener('click', async () => {
    nodes.logout.disabled = true;
    try {
      await workshopApi.logout();
      setAuth(null);
    } catch (error) {
      notifyError(error);
    } finally {
      nodes.logout.disabled = false;
    }
  });

  nodes.createForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = nodes.createForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const form = new FormData(nodes.createForm);
      await workshopApi.createProject({
        name: String(form.get('name') || ''),
        summary: String(form.get('summary') || ''),
        category: String(form.get('category') || 'data'),
      });
      nodes.createForm.reset();
      await refreshMine();
    } catch (error) {
      notifyError(error);
    } finally {
      submit.disabled = false;
    }
  });

  const refresh = async () => {
    await Promise.allSettled([refreshHealth(), refreshAuth()]);
    showTab(activeTab);
  };

  const bridge = {
    version: VERSION,
    open,
    close,
    refresh,
    login: () => workshopApi.login(),
    logout: () => workshopApi.logout(),
    getSession: () => workshopApi.getStoredAuth(),
    listInstalled: () => projectService.installed(),
    cacheProject: projectId => projectService.cache(projectId),
    checkProjectUpdate: projectId => projectService.checkUpdate(projectId),
    applyProject: projectId => projectService.apply(projectId),
    uninstallProject: projectId => projectService.uninstall(projectId),
    exportProject: projectId => projectService.exportCached(projectId),
    importProject: file => projectService.importOffline(file),
  };

  host[GLOBAL_NAME] = bridge;
  host.dispatchEvent(new CustomEvent('reincarnation-workshop-ready', { detail: { version: VERSION } }));
  void refreshDiscover();

  window.addEventListener('pagehide', () => {
    try { if (host[GLOBAL_NAME] === bridge) delete host[GLOBAL_NAME]; } catch {}
    launcher.remove();
    overlay.remove();
    style.remove();
    booted = false;
  }, { once: true });
}
