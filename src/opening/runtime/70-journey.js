    // ==========================================
    // 🚀 终极执行：精准写入 MVU 与酒馆 AI 对接
    // ==========================================
    function parseOpeningWorldLaws(value) {
        return String(value || '')
            .split(/\s*[；;]\s*/)
            .map(s => s.trim())
            .filter(Boolean)
            .slice(0, 10);
    }

    function applyOpeningDefaultPortraits() {
        try {
            const win = window.parent || window;
            const storage = win.localStorage || localStorage;
            const playerAvatar = characterMode === 'library' && selectedOpeningCharacter
                ? String(selectedOpeningCharacter.avatarUrl || '').trim()
                : '';
            if (playerAvatar) {
                storage.setItem('samsara_reincarnator_portrait', playerAvatar);
            }

            if (selectedPartner === 'library' && selectedOpeningPartner) {
                const partnerAvatar = String(selectedOpeningPartner.avatarUrl || '').trim();
                const partnerName = String(selectedOpeningPartner.name || '').trim();
                if (partnerAvatar && partnerName) {
                    storage.setItem('samsara_npc_portrait_' + partnerName, partnerAvatar);
                }
            }
        } catch (error) {
            console.warn('[轮回战场开局] 默认头像写入失败', error);
        }
    }

    async function executeJourney() {
        const name = $('f-name').value.trim() || '';
        const gender = $('f-gender').value;
        const age = $('f-age').value;
        const race = $('f-race').value.trim() || '人类';
        const identity = $('f-identity').value;
        const tier = 'F'; // 初始血统品质固定为 F，不随加点走
        const bloodlineName = race + '血统';

        // 收集面板数据
        // 内部仍存 0..8 点数
        const attrs = {};
        document.querySelectorAll('.attr-input').forEach((input, idx) => { attrs[DB.attributes[idx]] = parseInt(input.value||0); });
        // 对外展示给 AI 时用品质字母
        const attrStr = Object.entries(attrs).map(([k,v])=>`${k}: ${calcSingleTier(v)}级`).join(', ');
        // 写入 MVU 血统的"原始属性"应为字母品质字典(下游 resolveRealAttr 据此读 tier)
        const attrTierObj = {};
        Object.entries(attrs).forEach(([k,v]) => { attrTierObj[k] = calcSingleTier(v); });

        const chosen = getAllItems().filter(i => selectedItems.has(i.id));
        const equipObj = {}, itemObj = {}, skillObj = {};
        chosen.forEach(i => {
            if (i._cat==='equipment' || DB.equipments.some(e=>e.id===i.id)) {
                
                // 🌟 魔术映射：将 UI的 0~17 转换为 数据库的 0~8
                let exportType = i.type;
                if (exportType >= 0 && exportType <= 9) exportType = 0; // 0~9 (所有武器和盾牌) 映射为 0 (手持类)
                else if (exportType >= 10 && exportType <= 17) exportType = exportType - 9; // 10变成1(手部), 11变成2(头部)... 以此类推
                
                // 装备：加入 限制{}，且纯净发包
                equipObj[i.name] = {
                    品质: i.tier, 类型: exportType, 标签: [...(i.tags||[]), ...(i.source?[i.source]:[])],
                    原始属性: i.attrs||{}, 效果: i.effects||{},
                    描述: i.desc||'', 消耗: i.consume||'', 状态: 0
                };
            }
            else if (i._cat==='item' || DB.items.some(e=>e.id===i.id)) {
                itemObj[i.name] = { 
                    品质: i.tier, 类型: i.type, 数量: Math.max(1, Number(i.quantity || 1)), 标签: [...(i.tags||[]), ...(i.source?[i.source]:[])], 
                    效果: i.effects||{}, 描述: i.desc||'' 
                };
            }
            else if (i._cat==='skill' || DB.skills.some(e=>e.id===i.id)) {
                // 技能：移除了伤害节点、冷却节点，Type是强类型的数字
                skillObj[i.name] = { 
                    品质: i.tier, 类型: i.type, 标签: [...(i.tags||[]), ...(i.source?[i.source]:[])], 
                    效果: i.effects||{}, 描述: i.desc||'', 消耗: i.consume||'' 
                };
            }
        });

        const openingCharacterBuild = characterMode === 'library' && selectedOpeningCharacter ? (selectedOpeningCharacter.build || selectedOpeningCharacter.character || {}) : null;
        const libraryBloodlineName = openingCharacterBuild ? (Object.keys(openingCharacterBuild.血统 || {})[0] || '') : '';
        const libraryBloodline = libraryBloodlineName && openingCharacterBuild
            ? ((openingCharacterBuild.血统 && openingCharacterBuild.血统[libraryBloodlineName]) || {})
            : null;
        const initialBloodlineName = libraryBloodlineName || bloodlineName;
        const initialBloodlineQuality = (libraryBloodline && libraryBloodline.品质) || tier;
        const initialBloodlineDescription = (libraryBloodline && libraryBloodline.描述) || '最初的基础，却有无限可能';
        const initialBloodlineAttributes = libraryBloodline
            ? DB.attributes.map(attr => attr + ': ' + (((libraryBloodline.原始属性 || {})[attr]) || 'F') + '级').join(', ')
            : attrStr;
        const libraryBloodlineEffects = libraryBloodline ? Object.entries(libraryBloodline.效果 || {}) : [];
        const initialBloodlineEffectText = libraryBloodline
            ? (libraryBloodlineEffects.length
                ? libraryBloodlineEffects.map(([effectName,effectText]) => effectName + ': ' + effectText).join('；')
                : '无（保持角色档案，不自动补写）')
            : '待首次降临生成';
        let partnerNode = null;
        let partnerIsCompleteAsset = false;
        if (selectedPartner === 'library' && selectedOpeningPartner) {
            const pb = structuredClone(selectedOpeningPartner.build || selectedOpeningPartner.character || {});
            const pp = selectedOpeningPartner.profile || {};
            partnerNode = {
                ...pb,
                姓名: selectedOpeningPartner.name || '未命名伙伴',
                在场: true,
                是否队友: typeof pb.是否队友 === 'boolean' ? pb.是否队友 : true,
                好感度: Number.isFinite(Number(pb.好感度)) ? Math.max(-100, Math.min(100, Number(pb.好感度))) : 0,
                性格: pp.性格 || pb.性格 || '',
                喜爱: pp.喜爱 || pb.喜爱 || '',
                外貌: pp.外貌 || pb.外貌 || '',
                背景故事: pp.背景故事 || pb.背景故事 || ''
            };
            partnerIsCompleteAsset = true;
        }
        if (selectedPartner === 'custom' && useCustomPartnerFlag) {
            partnerNode = { 姓名:$('cp-name').value.trim(), 层级:$('cp-tier').value, 种族:$('cp-race').value.trim(), 身份:[$('f-identity').value, $('cp-gender').value], 在场:true, 是否队友:true, 好感度:0, 喜爱:$('cp-like').value.trim(), 外貌:$('cp-app').value.trim(), 背景故事:$('cp-bg').value.trim() };
        }

        const wsLocked = (() => { const el=$('ws-lock'); return el ? el.checked : false; })();

        // 工坊开局角色/伙伴的项目封面作为默认头像。
        // 只在本次开局初始化时赋值；状态栏原有的点击头像上传/切换逻辑仍可随时覆盖。
        applyOpeningDefaultPortraits();

        // -----------------------------------------------------
        // 1. 尝试将数据精准写入后台 MVU (使用 Lodash _.set 不覆盖原有骨架)
        // -----------------------------------------------------
        try {
            const win = window.parent || window;
            if (win.Mvu && win._) {
                if (typeof win.waitGlobalInitialized === 'function') await win.waitGlobalInitialized('Mvu');
                const c = win.Mvu.getMvuData({type:'message', message_id:'latest'});
                const _set = win._.set;

                // 设置
                _set(c, 'stat_data.设置.世界超稳', wsLocked);
                _set(c, 'stat_data.设置.单一世界', singleWorldEnabled);

                // 角色资产与血统 (完美避开覆盖 HP/EP 等其他属性)
                _set(c, 'stat_data.角色.种族', race);
                const libraryIdentities = openingCharacterBuild && Array.isArray(openingCharacterBuild.身份)
                    ? openingCharacterBuild.身份
                    : [];
                const resolvedIdentities = [...new Set([
                    ...libraryIdentities,
                    identity,
                    gender,
                    age+'岁'
                ].map(value => String(value || '').trim()).filter(Boolean))];
                _set(c, 'stat_data.角色.身份', resolvedIdentities);
                _set(c, 'stat_data.角色.空间币', currentCoins);

                if (openingCharacterBuild) {
                    ['种族','层级','血统','技能','装备','状态','形态库','当前形态'].forEach(key => {
                        if (openingCharacterBuild[key] !== undefined) _set(c, 'stat_data.角色.' + key, structuredClone(openingCharacterBuild[key]));
                    });
                }
                
                _set(c, 'stat_data.角色.道具', itemObj);
                // 角色库提供基础构筑；本次开局商店购买的装备/技能继续叠加，不能被角色模板吞掉。
                const mergedEquip = openingCharacterBuild
                    ? { ...structuredClone(openingCharacterBuild.装备 || {}), ...equipObj }
                    : equipObj;
                const mergedSkills = openingCharacterBuild
                    ? { ...structuredClone(openingCharacterBuild.技能 || {}), ...skillObj }
                    : skillObj;
                _set(c, 'stat_data.角色.装备', mergedEquip);
                _set(c, 'stat_data.角色.技能', mergedSkills);
                
                // 自定义角色才创建初始血统；角色库资产保留其完整原始构筑
                if (!openingCharacterBuild) _set(c, `stat_data.角色.血统.${bloodlineName}`, {
                    品质: tier,
                    标签: ['初始血统', race],
                    原始属性: attrTierObj,
                    效果: {},
                    描述: '最初的基础，却有无限可能'
                });

                // 伙伴注入(阵营以最终确认时角色阵营为准, 防止建档后改阵营导致不一致)
                if (partnerNode && Array.isArray(partnerNode.身份)) partnerNode.身份[0] = $('f-identity').value;
                if (partnerNode) _set(c, `stat_data.关系列表.${partnerNode.姓名}`, partnerNode);

                // 世界信息精准注入
                if (singleWorldEnabled) {
                    _set(c, 'stat_data.系统状态.是否在主神空间', false);
                    _set(c, 'stat_data.世界.时间', $('sw-time').value.trim());
                    _set(c, 'stat_data.世界.名称', $('sw-name').value.trim());
                    _set(c, 'stat_data.世界.因果轨道', { 当前阶段: $('sw-mainstate').value.trim() || '未设定', 故事线: '', 下一节点: '', 偏移记录: {} });
                } else if (selectedPlot) {
                    _set(c, 'stat_data.系统状态.是否在主神空间', false);
                    const p = DB.plots.find(x => x.id === selectedPlot);
                    if (p) {
                        // .match(/【(.*?)】/) 会提取出【】里面的内容
                        const cleanName = (p.name.match(/【(.*?)】/) || [])[1] || p.name;
                        _set(c, 'stat_data.世界.名称', cleanName);
                        // 世界位格(罗马数字 Ⅰ~Ⅸ), 与[InitVar]世界初始设定.yaml 字段对齐, 与【选择世界】正则保持同步
                        if (p.rank) _set(c, 'stat_data.世界.位格', p.rank);
                        // 综合难度(保留 tier 原始范围 F~E 原样入库, 不截断为单个字母), 与【选择世界】正则保持同步
                        if (p.tier) {
                            const tierRaw = String(p.tier).replace(/\s+/g,'').replace(/[-–—]/g,'~').toUpperCase();
                            if (tierRaw) _set(c, 'stat_data.世界.难度', tierRaw);
                        }
                        // 预设世界法则已经固化在 DB.plots.p.law 中，开局时直接程序写入。
                        // p.risk 是风险/后果提示，不属于世界法则数组。
                        _set(c, 'stat_data.世界.法则', parseOpeningWorldLaws(p.law));
                        // 干涉模式 + 空名单；异端身份由随后的主神任务初始化
                        _set(c, 'stat_data.世界.异端雷达.当前模式', p.ecology || p.eco || '');
                        _set(c, 'stat_data.世界.异端雷达.名单', {});
                    }
                }

                await win.Mvu.replaceMvuData(c, {type:'message', message_id:'latest'});
                // replaceMvuData 可能同步触发状态栏刷新；再补写一次，保证新开局清理旧头像后仍得到本次默认头像。
                applyOpeningDefaultPortraits();
                console.log('✅ MVU 后台数据已隐蔽精准同步 (_.set 局部写入)');
            }
        } catch(e) { console.warn('非 SillyTavern 环境，跳过 MVU 写入'); }

        // -----------------------------------------------------
        // 2. 拼接发送给 AI 看的指令与文本
        // -----------------------------------------------------
        let isWorldAnchored = false;
        let worldText = "当前处于主神空间待机状态，未锚定具体世界。";
        if (singleWorldEnabled) {
            isWorldAnchored = true; // 状态更新：已进入单一世界
            worldText = `【${$('sw-name').value.trim() || '未知世界'}】
时间锚点: ${$('sw-time').value.trim() || '未设定'}
主线状态: ${$('sw-mainstate').value.trim() || '未设定'}
切入身份: ${$('sw-identity').value.trim() || '角色'}
主神任务: ${$('sw-goal').value.trim() || '无'}`;
        } else if (selectedPlot) {
            const p = DB.plots.find(x => x.id === selectedPlot);
            if (p) {
                isWorldAnchored = true; // 状态更新：已选择多元世界
                
                // 提取出干净的名字, 评级改用世界位格(罗马数字)
                const cleanName = (p.name.match(/【(.*?)】/) || [])[1] || p.name;
                const rank = p.rank || 'Ⅰ';
                const tier = (p.tier || 'F~E').replace(/\s+/g,'').replace('~','-') + '级';

                worldText = `【${cleanName}】 (世界位格: ${rank})
副本难度: ${tier}
时间锚点: ${p.time}
干涉模式: ${p.ecology} (预计异端: ${p.aliens!=null?p.aliens:0}人)
主线状态: ${p.deviation}
世界法则: ${p.law}
风险提示: ${p.risk}
切入身份: ${p.identity}`;
            }
        }

        let partnerText = "无协同实体";
        if (partnerNode) {
            const pName = partnerNode.姓名 || '未命名';
            const pTier = partnerNode.层级 || 'Ⅰ';
            const pRace = partnerNode.种族 || '未知';
            const pId = (partnerNode.身份 && partnerNode.身份[0]) || '未设定';
            const pApp = partnerNode.外貌 || '无';
            const pLike = partnerNode.喜爱 || '无';
            const pBg = partnerNode.背景故事 || '无';
            partnerText = `姓名: ${pName}
种族: ${pRace}
身份: ${pId}
层级: ${pTier}级
外貌特征: ${pApp}
喜爱: ${pLike}
背景故事: ${pBg}`;
        }
        // 2. 动态生成环境与传闻指令（核心修改）
        const envInstruction = isWorldAnchored
            ? "在叙事中，根据当前【时间锚点】与世界背景，更新货币、因果轨道、势力等地点变量，并全量刷新传闻，必须完整且符合世界当前局势。最后生成【主神任务】。"
            : "在叙事中，请重点描绘「主神空间」或私人休整区的宏大/静谧环境、光影变幻或系统光球的微光。聚焦于角色刚到此处的状态。";
        const bloodlineAwakeningInstruction = openingCharacterBuild
            ? ''
            : `首次降临时，请根据角色填写的【种族】特性，为「${initialBloodlineName}」设计 1~2 个符合【${initialBloodlineQuality}级】强度限制的专属血统效果，并在剧情中表现出觉醒的异象！`;
        const promptText = `进行开局初始化，请根据以下配置展开叙事：
（注：系统已将角色的初始装备、道具、血统与羁绊对象直接写入底层数据库。人物与羁绊基本属性已存在，禁止在初始化时替换它们，请直接提取使用。）

【角色信息】
姓名: ${name}
性别: ${gender}
年龄: ${age}岁
种族: ${race}
身份: ${identity}

【初始血统】
名称: ${initialBloodlineName}
品质: ${initialBloodlineQuality}级
原始属性: ${initialBloodlineAttributes}
效果: ${initialBloodlineEffectText}
描述: ${initialBloodlineDescription}

【协同实体 (伙伴)】
${partnerText}

【世界与降临信息】
${worldText}

---
【系统指令与叙事要求】：
生成一个极具沉浸感的开局场景。
${bloodlineAwakeningInstruction}
${envInstruction}
${partnerNode && !partnerIsCompleteAsset ? `[协同实体补全指令]：角色身边存在专属伙伴「${partnerNode.姓名 || '未命名'}」。该实体当前仅具有基础概念（层级、阵营、背景故事、喜好），缺乏具体战斗数据。请你基于其资料与【${partnerNode.层级 || '未知'}级】的强度限制，**自动为其推演并补全空白的战术模块**：
1. 赋予契合人设并符合层级限制的【血统】与【技能】。
2. 为其配备 1~2 件符合层级的【初始装备/武器】。
【叙事要求】：在开局场景中，请按时间锚点合理编排伙伴与角色的切入关系。在登场时，必须通过外貌细节与动作描写，自然地展现出伙伴补全的外貌着装等，并清晰呈现其性格、当前对角色的信任状态及真实态度。` : ''}`;

        // -----------------------------------------------------
        // 3. 拦截酒馆文本框并发送
        // -----------------------------------------------------
        try {
            const win = window.parent || window;
            const textarea = win.document.getElementById('send_textarea');
            const sendBtn = win.document.getElementById('send_but');
            
            if (textarea && sendBtn) {
                textarea.value = promptText;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                sendBtn.click();
                showToast('正在降临世界...', 'success');
            } else {
                console.log(promptText);
                showToast('未检测到酒馆界面，请手动在终端输入。', 'warning');
            }
        } catch(e) {
            showToast('跨域访问受限，无法自动发送！', 'error');
        }
    }

    // 等工坊安装的角色/伙伴/商店 Catalog 读取完成后再初始化。
    // 这样预设恢复不会在 openingAssets 尚未就绪时把已选资产 ID 丢掉。
    openingDataReady.catch(error => {
        console.warn('[轮回战场开局] 开局扩展资料初始化失败，将使用核心资料继续启动', error);
    }).finally(() => init());

