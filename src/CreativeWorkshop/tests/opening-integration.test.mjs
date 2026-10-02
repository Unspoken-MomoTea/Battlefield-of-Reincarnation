import assert from 'node:assert/strict';
import test from 'node:test';

import { workshopTemplate } from '../ui/template.js';
import {
  createOpeningAssetRecord,
  listOpeningAssetsByProject,
  replaceProjectOpeningAssets,
} from '../../opening/character-assets/registry.js';
import {
  listProjectStoreCatalogs,
  replaceProjectStoreCatalogs,
} from '../../opening/store/installed-catalogs.js';

test('publish shell uses one category selector plus character subtype and dynamic dedicated editor host', () => {
  const html = workshopTemplate('test');
  assert.match(html, /<option value="store_catalog">开局商店<\/option>/u);
  assert.match(html, /<option value="character">角色<\/option>/u);
  assert.match(html, /name="character_kind"/u);
  assert.match(html, /data-role="dedicated-editor-host"/u);
  assert.doesNotMatch(html, /name="extension_kind"/u);
  assert.doesNotMatch(html, /data-field="create-data"/u);
  assert.doesNotMatch(html, /opening_bloodline[^_]/u);
  assert.doesNotMatch(html, /store_equipments/u);
  assert.match(html, /data-role="publish-resource-section"/u);
  assert.match(html, /data-category-filter="extension" data-kind-filter="extension"[^>]*>扩展<\/button>/u);
  assert.match(html, /data-character-home[^>]*>角色<\/button>/u);
  assert.match(html, /data-kind-filter="store_catalog"[^>]*>开局商店<\/button>/u);
  assert.match(html, /data-role="character-world"/u);
  assert.match(html, /data-role="character-opening"/u);
  assert.match(html, /data-role="character-partner"/u);
});

test('browse category switches avoid duplicate discover refreshes', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const events = fs.readFileSync(fileURLToPath(new URL('../app/events.js', import.meta.url)), 'utf8');
  const app = fs.readFileSync(fileURLToPath(new URL('../app/workshop-app.js', import.meta.url)), 'utf8');
  assert.match(app, /function showTab\(name, \{ refresh = true \} = \{\}\)/u);
  assert.match(app, /if \(!refresh\) return;/u);
  assert.match(events, /showTab\('discover', \{ refresh: false \}\)/u);
});

test('installer snapshots remain usable in non-browser contract tests', async () => {
  assert.deepEqual(await listOpeningAssetsByProject('project:test'), []);
  assert.deepEqual(await listProjectStoreCatalogs('project:test'), []);
  assert.equal(await replaceProjectOpeningAssets({ id: 'project:test' }, []), 0);
  assert.equal(await replaceProjectStoreCatalogs({ id: 'project:test' }, []), 0);
});

test('browser-only opening payloads fail clearly when IndexedDB is unavailable', async () => {
  await assert.rejects(
    replaceProjectOpeningAssets(
      { id: 'project:test', name: 'Test', version: 1 },
      [{ content: { kind: 'opening_character', build: { 种族: '人类' } } }],
    ),
    /IndexedDB/,
  );
  await assert.rejects(
    replaceProjectStoreCatalogs(
      { id: 'project:test', name: 'Test', version: 1 },
      [{ content: { kind: 'store_catalog', catalog: { equipments: [] } } }],
    ),
    /IndexedDB/,
  );
});


test('specialized editor source is form-driven and contains no JSON code textarea contract', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const source = fs.readFileSync(fileURLToPath(new URL('../views/author/dedicated-editor.js', import.meta.url)), 'utf8');
  assert.match(source, /\+ 添加商品/u);
  assert.match(source, /删除/u);
  assert.match(source, /最多 2 项/u);
  assert.match(source, /OPENING_RANKS = \['Ⅰ', 'Ⅱ', 'Ⅲ'\]/u);
  assert.match(source, /STORE_QUALITIES = \['F', 'E', 'D'\]/u);
  assert.match(source, /budget = partner \? 16 : 8/u);
  assert.doesNotMatch(source, /opening_occupation_/u);
  assert.doesNotMatch(source, /职业名称/u);
  assert.doesNotMatch(source, /职业类型/u);
  assert.match(source, /STORE_PRICE_FLOOR = \{ F: 50, E: 300, D: 700 \}/u);
  assert.match(source, /EQUIPMENT_ATTR_QUALITIES = \['F', 'E', 'D', 'C', 'B', 'A'\]/u);
  assert.match(source, /\+ 添加效果/u);
  assert.match(source, /rw-effect-remove/u);
  assert.match(source, /if \(state\.length >= max\) return/u);
  assert.match(source, /\+ 添加装备/u);
  assert.match(source, /\+ 添加技能/u);
  assert.match(source, /rw-opening-skill-remove/u);
  assert.doesNotMatch(source, /五维加点 · 总预算/u);
  assert.doesNotMatch(source, /血统与五维（/u);
  assert.doesNotMatch(source, /JSON\.parse/u);
  assert.doesNotMatch(source, /rw-code-input/u);
});


