    const WORLD_TIME_MACHINE_DESCRIPTION='精确到月日时使用 {yyy}年-{mm}月-{dd}日-{时间段}；时间段仅限：凌晨/黎明/清晨/早晨/上午/中午/午后/下午/傍晚/入夜/晚上/深夜；只能确定季节/阶段时可保留粗粒度。';

    class WorldTimePolicy {
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
            if(calendarDate(raw,this.calendarFor(stat,result)))return;
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
            const before=worldDateKey(current),after=worldDateKey(nextTime);
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
