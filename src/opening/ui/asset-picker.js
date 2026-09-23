import { listOpeningAssets } from '../character-assets/registry.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function summary(asset) {
  const build = asset.build || asset.character || {};
  return [build.种族, build.层级, ...(Array.isArray(build.身份) ? build.身份.slice(0, 2) : [])].filter(Boolean);
}

export async function mountOpeningAssetPicker(root, {
  kind,
  title,
  emptyText = '暂无已安装内容，可前往创意工坊获取。',
  onSelect = () => {},
  allowCustom = true,
  customLabel = '自定义创建',
} = {}) {
  if (!root) return () => {};
  let assets = await listOpeningAssets(kind);
  let query = '';
  let selectedId = '';
  let expandedId = '';

  const render = () => {
    const filtered = assets.filter(asset => {
      const haystack = [asset.name, asset.sourceProjectName, ...summary(asset)].join(' ').toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
    root.innerHTML = `
      <section class="oa-picker">
        <header class="oa-head">
          <div><span class="oa-kicker">REINCARNATION ARCHIVE</span><h3>${esc(title || '角色档案')}</h3></div>
          <label class="oa-search"><span>⌕</span><input data-oa-search placeholder="搜索姓名 / 种族 / 身份 / 来源" value="${esc(query)}"></label>
        </header>
        <div class="oa-toolbar">
          <span>${filtered.length} 份可用档案</span>
          ${allowCustom ? `<button type="button" class="oa-custom" data-oa-custom>＋ ${esc(customLabel)}</button>` : ''}
        </div>
        <div class="oa-grid">
          ${filtered.length ? filtered.map(asset => {
            const tags = summary(asset);
            const active = selectedId === asset.id;
            const expanded = expandedId === asset.id;
            const profile = asset.profile || {};
            return `<article class="oa-card ${active ? 'is-selected' : ''}" data-oa-id="${esc(asset.id)}">
              <button type="button" class="oa-card-main" data-oa-select>
                <span class="oa-glow"></span>
                <span class="oa-source">${esc(asset.sourceProjectName || '本地档案')}</span>
                <strong>${esc(asset.name || '未命名角色')}</strong>
                <span class="oa-tags">${tags.map(t=>`<i>${esc(t)}</i>`).join('')}</span>
                <span class="oa-status">${active ? '✓ 已选定' : '选择档案'}</span>
              </button>
              <button type="button" class="oa-detail-toggle" data-oa-detail>${expanded ? '收起档案' : '查看详情'} <b>${expanded ? '−' : '+'}</b></button>
              ${expanded ? `<div class="oa-detail">
                ${profile.性格 ? `<p><em>性格</em>${esc(profile.性格)}</p>` : ''}
                ${profile.喜爱 ? `<p><em>喜爱</em>${esc(profile.喜爱)}</p>` : ''}
                ${profile.背景故事 ? `<p><em>背景</em>${esc(profile.背景故事)}</p>` : ''}
                <p><em>构筑</em>血统 ${Object.keys((asset.build||{}).血统||{}).length} · 技能 ${Object.keys((asset.build||{}).技能||{}).length} · 装备 ${Object.keys((asset.build||{}).装备||{}).length} · 形态 ${Object.keys((asset.build||{}).形态库||{}).length}</p>
              </div>` : ''}
            </article>`;
          }).join('') : `<div class="oa-empty"><span>◇</span><strong>档案库为空</strong><p>${esc(emptyText)}</p></div>`}
        </div>
      </section>`;

    root.querySelector('[data-oa-search]')?.addEventListener('input', event => { query = event.target.value; render(); event.target.focus(); });
    root.querySelector('[data-oa-custom]')?.addEventListener('click', () => onSelect({ custom: true }));
    root.querySelectorAll('[data-oa-id]').forEach(card => {
      const id = card.dataset.oaId;
      card.querySelector('[data-oa-select]')?.addEventListener('click', () => {
        selectedId = id;
        render();
        onSelect(assets.find(asset => asset.id === id));
      });
      card.querySelector('[data-oa-detail]')?.addEventListener('click', () => { expandedId = expandedId === id ? '' : id; render(); });
    });
  };
  render();
  return () => { root.innerHTML = ''; };
}
