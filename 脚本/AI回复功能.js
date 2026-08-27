/* ============================================================================
 *  AI 回复并赋值功能  ——  提取自《镇魔司登记.html》
 * ============================================================================
 *  功能说明：
 *    本文件负责调用酒馆（SillyTavern）正文 AI 接口 generateRaw，依据用户
 *    已填写的档案信息，自动补全所有留空字段，并将 AI 返回的纯文本表单
 *    解析后逐一赋值回页面中对应的输入控件。
 *
 *  AI 激活入口：aiFill()
 *    由页面按钮 #btn-ai-fill 点击触发。
 *
 *  调用链路：
 *    aiFill()   —— 主入口：拼装提示词、调用 AI、回调回填
 *      ├ collect()            收集当前表单已有信息
 *      ├ getAI()              定位正文 AI 接口 generateRaw
 *      ├ callAI(sys,user)     统一封装的 AI 调用（Promise）
 *      └ fillFromAI(text)     解析 AI 返回文本并回填各字段
 *          └ setSelectOrCustom()  下拉框 / 自定义输入回填辅助
 *
 *  依赖说明（以下由宿主 HTML 提供，本文件不重复定义）：
 *    $            —— document.getElementById 的简写
 *    toast(msg)   —— 轻提示函数
 *    addAbility(d)—— 新增一门「看家本领」卡片
 *    abCount      —— 本领卡片计数器（外部变量）
 *    页面控件 ID：
 *      f-name / f-age / f-gender-x / f-look / f-role / f-role-x
 *      f-rank / f-rank-x / f-back / ablist / btn-ai-fill
 *      以及 name="gender" 单选组
 * ========================================================================== */


/* --------------------------------------------------------------------------
 * collect() —— 收集当前档案表单的全部数据
 *
 * 遍历姓名、年龄、性别、外貌、身份、实力、本领、背景等字段，返回一个
 * 结构化对象。该对象既用于拼装「已有信息」提示词，也用于后续提交档案。
 *
 * 注意：身份(f-role)、实力(f-rank) 为「预设下拉 + 自定义手填」组合控件，
 *       当下拉值为 '__custom' 时取对应手填输入框的值；性别同理。
 * ------------------------------------------------------------------------ */
function collect() {
    var roleSel = $('f-role'),
        rankSel = $('f-rank');

    // —— 性别：单选组 + 自定义输入框 ——
    var gChecked = document.querySelector('input[name="gender"]:checked');
    var gender = '';
    if (gChecked) {
        gender = (gChecked.value === '__custom') ? $('f-gender-x').value.trim() : gChecked.value;
    }

    // —— 看家本领：遍历所有本领卡片，提取名称/类别/描述 ——
    var abilities = [];
    var cards = document.querySelectorAll('#ablist .abcard');
    for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        var a = {
            name: c.querySelector('[data-ab=name]').value.trim(),
            // 类别若为自定义则取手填值，否则取下拉值
            category: (function () {
                var s = c.querySelector('[data-ab=category]').value;
                if (s === '__custom') {
                    var x = c.querySelector('[data-ab=category-x]');
                    return (x && x.value.trim()) || '其他';
                }
                return s;
            })(),
            desc: c.querySelector('[data-ab=desc]').value.trim()
        };
        // 三项任一非空才纳入
        if (a.name || a.category || a.desc) abilities.push(a);
    }

    // 返回完整的档案对象
    return {
        name:      $('f-name').value.trim(),
        age:       $('f-age').value.trim(),
        gender:    gender,
        role:      roleSel.value === '__custom' ? $('f-role-x').value.trim() : roleSel.value,
        rank:      rankSel.value === '__custom' ? $('f-rank-x').value.trim() : rankSel.value,
        abilities: abilities,
        look:      $('f-look').value.trim(),
        backstory: $('f-back').value.trim()
    };
}


/* --------------------------------------------------------------------------
 * getAI() —— 定位正文 AI 接口 generateRaw
 *
 * generateRaw 可能在多种作用域下存在（当前窗口 / 父窗口 / TavernHelper），
 * 依次尝试获取，任一命中即返回该函数引用；均未找到则返回 null。
 * ------------------------------------------------------------------------ */
