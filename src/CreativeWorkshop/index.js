import { resolveHostWindow } from './config.js';
import { workshopApi } from './services/api.js';

const GLOBAL_NAME = 'ReincarnationWorkshop';
const VERSION = '0.1.0';
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
    .rw-overlay{position:fixed;inset:0;z-index:2147483390;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(8,8,12,.62);backdrop-filter:blur(8px);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#eee}
    .rw-overlay.is-open{display:flex}
    .rw-panel{width:min(860px,96vw);height:min(680px,92vh);background:linear-gradient(180deg,#1d1822,#111116);border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.55);overflow:hidden;display:flex;flex-direction:column}
    .rw-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.09)}
    .rw-title{font-weight:750;font-size:18px;flex:1}.rw-version{opacity:.55;font-size:12px}
    .rw-close,.rw-button{border:1px solid rgba(255,255,255,.13);background:#29242f;color:#f6f0f7;border-radius:10px;padding:9px 13px;cursor:pointer}
    .rw-button.primary{background:#7652a8}.rw-button.danger{background:#57353a}
    .rw-body{padding:20px;overflow:auto;display:grid;gap:16px}
    .rw-card{border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.035);padding:16px}
    .rw-card h3{margin:0 0 10px;font-size:15px}.rw-muted{opacity:.65;font-size:13px;line-height:1.6}
    .rw-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.rw-status{font-size:13px}.rw-status.ok{color:#9be4b0}.rw-status.bad{color:#ffaaa1}
    @media(max-width:600px){.rw-launcher{width:46px;height:46px;right:14px;bottom:82px}.rw-overlay{padding:0}.rw-panel{width:100vw;height:100dvh;border-radius:0}}
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
        <div class="rw-version">v${VERSION}</div>
        <button class="rw-close" type="button" data-action="close">关闭</button>
      </header>
      <main class="rw-body">
        <section class="rw-card">
          <h3>服务状态</h3>
          <div class="rw-status" data-role="health">正在检查服务器...</div>
        </section>
        <section class="rw-card">
          <h3>Discord 账号</h3>
          <div class="rw-muted" data-role="account">尚未登录。第一版使用 Discord OAuth 作为唯一登录方式。</div>
          <div class="rw-row" style="margin-top:12px">
            <button class="rw-button primary" type="button" data-action="login">使用 Discord 登录</button>
            <button class="rw-button danger" type="button" data-action="logout" hidden>退出登录</button>
          </div>
        </section>
        <section class="rw-card">
          <h3>工坊内容</h3>
          <div class="rw-muted">这一版先完成服务器健康检查、Discord 登录、会话保存与安全边界。项目浏览、上传、审核与安装会在此基础上继续接入。</div>
        </section>
      </main>
    </section>
  `;
  doc.body.appendChild(overlay);

  const health = overlay.querySelector('[data-role="health"]');
  const account = overlay.querySelector('[data-role="account"]');
  const loginButton = overlay.querySelector('[data-action="login"]');
  const logoutButton = overlay.querySelector('[data-action="logout"]');

  const renderAuth = auth => {
    const user = auth?.user;
    if (!user) {
      account.textContent = '尚未登录。第一版使用 Discord OAuth 作为唯一登录方式。';
      loginButton.hidden = false;
      logoutButton.hidden = true;
      return;
    }
    account.textContent = `已登录：${user.display_name || user.username}（Discord ID: ${user.discord_id}）`;
    loginButton.hidden = true;
    logoutButton.hidden = false;
  };

  const refresh = async () => {
    try {
      const result = await workshopApi.health();
      health.textContent = `服务器在线 · ${result.service} · ${result.version}`;
      health.className = 'rw-status ok';
    } catch (error) {
      health.textContent = `服务器尚未连接：${error.message}`;
      health.className = 'rw-status bad';
    }

    try {
      const stored = await workshopApi.getStoredAuth();
      if (!stored) {
        renderAuth(null);
        return;
      }
      const current = await workshopApi.me();
      renderAuth({ ...stored, user: current.user });
    } catch {
      renderAuth(null);
    }
  };

  const open = () => {
    overlay.classList.add('is-open');
    void refresh();
  };
  const close = () => overlay.classList.remove('is-open');

  launcher.addEventListener('click', open);
  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });

  loginButton.addEventListener('click', async () => {
    loginButton.disabled = true;
    loginButton.textContent = '等待 Discord 授权...';
    try {
      const auth = await workshopApi.login();
      renderAuth(auth);
    } catch (error) {
      console.error('[轮回战场创意工坊] Discord 登录失败:', error);
      account.textContent = `登录失败：${error.message}`;
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = '使用 Discord 登录';
    }
  });

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
      await workshopApi.logout();
      renderAuth(null);
    } finally {
      logoutButton.disabled = false;
    }
  });

  const bridge = {
    version: VERSION,
    open,
    close,
    refresh,
    login: () => workshopApi.login(),
    logout: () => workshopApi.logout(),
    getSession: () => workshopApi.getStoredAuth(),
  };

  host[GLOBAL_NAME] = bridge;
  host.dispatchEvent(new CustomEvent('reincarnation-workshop-ready', { detail: { version: VERSION } }));

  window.addEventListener('pagehide', () => {
    try {
      if (host[GLOBAL_NAME] === bridge) delete host[GLOBAL_NAME];
    } catch {}
    launcher.remove();
    overlay.remove();
    style.remove();
    booted = false;
  }, { once: true });
}
