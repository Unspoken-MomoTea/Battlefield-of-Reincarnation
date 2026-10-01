    function shopGetLastMessageId() {
        try {
            var win = GS_PARENT || window;
            var helper = win.TavernHelper || {};
            var ctx = (win.SillyTavern && typeof win.SillyTavern.getContext === 'function') ? win.SillyTavern.getContext() : null;
            var fn = helper.getLastMessageId || win.getLastMessageId || (ctx ? ctx.getLastMessageId : null);
            var id = typeof fn === 'function' ? Number(fn.call(ctx || win)) : NaN;
            if (Number.isFinite(id)) return id;
            if (ctx && Array.isArray(ctx.chat)) return ctx.chat.length - 1;
        } catch(e) {}
        return 0;
    }
    function shopReadMessageById(messageId) {
        try {
            var win = GS_PARENT || window;
            if (typeof win.getChatMessages !== 'function') return null;
            var messages = win.getChatMessages(messageId);
            if (messages && messages.length) {
                return messages[messages.length - 1] || messages[0];
            }
        } catch(e) {}
        return null;
    }
    function shopWaitForCreatedUserMessage(afterId, timeout) {
        timeout = timeout || 10000;
        var start = Date.now();
        return new Promise(function(resolve, reject) {
            function check() {
                if (Date.now() - start > timeout) { reject(new Error('未能定位交易记录楼层')); return; }
                try {
                    var latestId = shopGetLastMessageId();
                    var found = false;
                    var pending = latestId - afterId;
                    if (pending <= 0) { setTimeout(check, 80); return; }
                    var checked = 0;
                    var next = function(id) {
                        if (id > latestId) {
                            if (!found) setTimeout(check, 80);
                            return;
                        }
                        var msg = shopReadMessageById(id);
                        if (msg && msg.role === 'user') { resolve(id); return; }
                        next(id + 1);
                    };
                    next(afterId + 1);
                } catch(e) { setTimeout(check, 80); }
            }
            check();
        });
    }
    function shopTriggerSlash(cmd) {
        return new Promise(function(resolve, reject) {
            try {
                var win = GS_PARENT || window;
                // 优先 triggerSlash(酒馆原生)
                if (typeof win.triggerSlash === 'function') { resolve(win.triggerSlash(cmd)); return; }
                if (typeof win.SillyTavern === 'object' && win.SillyTavern && typeof win.SillyTavern.triggerSlash === 'function') { resolve(win.SillyTavern.triggerSlash(cmd)); return; }
                // 兜底: 注册的 STScriptParser / executeSlashCommand
                if (typeof win.executeSlashCommand === 'function') { resolve(win.executeSlashCommand(cmd)); return; }
                if (typeof win.registeredSlashCommands !== 'undefined') {
                    // /send 走 sendToInputBox 自动发送替代
                    reject(new Error('triggerSlash 不可用'));
                    return;
                }
                reject(new Error('triggerSlash 不可用'));
            } catch(e) { reject(e); }
        });
    }
    // 小票只记录已经成功落地的本地商城行为；逐笔换行追加，等待正文模型叙事后清空。
    function shopAppendReceipt(statData, line) {
        if (!statData || !line) return;
        statData.系统状态 = statData.系统状态 || {};
        var oldText = safeStr(statData.系统状态.待播报记录, '').trim();
        statData.系统状态.待播报记录 = oldText ? (oldText + '\n' + line) : line;
    }
    function shopReceiptLine(action, detail, cost, balance, actorLabel) {
        var who = actorLabel || '角色';
        return '['+action+']['+who+'] '+detail+'｜支付 '+safeNum(cost, 0)+'空间币｜余额 '+safeNum(balance, 0);
    }
    function shopClearReceipt() {
        var ok = writeBackMvu(function(statData) {
            statData.系统状态 = statData.系统状态 || {};
            statData.系统状态.待播报记录 = '';
        });
        if (ok) { renderAll(); samToast('success', '待播报记录已删除'); }
        else samToast('error', '删除失败: MVU写回不可用');
    }
    // 构建交易: 在 stat_data 副本上执行扣币/入包, 返回 { statData, purchaseLog, receipts, actorName }
    // ★ 多角色商城: 接收者(打包装入背包的角色)由 shopCurrentActor 决定(角色或NPC); 货币永远从 角色.空间币 扣除
    function shopBuildTransaction(statData) {
        var coinOwner = statData.角色;
        if (!coinOwner) throw new Error('角色数据不存在');
        var actorName = shopCurrentActor || SHOP_ACTOR_REINCARNATOR;
        var character = (actorName === SHOP_ACTOR_REINCARNATOR) ? coinOwner : (statData.关系列表 && statData.关系列表[actorName]);
        if (!character) throw new Error('角色数据不存在: ' + actorName);
        for (var gateI = 0; gateI < shopCart.length; gateI++) {
            var gateItem = shopCart[gateI] || {};
            var gate = shopPermissionDecision(character, gateItem, coinOwner.权限凭证);
            if (!gate.allowed) throw new Error(shopPermissionMessage(gate, gateItem));
        }
        var credentialRequirements = shopCredentialCartRequirements(character, shopCart);
        var credentialShortages = shopCredentialShortages(coinOwner.权限凭证, credentialRequirements);
        if (credentialShortages.length) throw new Error('权限凭证不足：' + shopCredentialShortageText(credentialShortages));
        var total = shopCartCost();
        var startCoin = Number(coinOwner.空间币 || 0);
        if (startCoin < total) throw new Error('角色空间币不足');
        coinOwner.权限凭证 = coinOwner.权限凭证 || {};
        if (!shopCredentialConsume(coinOwner.权限凭证, credentialRequirements)) throw new Error('权限凭证扣除失败');
        coinOwner.空间币 = startCoin - total;
        if (!character.装备) character.装备 = {};
        if (!character.技能) character.技能 = {};
        if (!character.血统) character.血统 = {};
        if (!character.道具) character.道具 = {};
        if (!character.形态库) character.形态库 = {};
        var itemStrs = [];
        var receiptLines = [];
        var receiptBalance = startCoin;
        var _actorLabel = (actorName === SHOP_ACTOR_REINCARNATOR) ? '角色' : actorName;
        for (var i = 0; i < shopCart.length; i++) {
            var item = shopCart[i];
            var qty = item.quantity || 1;
            if (item._cat === '技能区') {
                character.技能[item.name] = shopToSkillVar(item);
            } else if (item._cat === '血统区') {
                // ★ 血统上限防御(兜底): 正常流程血统区商品在 shopHandleExec 被拦截进融合弹窗,
                //   直接购买路径(bloodFusionDirectPurchase)已含上限检查; 此分支防止未来改动
                //   绕过路由导致净增血统突破 BLOODLINE_CAP
                if (!character.血统[item.name] && Object.keys(character.血统).length >= BLOODLINE_CAP) {
                    throw new Error('血统已达上限(' + BLOODLINE_CAP + '), 无法购买: ' + item.name);
                }
                character.血统[item.name] = shopToBloodlineVar(item);
            } else if (item._cat === '装备区') {
                var nextEq = shopToEquipVar(item, item._slot);
                character.装备[item.name] = nextEq;
            } else if (item._cat === '道具区') {
                var old = character.道具[item.name];
                var nextCon = shopToConsumeVar(item, qty);
                if (old && typeof old === 'object') nextCon.数量 = Number(old.数量 || 0) + qty;
                var merged = {};
                if (old && typeof old === 'object') { for (var ok2 in old) { if (old.hasOwnProperty(ok2)) merged[ok2] = old[ok2]; } }
                for (var nk in nextCon) { if (nextCon.hasOwnProperty(nk)) merged[nk] = nextCon[nk]; }
                character.道具[item.name] = merged;
            } else if (item._cat === '形态区') {
                // 形态商品: 直接购买入形态库(键为形态名, 不强制替换; 同名覆盖)
                character.形态库[item.name] = shopToFormVar(item, item.name);
            } else if (item._cat === '升级区') {
                // 升级商品: 按所属大类决定写入哪个角色字段; 替换目标决定回收哪个旧物品
                var upCat = item.category || '';
                var tgtName = item.replace_target || item.name;
                if (upCat === '血统') {
                    // ★ 血统上限防御: 升级服务语义是"删旧加新"(数量不变), 但若 AI 生成的
                    //   replace_target 与角色实际持有的血统名不匹配(数据过期/已被融合/名字幻觉),
                    //   delete 会沦为空操作, 等效"净增1个血统"→ 绕过 BLOODLINE_CAP 上限。
                    //   故写入前校验: 替换目标不存在且非同名覆盖时, 购买后数量不得超上限。
                    var bTgtExists = !!character.血统[tgtName];
                    var bOverwrite = !!character.血统[item.name];
                    if (!bTgtExists && !bOverwrite && Object.keys(character.血统).length >= BLOODLINE_CAP) {
                        throw new Error('血统已达上限(' + BLOODLINE_CAP + '), 升级服务【' + item.name + '】的替换目标【' + tgtName + '】不存在, 无法购买');
                    }
                    if (bTgtExists) delete character.血统[tgtName];
                    character.血统[item.name] = shopToBloodlineVar(item);
                } else if (upCat === '技能') {
                    if (character.技能[tgtName]) delete character.技能[tgtName];
                    character.技能[item.name] = shopToSkillVar(item);
                } else if (upCat === '装备') {
                    var oldEquip = character.装备[tgtName];
                    var newEquip = shopToEquipVar(item, '');
                    if (oldEquip && typeof oldEquip === 'object' && oldEquip.状态 != null) newEquip.状态 = oldEquip.状态;
                    if (character.装备[tgtName]) delete character.装备[tgtName];
                    character.装备[item.name] = newEquip;
                } else if (upCat === '形态') {
                    // 升级形态: 删旧形态(替换目标)再写新形态; 与"购买形态"同走 shopToFormVar
                    if (character.形态库[tgtName]) delete character.形态库[tgtName];
                    character.形态库[item.name] = shopToFormVar(item, item.name);
                }
            }
            var qtyStr = qty > 1 ? ' ×'+qty : '';
            var ratingStr = item.rating ? ('（'+item.rating+'级）') : '';
            // 升级服务小票: 显示 "替换目标→新名称", 操作标记为"升级"; 其他商品为"购买 名称"
            var upTgtName = (item._cat === '升级区' && item.replace_target) ? item.replace_target : '';
            var itemDetail = upTgtName ? (upTgtName + ' → ' + item.name + ratingStr) : (item.name + qtyStr + ratingStr);
            var itemAction = upTgtName ? '升级' : '购买';
            var itemCost = Number(item.price || 0) * Number(qty);
            receiptBalance -= itemCost;
            itemStrs.push(itemDetail);
            receiptLines.push(shopReceiptLine(itemAction, itemDetail, itemCost, receiptBalance, _actorLabel));
        }
        shopRecalcDerived(character);
        // 从 当前角色对应的商库 移除已购买商品(持久化售出状态)
        shopRemovePurchasedFromLibrary(statData, shopCart, actorName);
        return {
            statData: statData,
            purchaseLog: _actorLabel + '兑换了 ' + itemStrs.join('、'),
            receipts: receiptLines,
            actorName: actorName
        };
    }
    // 从商品库移除已购物品: 商城.成员商库.<角色名> 下的 装备列表/技能列表/血统列表/道具列表/升级列表 均为扁平数组
    // 所有区域(含道具区)统一"整件移除"——买走的商品直接从商品库消失, 不做数量递减
    // (商店语义: 玩家买走的即下架, 不再陈列; 道具原数量字段仅作展示, 不作为可购上限)
    // ★ 多角色: actorName 指定从哪个角色的专属商库移除; 默认沿用 shopCurrentActor
    function shopRemovePurchasedFromLibrary(statData, cart, actorName) {
        if (!statData.商城) return;
        var libMap = statData.商城[SHOP_ACTOR_LIB_KEY];
        actorName = actorName || shopCurrentActor || SHOP_ACTOR_REINCARNATOR;
        var lib = null;
        if (libMap && libMap[actorName]) {
            lib = libMap[actorName];
        } else if (actorName === SHOP_ACTOR_REINCARNATOR) {
            // 兼容旧数据: 角色商库可能直接平铺在 商城 顶层
            if (Array.isArray(statData.商城.装备列表) || Array.isArray(statData.商城.技能列表)
                || Array.isArray(statData.商城.血统列表) || Array.isArray(statData.商城.道具列表) || Array.isArray(statData.商城.升级列表) || Array.isArray(statData.商城.形态列表)) {
                lib = statData.商城;
            }
        }
        if (!lib) return;
        // 收集已购物品名(全部整件移除)
        var removeNames = {};
        for (var i = 0; i < cart.length; i++) {
            removeNames[cart[i].name] = true;
        }
        // 新结构: 4个扁平数组, 逐个过滤(整件移除)
        var listKeys = ['装备列表','技能列表','血统列表','道具列表','升级列表','形态列表'];
        for (var ki = 0; ki < listKeys.length; ki++) {
            var key = listKeys[ki];
            if (Array.isArray(lib[key])) {
                lib[key] = shopFilterLibArray(lib[key], removeNames);
            }
        }
        // ★ 升级服务互斥: 玩家购买某升级服务后, 其替换目标(原物品)已被删除,
        //   升级列表里其余"替换目标=该同一原物品"的升级条目也失去意义, 一并移除
        //   例: 人类血统 → 升级列表有【修仙进化】【科技进化】【血肉进化】, 均以"人类血统"为替换目标;
        //       购买【修仙进化】后人类血统被删除, 剩余对应人类血统的升级商品全部移除
        if (Array.isArray(lib.升级列表) && lib.升级列表.length) {
            var consumeTargets = {};
            for (var ci = 0; ci < cart.length; ci++) {
                var ce = cart[ci];
                if (ce && ce._cat === '升级区' && ce.replace_target) {
                    consumeTargets[String(ce.replace_target)] = true;
                }
            }
            if (Object.keys(consumeTargets).length) {
                lib.升级列表 = lib.升级列表.filter(function(u) {
                    var upTgt = String(shopPick(u, 'replace_target','替换目标') || '');
                    // 同替换目标的升级条目一并移除(已购条目上面已整件移除, 这里兜底再清)
                    return !(upTgt && consumeTargets[upTgt]);
                });
            }
        }
    }
    // 商品库数组过滤(整件移除): 按名称移除已购物品, 其余保留
    function shopFilterLibArray(arr, removeNames) {
        if (!Array.isArray(arr) || !removeNames) return arr || [];
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var it = arr[i];
            var nm = String(shopPick(it, '名称','name','道具名','物品名') || '');
            if (removeNames[nm]) continue;
            out.push(it);
        }
        return out;
    }
    // 返回对象上第一个匹配的 key 名(供原地修改数量字段)
    function shopPickKey(obj) {
        for (var i = 1; i < arguments.length; i++) {
            var k = arguments[i];
            if (obj && obj[k] !== undefined) return k;
        }
        return null;
    }
    function shopHandleExec() {
        var sd = getStatData();
        if (!sd) { samToast('error', '数据未就绪'); return; }
        if (!shopCart.length) { samToast('warning', '请先选择商品'); return; }
        // ★ 升级服务也有融合进行中屏蔽: 命中"replace_target=正在被融合的血统"的升级条目禁止结算
        if (bloodFusionBusy && bloodFusionConsumedNames.length) {
            var upgradeHit = shopCart.filter(function(entry) {
                return entry && entry._cat === '升级区' && entry.category === '血统'
                    && bloodFusionConsumedNames.indexOf(entry.replace_target || '') >= 0;
            });
            if (upgradeHit.length) { samToast('warning', '血统融合进行中, 对应升级服务暂不可购买, 请等待融合完成'); return; }
        }
        var bloodItems = shopCart.filter(function(entry) { return entry && entry._cat === '血统区'; });
        if (bloodItems.length) {
            // ★ 血统相关操作屏蔽: 融合进行中不允许再发起血统购买/融合; 其他商品交易不受影响
            if (bloodFusionBusy) { samToast('warning', '血统融合进行中, 请等待融合完成后再购买血统'); return; }
            // ★ 血统购买自动收敛: 清理购物车内其他类别商品 + 多余血统条目, 仅保留最后一个选中的血统,
            //   保证融合流程顺利发起(融合会替换 / 直接购买会入栏), 不再阻止用户进入融合舱
            var keepBlood = bloodItems[bloodItems.length - 1];
            if (bloodItems.length !== 1 || shopCart.length !== 1) {
                shopCart = [];
                var merged = {};
                for (var bk in keepBlood) { if (keepBlood.hasOwnProperty(bk)) merged[bk] = keepBlood[bk]; }
                merged._cat = '血统区'; merged._slot = ''; merged.quantity = 1;
                shopCart.push(merged);
                shopRefreshMarket();
                samToast('info', '血统需单独结算, 已自动清空购物车其他商品');
            }
            openBloodFusionModal(keepBlood);
            return;
        }
        // ★ 多角色商城: 货币永远从 角色.空间币 扣除; 校验角色空间币余额
        var coin = safeNum(sd.角色 && sd.角色.空间币, 0);
        if (coin < shopCartCost()) { samToast('error', '空间币不足, 无法执行交易'); return; }
        // ★ 校验当前目标角色(NPC) 是否仍在场(切换后可能离场)
        if (shopCurrentActor !== SHOP_ACTOR_REINCARNATOR) {
            var actorNpc = (sd.关系列表 && sd.关系列表[shopCurrentActor]) ? sd.关系列表[shopCurrentActor] : null;
            if (!actorNpc) { samToast('error', '目标角色已离场, 无法为其购买, 请重新选择'); return; }
        }
        // 1) 在 stat_data 副本上构建交易结果(扣币/入包/商品库一次性移除全部已购)
        var result;
        try {
            // 深拷贝 stat_data, 避免污染原对象
            var snapshot = (_ && _.cloneDeep) ? _.cloneDeep(sd) : JSON.parse(JSON.stringify(sd));
            result = shopBuildTransaction(snapshot);
        } catch(e) {
            samToast('error', '交易构建失败: '+e.message);
            return;
        }
        var $execBtn = $('.sam-shop-exec-btn');
        if ($execBtn.length) { $execBtn.prop('disabled', true).text('执行中...'); }
        // 2) ★ 同步优先直写 MVU(原子操作): 立即把交易结果写回, 商品库一次性移除全部已购物品
        //    旧流程先 /trigger 触发AI回复, AI的[mvu_update]会覆盖我们的写回(导致只删1个),
        //    改为: 先直写MVU(不可被覆盖) → 清空购物车 → 再 /send 记录文本(不触发AI)
        var writeOk = writeBackMvu(function(statData) {
            // 用构建好的交易结果整体覆盖角色字段 + 商城商品库
            var rs = result.statData;
            // ★ 写回: 角色(含空间币扣除, 角色购物时含新装备) + 商城(商品库已移除已购) + 关系列表(NPC购物时含新装备)
            if (rs.角色) statData.角色 = rs.角色;
            if (rs.商城) statData.商城 = rs.商城;
            if (rs.关系列表) statData.关系列表 = rs.关系列表;
            for (var ri = 0; ri < result.receipts.length; ri++) {
                shopAppendReceipt(statData, result.receipts[ri]);
            }
        });
        if (!writeOk) {
            samToast('error', '交易失败: MVU写回不可用');
            if ($execBtn.length) { $execBtn.prop('disabled', false).text('授权执行交易'); }
            return;
        }
        // 3) 清空购物车 + 刷新UI(立即反映商品库已移除已购)
        shopCart = [];
        // 重新读取当前角色的商品库以同步本地缓存(shopMarketData), 避免显示已售商品
        var freshSd = getStatData();
        var freshLib = shopGetActorLibRaw((freshSd && freshSd.商城) ? freshSd.商城 : null, shopCurrentActor);
        if (freshLib) {
            shopMarketData = shopNormalizeMarketData(freshLib);
            if (!shopTabHasData(shopActiveTab)) shopActiveTab = shopPickFirstAvailableTab();
        } else {
            shopMarketData = null;
        }
        samToast('success', '交易已完成');
        renderAll();
        // 4) /send 记录交易文本(仅创建用户楼层, 不带 /trigger, 不触发AI回复, 避免AI的mvu_update覆盖商品库)
        var msg = result.purchaseLog + '。';
        try {
            shopTriggerSlash('/send ' + msg).then(function() {
                if ($execBtn.length) { $execBtn.prop('disabled', false).text('授权执行交易'); }
            }).catch(function(eSend) {
                try { console.warn('[主神终端] /send 记录失败(交易已生效):', eSend.message); } catch(e2){}
                if ($execBtn.length) { $execBtn.prop('disabled', false).text('授权执行交易'); }
            });
        } catch(eSync) {
            try { console.warn('[主神终端] /send 异常(交易已生效):', eSync.message); } catch(e2){}
            if ($execBtn.length) { $execBtn.prop('disabled', false).text('授权执行交易'); }
        }
    }
    /* ===== 32d. 商城: 刷新商品(调正文AI generateRaw, 按新ZOD结构生成商品库) =====
       - 二次校验 战斗中/不在主神空间(按钮已禁用, 此处兜底)
       - 通过 generateRaw 调用正文AI, 让其按新结构(YAML式)输出4个商品列表
       - 解析返回文本 → 写入 stat_data.商城(经ZOD校验归一化) + 重置本地缓存 + renderAll
       - 刷新中用模块级 shopRefreshing 标志驱动渲染: 置 true 后 renderAll 即隐藏原列表、
         改显示"正在请求…可关闭或等待"提示且按钮/输入框置灰; 切聊天/关再开面板均不丢失
         (标志为模块级, 不随 renderAll 重建而清零)
       - AI 成功 → 清缓存重渲染 + toast"商品列表已刷新, 共N件"; 失败/解析空 → toast +
         保留 shopMarketData 使原列表恢复显示; 两路径均置 shopRefreshing=false 解除锁定 */
    // 32d-1. 定位正文AI接口 generateRaw(跨作用域: 当前/父/TavernHelper)