function getAI() {
    // 1) 当前作用域
    if (typeof generateRaw === 'function') return generateRaw;
    // 2) 父窗口（iframe 场景）
    try {
        if (typeof parent !== 'undefined' && typeof parent.generateRaw === 'function') return parent.generateRaw;
    } catch (e) {}
    // 3) window.TavernHelper.generateRaw
    if (typeof window !== 'undefined' && window.TavernHelper && typeof window.TavernHelper.generateRaw === 'function') return window.TavernHelper.generateRaw;
    // 4) 父窗口 TavernHelper.generateRaw
    try {
        if (typeof parent !== 'undefined' && parent.TavernHelper && typeof parent.TavernHelper.generateRaw === 'function') return parent.TavernHelper.generateRaw;
    } catch (e) {}
    return null;
}


/* --------------------------------------------------------------------------
 * callAI(systemPrompt, userMsg) —— 统一封装的 AI 调用（返回 Promise）
 *
 * 参数：
 *   systemPrompt —— 系统提示词（设定角色与世界观）
 *   userMsg      —— 用户输入（已有信息 + 要求补全的格式模板）
 *
 * 内部通过 getAI() 取得 generateRaw，以 { user_input, ordered_prompts }
 * 结构发起调用，并兼容同步 / 异步返回值（Promise.resolve 兜底）。
 * 调用失败或未找到接口时 reject。
 * ------------------------------------------------------------------------ */
function callAI(systemPrompt, userMsg) {
    return new Promise(function (resolve, reject) {
        var fn = getAI();
        if (!fn) {
            reject(new Error('未找到酒馆正文AI接口 generateRaw'));
            return;
        }
        try {
            var p = fn({
                user_input: userMsg,
                ordered_prompts: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user',   content: userMsg }
                ]
            });
            // 兼容 generateRaw 返回 Promise 或普通值
            Promise.resolve(p).then(function (r) {
                resolve(r);
            }).catch(function (e) {
                reject(e);
            });
        } catch (e) {
            reject(e);
        }
    });
}


/* --------------------------------------------------------------------------
 * ★ aiFill() —— AI 激活入口（由 #btn-ai-fill 触发）
 *
 * 流程：
 *   1. 校验 AI 接口是否存在；
 *   2. collect() 收集已有信息，拼成「已有信息」清单；
 *   3. 构造系统提示词 sys（世界观设定）与用户提示词 user（补全格式模板）；
 *   4. callAI() 发起调用，期间按钮置灰、文案改为「正在请神录档…」；
 *   5. 成功 → fillFromAI(out) 回填表单并提示；失败 → 提示错误信息。
 *   6. 无论成功失败，恢复按钮可用状态与原文案。
 * ------------------------------------------------------------------------ */