test('library opening partner forwards the published appearance into the MVU partner node', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const opening = fs.readFileSync(
    fileURLToPath(new URL('../../../Regular/开局.html', import.meta.url)),
    'utf8',
  );
  assert.match(opening, /外貌:\s*pp\.外貌\s*\|\|\s*pb\.外貌\s*\|\|\s*''/u);

  const picker = fs.readFileSync(
    fileURLToPath(new URL('../../opening/ui/asset-picker.js', import.meta.url)),
    'utf8',
  );
  assert.match(picker, /profile\.外貌/u);
  assert.match(picker, /<em>外貌<\/em>/u);
});

test('opening library shows portraits and selected build details before launch', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const opening = fs.readFileSync(
    fileURLToPath(new URL('../../../Regular/开局.html', import.meta.url)),
    'utf8',
  );

  assert.match(opening, /asset\.avatarUrl/u);
  assert.match(opening, /class="asset-library-avatar"/u);
  assert.match(opening, /function renderSelectedAssetPanel\(asset, kind\)/u);
  assert.match(opening, /血统原始属性/u);
  assert.match(opening, /blood\.data\.原始属性/u);
  assert.match(opening, /selectedOpeningAttributePoints/u);
  assert.match(opening, /applyOpeningAttributePoints\(selectedOpeningAttributePoints\(asset\)\)/u);
});

