    // 玩家探索投影保护层。
    const EXPLORATION_PROJECTION_RULES=`【玩家探索投影硬约束】实际到达整体区域时至少记录10%探索；离开区域后仍保留探索台账。`;
    const EXPLORATION_PROJECTION_SUFFIX=/(?:地区|区域|校区|城区|街区|片区)$/;
    function explorationProjectionBaseKey(value) {
        const key=nameKey(value);
        const stripped=key.replace(EXPLORATION_PROJECTION_SUFFIX,'');
        return stripped.length>=2?stripped:key;
    }
    function explorationProjectionEquivalent(a,b) {
        const x=nameKey(a),y=nameKey(b);if(!x||!y)return false;
        if(x===y)return true;
        const xb=explorationProjectionBaseKey(a),yb=explorationProjectionBaseKey(b);
        return xb===yb&&xb.length>=2;
    }
    function explorationLocationContainsArea(location,areaName) {
        const locationKey=nameKey(location),areaKey=nameKey(areaName);if(!locationKey||!areaKey)return false;
        if(locationKey===areaKey||locationKey.includes(areaKey))return true;
        const locationBase=explorationProjectionBaseKey(location),areaBase=explorationProjectionBaseKey(areaName);
        return areaBase.length>=2&&(locationBase===areaBase||locationBase.includes(areaBase));
    }
    function explorationProjectionRegionCandidates(stat,result) {
        const stored=stat?.世界?.[PATH]?.势力地区||{},map=new Map();
        for(const [name,record] of Object.entries(stored)){
            if(!plain(record))continue;
            map.set(nameKey(name),{名称:name,记录:copy(record)});
        }
        for(const item of result?.势力地区||[]){
            if(!plain(item)||item.操作==='撤销本轮')continue;
            const id=nameKey(item.名称);if(!id)continue;
            const previous=map.get(id);
            map.set(id,{名称:previous?.名称||item.名称,记录:Object.assign({},previous?.记录||{},copy(item))});
        }
        return Array.from(map.values()).filter(item=>String(item.记录?.类型||'地区')!=='势力');
    }
    function currentExplorationProjectionRegion(stat,result) {
        if(stat?.系统状态?.是否在主神空间)return null;
        const location=String(stat?.世界?.地点||'').trim();if(!location)return null;
        const locationKey=nameKey(location);
        const candidates=explorationProjectionRegionCandidates(stat,result).filter(item=>explorationLocationContainsArea(location,item.名称));
        if(!candidates.length)return null;
        candidates.sort((a,b)=>{
            const ak=nameKey(a.名称),bk=nameKey(b.名称);
            const exactA=ak===locationKey?1:0,exactB=bk===locationKey?1:0;
            if(exactA!==exactB)return exactB-exactA;
            return bk.length-ak.length;
        });
        return candidates[0];
    }
    function ensureCurrentExplorationProjection(stat,result) {
        const region=currentExplorationProjectionRegion(stat,result);if(!region)return null;
        const name=String(region.名称||'').trim();if(!name||explorationGranularity(name).invalid)return null;
        const bucket=stat?.世界?.探索||{},storedEntries=Object.entries(bucket);
        let storedName=Object.hasOwn(bucket,name)?name:stableNameIn(bucket,name);
        if(!storedName){
            const matches=storedEntries.filter(([candidate])=>explorationProjectionEquivalent(candidate,name));
            if(matches.length===1)storedName=matches[0][0];
        }
        const resultList=Array.isArray(result.探索)?result.探索:(result.探索=[]);
        const resultIndex=resultList.findIndex(item=>plain(item)&&item.操作!=='撤销本轮'&&explorationProjectionEquivalent(item.名称,name));
        const explicit=resultIndex>=0?resultList[resultIndex]:null;
        const stored=storedName&&plain(bucket[storedName])?bucket[storedName]:null;
        const currentProgress=Math.max(Number(stored?.探索度)||0,Number(explicit?.探索度)||0,10);
        const description=String(explicit?.描述||stored?.描述||region.记录?.描述||region.记录?.公开动态||region.记录?.进展||('已实际到达'+name+'。'));
        const record={名称:name,操作:'更新',风险:String(explicit?.风险||stored?.风险||'F'),探索度:Math.min(100,currentProgress),描述:description,隐藏真相:String(explicit?.隐藏真相||stored?.隐藏真相||'')};
        if(explicit)resultList.splice(resultIndex,1,record);
        else if(!stored||Number(stored.探索度)<10||storedName!==name)resultList.push(record);
        return {名称:name,旧名称:storedName&&storedName!==name?storedName:''};
    }

    pruneColdExploration=function(){return [];};

    const compileWorldResultBeforeExplorationProjection=compileWorldResult;
    compileWorldResult=function(stat,value) {
        const result=normalizeWorldResult(value);
        const projection=ensureCurrentExplorationProjection(stat,result);
        const compiled=compileWorldResultBeforeExplorationProjection(stat,result);
        if(projection?.旧名称){
            const removePath=pointer(['世界','探索',projection.旧名称]);
            if(!compiled.patches.some(patch=>patch.op==='remove'&&patch.path===removePath))compiled.patches.push({op:'remove',path:removePath});
            compiled.warnings.push('探索名称规范化：'+projection.旧名称+' → '+projection.名称);
        }
        return compiled;
    };