function aiFill() {
    var fn = getAI();
    if (!fn) {
        toast('未检测到正文AI接口，无法补全');
        return;
    }

    var btn = $('btn-ai-fill');
    var prof = collect();                 // 收集当前已填信息
    btn.disabled = true;                  // 置灰防重复点击
    btn.textContent = '✦ 正 在 请 神 录 档 …';

    // —— 拼装「已有信息」清单（仅收录非空字段） ——
    var have = [];
    if (prof.name)     have.push('姓名：' + prof.name);
    if (prof.age)      have.push('年龄：' + prof.age);
    if (prof.gender)   have.push('性别：' + prof.gender);
    if (prof.look)     have.push('外貌：' + prof.look);
    if (prof.role)     have.push('身份：' + prof.role);
    if (prof.rank)     have.push('实力（身份牌）：' + prof.rank);
    for (var i = 0; i < prof.abilities.length; i++) {
        var a = prof.abilities[i];
        have.push('本领' + (i + 1) + '：' + a.name + '（' + a.category + '）— ' + a.desc);
    }
    if (prof.backstory) have.push('背景故事：' + prof.backstory);

    // —— 系统提示词：世界观与文风设定 ——
    var sys = '你为中式志怪跑团《诡事录》创建玩家角色。世界观：现代表层之下共生「暗面」，诡异栖身；龙国「镇厄司」统筹（天轨/地轨·封印/疏导/掩盖线·封号队·更夫）；看家本领为道法/术法/出马仙/蛊术/古武/风水等传统传承，借天地规则、需媒介、有代价；诡异分游怨煞凶劫；更夫身份牌玄铁/青铜/素银/紫金/墨玉。文风冷峻克制、带民俗黑话。';

    // —— 用户提示词：已有信息 + 严格输出格式模板 ——
    //    全空时要求 AI 自行创作一个有记忆点的角色；
    //    本领类别须据描述如实分散选择，严禁雷同（尤其严禁全为道法）。
    var user = '依据【已有信息】补全所有留空字段。仅输出纯文本表单，不要解释。\n\n'
        + (have.length ? ('【已有信息】\n' + have.join('\n')) : '【已有信息】（全空，请创作一个有记忆点的角色）')
        + '\n\n【严格按格式，每项一行，本领1-3门。每门本领的类别必须依据其描述如实选择，严禁全部相同、尤其严禁全为道法，须分散到不同类别（道法/术法/出马仙/蛊术/古武传承/风水堪舆/鲁班书传人/祝由科医者/走阴人/赶尸匠/铁口直断/阴阳刺青师等任选）】\n'
        + '姓名：\n'
        + '年龄：\n'
        + '性别：（男/女/自定义）\n'
        + '外貌：（容貌、身形、衣着、辨识特征，60字内）\n'
        + '身份：\n'
        + '实力：（玄铁牌/青铜牌/素银牌/紫金牌/墨玉牌 任选，可附注）\n'
        + '本领1：名称 | 类别 | 描述（施展方式与代价）\n'
        + '本领2：名称 | 类别 | 描述（可选）\n'
        + '背景故事：（120字内，交代与暗面结缘之由）';

    // —— 发起调用并处理结果 ——
    callAI(sys, user).then(function (out) {
        fillFromAI(out);                                   // 解析并回填
        btn.disabled = false;
        btn.textContent = '✦ 请 正 文 AI 补 全 档 案';
        toast('档案已由正文AI补全，可增删修改。');
    }).catch(function (e) {
        btn.disabled = false;
        btn.textContent = '✦ 请 正 文 AI 补 全 档 案';
        toast('AI补全失败：' + (e && e.message ? e.message : e));
    });
}


/* --------------------------------------------------------------------------
 * fillFromAI(text) —— 解析 AI 返回文本并回填表单
 *
 * AI 按行输出「字段：值」格式，本函数逐行正则匹配后回填对应控件：
 *   姓名 / 年龄 / 外貌 —— 直接写入 input
 *   性别              —— 命中「男/女」则勾选单选，否则走自定义
 *   身份              —— setSelectOrCustom 匹配下拉或转自定义
 *   实力              —— 先匹配身份牌关键词，命中则选下拉，否则自定义
 *   本领N             —— 以「|」拆分 名称|类别|描述，重建本领卡片
 *   背景故事          —— 可跨行，直到遇到下一个字段键为止
 * ------------------------------------------------------------------------ */
