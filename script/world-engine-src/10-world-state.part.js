    const NPC_AUDIT_LEVELS=['杂兵级','精英级','首领/Boss级'];
    const RECORDS = {
        事件: { 描述:'', 时间:'', 条件:'', 前因:[], 状态:'待发生', 默认走向:'', 结果:'', 公开征兆:'', 地点:'' },
        人物: { 所属世界:'', 审计级别:'', 地点:'', 目标:'', 行动:'', 认知:[], 下次检查:'', 关联事件:[], 公开动态:'' },
        势力地区: { 类型:'地区', 描述:'', 目标:'', 进展:'', 下次检查:'', 关联事件:[], 公开动态:'' },
        历史: { 时间:'', 事实:'', 关联事件:[] },
        传播: { 关联事件:[], 来源:'', 范围:'', 时间:'', 内容:'', 真相:'', 状态:'传播中' }
    };
    // 可选明细兼容第一版记录：对应参考助手的行程、承诺、认知、资源及任务阶段。
    const DETAILS = {
        事件: {分类:'',开始时间:'',预计结束:'',更新时间:'',下次检查:'',参与者:[],关联任务:[],可见影响:[{时间:'',地点:'',影响:''}]},
        人物: {状态:'',更新时间:'',开始时间:'',预计结束:'',行程:[{开始:'',结束:'',地点:'',行动:'',状态:'',结果:''}],承诺:[{对象:'',内容:'',期限:'',解除条件:''}],待决事项:[{问题:'',选项:[],等待:''}],关系变化:[{对象:'',关系:'',变化:'',时间:''}],认知来源:[{事实:'',来源:'',获知时间:'',状态:''}],登场条件:'',背景关联:[{类型:'',名称:'',关系:''}]},
        势力地区: {更新时间:'',控制方:'',争夺方:[],资源:[{名称:'',数量:'',用途:'',限制:''}],内部派系:[{名称:'',立场:'',行动:'',影响:''}],近期变化:[{时间:'',事实:'',关联事件:''}],环境状态:[],现场群体:[{名称:'',规模:'',身份:'',动态:''}]},
        历史:{},传播:{更新时间:'',到期时间:'',受众:[],引发行动:[]}
    };
    const MODEL_RECORDS = copy(RECORDS);
    const MODEL_DETAILS = copy(DETAILS);
    for (const key of ['承诺','待决事项','关系变化']) delete MODEL_DETAILS.人物[key];

    const nameKey=value=>String(value||'').toLowerCase().replace(/[\\/／·・._\-\s]+/g,'');
    function stableNameIn(bucket,name) {
        if(!plain(bucket))return '';
        if(Object.hasOwn(bucket,name))return name;
        const key=nameKey(name),matches=Object.keys(bucket).filter(item=>nameKey(item)===key);
        return matches.length===1?matches[0]:'';
    }
    function worldLocationRelated(a,b) {
        const x=nameKey(a),y=nameKey(b);if(!x||!y)return false;
        return x===y||x.includes(y)||y.includes(x);
    }
