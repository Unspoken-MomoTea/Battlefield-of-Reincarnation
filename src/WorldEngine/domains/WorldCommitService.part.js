    class WorldCommitService {
        constructor(engine){this.engine=engine;}
        recentChanges(patches,worldTime){
            return (patches||[]).map(patch=>{
                const parts=tokens(patch.path),back=parts[1]===PATH,asset=parts[0]==='资产';
                return {
                    时间:worldTime,
                    类别:asset?'资产':back?parts[2]:parts[1],
                    名称:asset?parts[1]:back?parts[3]:parts[2],
                    字段:asset?'资产':parts.at(-1),
                    操作:patch.op==='add'?'新增':patch.op==='remove'?'移除':'更新',
                    内容:typeof patch.value==='string'?patch.value:plain(patch.value)
                        ?(patch.value.描述||patch.value.行动||patch.value.事实||patch.value.目标||patch.value.状态||patch.value.内容||'记录已更新')
                        :''
                };
            });
        }
        prepare({next,committedPatches=[],base,acceptedWorldResult=null,reply,validate}){
            const engine=this.engine;
            if(!plain(next)||!base?.stat)throw new Error('世界提交缺少待写入状态');
            if(!(next.设置||{}).世界超稳){
                const offsets=(next.世界?.因果轨道||{}).偏移记录||{};
                const total=Object.values(offsets).reduce((sum,record)=>sum+(Number(record?.影响程度)||0),0);
                next.世界.稳定=Math.max(0,Math.min(120,100+total));
            }
            if(!plain(next.世界?.[PATH]))next.世界[PATH]=emptyState();
            next.世界[PATH].已处理楼层=base.fingerprint;
            next.世界[PATH].已处理时间=base.stat.世界?.时间;
            next.世界[PATH].最近变化=this.recentChanges(committedPatches,base.stat.世界?.时间).slice(-100);

            if(typeof engine.beforeWorldCommit==='function')engine.beforeWorldCommit(next,{
                messageId:base.id,
                fingerprint:base.fingerprint,
                worldResult:acceptedWorldResult,
                reply:copy(reply),
                baseStat:base.stat
            });

            if(typeof validate==='function'){
                const checked=validate(next);
                for(const patch of committedPatches){
                    if(patch.op==='remove')continue;
                    if(!same(get(checked,tokens(patch.path)),get(next,tokens(patch.path))))throw schemaMismatchError(next,checked,patch.path);
                }
            }
            const nextReply=copy(reply||{});
            nextReply.patches=copy(committedPatches);
            return {next,reply:nextReply};
        }
        async persist(prepared,base){
            if(!prepared?.current?.raw||!prepared?.current?.mvu||!prepared?.next)throw new Error('世界提交上下文不完整');
            const result=prepared.current.raw;
            result.stat_data=prepared.next;
            const replay=typeof this.engine.buildWorldReplayPackage==='function'
                ?this.engine.buildWorldReplayPackage(base.stat,prepared.next,base.fingerprint)
                :null;
            if(replay)result.__samsaraWorldReplay=replay;
            await prepared.current.mvu.replaceMvuData(result,{type:'message',message_id:base.id});
            return result;
        }
    }
