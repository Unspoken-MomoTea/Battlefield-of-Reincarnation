    function bindUIEvents() {
        var $panel = $('#samsara-panel');
        $panel.off('click.samBloodFusion').on('click.samBloodFusion', '.sam-blood-fusion-open', function(e) {
            e.stopPropagation();
            if (!$(this).is('[disabled]')) openBloodFusionModal(null);
        });
        $(document).off('click.samFusionStart').on('click.samFusionStart', '.sam-fusion-start', function(e) {
            e.stopPropagation();
            if ($(this).is('[disabled]')) return; // 不足2条血统: 开始融合按钮灰度不响应
            bloodFusionStart($('.sam-fusion-select[data-fusion-role="a"]').val(), $('.sam-fusion-select[data-fusion-role="b"]').val());
        });
        $(document).off('click.samFusionDirect').on('click.samFusionDirect', '.sam-fusion-direct', function(e) {
            e.stopPropagation();
            if ($(this).is('[disabled]')) return; // 血统已满: 灰度按钮不响应
            if (bloodFusionShopItem) bloodFusionDirectPurchase(); else closeModal();
        });
        // ★ 商城血统替换流程(血统栏已满时): 打开选择弹窗 / 取消返回融合舱 / 确认执行替换
        $(document).off('click.samFusionReplaceOpen').on('click.samFusionReplaceOpen', '.sam-fusion-replace-open', function(e) {
            e.stopPropagation();
            if ($(this).is('[disabled]')) return;
            openBloodReplaceModal();
        });
        $(document).off('click.samFusionReplaceCancel').on('click.samFusionReplaceCancel', '.sam-fusion-replace-cancel', function(e) {
            e.stopPropagation();
            openBloodFusionModal(bloodFusionShopItem); // 返回融合舱
        });
        $(document).off('click.samFusionReplaceConfirm').on('click.samFusionReplaceConfirm', '.sam-fusion-replace-confirm', function(e) {
            e.stopPropagation();
            var tgt = $('#sam-replace-target').val();
            if (!tgt) { samToast('warning', '请先选择要替换的血统'); return; }
            bloodFusionReplacePurchase(tgt);
        });
        // ★ A/B 下拉框联动: 改变一方时, 另一方排除新选中值(避免A=B); 若对方当前值被排除则回退到第一个可用项
        $(document).off('change.samFusionSync').on('change.samFusionSync', '.sam-fusion-select', function(e) {
            e.stopPropagation();
            var role = $(this).attr('data-fusion-role') || 'a';
            bloodFusionSyncSelect(role);
        });
        // 关闭(编辑模式开启时, 先退出编辑模式再关闭面板)
        $panel.off('click.samClose').on('click.samClose', '.sam-icon-btn.close', function() {
            if (isEditMode()) setEditMode(false);
            if ($('#samsara-panel').hasClass('open')) toggleSamsaraPanel();
        });
        // 刷新(编辑模式开启时, 先退出编辑模式再刷新数据)
        $panel.off('click.samRefresh').on('click.samRefresh', '.sam-icon-btn.refresh', function() {
            if (isEditMode()) setEditMode(false);
            renderAll();
            try { console.log('%c[主神终端] 🔄 手动刷新', 'color:#8f9fff'); } catch(e){}
        });
        // 设置
        $panel.off('click.samSettings').on('click.samSettings', '.sam-icon-btn.settings', function() { openSettings(); });
        // Tab切换
        $panel.off('click.samTab').on('click.samTab', '.sam-tab-btn', function() {
            var tab = $(this).data('tab');
            if (tab === 'world') {
                var engine = GS_PARENT.Samsara && GS_PARENT.Samsara.worldEngine;
                if (engine && typeof engine.isConfigured === 'function' && engine.isConfigured()) {
                    engine.open();
                    return;
                }
                // 世界推进总开关关闭（或独立脚本未加载）时，恢复原来的世界面板。
                setCurrentTab('world');
                renderTabContent('world');
                $panel.find('.sam-tab-btn').removeClass('active');
                $(this).addClass('active');
                return;
            }
            setCurrentTab(tab);
            renderTabContent(tab);
            $panel.find('.sam-tab-btn').removeClass('active');
            $(this).addClass('active');
        });
        // 子Tab切换
        $panel.off('click.samSubtab').on('click.samSubtab', '.sam-subtab', function() {
            var sub = $(this).data('sub');
            $(this).siblings().removeClass('active');
            $(this).addClass('active');
            $panel.find('.sam-subpane').removeClass('active').hide();
            $panel.find('.sam-subpane[data-sub="'+sub+'"]').addClass('active').show();
            // 记住关系面板当前激活的子Tab, 避免 renderAll 后跳回"全部"
            try { relationActiveSub = sub; } catch(e) {}
        });
        // 卡片点击→详情弹窗
        $panel.off('click.samCard').on('click.samCard', '.sam-card', function(e) {
            if ($(e.target).closest('.sam-tier-infuse-btn').length) return;
            var path = $(this).data('path');
            // ★ 编辑模式: NPC 卡片仍放行(弹角色档案以编辑其数据); 其他卡片保持拦截,避免误触只读详情
            var isNpcPath = (typeof path === 'string' && path.indexOf('关系列表.') === 0);
            if (isEditMode() && !isNpcPath) return;
            var title = $(this).data('title') || '详情';
            if (path) openDetailModal(path, title);
        });
        // NPC删除按钮(编辑模式)→从MVU删除该NPC
        $panel.off('click.samNpcDel').on('click.samNpcDel', '.sam-npc-del', function(e) {
            e.stopPropagation();
            var name = $(this).data('del-npc');
            if (!name) return;
            deleteNpc(name);
        });
        // ★ NPC转移按钮(在场NPC)→打开物资转移弹窗
        $panel.off('click.samTransfer').on('click.samTransfer', '.sam-npc-transfer', function(e) {
            e.stopPropagation();
            var name = $(this).data('transfer-npc');
            if (name) openTransferModal(name);
        });
        // ★ NPC获取遗物按钮(死亡NPC)→打开获取弹窗
        $panel.off('click.samLoot').on('click.samLoot', '.sam-npc-loot', function(e) {
            e.stopPropagation();
            var name = $(this).data('loot-npc');
            if (name) openLootModal(name);
        });
        // ★ 获取弹窗内交互(委托到document)
        $(document).off('click.samLootItem').on('click.samLootItem', '.sam-loot-item', function(e) {
            if ($(e.target).closest('.sam-trf-qty').length) return;
            lootToggle($(this).data('loot-cat'), $(this).data('loot-key'));
        });
        $(document).off('click.samLootQty').on('click.samLootQty', '.sam-loot-qty-btn', function(e) {
            e.stopPropagation();
            lootAdjustQty($(this).data('cat'), $(this).data('key'), $(this).data('trf-qty'));
        });
        $(document).off('change.samLootInp').on('change.samLootInp', '.sam-loot-qty-inp', function(e) {
            e.stopPropagation();
            lootInputQty($(this).data('cat'), $(this).data('key'), this.value);
        });
        $(document).off('click.samLootConfirm').on('click.samLootConfirm', '.sam-loot-btn.confirm', function(e) {
            executeLoot();
        });
        $(document).off('click.samLootCancel').on('click.samLootCancel', '.sam-loot-btn.cancel', function(e) {
            closeModal();
        });
        // ★ 转移弹窗内交互(委托到document, 因modal容器首次showModal时才创建)
        $(document).off('click.samTrfItem').on('click.samTrfItem', '.sam-trf-item', function(e) {
            if ($(e.target).closest('.sam-trf-qty').length) return; // 数量控件区不触发toggle
            transferToggle($(this).data('trf-cat'), $(this).data('trf-key'));
        });
        $(document).off('click.samTrfQty').on('click.samTrfQty', '.sam-trf-qty-btn', function(e) {
            e.stopPropagation();
            transferAdjustQty($(this).data('cat'), $(this).data('key'), $(this).data('trf-qty'));
        });
        $(document).off('change.samTrfInp').on('change.samTrfInp', '.sam-trf-qty-inp', function(e) {
            e.stopPropagation();
            transferInputQty($(this).data('cat'), $(this).data('key'), this.value);
        });
        $(document).off('click.samTrfConfirm').on('click.samTrfConfirm', '.sam-trf-btn.confirm', function(e) {
            executeTransfer();
        });
        $(document).off('click.samTrfCancel').on('click.samTrfCancel', '.sam-trf-btn.cancel', function(e) {
            closeModal();
        });
        // ★ 世界条目删除按钮(编辑模式, 探索点/势力)→从MVU删除该条目
        $panel.off('click.samWorldDel').on('click.samWorldDel', '.sam-rumor-del-btn[data-world-del]', function(e) {
            e.stopPropagation();
            var path = $(this).attr('data-del-path') || '';
            if (!path) return;
            // 解析出父路径和末段key(用于确认文案)
            var parts = path.split('.');
            var key = parts.pop();
            var parentPath = parts.join('.');
            var label = key;
            samConfirm('删除条目', '确定删除「'+label+'」吗？此操作不可撤销。', function() {
                deleteWorldEntry(path, parentPath, key);
            });
        });
        // ★ 资产删除按钮(编辑模式)→从MVU删除该资产(复用通用按点路径删除)
        $panel.off('click.samAssetDel').on('click.samAssetDel', '.sam-fc-del-btn[data-asset-del]', function(e) {
            e.stopPropagation();
            var path = $(this).attr('data-asset-del') || '';
            if (!path) return;
            var parts = path.split('.');
            var key = parts.pop();
            var parentPath = parts.join('.');
            samConfirm('删除资产', '确定删除资产「'+key+'」吗？此操作不可撤销。', function() {
                deleteWorldEntry(path, parentPath, key);
            });
        });
        // ★ 建设序列删除按钮(编辑模式)→从MVU删除该建设序列
        $panel.off('click.samAssetSeqDel').on('click.samAssetSeqDel', '.sam-fc-del-btn[data-asset-seq-del]', function(e) {
            e.stopPropagation();
            var path = $(this).attr('data-asset-seq-del') || '';
            if (!path) return;
            var parts = path.split('.');
            var key = parts.pop();
            var parentPath = parts.join('.');
            samConfirm('删除建设序列', '确定删除建设序列「'+key+'」吗？此操作不可撤销。', function() {
                deleteWorldEntry(path, parentPath, key);
            });
        });
        // ★ R21-传闻交易: 可交易按钮 → 发送文字到输入框(找{卖家}购买情报「{名}」)
        $panel.off('click.samRumorTrade').on('click.samRumorTrade', '.sam-rumor-trade-btn', function(e) {
            e.stopPropagation();
            var name = $(this).attr('data-rumor-name') || '';
            var seller = $(this).attr('data-rumor-seller') || '不明';
            if (!name) return;
            var text = '找'+seller+'购买情报「'+name+'」';
            var ok = sendToInputBox(text, false);
            if (ok) samToast('success', '已发送到输入框: '+text);
            else samToast('warning', '未找到输入框, 已复制到剪贴板');
        });
        // ★ 经营面板: 待办事件整条可点击 → 将该条文本填入输入框
        $panel.off('click.samAssetTodo').on('click.samAssetTodo', '.sam-asset-todo-item.clickable', function(e) {
            e.stopPropagation();
            var text = $(this).attr('data-asset-todo') || '';
            if (!text) return;
            var ok = sendToInputBox(text, false);
            if (ok) samToast('success', '已填入输入框');
            else samToast('warning', '未找到输入框');
        });
        // ★ R21-传闻交易: 单条删除按钮 → 写回MVU删除该条传闻(需确认)
        $panel.off('click.samRumorDel').on('click.samRumorDel', '.sam-rumor-del-btn[data-rumor-del]', function(e) {
            e.stopPropagation();
            var section = $(this).attr('data-rumor-section') || '';
            var name = $(this).attr('data-rumor-name') || '';
            if (!section || !name) return;
            samConfirm('删除传闻', '确定删除「'+name+'」这条'+section+'吗？此操作不可撤销。', function() {
                handleRumorDelete(section, name);
            });
        });
        // ★ R21-传闻交易: 分类一键清除 → 清空该分类(街头巷议/情报交易/布告与檄文), 需确认
        $panel.off('click.samRumorClearSec').on('click.samRumorClearSec', '.sam-rumor-clear-btn', function(e) {
            e.stopPropagation();
            e.preventDefault(); // 阻止 summary 展开/收起
            var section = $(this).attr('data-rumor-clear-section') || '';
            if (!section) return;
            samConfirm('清空分类', '确定一键清除「'+section+'」中的全部传闻吗？此操作不可撤销。', function() {
                handleRumorClearSection(section);
            });
        });
        // ★ R21-传闻交易: 顶部一键删除全部传闻 → 清空 传闻.街头巷议/情报交易/布告与檄文, 需确认
        $panel.off('click.samRumorClearAll').on('click.samRumorClearAll', '.sam-rumor-clearall-btn', function(e) {
            e.stopPropagation();
            samConfirm('删除全部传闻', '确定删除全部传闻(街头巷议/情报交易/布告与檄文)吗？此操作不可撤销。', function() {
                handleRumorClearAll();
            });
        });
        // 装备/道具操作按钮(穿戴/脱下/存放/取回/删除)→写回MVU+刷新
        $panel.off('click.samAct').on('click.samAct', '.sam-act-btn', function(e) {
            e.stopPropagation();
            var $b = $(this);
            var action = $b.attr('data-act');
            // 形态激活/取消激活按钮(单独分发, 不走装备/道具 handler)
            if (action === 'activate' || action === 'deactivate') {
                var formName = $b.attr('data-form');
                if (formName) {
                    if (action === 'activate') handleFormActivate(formName);
                    else handleFormDeactivate(formName);
                }
                return;
            }
            var path = $b.attr('data-path');
            var kind = $b.attr('data-kind');
            var type = $b.attr('data-type');
            var key = $b.attr('data-key');
            // 删除操作先弹二级确认框, 确认后再执行
            if (action === 'delete') {
                var label = key || (path ? path.split('.').pop() : '');
                var cat = (kind === 'equip') ? '装备' : '道具';
                samConfirm('删除'+cat, '确定删除'+cat+'「'+label+'」吗？此操作不可撤销。', function() {
                    handleItemAction(action, path, kind, type, key);
                });
                return;
            }
            handleItemAction(action, path, kind, type, key);
        });
        // 状态按钮点击→二级详情弹窗(复用主面板卡片渲染风格)
        // ★ 编辑模式: 状态详情也走递归编辑渲染(renderDetailNode 编辑态), 底部追加保存按钮
        $panel.off('click.samBuff').on('click.samBuff', '.sam-buff-chip', function() {
            var name = $(this).data('name');
            var path = $(this).data('path');
            var sd = getStatData();
            if (!sd || !path) return;
            var obj = resolvePath(sd, path);
            if (!obj) return;
            var ed = isEditMode();
            var html = renderDetailNode(obj, ['真属性'], ['状态', name], ed, ed ? path : '');
            if (!ed) {
                // 只读态兜底: 空对象(如仅有真属性被屏蔽)给出占位
                if (!html || !html.trim()) html = '<div class="sam-empty">无可见内容</div>';
                showModal(name + ' · 状态详情', '<div class="sam-detail">'+html+'</div>');
                return;
            }
            var foot = '<div class="sam-nd-edit-tip">✎ 编辑模式 · 点击数值就地修改, 失焦自动暂存</div><button type="button" class="sam-save-btn sam-nd-save">💾 保存</button>';
            showModal(name + ' · 状态详情 · 编辑', '<div class="sam-detail">'+html+'</div>'+foot);
            bindEditorEvents($('#samsara-modal')); // modal 独立DOM, 需单独委托编辑事件
        });
        // ★ 职业结构化编辑器事件已迁移至 bindEditorEvents($root)(panel/modal 共用)
        // ★ 源力灌注：角色/队友共用同一执行器；只允许当前层级→下一层级。
        $panel.off('click.samSourceInfusion').on('click.samSourceInfusion', '.sam-tier-infuse-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openSourceInfusion($(this).attr('data-tier-target') || '角色');
        });
        // ★ 进阶按钮(层级进度条中部): 属性总点达下层级下限才显示; 战斗中拦截
        //   - 申请进阶(进阶试炼未完成): 发送"【当前进阶条件已满足，申请进阶试炼】"到输入框
        //   - 开始进阶(试炼已完成): writeBackMvu(角色.层级=nextTier) + renderAll() 刷新进度条/顶部层级
        $panel.off('click.samTierAdv').on('click.samTierAdv', '.sam-tier-adv-btn', function(e) {
            e.stopPropagation();
            var $b = $(this);
            var act = $b.attr('data-tier-act') || '';
            var nextTier = $b.attr('data-tier-next') || '';
            var sd = getStatData();
            if (!sd || !sd.角色) { samToast('error', '数据未就绪'); return; }
            var sys = sd.系统状态 || {};
            // 战斗中拦截: 任何进阶操作均不可在战斗中执行
            if (sys.是否战斗中 === true) {
                samToast('warning', '请在安全区域内再重新尝试');
                return;
            }
            if (act === 'apply') {
                if (sys.是否可试炼 !== true || sys.试炼已完成 === true) { samToast('warning', '晋升条件已变化，请刷新后重试'); renderAll(); return; }
                // 申请进阶: 写入一句话到输入框(同情报交易可购买按钮, 不自动发送)
                var text = '当前进阶条件已满足，申请【晋升试炼任务】';
                var ok = sendToInputBox(text, false);
                if (ok) samToast('success', '已发送到输入框: '+text);
                else samToast('warning', '未找到输入框, 已复制到剪贴板');
            } else if (act === 'start') {
                // 开始进阶: 直接提升角色层级到下一级(F→E→...→SSS), 进阶试炼完成后执行
                var advance = validateTrialAdvancement(sd, nextTier);
                if (advance.error) { samToast('warning', advance.error); renderAll(); return; }
                nextTier = advance.nextTier;
                // ★ 传入层级通行证: replaceMvuData 异步触发的二次 VARIABLE_UPDATE_ENDED
                //   不在 __samsaraUIMutation 窗口期内, 需凭通行证放行层级变化(否则被守卫回滚)
                var ok2 = writeBackMvu(function(statData) {
                    var latestAdvance = validateTrialAdvancement(statData, nextTier);
                    if (latestAdvance.error) throw new Error(latestAdvance.error);
                    if (statData.角色) {
                        var oldTier = normalizeLifeTier(statData.角色.层级);
                        statData.角色.层级 = nextTier;
                        shopAppendReceipt(statData, '[普升][角色] 晋升试炼完成：'+oldTier+' → '+nextTier);
                    }
                    // 进阶完成后重置试炼标记, 为下一轮进阶流程做准备
                    if (statData.系统状态) statData.系统状态.试炼已完成 = false;
                }, { tierPermit: nextTier });
                if (ok2) {
                    samToast('success', '层级已提升至 '+nextTier+' 级');
                    renderAll(); // 刷新进度条与顶部层级显示, 按钮随之隐藏(达新层级未满足下一级条件)
                } else {
                    samToast('error', '进阶失败: MVU写回不可用');
                }
            }
        });
        // ★ 结算任务按钮: 顶栏入口；副本内非战斗时常驻显示，点击发送【结算任务】到输入框
        $panel.off('click.samMissionSettle').on('click.samMissionSettle', '[data-mission-settle]', function(e) {
            e.stopPropagation();
            var text = '【结算任务】';
            var ok = sendToInputBox(text, false);
            if (ok) samToast('success', '已发送到输入框: '+text);
            else samToast('warning', '未找到输入框, 已复制到剪贴板');
        });
        // ★ 血统/形态/技能卡片删除按钮(编辑模式显示): 二级确认 → 写回MVU删除
        $panel.off('click.samFcDel').on('click.samFcDel', '.sam-fc-del-btn[data-del-path]', function(e) {
            e.stopPropagation();
            var path = $(this).attr('data-del-path') || '';
            if (!path) return;
            // 提取末段名用于提示
            var seg = path.split('.');
            var name = seg[seg.length - 1] || path;
            samConfirm('确认删除', '确定要删除「'+name+'」吗? 此操作将写入变量并刷新面板。', function() {
                var ok = writeBackMvu(function(statData) {
                    if (!statData) return;
                    var cur = statData, i;
                    for (i = 0; i < seg.length - 1; i++) {
                        if (!cur[seg[i]] || typeof cur[seg[i]] !== 'object') return;
                        cur = cur[seg[i]];
                    }
                    if (cur[seg[seg.length - 1]] !== undefined) delete cur[seg[seg.length - 1]];
                    // ★ 删除形态库中的形态时, 若该形态正被角色"当前形态"激活/引用,
                    //   须同步重置 当前形态(激活:false, 名称清空), 否则残留指向已删除形态,
                    //   会导致后续血统购买/AI 拼附形构筑时持续误读为"已存在的形态", 拒绝或报错
                    if (seg.length === 3 && seg[0] === '角色' && seg[1] === '形态库'
                        && statData.角色 && statData.角色.当前形态) {
                        var cf = statData.角色.当前形态;
                        if (cf && cf.名称 === name) {
                            cf.激活 = false; cf.名称 = '';
                        }
                    }
                });
                if (ok) {
                    samToast('success', '已删除: '+name);
                    renderAll();
                } else {
                    samToast('error', '删除失败: MVU写回不可用');
                }
            });
        });
        // ★ 选择世界按钮(顶栏, 仅在主神空间且非战斗时渲染): 点击发送【选择世界】到输入框
        $panel.off('click.samChooseWorld').on('click.samChooseWorld', '[data-choose-world]', function(e) {
            e.stopPropagation();
            var text = '【选择世界】';
            var ok = sendToInputBox(text, false);
            if (ok) samToast('success', '已发送到输入框: '+text);
            else samToast('warning', '未找到输入框, 已复制到剪贴板');
        });
        // ★ 商城刷新商品按钮: 调正文AI generateRaw 按新ZOD结构生成商品库, 写回 stat_data.商城
        $panel.off('click.samShopRefresh').on('click.samShopRefresh', '.sam-shop-refresh-btn', async function(e) {
            e.stopPropagation();
            var $btn = $(this);
            if ($btn.is('[disabled]')) return;
            var $req = $panel.find('.sam-shop-req').first();
            var req = $req.length ? String($req.val() || '').trim() : '';
            // 保存需求输入到模块级(刷新后 renderAll 重建DOM仍能回填, 不清除: 不满意可继续刷)
            shopReqText = req;
            
            var content = ''
                + '属性系统 (底层定义):\n'
                + '  基础五维 (判定依据):\n'
                + '    力量: 近战/负重/破坏\n'
                + '    敏捷: 平衡/潜行/瞄准\n'
                + '    体质: 生命/耐性/恢复\n'
                + '    精神: 施法/察觉/意志\n'
                + '    魅力: 社交/欺骗/威吓\n'
                + '  资源属性:\n'
                + '    HP: 生命值，HP≤0即判定死亡\n'
                + '    HP_MAX: 生命值上限\n'
                + '    THP: 临时生命值/护盾，受到伤害时优先扣减，不叠加，脱战归零\n'
                + '    EP: 能量值，用于技能消耗\n'
                + '    EP_MAX: 能量值上限\n'
                + '  衍生属性:\n'
                + '    ATK: 物理攻击\n'
                + '    DEF: 物理防御\n'
                + '    MATK: 法术攻击\n'
                + '    MDEF: 法术防御\n'
                + '    AP: 法术强度乘区\n'
                + '  行动属性 (全局禁止添加):\n'
                + '    先攻DC: 行动顺序\n'
                + '    防御DC: 被命中难度\n';
            // 获取世界书内容的调用
            content += await getWorldBookContent('⚙️生命层级与社会生态'); 
            content += await getWorldBookContent('⚙️品质效果数值规则'); 
            content += await getWorldBookContent('⚙️实体生成规则'); 
            content += await getWorldBookContent('⚙️状态协议'); 
            content += await getWorldBookContent('⚙️行为判定[mvu_plot]'); 
            
            if (content) {
                // 在这里可以把拿到的世界书内容传进去
                handleShopRefresh(req, content); 
            }
        });
        // ★ 需求输入框: 输入时实时同步到模块级 shopReqText, 切Tab/其他 renderAll 重建DOM仍能回填(不丢内容)
        $panel.off('input.samShopReq').on('input.samShopReq', '.sam-shop-req', function() {
            shopReqText = String($(this).val() || '');
        });
        // ★ "停止"按钮(商城停止刷新 / 血统融合停止): 通过 data-sam-act 分发, dub 打断卡死的AI请求并推进对应 epoch 让旧 Promise 回调丢弃结果
        $panel.off('click.samShopStop').on('click.samShopStop', '.sam-shop-stop-btn', function(e) {
            e.stopPropagation();
            var act = String($(this).attr('data-sam-act') || '');
            if (act === 'blood-fusion-stop') bloodFusionStop();
            else shopStopRefresh();
        });
        // 待播报记录: 用户手动清空(模型正常叙事后也会通过JSONPatch自动清空)
        $panel.off('click.samReceiptClear').on('click.samReceiptClear', '[data-receipt-clear]', function(e) {
            e.stopPropagation();
            shopClearReceipt();
        });
        // ★ 商城市场区: 区域Tab切换(装备|道具|技能|血统)
        $panel.off('click.samShopTab').on('click.samShopTab', '.sam-shop-tab', function(e) {
            e.stopPropagation();
            var tab = $(this).attr('data-shop-tab');
            if (!tab || tab === shopActiveTab) return;
            shopActiveTab = tab;
            shopActiveSlot = ''; // 切区时重置槽位
            shopRefreshMarket();
        });
        // ★ 持有面板: 子Tab切换(战术栏|装备背包|道具背包|仓库)
        $panel.off('click.samHoldTab').on('click.samHoldTab', '.sam-hold-tab', function(e) {
            e.stopPropagation();
            var tab = $(this).attr('data-hold-tab');
            if (!tab || tab === holdActiveTab) return;
            holdActiveTab = tab;
            holdTypeFilter = ''; // 切换子Tab时重置类型筛选(每个Tab的分类体系不同)
            // 仅切换Tab条active态 + 局部替换内容区(不重建Tab条, 消除整排抖动/错位)
            $panel.find('.sam-hold-tab').removeClass('active');
            $(this).addClass('active');
            var sdHold = getStatData();
            if (sdHold) {
                // 分类行随内容一起重建(不同Tab类型集合不同; 外层容器常驻, 空Tab时清空内容)
                $('#sam-hold-types-wrap').html(renderHoldTypeRow(sdHold));
                $('#sam-hold-body').html(renderHoldBody(sdHold));
            }
        });
        // ★ 持有面板: 专属分类行筛选(全部/各类型) —— 点击后仅刷新 active 态 + 内容区, 不重建Tab条与分类行结构
        //   分类很多时行内横向滚动; 点击视口边缘外的胶囊时把它平滑滚入可见区域(inline:center)
        $panel.off('click.samHoldType').on('click.samHoldType', '.sam-hold-type', function(e) {
            e.stopPropagation();
            var t = String($(this).attr('data-hold-type') || '');
            if (t !== holdTypeFilter) {
                holdTypeFilter = t;
                $panel.find('.sam-hold-type').removeClass('active');
                $(this).addClass('active');
                var sdType = getStatData();
                if (sdType) $('#sam-hold-body').html(renderHoldBody(sdType));
            }
            try { this.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' }); } catch(err) { try { this.scrollIntoView(false); } catch(e2){} }
        });
        // ★ 商城市场区: 装备区 左nav槽位切换
        $panel.off('click.samShopSlot').on('click.samShopSlot', '.sam-shop-nav-btn', function(e) {
            e.stopPropagation();
            var slot = $(this).attr('data-shop-slot');
            if (!slot || slot === shopActiveSlot) return;
            shopActiveSlot = slot;
            shopRefreshMarket();
        });
        // ★ 商城市场区: 商品卡片点击(选中/取消); 道具区不响应卡片整体点击(由数量控件决定)
        $panel.off('click.samShopItem').on('click.samShopItem', '.sam-shop-item', function(e) {
            // 若点击源自数量控件(按钮/输入框), 则放行由 qty 委托处理
            var $tgt = $(e.target);
            if ($tgt.closest('.sam-shop-qty').length) return;
            // 技能折叠块(<details>/<summary>)的点击不触发卡片选中/加数量, 否则与商品选中冲突
            if ($tgt.closest('.sam-shop-sk-list').length) return;
            e.stopPropagation();
            var $card = $(this);
            // 禁用态拦截: 按禁用原因给出对应提示
            if ($card.hasClass('disabled')) {
                var reason = $card.attr('data-dis-reason');
                if (reason === 'fusionbusy') { samToast('warning', '血统融合进行中, 请等待融合完成后再购买血统'); return; }
                if (reason === 'permission') { samToast('warning', '权限不足, 当前层级/权限凭证无法购买该档位商品'); return; }
                samToast('warning', '空间币不足, 无法购买'); return;
            }
            var name = $card.attr('data-name');
            var cat  = $card.attr('data-cat');
            var slot = $card.attr('data-slot') || '';
            if (!name || !cat) return;
            // 道具区: 点击卡片=+1数量(便捷操作); 加1前预检余额
            if (cat === '道具区') {
                var cur = 0, unitPrice = 0;
                for (var i = 0; i < shopCart.length; i++) {
                    if (shopCart[i].name === name && shopCart[i]._cat === cat) { cur = shopCart[i].quantity || 0; unitPrice = Number(shopCart[i].price || 0); break; }
                }
                if (!unitPrice) {
                    var fnd = shopFindItems(cat, slot, name);
                    if (fnd.length) unitPrice = Number(fnd[0].price || 0);
                }
                var coinNow = (function(){ var sd = getStatData(); return sd && sd.角色 ? safeNum(sd.角色.空间币, 0) : 0; })();
                // 剩余余额 = 原始余额 - 已选合计(含本商品已选数量)
                var remainNow = shopRemain(coinNow) + (cur * unitPrice); // 移除本商品已占额度后才是真正可加的剩余
                if (remainNow < unitPrice * (cur + 1)) { samToast('warning', '空间币不足, 无法再加1(剩余 '+remainNow.toLocaleString()+')'); return; }
                shopSetQty(name, cat, cur + 1);
                return;
            }
            var items = shopFindItems(cat, slot, name);
            if (items.length) shopToggleSelect(items[0], cat, slot);
        });
        // ★ 商城市场区: 道具数量控件(+/− 按钮 + 输入框); 加数量时预检余额
        $panel.off('click.samShopQty').on('click.samShopQty', '.sam-shop-qty-btn', function(e) {
            e.stopPropagation();
            var $btn = $(this);
            var name = $btn.attr('data-name');
            var isPlus = ($btn.attr('data-shop-qty-btn') === 'plus');
            var $inp = $btn.siblings('.sam-shop-qty-inp').first();
            var cur = $inp.length ? (parseInt($inp.val(), 10) || 0) : 0;
            var nxt = Math.max(0, cur + (isPlus ? 1 : -1));
            if (isPlus && nxt > cur) {
                // 查单价并预检余额
                var up = 0;
                for (var k = 0; k < shopCart.length; k++) { if (shopCart[k].name === name && shopCart[k]._cat === '道具区') { up = Number(shopCart[k].price || 0); break; } }
                if (!up) { var f = shopFindItems('道具区', '', name); if (f.length) up = Number(f[0].price || 0); }
                var cn = (function(){ var sd = getStatData(); return sd && sd.角色 ? safeNum(sd.角色.空间币, 0) : 0; })();
                // 剩余余额 = 原始余额 - 已选合计; 但本商品已选数量应排除(因为是把它从 cur 改到 nxt)
                var curQty = shopGetQty(name, '道具区') || 0;
                var remainB = shopRemain(cn) + (curQty * up);
                if (remainB < up * nxt) { samToast('warning', '空间币不足, 无法加到 '+nxt+' 件(剩余 '+remainB.toLocaleString()+')'); return; }
            }
            if ($inp.length) $inp.val(nxt);
            shopSetQty(name, '道具区', nxt);
        });
        $panel.off('input.samShopQty change.samShopQty', '.sam-shop-qty-inp').on('input.samShopQty change.samShopQty', '.sam-shop-qty-inp', function(e) {
            e.stopPropagation();
            var $inp = $(this);
            var name = $inp.attr('data-name');
            var qty = parseInt($inp.val(), 10) || 0;
            if (qty < 0) qty = 0;
            // 余额预检: 直接输入大数字也需拦截(防止绕过 +/- 按钮的预检)
            if (qty > 0) {
                var upInp = 0;
                for (var k2 = 0; k2 < shopCart.length; k2++) { if (shopCart[k2].name === name && shopCart[k2]._cat === '道具区') { upInp = Number(shopCart[k2].price || 0); break; } }
                if (!upInp) { var fInp = shopFindItems('道具区', '', name); if (fInp.length) upInp = Number(fInp[0].price || 0); }
                var cnInp = (function(){ var sd = getStatData(); return sd && sd.角色 ? safeNum(sd.角色.空间币, 0) : 0; })();
                var curQtyInp = shopGetQty(name, '道具区') || 0;
                var remainInp = shopRemain(cnInp) + (curQtyInp * upInp);
                if (remainInp < upInp * qty) {
                    // 计算可承受最大数量, 回填并提示
                    var maxQty = upInp > 0 ? Math.floor(remainInp / upInp) : qty;
                    if (maxQty < 0) maxQty = 0;
                    samToast('warning', '空间币不足, 最多可购 '+maxQty+' 件(剩余 '+remainInp.toLocaleString()+')');
                    qty = maxQty;
                    $inp.val(qty);
                }
            }
            shopSetQty(name, '道具区', qty);
        });
        // ★ 商城市场区: 执行交易按钮
        $panel.off('click.samShopExec').on('click.samShopExec', '.sam-shop-exec-btn', function(e) {
            e.stopPropagation();
            var $btn = $(this);
            if ($btn.is('[disabled]')) return;
            shopHandleExec();
        });
        // ★ 商城: 切换购买目标角色下拉框
        //   切换时: 校验入参合法性; 若刷新进行中则忽略(下拉框已置灰, 双保险);
        //   持久化保存当前角色购物状态不需要额外操作(库存已持久化到 MVU 成员商库);
        //   切换后清空购物车(避免为上一角色购买的商品误派发到新角色) + 重置激活区域 + 重渲染
        $panel.off('change.samShopActor').on('change.samShopActor', '.sam-shop-actor-select', function(e) {
            e.stopPropagation();
            var $sel = $(this);
            if ($sel.is('[disabled]')) return;
            var newActor = String($(this).val() || '').trim();
            if (!newActor || newActor === shopCurrentActor) return;
            var sdActor = getStatData();
            if (sdActor) {
                var opts = shopBuildActorOptions(sdActor);
                var okOpt = false;
                for (var oi = 0; oi < opts.length; oi++) { if (opts[oi].name === newActor) { okOpt = true; break; } }
                if (!okOpt) { samToast('warning', '该角色不可选(可能已离场或非队友)'); return; }
            }
            shopCurrentActor = newActor;
            // 清空购物车(每角色库存独立, 切换角色时上一角色的待买清单不保留)
            shopCart = [];
            shopActiveTab = '';
            shopActiveSlot = '';
            renderAll();
        });
        // ★ 编辑器事件(点击即编辑/失焦暂存/字段开关): 提取为独立函数, panel 与 modal(独立DOM)共用
        bindEditorEvents($panel);
        // 保存按钮
        $(document).off('click.samSave').on('click.samSave', '.sam-save-btn', saveEdits);
        // <details> 折叠记忆: 监听 summary 点击(用户主动切换), 记录open状态供下次渲染还原
        // 注: 用 click 而非原生 toggle 事件, 因 jQuery 对 toggle 的委托在部分版本有兼容问题;
        // key 取 summary 文本并剥离尾部 "(N)" 数量括号, 保证跨数据增减稳定匹配
        $panel.off('click.samDetails').on('click.samDetails', 'details > summary', function(e) {
            // 仅处理本面板内栏目标题点击(冒泡到的 summary)
            var $d = $(this).closest('details');
            if (!$d.length) return;
            // 异步读取: click 先触发默认toggle切换, 之后再读 open 属性
            var $sum = $(this);
            setTimeout(function() {
                var raw = $sum.text().trim();
                var key = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
                if (key) detailsOpenState[key] = $d.prop('open');
            }, 0);
        });
    }
    /* 编辑器事件绑定: $root 可为 #samsara-panel 或 #samsara-modal (两者为兄弟节点, 需分别委托) */
    function bindEditorEvents($root) {
        if (!$root || !$root.length) return;
        // 编辑器input变更(实时暂存, 不立即写回)
        $root.off('input.samEdit change.samEdit', '.sam-edit-input').on('input.samEdit change.samEdit', '.sam-edit-input', function() {
            $(this).addClass('sam-dirty');
        });
        // 点击即编辑: 点击显示态(.sam-ed-wrap)→插入真实输入框→聚焦
        $root.off('click.samEd', '.sam-ed-wrap').on('click.samEd', '.sam-ed-wrap', function(e) {
            e.stopPropagation();
            var $w = $(this);
            if ($w.hasClass('editing')) return;
            $w.addClass('editing');
            var path = $w.attr('data-path');
            var type = $w.attr('data-type') || 'text';
            var optsStr = $w.attr('data-opts') || '';
            var cur = $w.find('.sam-ed-val').first().text();
            var real;
            if (type === 'select') {
                real = editRealSelectHtml(path, strToOpts(optsStr), cur);
            } else {
                real = editRealInputHtml(path, cur, type);
            }
            $w.html(real);
            var $inp = $w.find('.sam-edit-active').first();
            if ($inp.is('input,textarea')) { $inp.trigger('focus'); if ($inp[0].select) $inp[0].select(); }
        });
        // 失焦/回车: 暂存到pendingEdits并还原显示态
        $root.off('blur.samEd keydown.samEd', '.sam-edit-active').on('blur.samEd', '.sam-edit-active', function() {
            flushStagedDisplay($(this));
        });
        $root.on('keydown.samEd', '.sam-edit-active', function(e) {
            if (e.which === 13 && $(this).is('input')) { e.preventDefault(); this.blur(); }
            else if (e.which === 27) { e.preventDefault(); this.blur(); }
        });
        // 字段级开关(编辑模式内)
        $root.off('click.samFieldToggle').on('click.samFieldToggle', '.sam-toggle-switch[data-toggle="field"]', function(e) {
            e.stopPropagation();
            $(this).toggleClass('on');
            var path = $(this).data('path');
            if (path) stageEdit(path, $(this).hasClass('on'), 'toggle');
        });
        // ★ 职业结构化编辑器: 输入失焦/变更→重组暂存; 删除→移除卡片重组; 添加→追加空卡片重组
        //   (modal 内编辑职业时同样生效, occEditAdd 已按 data-occ-path 全局 filter 查找容器)
        $root.off('blur.occEd change.occEd', '.sam-occ-field').on('blur.occEd change.occEd', '.sam-occ-field', function() {
            occReassemble($(this).closest('.sam-occ-edit'));
        });
        $root.off('click.occDel').on('click.occDel', '.sam-occ-del-btn', function(e) {
            e.stopPropagation();
            occEditDelete($(this).closest('.sam-occ-edit-card'));
        });
        $root.off('click.occAdd').on('click.occAdd', '.sam-occ-add-btn', function(e) {
            e.stopPropagation();
            occEditAdd($(this));
        });
    }
    /* ===== 14b. 立绘相关事件绑定(头像点击放大/上传 + 查看器关闭) ===== */
    function bindPortraitEvents() {
        // 角色头像点击: 不管有无立绘, 直接弹自定义立绘框(不再放大/不再有✎角标)
        $(document).off('click.samPortrait', '.sam-avatar').on('click.samPortrait', '.sam-avatar', function(e) {
            e.stopPropagation();
            openReincarnatorPortraitUp();
        });
        // NPC头像点击: 不管有无立绘, 直接弹自定义立绘框(阻止冒泡到卡片详情)
        $(document).off('click.samNpcAvatar', '.sam-npc-avatar').on('click.samNpcAvatar', '.sam-npc-avatar', function(e) {
            e.stopPropagation();
            openPortraitUpload($(this).data('name') || '');
        });
        // NPC无立绘时的"立绘"小按钮→上传(阻止冒泡)
        $(document).off('click.samNpcPortraitBtn', '.sam-npc-portrait-btn').on('click.samNpcPortraitBtn', '.sam-npc-portrait-btn', function(e) {
            e.stopPropagation();
            openPortraitUpload($(this).data('name') || '');
        });
        // 立绘查看器点击关闭
        $(document).off('click.samPvClose', '#samsara-portrait-viewer').on('click.samPvClose', '#samsara-portrait-viewer', function() {
            $(this).removeClass('show');
        });
    }

    