    function shopGetAI() {
        var win = GS_PARENT || window;
        try {
            if (typeof win.generateRaw === 'function') return win.generateRaw;
        } catch (e) {}
        try {
            if (typeof generateRaw === 'function') return generateRaw;
        } catch (e2) {}
        try {
            if (win.TavernHelper && typeof win.TavernHelper.generateRaw === 'function') return win.TavernHelper.generateRaw;
        } catch (e3) {}
        return null;
    }
    // 32d-2. 统一封装AI调用(返回Promise, 兼容同步/异步)
    //  统一分发: 若"额外模型配置"开关开启 → 走自托管API(apiChat); 否则 → 走 generateRaw 正文AI
    function shopCallAI(systemPrompt, userMsg) {
        if (isApiConfigEnabled()) {
            // 额外模型通道: OpenAI 兼容 /chat/completions 直连(商城刷新/血统融合共用)
            return apiChat(systemPrompt, userMsg).then(function(content){
                // generateRaw 返回的通常是字符串; 保持调用方语义一致
                return content;
            });
        }
        return new Promise(function (resolve, reject) {
            var fn = shopGetAI();
            if (!fn) { reject(new Error('未找到正文AI接口 generateRaw')); return; }
            try {
                var p = fn({
                    ordered_prompts: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user',   content: userMsg }
                    ]
                });
                Promise.resolve(p).then(function (r) { resolve(r); }).catch(function (e) { reject(e); });
            } catch (e) { reject(e); }
        });
    }
    // 32d-3. 解析AI返回的YAML式文本 → { 血统列表:[], 技能列表:[], 装备列表:[], 道具列表:[] }
    //   容错: 兼容 ```yaml / ``` 代码围栏; 字段名大小写不敏感; 行内 {a:1,b:2} 与 ['a','b'] 内联语法
    //   严格匹配ZOD新结构: 血统(原始属性/效果) 技能(类型0-2) 装备(类型0-8) 道具(类型str/数量)
    function shopParseMarketText(text) {
        var result = { 血统列表: [], 技能列表: [], 装备列表: [], 道具列表: [], 升级列表: [], 形态列表: [] };
        if (!text || typeof text !== 'string') return result;
        // 剥离代码围栏
        var cleaned = text.replace(/```(?:ya?ml|json)?/gi, '').replace(/```/g, '');
        var lines = cleaned.split('\n');
        // 内联对象/数组解析: {a:1, b:2} → {a:1,b:2}; ['a','b'] → ['a','b']
        function parseInline(raw) {
            if (raw == null) return null;
            var s = String(raw).trim();
            if (!s) return null;
            // 行内 {...}
            if (/^\{.*\}$/.test(s)) {
                try { return JSON.parse(s.replace(/'/g, '"')); } catch (e) {}
                // 手动拆分 键:值 对
                var obj = {};
                var inner = s.slice(1, -1);
                var parts = inner.split(',');
                for (var i = 0; i < parts.length; i++) {
                    var kv = parts[i].split(':');
                    if (kv.length >= 2) {
                        var k = kv[0].trim().replace(/['"]/g, '');
                        var v = parts[i].slice(kv[0].length + 1).trim().replace(/['"]/g, '');
                        if (k) obj[k] = v;
                    }
                }
                return Object.keys(obj).length ? obj : null;
            }
            // 行内 [...]
            if (/^\[.*\]$/.test(s)) {
                try { return JSON.parse(s.replace(/'/g, '"')); } catch (e2) {}
                var innerA = s.slice(1, -1);
                var arr = innerA.split(',').map(function(x) { return x.trim().replace(/['"]/g, ''); }).filter(Boolean);
                return arr.length ? arr : null;
            }
            return null;
        }
        function num(v, def) { var n = parseFloat(v); return isFinite(n) ? n : (def || 0); }
        function str(v) {
            var s = (v == null) ? '' : String(v).trim();
            // 剥离 YAML 字符串外层配对引号(双引号或单引号), 如 "材料" → 材料
            if (s.length >= 2 && (s.charAt(0) === '"' || s.charAt(0) === "'") && s.charAt(s.length - 1) === s.charAt(0)) {
                s = s.slice(1, -1);
            }
            return s;
        }
        function tags(v) {
            var p = parseInline(v);
            if (Array.isArray(p)) return p.map(function(x) { return String(x); });
            if (typeof v === 'string' && v.trim()) return v.split(/[,，、]/).map(function(x){return x.trim();}).filter(Boolean);
            return [];
        }
        function objMap(v) {
            var p = parseInline(v);
            return (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
        }
        // 属性对象(用于 原始属性: {力量:'B', ATK:5} 兼容品质字母与数值)
        function numMap(v) {
            var p = parseInline(v);
            if (!p || typeof p !== 'object' || Array.isArray(p)) return {};
            var out = {};
            for (var key in p) {
                if (!Object.prototype.hasOwnProperty.call(p, key)) continue;
                out[key] = attrMapVal(p[key]);
            }
            return out;
        }
        // 缩进式YAML解析: 按列表头(血统列表/技能列表/...)分段, 每段内 - 项为新条目, 同级缩进键为字段
        var listKeys = ['血统列表', '技能列表', '装备列表', '道具列表', '升级列表', '形态列表'];
        var curList = null;     // 当前所在列表名(result的key)
        var curItem = null;     // 当前正在填充的条目对象
        var itemIndent = -1;    // 当前条目的 - 行缩进
        function flushItem() {
            if (curItem && curList && Array.isArray(result[curList])) {
                if (curItem.名称) result[curList].push(curItem);
            }
            curItem = null;
            itemIndent = -1;
        }
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            // 跳过空行与注释
            if (!line.trim() || /^\s*#/.test(line)) continue;
            // 顶层列表头(无缩进或极小缩进的 "xxx列表:")
            var headM = line.match(/^\s{0,2}(血统列表|技能列表|装备列表|道具列表|升级列表|形态列表)\s*:\s*$/);
            if (headM) {
                flushItem();
                curList = headM[1];
                continue;
            }
            // 列表项起始: 行内含 "  - " 前缀
            var itemM = line.match(/^(\s*)-\s+(.*)$/);
            if (itemM && curList) {
                flushItem();
                curItem = {};
                itemIndent = itemM[1].length;
                // 行内可能带 名称: xxx
                var rest = itemM[2];
                var inlineKV = rest.match(/^([^\s:]+)\s*:\s*(.*)$/);
                if (inlineKV) {
                    var _pv = parseInline(inlineKV[2]);
                    curItem[inlineKV[1]] = _pv !== null ? _pv : str(inlineKV[2]);
                }
                continue;
            }
            // 字段行: 缩进大于列表头, 形如 "  字段: 值"
            var fieldM = line.match(/^(\s+)([^\s:]+)\s*:\s*(.*)$/);
            if (fieldM && curItem && curList) {
                var k = fieldM[2];
                var v = fieldM[3];
                var fieldIndent = fieldM[1].length;
                // 多行对象字段: 形态列表内 技能 子块, 值为空时, 向下收集更深层缩进的 "- 名称: ..." 子技能
                // (形态条目内嵌 技能: { - 名称: ...\n  品质: ...\n  类型: ...\n  效果: {...}\n  标签: [...] } 子列表,
                //  子技能的 效果/原始属性 也可能展开为多行 YAML, 需前瞻收集)
                // 技能 子块收集: 形态列表 内, 或 升级列表 内且当前条目 所属大类=形态(形态升级条目内嵌 技能 子列表)
                var _isFormSkillBlock = (curList === '形态列表') || (curList === '升级列表' && curItem && (curItem.所属大类 === '形态' || curItem.category === '形态'));
                if (!v.trim() && _isFormSkillBlock && k === '技能') {
                    var skillsArr = [];
                    var sCur = null;        // 当前正在填充的子技能
                    var sIndent = -1;       // 子技能 "- " 行缩进
                    var j3 = i + 1;
                    // 子技能字段值处理器: 行内值 sv → 归一化为对应类型
                    function pushSkillField(obj, fk, fv) {
                        if (fk === '标签') obj[fk] = tags(fv);
                        else if (fk === '类型') {
                            var _stn = parseInt(fv, 10);
                            obj[fk] = isFinite(_stn) ? _stn : 0;
                        } else if (fk === '效果') {
                            obj[fk] = objMap(fv);
                        } else if (fk === '原始属性') {
                            obj[fk] = numMap(fv);
                        } else {
                            obj[fk] = (fv && parseInline(fv) !== null) ? parseInline(fv) : str(fv);
                        }
                    }
                    for (; j3 < lines.length; j3++) {
                        var sLine = lines[j3];
                        if (!sLine.trim() || /^\s*#/.test(sLine)) continue;
                        // 字段行: 缩进大于 sIndent → 当前子技能字段
                        var sfM = sLine.match(/^(\s+)([^\s:]+)\s*:\s*(.*)$/);
                        if (sfM && sCur && sfM[1].length > sIndent) {
                            var sk = sfM[2], sv = sfM[3];
                            var sFieldIndent = sfM[1].length;
                            // 子技能 效果/原始属性 多行展开: 值为空时前瞻收集更深层缩进 key:value
                            if (!sv.trim() && (sk === '效果' || sk === '原始属性')) {
                                var sSub = {};
                                var jj = j3 + 1;
                                for (; jj < lines.length; jj++) {
                                    var sSubLine = lines[jj];
                                    if (!sSubLine.trim() || /^\s*#/.test(sSubLine)) continue;
                                    if (/^\s*-\s+/.test(sSubLine)) break;
                                    var sSubM = sSubLine.match(/^(\s+)([^\s:]+)\s*:\s*(.*)$/);
                                    if (!sSubM || sSubM[1].length <= sFieldIndent) break;
                                    if (sSubM[2]) sSub[sSubM[2]] = str(sSubM[3]);
                                }
                                if (sk === '原始属性') {
                                    var numSubObj = {};
                                    for (var nsk in sSub) { if (sSub.hasOwnProperty(nsk)) numSubObj[nsk] = attrMapVal(sSub[nsk]); }
                                    sCur[sk] = numSubObj;
                                } else {
                                    sCur[sk] = sSub;
                                }
                                j3 = jj - 1;
                                continue;
                            }
                            pushSkillField(sCur, sk, sv);
                            continue;
                        }
                        // 子技能项起始: 缩进大于 技能 字段缩进(fieldIndent), 形如 "     - 名称: xxx"
                        var sItemM = sLine.match(/^(\s*)-\s+(.*)$/);
                        if (sItemM && sItemM[1].length > fieldIndent) {
                            if (sCur) skillsArr.push(sCur);
                            sCur = {};
                            sIndent = sItemM[1].length;
                            var sRest = sItemM[2];
                            var sInlineKV = sRest.match(/^([^\s:]+)\s*:\s*(.*)$/);
                            if (sInlineKV) {
                                var _spv = parseInline(sInlineKV[2]);
                                sCur[sInlineKV[1]] = _spv !== null ? _spv : str(sInlineKV[2]);
                            }
                            continue;
                        }
                        // 缩进回退到 ≤ fieldIndent → 子块结束
                        if (sfM && sfM[1].length <= fieldIndent) break;
                        // 缩进更小的非字段(如下一个形态 - 项) → 结束
                        if (sItemM && sItemM[1].length <= fieldIndent) break;
                        break;
                    }
                    if (sCur) skillsArr.push(sCur);
                    curItem['技能'] = skillsArr;
                    i = j3 - 1;
                    continue;
                }
                // 多行对象字段: 效果/原始属性 值为空时, 向下收集更深层缩进的 key:value 对
                // (AI 常将嵌套对象展开为多行 YAML 而非行内 {k:v}, 需前瞻收集)
                if (!v.trim() && (k === '效果' || k === '原始属性')) {
                    var subObj = {};
                    var j2 = i + 1;
                    for (; j2 < lines.length; j2++) {
                        var subLine = lines[j2];
                        if (!subLine.trim() || /^\s*#/.test(subLine)) continue;
                        if (/^\s*-\s+/.test(subLine)) break;
                        var subM = subLine.match(/^(\s+)([^\s:]+)\s*:\s*(.*)$/);
                        if (!subM || subM[1].length <= fieldIndent) break;
                        if (subM[2]) subObj[subM[2]] = str(subM[3]);
                    }
                    if (k === '原始属性') {
                        var numObj = {};
                        for (var nk in subObj) { if (subObj.hasOwnProperty(nk)) numObj[nk] = attrMapVal(subObj[nk]); }
                        curItem[k] = numObj;
                    } else {
                        curItem[k] = subObj;
                    }
                    i = j2 - 1;
                    continue;
                }
                // 数值字段
                if (k === '价格' || k === '数量') {
                    curItem[k] = num(v, k === '数量' ? 1 : 0);
                } else if (k === '类型') {
                    // 技能(0-2)/装备(0-8)为数字, 道具为字符串
                    var tn = parseInt(v, 10);
                    if (curList === '技能列表' || curList === '装备列表') {
                        curItem[k] = isFinite(tn) ? tn : 0;
                    } else {
                        curItem[k] = str(v);
                    }
                } else if (k === '原始属性') {
                    curItem[k] = numMap(v);
                } else if (k === '效果') {
                    curItem[k] = objMap(v);
                } else if (k === '标签') {
                    curItem[k] = tags(v);
                } else if (k === '品质' || k === '层级' || k === '消耗' || k === '描述' || k === '名称') {
                    curItem[k] = str(v);
                } else {
                    // 未知字段原样保留
                    curItem[k] = parseInline(v) !== null ? parseInline(v) : str(v);
                }
                continue;
            }
        }
        flushItem();
        return result;
    }
    // 32d-4. 构造玩家上下文摘要(供AI参考玩家构筑与层级)
    // ★ 多角色商城: actorName 指定本次为谁生成上下文(角色或NPC); 空间币始终展示角色余额(由角色支付)
    function shopBuildPlayerContext(sd, actorName) {
        actorName = actorName || shopCurrentActor || SHOP_ACTOR_REINCARNATOR;
        var ctx = shopResolveCharacter(sd, actorName);
        var p = ctx.character || {};
        var reincarnatorCoin = (sd.角色 && sd.角色.空间币 != null) ? sd.角色.空间币 : null;
        var reincarnatorCredentials = (sd.角色 && sd.角色.权限凭证 && typeof sd.角色.权限凭证 === 'object') ? sd.角色.权限凭证 : {};
        var parts = [];
        // 顶部标注本次生成目标(角色/队友名), 供AI对齐构筑
        parts.push('本次购买目标: ' + (ctx.isReincarnator ? '角色(玩家本人)' : (actorName + '(队友)')));
        if (p.种族) parts.push('种族: ' + p.种族);
        if (Array.isArray(p.身份) && p.身份.length) parts.push('身份: ' + p.身份.join('/'));
        {
            var _occTxt = occupationSummaryText(p.职业);
            if (_occTxt) parts.push('职业: ' + _occTxt);
        }
        if (p.层级) parts.push('层级: ' + p.层级);
        // 空间币与权限凭证都属于角色账户；即使当前为NPC购买，也使用角色账户支付/授权。
        if (reincarnatorCoin != null) parts.push('空间币: ' + reincarnatorCoin);
        var credentialParts = [];
        for (var _ci = 0; _ci < SHOP_PERMISSION_QUALITY_ORDER.length; _ci++) {
            var _cg = SHOP_PERMISSION_QUALITY_ORDER[_ci];
            var _cq = Math.max(0, Math.floor(safeNum(reincarnatorCredentials[_cg], 0)));
            if (_cq > 0) credentialParts.push(_cg + '×' + _cq);
        }
        parts.push('权限凭证(角色账户): ' + (credentialParts.length ? credentialParts.join(' / ') : '无'));

        // ★ 核心辅助函数：提取物品的所有关键信息，拼接成紧凑的单行文本，既全面又省 Token
        function formatDict(dict) {
            var keys = Object.keys(dict || {});
            if (keys.length === 0) return '无';
            
            return keys.map(function(k) {
                var v = dict[k] || {};
                var info = [];
                
                if (v.品质) info.push(v.品质 + '级');
                if (v.数量 != null) info.push('数量:' + v.数量);
                if (v.消耗) info.push('消耗:' + v.消耗);
                // 属性和效果是对象，用 JSON.stringify 拍平显示
                if (v.原始属性 && Object.keys(v.原始属性).length > 0) info.push('属性:' + JSON.stringify(v.原始属性));
                if (v.效果 && Object.keys(v.效果).length > 0) info.push('效果:' + JSON.stringify(v.效果));
                if (v.描述) info.push('描述:' + v.描述);
                
                // 输出格式例: "  - 御剑术 [F级 | 消耗:8MP | 效果:{"主动":"..."} | 描述:...]"
                return '  - ' + k + ' [' + info.join(' | ') + ']';
            }).join('\n');
        }

        // 已有装备/技能/血统名称(帮助AI避免重复+贴合构筑)
        var blData = p.血统 || {};
        if (Object.keys(blData).length) parts.push('已有血统:\n' + formatDict(blData));
        
        var skData = p.技能 || {};
        if (Object.keys(skData).length) parts.push('已有技能:\n' + formatDict(skData));
        
        var eqData = p.装备 || {};
        if (Object.keys(eqData).length) parts.push('已有装备:\n' + formatDict(eqData));
        
        var invData = p.道具 || {};
        if (Object.keys(invData).length) parts.push('已有物品:\n' + formatDict(invData));

        var statusData = p.状态 || {};
        if (Object.keys(statusData).length) parts.push('已有状态:\n' + formatDict(statusData));

        // 已有形态库(供AI贴合规避重复构筑; 形态升级服务需据此填"替换目标")
        var formData = p.形态库 || {};
        if (Object.keys(formData).length) parts.push('已有形态:\n' + formatDict(formData));
        
        // 世界/任务上下文
        var w = sd.世界 || {};
        if (w.当前世界) parts.push('当前世界: ' + w.当前世界);
        
        return parts.join('\n');
    }
    // 32d-4-1. 获取世界书内容
    async function getWorldBookContent(searchTitle) {
        var win = GS_PARENT; 

        if (!win.EjsTemplate || typeof win.EjsTemplate.evalTemplate !== 'function') {
            console.error('[主神终端] 致命错误：未找到 EjsTemplate.evalTemplate 扩展接口！');
            return null;
        }
        
        try {
            // 4. 因为上面的 ceshiBUG 加了 async，这里的 await 才完全合法
            var env = await win.EjsTemplate.prepareContext({ targetTitle: searchTitle });
            var code = '<%- await getwi(targetTitle) %>';
            var content = await win.EjsTemplate.evalTemplate(code, env);
            
            if (content && content.trim() !== '') {
                return content + '\n';
            }
            return null;
        } catch (error) {
            console.error('[主神终端] 世界书读取异常:', searchTitle, error);
            return null;
        }
    }
    // 32d-5. 主入口: 刷新商品
    function handleShopRefresh(reqText, worldBookContent) {
        var sd = getStatData();
        if (!sd) { samToast('error', '数据未就绪'); return; }
        var sys = sd.系统状态 || {};
        if (sys.是否战斗中 === true) { samToast('warning', '战斗中无法交易, 请在安全区域后再试'); return; }
        if (sys.是否在主神空间 !== true && !(sd.设置 && sd.设置.单一世界 === true)) { samToast('warning', '需返回主神空间后才能开启商城交易'); return; }
        // 检查AI接口: 启用额外模型配置时走自托管API, 否则需 generateRaw
        if (!isApiConfigEnabled() && !shopGetAI()) { samToast('error', '未检测到正文AI接口 generateRaw(或在设置里启用额外模型配置)'); return; }
        if (isApiConfigEnabled()) {
            var _apiCfgChk = getApiConfig();
            if (!_apiCfgChk.model) { samToast('error', '额外模型配置已启用但未选择模型, 请先在设置面板选择模型'); return; }
        }
        // 防重入: 已在刷新中则忽略
        if (shopRefreshing) return;
        // 进入刷新中状态(模块级标志, 切换界面/重渲染仍保持禁用); 立即重渲染以隐藏列表+显示提示
        shopRefreshing = true;
        shopRefreshEpoch += 1;          // 新一轮回合, 此前未完成的旧请求回调会被回合号不匹配丢弃
        var myEpoch = shopRefreshEpoch;
        renderAll();
        // —— 判断是否为精准搜索 ——
        var hasReq = (reqText && reqText.trim() !== '');
        // —— 系统提示词: 主神兑换终端设定 + 新结构说明 ——
       var sysPrompt = ''
            + '你是「主神兑换终端」的商品生成子系统。玩家在主神空间开启商城, 需要你生成一批可购买商品。\n'
            + '世界观: 轮回战场, 玩家穿越各副本世界完成任务, 在主神空间用「空间币」兑换装备/技能/血统/道具/形态。\n'
            + '【系统设定】\n'
            + worldBookContent + '\n'
            + '【生成约束】\n'
            + '1. 贴合度: 根据玩家当前的构筑（偏向物理/近战/生存）、职业和购买力生成。\n'
            + '2. 品质与视野权限控制 (商城解锁铁律):\n'
            + '   - 【前置扫描】: 生成商品前，必须读取【当前角色数据】中的购买对象层级，以及独立字段【权限凭证(角色账户)】。权限凭证不在道具/状态中查找。\n'
            + '   - 【基础视野】: 若无更高权限凭证，商城视野 =【购买对象当前层级+1阶】，最高封顶SSS（Ⅰ=F，Ⅱ=E……Ⅸ=SSS）。\n'
            + '   - 【凭证覆盖】: 若【权限凭证(角色账户)】中存在数量>0且高于【购买对象当前层级+1阶】的X级凭证，则商城视野提升至X级；多个有效凭证只取最高品质。凭证数量不会叠加品质。\n'
            + '   - 【绝对红线】: 商品最高品质不得超过【商城视野】。商城视野只能来源于【基础视野】或【权限凭证】其中之一，禁止叠加计算。阶位序列:F→E→D→C→B→A→S→SS→SSS。普通主神商城AI绝不生成、出售或展示权限凭证；仅空间集市系统柜台按独立规则固定供给。\n'
            + '   - 【纯净展示】: 权限凭证仅用于决定商城视野；选购与结算仍由程序按同一上限硬校验。合法视野内商品无需再次写权限条件，超出商城视野的商品不得生成。\n'
            + '   - 避免与玩家已有物品功能完全重复。\n'
            + '3. 升级重铸机制: \n'
            + '   - 仔细检阅【当前角色数据】，挑选玩家现有的低阶血统、技能、装备或形态，生成高阶强化版本放入「升级列表」。必须直接生成升级后的完整成品面板，绝对禁止采用词条增量打补丁！必须提供精准的 `替换目标`，以便系统进行回收替换。同一目标可提供多个选项。\n'
            + '   - 【升级命名】: 成品必须使用简洁完整的名称；禁止在旧名称后追加或累积“改/强化/进阶/精制/Ⅰ/Ⅱ/Plus”等升级后缀，需要改名时直接整体重命名。\n'
            + '   - 【阶位限制规则】: 升级与重铸的阶位上限，严格与上述第2条的【品质与视野权限控制】同步。绝不能生成超出玩家视野上限的升级方案。\n'
            + '   - 【升级继承规则】:\n'
            + '      * 升级商品必须完整继承替换目标的已有有效词条。\n'
            + '      * 禁止使用“融合了原能力”“保留部分能力”等模糊描述替代实际词条记录。\n'
            + '      * 原装备/技能/血统的已有效果必须逐条迁移到新面板【效果】字段中。\n'
            + '      * 若旧词条被改造、合并或替换，必须明确记录原词条 → 新词条的对应关系。\n'
            + (hasReq
                ? '4. 核心聚焦: 玩家提出了明确的【核心需求】。商品生成必须以此为绝对中心。允许某些分类为空（不生成）。若生成其他类型的商品，必须与核心需求构成【流派联动】（例如需求是"狙击枪"，则配套生成"隐身技能"、"穿甲弹药道具"等）。总数控制在 16~24 个。\n'
                : '4. 均衡刷新: 一次生成约 18~28 个商品，血统/形态/技能/装备/道具 均衡分布，升级列表 2~4 项。\n')
            + '5. 商品职责隔离:\n'
            + '   - 【血统与形态严格隔离】: 两者必须彻底解耦，绝对禁止生成“附带变身形态的血统”。血统是底层生命本质的被动改造；形态是可激活的独立战斗变身面板或外置武装系统。\n'
            + '   - 【形态列表】: 禁止Ⅶ级以上形态商品出售。\n'
            + '   - 【血统列表】: 仅生成玩家未拥有的独立血统体系。若属于玩家已有血统的同源强化、进化、觉醒版本，必须进入升级列表。禁止S级以上血统商品出售。\n'
            + '   - 【升级列表】: \n'
            + '      * 仅处理玩家当前已有血统、技能、装备、形态的强化、升阶或重铸。必须填写准确替换目标。\n'
            + '      * 同阶强化与跨阶升阶均为有效升级方案，同一目标可同时提供同阶强化和跨阶升阶选项。\n'
            + '   - 【世界遗物规则】:\n'
            + '      * 世界遗物禁止作为商城普通商品生成。\n'
            + '      * 世界遗物只能通过任务世界探索、特殊事件、剧情奖励或世界结算获得。\n'
            + '      * 主神空间仅提供世界遗物的解析、修复、强化、融合等服务，不直接出售新的世界遗物。\n'
            + '      * 世界遗物不可进入普通装备栏体系，不作为常规装备替代品处理。\n'
            + '   - 同一目标禁止同时作为普通商品与升级商品出现。\n'
            + '   - 禁止提供金融类服务，如贷款，彩票等一切让玩家额外获得空间币的商品或能力。\n'
            + '6. 修炼类道具规则:\n'
            + '   - 【道具列表】允许生成秘籍、功法、心法、修炼资料等成长型道具。\n'
            + '   - 修炼类道具属于学习媒介，不直接生成技能或被动效果；购买后需通过修炼过程生成对应成长型状态。\n'
            + '   - 若商品描述为功法、修真秘籍、内功心法、魔法研究资料、身体强化方案等，应优先作为【道具】生成，而非【技能】。\n'
            + '   - 技能列表仅用于角色已经掌握、可直接使用的能力，不用于记录学习材料或成长路径。\n'
            + '   - 技能列表禁止生成需要长期学习、修炼积累或改变生命结构才能获得的体系能力。\n'
            + '   - 品质参考:\n'
            + '      * 普通武学、基础训练类秘籍: F-E级\n'
            + '      * 高深武学、内功心法、特殊技艺传承: D-C级\n'
            + '      * 修炼体系、生命进化、长期身体改造类秘籍: 通常不低于D级，依据实际成长潜力评估\n'
            + '   - 禁止将长期修炼体系压缩为单个技能出售，例如禁止把“修真功法”“血脉觉醒法”“内功心法”直接生成技能。\n'
            + '【严格输出格式】\n'
            + '仅输出 YAML 文本, 不要解释、不要 markdown 代码围栏。顶层为六个列表键: 血统列表 / 形态列表 / 技能列表 / 装备列表 / 道具列表 / 升级列表, 每项以 "  - " 开头。\n'
            + '字段类型必须严格遵守:\n'
            + '  - 层级: 字符串, 仅可选 Ⅰ / Ⅱ / Ⅲ / Ⅳ / Ⅴ / Ⅵ / Ⅶ / Ⅷ / Ⅸ\n'
            + '  - 品质: 字符串, 仅可选 F / E / D / C / B / A / S / SS / SSS\n'
            + '  - 标签: 行内数组 [\'标签1\', \'标签2\'...]\n'
            + '  - 原始属性: 行内对象，定档遵循《品质效果数值规则》；血统必须完整包含五维（力量、敏捷、体质、精神、魅力），【形态】必须完整包含五维并附加相关【衍生属性】，装备仅写有效非0项。\n'
            + '  - 效果: 行内对象 {效果名: \'描述\'}, 键为字符串, 值为字符串描述\n'
            + '  - 价格: 数字(空间币)\n'
            + '  - 描述/消耗: 字符串\n'
            + '  - 类型:\n'
            + '      技能列表.类型 = 数字 0(主动) / 1(被动) / 2(特殊)\n'
            + '      装备列表.类型 = 数字 0(武器) / 1(手套) / 2(头部) / 3(胸部) / 4(腿部) / 5(鞋子) / 6(披风) / 7(饰品)\n'
            + '      道具列表.类型 = 字符串(消耗品/材料/特殊等, 同类型需复用且不得细分)\n'
            + '  - 替换目标: 字符串 (仅【升级列表】内商品必填，必须与玩家当前拥有的原物品名称一字不差！)\n'
            + '  - 所属大类: 字符串 (仅【升级列表】内商品必填，仅限填写: 血统 / 形态 / 技能 / 装备)\n'
            + '  - 道具列表.数量 = 数字(该商品可购入的库存份数, ≥1)\n'
            + '对象键禁止使用英文句点，口径类X.Ymm统一写作X·Y（例：5.56mm弹药→5·56弹药）;\n'

        // —— 用户提示词: 玩家上下文 + 需求 + 输出模板示例 ——
        // ★ 多角色: 上下文以当前选中角色为准; AI据此为该角色量身生成商品/升级方案
        var playerCtx = shopBuildPlayerContext(sd, shopCurrentActor);
        var userPrompt = '\n【当前角色数据】\n' + (playerCtx || '(无)') + '\n';
        userPrompt += '\n【输出结构】\n以下内容仅演示字段格式，具体档位按商品定位生成。\n'
            + '血统列表:\n'
            + '  - 名称: 血统名\n'
            + '    品质: E\n'
            + '    标签: ["主神空间", "强化"]\n'
            + '    原始属性: {"力量": "C", "敏捷": "F", "体质": "D", "精神": "E", "魅力": "F"}\n'
            + '    效果: {体能充沛: 基础生命恢复速度小幅提升}\n'
            + '    描述: 简短描述\n'
            + '    价格: 450\n'
            + '技能列表:\n'
            + '  - 名称: 技能名\n'
            + '    品质: F\n'
            + '    类型: 0\n'
            + '    标签: ["主神空间", "被动"]\n'
            + '    效果: {射击校准: 射击检定+5}\n'
            + '    描述: 简短描述\n'
            + '    消耗: 无\n'
            + '    价格: 80\n'
            + '装备列表:\n'
            + '  - 名称: 装备名\n'
            + '    品质: D\n'
            + '    类型: 0\n'
            + '    标签: ["主神空间", "科技"]\n'
            + '    原始属性: {"ATK": "C", "敏捷": "F"}\n'
            + '    效果: {射击稳定: 连续射击检定+15}\n'
            + '    描述: 简短描述\n'
            + '    消耗: 无\n'
            + '    价格: 3000\n'
            + '道具列表:\n'
            + '  - 名称: 道具名\n'
            + '    品质: F\n'
            + '    类型: 消耗品\n'
            + '    数量: 3\n'
            + '    标签: ["主神空间", "辅助"]\n'
            + '    效果: {急救: 恢复10HP}\n'
            + '    描述: 简短描述\n'
            + '    价格: 50\n'
            + '形态列表:\n'
            + '  - 名称: 形态名称\n'
            + '    层级: {按形态自身战斗位格生成，Ⅰ－Ⅸ}\n'
            + '    消耗: HP/EP/特殊资源\n'
            + '    状态: 完好\n'
            + '    标签: ["主神空间", 依赖的道具/血统/来源等]\n'
            + '    原始属性: {基础属性/衍生属性: 品质}\n'
            + '    效果: { [词条]: 描述 }\n'
            + '    技能: {\n'
            + '     - 名称: 技能名\n'
            + '       品质: F\n'
            + '       类型: 0\n'
            + '       标签: ["主神空间", "被动"]\n'
            + '       效果: {射击校准: 射击检定+5}\n'
            + '       描述: 简短描述\n'
            + '       消耗: 无}\n'
            + '    描述: 简短描述\n'
            + '    价格: 300\n'
            + '升级列表:\n'
            + '  - 名称: 进阶装备/技能/血统/形态名称 (例: M16A2突击步枪·改)\n'
            + '    替换目标: 原有物品确切名称 (例: M16A2突击步枪)\n'
            + '    所属大类: 装备 (必填: 血统/技能/装备/形态)\n'
            + '    层级: Ⅰ\n'
            + '    品质: E\n'
            + '    类型: 0\n'
            + '    标签: ["主神空间", "科技", "升级"]\n'
            + '    原始属性: {"ATK": "C", "敏捷": "E"}\n'
            + '    效果: {精密射击: 瞄准射击检定+10}\n'
            + '    描述: 回收旧型号进行重铸升阶后的成品\n'
            + '    消耗: 无\n'
            + '    价格: 300\n'
// 🌟 核心优化：动态结尾指令
if (hasReq) {
    userPrompt += '\n【本次核心商品需求】\n  ' + reqText + '\n';
    userPrompt += '\n现在请基于上述核心需求进行精准检索与配套生成（允许部分列表为空），仅输出 YAML:\n';
} else {
    userPrompt += '\n现在请执行商城日常刷新，仔细检阅玩家数据生成升级方案。仅输出 YAML:\n';
}
            // console.log('系统提示词:', sysPrompt, '\n用户提示词:', userPrompt);
        shopCallAI(sysPrompt, userPrompt).then(function (out) {
            // 回合校验: 用户点了"停止刷新"或重发起一次新刷新时 epoch 已变, 丢弃这次迟到结果
            if (myEpoch !== shopRefreshEpoch || !shopRefreshing) return;
            var parsed = shopParseMarketText(out);
            // 统计生成数量
            var total = (parsed.血统列表.length + parsed.技能列表.length + parsed.装备列表.length + parsed.道具列表.length + parsed.升级列表.length + parsed.形态列表.length);
            if (total === 0) {
                // 解析失败: 退出刷新中态, 恢复原列表显示, 弹提示
                shopRefreshing = false;
                renderAll();
                samToast('error', 'AI返回内容无法解析为商品, 已恢复原商品列表');
                return;
            }
            // ★ 写回 当前角色的专属商库(商城.成员商库.<角色名>); 不影响其他角色的商库
            //   角色键沿用旧顶层结构时迁入 成员商库.角色, 以实现多角色隔离
            var refreshActor = shopCurrentActor || SHOP_ACTOR_REINCARNATOR;
            var ok = writeBackMvu(function (statData) {
                if (!statData.商城 || typeof statData.商城 !== 'object') statData.商城 = {};
                var market = statData.商城;
                // 懒初始化 成员商库
                if (!market[SHOP_ACTOR_LIB_KEY] || typeof market[SHOP_ACTOR_LIB_KEY] !== 'object') {
                    market[SHOP_ACTOR_LIB_KEY] = {};
                }
                var libMap = market[SHOP_ACTOR_LIB_KEY];
                // 角色首次迁入: 将旧顶层扁平商库作为角色初始库存(仅当尚未存在角色键时)
                if (refreshActor === SHOP_ACTOR_REINCARNATOR && !libMap[SHOP_ACTOR_REINCARNATOR]) {
                    var oldTop = null;
                    if (Array.isArray(market.血统列表) || Array.isArray(market.技能列表)
                        || Array.isArray(market.装备列表) || Array.isArray(market.道具列表) || Array.isArray(market.升级列表) || Array.isArray(market.形态列表)) {
                        oldTop = {
                            血统列表: Array.isArray(market.血统列表) ? market.血统列表 : [],
                            技能列表: Array.isArray(market.技能列表) ? market.技能列表 : [],
                            装备列表: Array.isArray(market.装备列表) ? market.装备列表 : [],
                            道具列表: Array.isArray(market.道具列表) ? market.道具列表 : [],
                            升级列表: Array.isArray(market.升级列表) ? market.升级列表 : [],
                            形态列表: Array.isArray(market.形态列表) ? market.形态列表 : []
                        };
                    }
                    libMap[SHOP_ACTOR_REINCARNATOR] = oldTop || { 血统列表:[], 技能列表:[], 装备列表:[], 道具列表:[], 升级列表:[], 形态列表:[] };
                    // 清除旧顶层冗余字段, 统一迁移到成员商库
                    delete market.血统列表;
                    delete market.技能列表;
                    delete market.装备列表;
                    delete market.道具列表;
                    delete market.升级列表;
                    delete market.形态列表;
                }
                // 写入当前角色的新刷新结果(整库覆盖)
                libMap[refreshActor] = {
                    血统列表: parsed.血统列表,
                    技能列表: parsed.技能列表,
                    装备列表: parsed.装备列表,
                    道具列表: parsed.道具列表,
                    升级列表: parsed.升级列表,
                    形态列表: parsed.形态列表
                };
            });
            // 退出刷新中态
            shopRefreshing = false;
            if (ok) {
                shopMarketData = null;   // 触发 renderAll 时从 stat_data 重新归一化
                shopCart = [];
                shopActiveTab = '';
                shopActiveSlot = '';
                renderAll();
                samToast('success', '商品列表已刷新, 共生成 ' + total + ' 件商品');
            } else {
                renderAll();
                samToast('error', '商品已生成但MVU写回失败, 已恢复原商品列表');
            }
        }).catch(function (e) {
            // 失败: 退出刷新中态, 恢复原商品列表显示, 弹提示
            if (myEpoch !== shopRefreshEpoch) return;  // 已被打断, 不再处理失败
            shopRefreshing = false;
            renderAll();
            samToast('error', 'AI生成失败, 已恢复原商品列表: ' + (e && e.message ? e.message : e));
        });
    }
    /* 32d-6. 停止刷新: 用户在"正在刷新…"态点击停止按钮时调用
       - 立即解除 shopRefreshing 锁定, renderAll 恢复刷新按钮可用 + 原商品列表显示
       - 通过推进 shopRefreshEpoch 让已在飞行中的旧 Promise 回调在回合校验处自动丢弃结果,
         AI 迟到的回复不会再覆盖用户当前操作或写入 商城 */
    function shopStopRefresh() {
        if (!shopRefreshing) return;
        shopRefreshEpoch += 1;          // 让旧回调回合不匹配 → 丢弃返回结果
        shopRefreshing = false;
        renderAll();
        samToast('warning', '已停止商品刷新, 可重新点击「刷新商品」');
    }
    /* 32d-7. 停止融合: 用户在"血统融合进行中…"态点击停止按钮时调用
       - 立即解除 bloodFusionBusy 锁定, renderAll 恢复可发起融合
       - 通过推进 bloodFusionEpoch 让已在飞行中的旧 Promise 回调在回合校验处自动丢弃结果,
         AI 迟到的回复不会再覆盖血统库/升级列表/形态库
       - 若本次为商城血统融合(开始时已扣币+删除商品库), 需回滚 bloodFusionSnap 还原空间币+商品库 */
    function bloodFusionStop() {
        if (!bloodFusionBusy) return;
        bloodFusionEpoch += 1;          // 让旧回调回合不匹配 → 丢弃返回结果
        bloodFusionBusy = false;
        bloodFusionShopItem = null;
        bloodFusionResult = null;
        bloodFusionConsumedNames = [];
        // 回滚开始时已扣除的空间币与已删除的商品库
        if (bloodFusionSnap) {
            try {
                writeBackMvu(function(statData) {
                    statData.角色 = statData.角色 || {};
                    statData.角色.空间币 = safeNum(statData.角色.空间币, 0) + bloodFusionSnap.price;
                    statData.角色.权限凭证 = statData.角色.权限凭证 || {};
                    shopCredentialRefund(statData.角色.权限凭证, bloodFusionSnap.credentialRequirements || {});
                    if (bloodFusionSnap.preBloodLib !== null && statData.商城) {
                        var _rlibS = shopGetActorLibRaw(statData.商城, bloodFusionSnap.preActor);
                        if (_rlibS) _rlibS.血统列表 = bloodFusionSnap.preBloodLib.slice();
                    }
                });
            } catch(eStop) { try { console.warn('[主神终端] 停止融合回滚异常:', eStop.message); } catch(e2){} }
            // 商店列表本地缓存还原: 让被删除的血统商品回到血统区
            try {
                var freshSd = getStatData();
                var freshLibS = shopGetActorLibRaw(freshSd && freshSd.商城, bloodFusionSnap.preActor);
                if (freshLibS) {
                    shopMarketData = shopNormalizeMarketData(freshLibS);
                    if (!shopTabHasData(shopActiveTab)) shopActiveTab = shopPickFirstAvailableTab();
                }
            } catch(eSnapStop) {}
            bloodFusionSnap = null;
        }
        closeModal();
        renderAll();
        samToast('warning', '已停止血统融合, 空间币与商品库已回滚, 可重新发起融合');
    }
    /* 统一处理装备/道具操作 */
    function handleItemAction(action, path, kind, typeStr, key) {
        if (!action || !path) return;
        var type = Number(typeStr);
        var sd = getStatData();
        if (!sd || !sd.角色) { samToast('error', '数据未就绪'); return; }
        var isEquip = (kind === 'equip');
        var dict = isEquip ? (sd.角色.装备 || {}) : (sd.角色.道具 || {});
        var basePath = isEquip ? '角色.装备' : '角色.道具';
        // 删除: 直接从字典移除
        if (action === 'delete') {
            var ok = writeBackMvu(function(statData) {
                var d = isEquip ? (statData.角色.装备||{}) : (statData.角色.道具||{});
                if (d[key] !== undefined) delete d[key];
            });
            if (ok) { samToast('success', (isEquip?'装备':'道具')+'已删除: '+key); renderAll(); }
            else samToast('error', '删除失败: MVU写回不可用');
            return;
        }
        // 目标状态映射
        var targetStatus;
        if (action === 'wear') targetStatus = 1;
        else if (action === 'remove') targetStatus = 0;
        else if (action === 'store') targetStatus = 2;
        else if (action === 'takeback') targetStatus = 0;
        else { samToast('error', '未知操作: '+action); return; }
        // 穿戴前的限制校验 (上限配置来自模块级常量 EQUIP_SLOTS / ITEM_SLOT_CAP)
        if (action === 'wear') {
            if (isEquip) {
                // 查 EQUIP_SLOTS 取该类型 cap: cap>=2 满则拒绝; cap===1 替换同类型已装备; cap===0 无限制
                var slotCfg = null;
                for (var si = 0; si < EQUIP_SLOTS.length; si++) { if (EQUIP_SLOTS[si].type === type) { slotCfg = EQUIP_SLOTS[si]; break; } }
                var cap = slotCfg ? slotCfg.cap : 0;
                var slotLabel = slotCfg ? slotCfg.label : '装备';
                if (cap >= 2) {
                    // 多槽位类型(武器2/饰品2): 满则拒绝
                    var wCount = 0;
                    Object.keys(dict).forEach(function(k){ if (Number(dict[k].类型)===type && Number(dict[k].状态)===1) wCount++; });
                    if (wCount >= cap) { samToast('warning', '身上'+slotLabel+'已满('+cap+'件), 先脱下现有'+slotLabel+'后再尝试'); return; }
                } else if (cap === 1) {
                    // 单槽位类型(手套/头部/.../披风): 替换同类型已装备
                    var replaced = [];
                    Object.keys(dict).forEach(function(k){
                        if (k !== key && Number(dict[k].类型) === type && Number(dict[k].状态) === 1) replaced.push(k);
                    });
                    if (replaced.length > 0) {
                        var okR = writeBackMvu(function(statData) {
                            var d = statData.角色.装备 || {};
                            replaced.forEach(function(k){ if (d[k]) d[k].状态 = 0; });
                            if (d[key]) d[key].状态 = 1;
                        });
                        if (okR) { samToast('success', '已穿戴: '+key+(replaced.length?' (替换:'+replaced.join(',')+')':'')); renderAll(); }
                        else samToast('error', '穿戴失败: MVU写回不可用');
                        return;
                    }
                }
                // cap === 0 (特殊): 无限制, 直接走通用穿戴流程
            } else {
                // 道具战术栏限 ITEM_SLOT_CAP 个
                var iCount = 0;
                Object.keys(dict).forEach(function(k){ if (Number(dict[k].状态)===1) iCount++; });
                if (iCount >= ITEM_SLOT_CAP) { samToast('warning', '身上负重已满('+ITEM_SLOT_CAP+'个道具), 先卸载现有道具后再尝试'); return; }
            }
        }
        // 通用: 设目标状态
        var ok2 = writeBackMvu(function(statData) {
            var d = isEquip ? (statData.角色.装备||{}) : (statData.角色.道具||{});
            if (d[key]) d[key].状态 = targetStatus;
        });
        if (ok2) {
            var actLabel = {wear:'穿戴',remove:'脱下',store:'存放',takeback:'取回'}[action];
            samToast('success', actLabel+'成功: '+key);
            renderAll();
        } else {
            samToast('error', '操作失败: MVU写回不可用');
        }
    }

    