function fillFromAI(text) {
    if (!text) return;
    var lines = text.split('\n');

    // 内部工具：按正则在所有行中取首个匹配的捕获组（已 trim）
    function get(re) {
        for (var i = 0; i < lines.length; i++) {
            var m = lines[i].match(re);
            if (m) return m[1].trim();
        }
        return '';
    }

    // —— 提取各单行字段 ——
    var name    = get(/^姓名[：:]\s*(.+)$/),
        age     = get(/^年龄[：:]\s*(\d+)/),
        gender  = get(/^性别[：:]\s*(.+)$/),
        look    = get(/^外貌[：:]\s*(.+)$/),
        role    = get(/^身份[：:]\s*(.+)$/),
        rankRaw = get(/^实力[：:]\s*(.+)$/);

    // —— 背景故事：可能跨行，遇到下一个字段键即结束 ——
    var backLines = [],
        inBack = false;
    for (var i = 0; i < lines.length; i++) {
        if (/^背景故事[：:]/.test(lines[i])) {
            inBack = true;
            var m = lines[i].match(/^背景故事[：:]\s*(.*)$/);
            if (m[1]) backLines.push(m[1]);
            continue;
        }
        if (inBack && /^(姓名|年龄|性别|身份|实力|本领)/.test(lines[i])) inBack = false;
        if (inBack) backLines.push(lines[i]);
    }

    // —— 回填简单文本字段 ——
    if (name) $('f-name').value = name;
    if (age)  $('f-age').value = age;
    if (look) $('f-look').value = look;

    // —— 性别回填：命中男/女勾选单选，否则走自定义 ——
    if (gender) {
        var gv = gender.indexOf('女') >= 0 ? '女' : (gender.indexOf('男') >= 0 ? '男' : null);
        if (gv) {
            var rd = document.querySelector('input[name="gender"][value="' + gv + '"]');
            if (rd) rd.checked = true;
            $('f-gender-x').style.display = 'none';
        } else {
            var cust = document.querySelector('input[name="gender"][value="__custom"]');
            if (cust) {
                cust.checked = true;
                $('f-gender-x').style.display = 'block';
                $('f-gender-x').value = gender;
            }
        }
    }

    // —— 身份：下拉预设优先，匹配不到则转自定义 ——
    setSelectOrCustom('f-role', 'f-role-x', role);

    // —— 实力：先在文本中找身份牌关键词，命中则选对应下拉项 ——
    var rankMap = ['玄铁牌', '青铜牌', '素银牌', '紫金牌', '墨玉牌'];
    var hit = null;
    for (var k = 0; k < rankMap.length; k++) {
        if (rankRaw.indexOf(rankMap[k]) >= 0) {
            hit = rankMap[k];
            break;
        }
    }
    if (hit) {
        var sel = $('f-rank');
        var full = null;
        for (var j = 0; j < sel.options.length; j++) {
            if (sel.options[j].value.indexOf(hit) >= 0) {
                full = sel.options[j].value;
                break;
            }
        }
        if (full) sel.value = full;
    } else if (rankRaw) {
        // 未命中预设牌，则作为自定义文本回填
        setSelectOrCustom('f-rank', 'f-rank-x', rankRaw);
    }

    // —— 本领：按「名称 | 类别 | 描述」拆分，重建卡片（最多 3 门） ——
    var abilities = [];
    for (var i = 0; i < lines.length; i++) {
        var m = lines[i].match(/^本领\d*[：:]\s*(.+)$/);
        if (m) {
            var parts = m[1].split('|').map(function (s) { return s.trim(); });
            abilities.push({
                name:     parts[0] || '',
                category: parts[1] || '',
                desc:     parts.slice(2).join(' ').trim()
            });
        }
    }
    if (abilities.length) {
        $('ablist').innerHTML = '';          // 清空旧卡片
        abCount = 0;                         // 重置计数
        for (var i = 0; i < Math.min(3, abilities.length); i++) addAbility(abilities[i]);
    }

    // —— 背景故事回填 ——
    if (backLines.length) $('f-back').value = backLines.join('').trim();
}


/* --------------------------------------------------------------------------
 * setSelectOrCustom(selId, xId, val) —— 下拉框 / 自定义回填辅助
 *
 * 用于「预设下拉 + 自定义手填」组合控件：
 *   优先在下拉选项中匹配 val（精确或包含匹配），命中则直接选中；
 *   命中不到则将下拉切到 '__custom'，显示并填充自定义输入框。
 *
 * 参数：
 *   selId —— 下拉框元素 ID
 *   xId   —— 自定义输入框元素 ID
 *   val   —— 待回填的值
 * ------------------------------------------------------------------------ */
function setSelectOrCustom(selId, xId, val) {
    if (!val) return;
    var sel = $(selId),
        cus = $(xId),
        match = null;
    // 在下拉选项中查找：精确相等 或 选项值包含 val
    for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === val || sel.options[i].value.indexOf(val) >= 0) {
            match = sel.options[i].value;
            break;
        }
    }
    if (match) {
        sel.value = match;                  // 命中预设 → 直接选中
    } else {
        sel.value = '__custom';             // 未命中 → 切自定义
        cus.style.display = 'block';
        cus.value = val;
    }
}
