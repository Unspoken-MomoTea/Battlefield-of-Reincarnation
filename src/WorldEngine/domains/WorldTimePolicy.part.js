    const WORLD_TIME_MACHINE_DESCRIPTION='精确到月日时使用 {yyy}年-{mm}月-{dd}日-{时间段}；时间段仅限：凌晨/黎明/清晨/早晨/上午/中午/午后/下午/傍晚/入夜/晚上/深夜；只能确定季节/阶段时可保留粗粒度。';
    const WORLD_DAYPART_ALIASES=Object.freeze({
        '清早':'清晨',
        '早上':'早晨',
        '黄昏':'傍晚',
        '夜晚':'晚上',
        '夜间':'晚上',
        '夜里':'晚上',
        '晚间':'晚上'
    });

    class WorldTimePolicy {
        normalizeDaypartAlias(value) {
            let source=String(value||'');
            for(const [alias,canonical] of Object.entries(WORLD_DAYPART_ALIASES))source=source.replaceAll(alias,canonical);
            return source;
        }

        key(value) {
            const source=this.normalizeDaypartAlias(value);
            let m=source.match(/(\d{1,4})\s*年\s*-?\s*(\d{1,2})\s*月\s*-?\s*(\d{1,2})\s*日/);
            if(!m)m=source.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
            if(!m)return null;
            const y=+m[1],month=+m[2],day=+m[3];
            if(!Number.isInteger(y)||!Number.isInteger(month)||!Number.isInteger(day)||month<1||month>12||day<1)return null;
            const date=new Date(0);
            date.setUTCFullYear(y,month-1,day);date.setUTCHours(0,0,0,0);
            if(date.getUTCFullYear()!==y||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;

            const exact=source.match(/(?:^|[日T\s_-])(\d{1,2}):([0-5]\d)(?::([0-5]\d))?/);
            if(exact){
                const hour=Number(exact[1]),minute=Number(exact[2]),second=Number(exact[3]||0);
                if(!Number.isInteger(hour)||hour<0||hour>23)return null;
                return date.getTime()/3600000+hour+minute/60+second/3600;
            }

            const part=source.match(/凌晨|黎明|清晨|早晨|上午|中午|午后|下午|傍晚|入夜|晚上|深夜/);
            const hour={凌晨:2,黎明:5,清晨:6,早晨:8,上午:10,中午:12,午后:14,下午:15,傍晚:18,入夜:19,晚上:20,深夜:23};
            let dayHour=part?hour[part[0]]:0;
            const branch=source.match(/([子丑寅卯辰巳午未申酉戌亥])时(?:([一二三四1234])刻)?/);
            if(branch){
                const branchHour={子:23,丑:1,寅:3,卯:5,辰:7,巳:9,午:11,未:13,申:15,酉:17,戌:19,亥:21};
                const quarterMap={一:1,二:2,三:3,四:4,'1':1,'2':2,'3':3,'4':4};
                dayHour=branchHour[branch[1]]+(quarterMap[branch[2]]||0)*0.25;
            }
            return date.getTime()/3600000+dayHour;
        }

        capacity(previous,current) {
            const from=String(previous||'').trim(),to=String(current||'').trim();
            const a=this.key(from),b=this.key(to);
            if(!from)return {起点:'首次运行/无上次引擎时间',终点:to,小时:null,等级:'首轮初始化',允许:'先建立宏观骨架；近期细节只依据当前事实，不假定额外耗时。'};
            if(a!==null&&b!==null){
                const hours=Math.max(0,b-a);
                if(hours<=0)return {起点:from,终点:to,小时:0,等级:'未推进',允许:'只能记录本轮新确认事实、即时反应或同步结果；不得完成需要时间的后台事项。'};
                if(hours<=2)return {起点:from,终点:to,小时:hours,等级:'短时段',允许:'只够当面短谈、通讯、案头事务或同区域短途移动；大型行动只能准备或启动。'};
                if(hours<=12)return {起点:from,终点:to,小时:hours,等级:'数小时',允许:'允许同城区移动、有限调查/准备、一次工作阶段；跨城或大规模调动通常不能完成。'};
                if(hours<=24)return {起点:from,终点:to,小时:hours,等级:'半天至一天',允许:'允许完成一套日常事务、一次较完整阶段或城区迁移；长期工程与远距行动仍需分段。'};
                return {起点:from,终点:to,小时:hours,等级:'数日以上',允许:'可推进长途行程、物资转运、据点/组织事项的多个阶段，但仍按因果与资源逐步推进。'};
            }
            return {起点:from,终点:to,小时:null,等级:'作品内时间',允许:'按作品内时间语义保守估计行动容量；无法确认跨度时只推进一步，不直接跳到长期结果。'};
        }

        calendarDate(value,calendar) {
            const source=String(value||'').trim();
            const full=source.match(/(?:^|[^\d])(\d{1,4})\s*年\s*-?\s*(\d{1,2})\s*月\s*-?\s*(\d{1,2})\s*日/)||source.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/);
            let y,month,d,fallbackYear=false;
            if(full){
                y=+full[1];month=+full[2];d=+full[3];
            }else{
                const md=source.match(/(?:^|[^\d])(\d{1,2})\s*月\s*-?\s*(\d{1,2})\s*日/)||source.match(/(?:^|[^\d])(\d{1,2})[-/.](\d{1,2})(?!\d)/);
                if(!md)return null;
                y=2026;month=+md[1];d=+md[2];fallbackYear=true;
            }
            const custom=Array.isArray(calendar?.月份天数)?calendar.月份天数.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=99).slice(0,24):[];
            if(custom.length){
                if(month<1||month>custom.length||d<1||d>custom[month-1])return null;
                return {y,m:month,d,key:y+'-'+month+'-'+d,fallbackYear,customCalendar:true};
            }
            const date=new Date(0);
            date.setFullYear(y,month-1,d);date.setHours(0,0,0,0);
            if(date.getFullYear()!==y||date.getMonth()!==month-1||date.getDate()!==d)return null;
            return {y,m:month,d,key:y+'-'+month+'-'+d,fallbackYear,customCalendar:false};
        }

        dayKey(value) {
            const key=this.key(value);
            return key===null?null:Math.floor(key/24);
        }

        hasExactClock(value) {
            return /(?:^|[日T\s_-])(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?/.test(String(value||''));
        }
        unset(value) {
            const raw=String(value??'').trim();
            return !raw||raw==='待初始化';
        }

        identity(value) {
            return String(value??'').trim().replace(/[\s·・_—–-]+/g,'');
        }

        claimsMonthDay(value) {
            const source=String(value??'').trim();
            return !!source&&/月/.test(source)&&/(?:第\s*)?\d{1,2}\s*日/.test(source);
        }

        calendarFor(stat,result) {
            return plain(result?.历法)?result.历法:(plain(stat?.世界?.历法)?stat.世界.历法:{});
        }

        assertCalendarCompatibleTimeValue(stat,result,value,label='时间') {
            const raw=String(value??'').trim();
            if(!this.claimsMonthDay(raw))return;
            if(this.calendarDate(raw,this.calendarFor(stat,result)))return;
            throw new Error(label+'格式无法用于日历：'+raw+'。精确到月日时请使用 {yyy}年-{mm}月-{dd}日-{时间段}；不要用月份名称替代数字月。');
        }

        assertCalendarCompatibleWorldResultTimes(stat,result) {
            const temporalKeys=new Set(['时间','开始时间','预计结束','更新时间','到期时间','下次检查','开始','结束','期限','获知时间']);
            const walk=(value,path=[])=>{
                if(Array.isArray(value)){for(let i=0;i<value.length;i++)walk(value[i],path.concat(i));return;}
                if(!plain(value))return;
                for(const [key,child] of Object.entries(value)){
                    const nextPath=path.concat(key);
                    if(typeof child==='string'&&temporalKeys.has(key))this.assertCalendarCompatibleTimeValue(stat,result,child,nextPath.join('.'));
                    else if(child&&typeof child==='object')walk(child,nextPath);
                }
            };
            walk(result);
            return result;
        }

        inferFromCurrentActivities(result) {
            const candidates=new Map();
            for(const item of result?.人物||[]){
                if(!plain(item)||item.操作==='撤销本轮')continue;
                const activeFacts=String(item.地点||'').trim()&&String(item.目标||'').trim()&&String(item.行动||'').trim();
                const raw=String(item.更新时间||'').trim();
                if(!activeFacts||!raw)continue;
                const key=this.identity(raw);if(key&&!candidates.has(key))candidates.set(key,raw);
            }
            return candidates.size===1?Array.from(candidates.values())[0]:'';
        }

        resolveProposal(stat,result) {
            const explicit=String(result?.时间||'').trim();
            if(explicit)return explicit;
            if(!this.unset(stat?.世界?.时间))return '';
            return this.inferFromCurrentActivities(result);
        }

        assertNotBackwards(stat,nextTime) {
            const current=String(stat?.世界?.时间||'').trim();
            if(this.unset(current)||!nextTime)return;
            const before=this.key(current),after=this.key(nextTime);
            if(before!==null&&after!==null&&after<before)throw new Error('世界时间不可回退：'+current+' -> '+nextTime);
        }

        prepareCompile(stat,result) {
            const proposal=this.resolveProposal(stat,result);
            if(proposal)result.时间=proposal;
            this.assertCalendarCompatibleWorldResultTimes(stat,result);
            if(proposal)this.assertNotBackwards(stat,proposal);
            if(!proposal)return {proposal:'',result,validationStat:stat};
            const validationStat=copy(stat);
            if(!plain(validationStat.世界))validationStat.世界={};
            validationStat.世界.时间=proposal;
            return {proposal,result,validationStat};
        }

        finalizeCompile(originalStat,proposal,compiled) {
            if(!proposal)return compiled;
            const old=originalStat?.世界?.时间;
            if(String(old??'')!==proposal)compiled.patches.unshift({op:old===undefined?'add':'replace',path:'/世界/时间',value:proposal});
            compiled.result.时间=proposal;
            return compiled;
        }
    }

    const DEFAULT_WORLD_TIME_POLICY=new WorldTimePolicy();
    let ACTIVE_WORLD_TIME_POLICY=DEFAULT_WORLD_TIME_POLICY;
    function worldDateKey(value){return ACTIVE_WORLD_TIME_POLICY.key(value);}
    function worldTimeCapacity(previous,current){return ACTIVE_WORLD_TIME_POLICY.capacity(previous,current);}
    function calendarDate(value,calendar){return ACTIVE_WORLD_TIME_POLICY.calendarDate(value,calendar);}