test('opening library live-refreshes installed assets and shows bloodline effects without duplicate portrait', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const opening = fs.readFileSync(
    fileURLToPath(new URL('../../../Regular/开局.html', import.meta.url)),
    'utf8',
  );
  const registry = fs.readFileSync(
    fileURLToPath(new URL('../../opening/character-assets/registry.js', import.meta.url)),
    'utf8',
  );

  assert.match(registry, /OPENING_ASSETS_CHANGED_EVENT = 'reincarnation:opening-assets-changed'/u);
  assert.match(registry, /notifyOpeningAssetsChanged\(\{ action: 'replace'/u);
  assert.match(registry, /notifyOpeningAssetsChanged\(\{ action: 'remove'/u);
  assert.match(opening, /addEventListener\('reincarnation:opening-assets-changed'/u);
  assert.match(opening, /void loadOpeningAssets\(\)/u);

  const panelStart = opening.indexOf('function renderSelectedAssetPanel(asset, kind)');
  const panelEnd = opening.indexOf('function renderOpeningCharacterLibrary()', panelStart);
  const panel = opening.slice(panelStart, panelEnd);
  assert.ok(panelStart >= 0 && panelEnd > panelStart);
  assert.doesNotMatch(panel, /asset-selected-avatar/u);
  assert.doesNotMatch(panel, /<span>血统 \$\{esc\(blood\.name\)/u);
  assert.match(panel, /<strong>血统<\/strong>/u);
  assert.match(panel, /blood\.data\.效果/u);
  assert.match(panel, /asset-selected-effect/u);
  assert.match(panel, /const equipmentSection = kind === 'partner'/u);
  assert.match(panel, /\$\{equipmentSection\}/u);
});

test('opening live-refresh covers characters, partners, and store catalogs', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const opening = fs.readFileSync(
    fileURLToPath(new URL('../../../Regular/开局.html', import.meta.url)),
    'utf8',
  );
  const catalogs = fs.readFileSync(
    fileURLToPath(new URL('../../opening/store/installed-catalogs.js', import.meta.url)),
    'utf8',
  );
  const editor = fs.readFileSync(
    fileURLToPath(new URL('../views/author/dedicated-editor.js', import.meta.url)),
    'utf8',
  );

  assert.match(catalogs, /OPENING_STORE_CHANGED_EVENT = 'reincarnation:opening-store-changed'/u);
  assert.match(catalogs, /notifyOpeningStoreChanged\(\{ action: 'replace'/u);
  assert.match(catalogs, /notifyOpeningStoreChanged\(\{ action: 'remove'/u);
  assert.match(opening, /addEventListener\('reincarnation:opening-store-changed'/u);
  assert.match(opening, /loadOpeningStoreCatalogs\(projectId\)/u);
  assert.match(opening, /DB\[group\] = DB\[group\]\.filter\(item => !item\._sourceProjectId\)/u);
  assert.match(opening, /renderSubCategories\(\);[\s\S]*renderRarityFilter\(\);[\s\S]*renderItems\(\);/u);

  assert.match(opening, /renderOpeningCharacterLibrary\(\);[\s\S]*renderOpeningPartnerLibrary\(\);/u);
  assert.match(opening, /实时刷新创意工坊角色\/伙伴失败/u);

  assert.match(editor, /STORE_ATTR_MAX_POINTS = 15/u);
  assert.match(editor, /STORE_ATTR_MAX_COUNT = 3/u);
  assert.match(editor, /index \+ 1/u);
  assert.match(editor, /F=1 \/ E=2 \/ D=3 \/ C=4 \/ B=5 \/ A=6/u);
  assert.match(editor, /已选 \$\{usage\.count\}\/\$\{STORE_ATTR_MAX_COUNT\} 项/u);
  assert.match(editor, /select\.disabled = selectionLocked && !select\.value/u);
  assert.match(editor, /remainingPoints = Math\.max\(0, STORE_ATTR_MAX_POINTS - otherPoints\)/u);
  assert.match(editor, /最高可选品质/u);
  assert.match(editor, /本次选择已撤回/u);
});

test('cross-origin opening delivery reads installed assets through the workshop host bridge', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const openingSource = fs.readFileSync(
    fileURLToPath(new URL('../../opening/runtime/10-core-assets.js', import.meta.url)),
    'utf8',
  );
  const workshopApp = fs.readFileSync(
    fileURLToPath(new URL('../app/workshop-app.js', import.meta.url)),
    'utf8',
  );
  const bridge = fs.readFileSync(
    fileURLToPath(new URL('../app/opening-data-bridge.js', import.meta.url)),
    'utf8',
  );

  assert.match(openingSource, /reincarnation:opening-data-request/u);
  assert.match(openingSource, /reincarnation:opening-data-response/u);
  assert.match(openingSource, /window\.parent\.postMessage|target\.postMessage/u);
  assert.match(openingSource, /loadHostOpeningData/u);
  assert.match(workshopApp, /bindOpeningDataBridge/u);
  assert.match(bridge, /listOpeningAssets/u);
  assert.match(bridge, /listInstalledStoreCatalogs/u);
  assert.match(bridge, /cdn\.jsdelivr\.net/u);
});

test('opening defaults character and partner tabs from installed workshop assets', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const opening = fs.readFileSync(
    fileURLToPath(new URL('../../../Regular/开局.html', import.meta.url)),
    'utf8',
  );

  assert.match(opening, /let characterMode = 'custom';/u);
  assert.match(opening, /let partnerMode = 'custom';/u);
  assert.match(opening, /let openingAssetDefaultsApplied = false;/u);
  assert.match(opening, /characterMode = openingAssets\.some\(asset => asset\.kind === 'opening_character'\) \? 'library' : 'custom'/u);
  assert.match(opening, /partnerMode = openingAssets\.some\(asset => asset\.kind === 'opening_partner'\) \? 'library' : 'custom'/u);
  assert.match(opening, /id="partner-mode-custom" class="active"[\s\S]*id="partner-mode-library"/u);
  assert.match(opening, /id="opening-partner-library" style="display:none;"/u);
});

test('installed opening partner writes configured affection and teammate flag into MVU relation node', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const opening = fs.readFileSync(
    fileURLToPath(new URL('../../../Regular/开局.html', import.meta.url)),
    'utf8',
  );

  const partnerStart = opening.indexOf("if (selectedPartner === 'library' && selectedOpeningPartner)");
  const partnerEnd = opening.indexOf("if (selectedPartner === 'custom' && useCustomPartnerFlag)", partnerStart);
  const partnerBlock = opening.slice(partnerStart, partnerEnd);
  assert.ok(partnerStart >= 0 && partnerEnd > partnerStart);
  assert.match(partnerBlock, /Number\(pb\.好感度\)/u);
  assert.match(partnerBlock, /Math\.max\(-100, Math\.min\(100,/u);
  assert.match(partnerBlock, /好感度:[\s\S]*:\s*0/u);
  assert.match(
    partnerBlock,
    /是否队友:\s*typeof pb\.是否队友 === 'boolean' \? pb\.是否队友 : true/u,
  );
  assert.doesNotMatch(
    opening,
    /partnerNode = \{[\s\S]{0,500}姓名: selectedOpeningPartner\.name[\s\S]{0,500}是否队友: true/u,
  );
});

test('installed opening partner suppresses the AI completion instruction', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const opening = fs.readFileSync(
    fileURLToPath(new URL('../../../Regular/开局.html', import.meta.url)),
    'utf8',
  );

  assert.match(opening, /if \(selectedPartner === 'library' && selectedOpeningPartner\)[\s\S]*partnerIsCompleteAsset = true;/u);
  assert.ok(opening.includes('partnerNode && !partnerIsCompleteAsset ? `[协同实体补全指令]'));
});
test('creator styles hide the character subtype outside character category and keep compact grids inside bounds', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const source = fs.readFileSync(fileURLToPath(new URL('../ui/styles.js', import.meta.url)), 'utf8');
  assert.match(source, /\.rw-field\[hidden\]\{display:none!important\}/u);
  assert.match(source, /\.rw-field>\.rw-input,[\s\S]*max-width:100%/u);
  assert.match(source, /\.rw-point-grid\{[\s\S]*repeat\(auto-fill,minmax\(min\(100%,220px\),1fr\)\)/u);
  assert.match(source, /\.rw-store-attr-grid,[\s\S]*repeat\(auto-fit,minmax\(78px,1fr\)\)/u);
});


test('creator flows require a cover before local testing or publishing', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const template = workshopTemplate('test');
  const create = fs.readFileSync(fileURLToPath(new URL('../views/author/create-project.js', import.meta.url)), 'utf8');
  const editor = fs.readFileSync(fileURLToPath(new URL('../views/author/project-editor.js', import.meta.url)), 'utf8');
  const heretic = fs.readFileSync(fileURLToPath(new URL('../views/author/create-heretic.js', import.meta.url)), 'utf8');
  assert.doesNotMatch(template, /封面图（可选）/u);
  assert.match(template, /data-action="create-heretic-open" hidden/u);
  assert.match(template, /data-form="create-heretic" hidden/u);
  assert.match(template, /封面图 \*/u);
  assert.match(template, /data-drop-target="heretic-cover"/u);
  assert.match(template, /data-role="heretic-cover-preview"/u);
  assert.match(template, /data-role="heretic-cover-state"/u);
  assert.match(create, /所有本地测试和正式作品都必须带封面/u);
  assert.match(create, /所有正式作品都必须带封面/u);
  assert.match(create, /showRequiredField/u);
  assert.doesNotMatch(create, /return notifyError\(new Error\('请先填写作品名称'\)\)/u);
  assert.doesNotMatch(create, /return notifyError\(new Error\('请选择封面图片；发布作品必须提供图片'\)\)/u);
  assert.match(create, /const coverDataUrl = await readFileDataUrl\(cover\)/u);
  assert.match(editor, /本地测试也必须带图片/u);
  assert.match(editor, /发布作品必须提供图片/u);
  assert.match(heretic, /发布异端也必须提供图片/u);
  assert.match(heretic, /const renderCover=/u);
  assert.match(heretic, /createObjectURL/u);
  assert.match(heretic, /dataTransfer\?\.files/u);
  assert.match(heretic, /is-dragover/u);
  assert.match(heretic, /let attempt=null/u);
  assert.match(heretic, /if\(!attempt\.projectId\)/u);
  assert.match(heretic, /if\(!attempt\.coverUploaded\)/u);
  assert.match(heretic, /if\(!attempt\.versionUploaded\)/u);
  assert.match(heretic, /if\(!attempt\.submitted\)/u);
});

test('opening asset registry inherits the project cover as default avatar without changing the build', () => {
  const record = createOpeningAssetRecord(
    {
      id: 'project:avatar',
      name: '角色作品',
      version: 3,
      coverUrl: 'https://workshop.example/api/projects/project%3Aavatar/cover',
    },
    {
      kind: 'opening_character',
      name: '测试角色',
      build: { 层级: 'Ⅱ', 血统: { 测试: { 品质: 'E' } } },
    },
    2,
    0,
  );
  assert.equal(record.id, 'project:avatar:2:0');
  assert.equal(record.avatarUrl, 'https://workshop.example/api/projects/project%3Aavatar/cover');
  assert.equal(record.build.层级, 'Ⅱ');
});

test('specialized heading keeps remaining points beside the bloodline-and-five-stats label', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const editor = fs.readFileSync(fileURLToPath(new URL('../views/author/dedicated-editor.js', import.meta.url)), 'utf8');
  const styles = fs.readFileSync(fileURLToPath(new URL('../ui/styles.js', import.meta.url)), 'utf8');
  assert.match(editor, /rw-special-subtitle-row/u);
  assert.match(editor, /allocator\.remaining/u);
  assert.match(styles, /\.rw-special-subtitle-row\{[\s\S]*align-items:center;justify-content:space-between/u);
});
