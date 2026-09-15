from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'script/world-engine-src/40-engine-runtime.part.js'
HISTORY = ROOT / 'script/world-engine-src/59-history-memory.part.js'
TEST = ROOT / 'tests/world-engine-history-memory.cjs'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding='utf-8')


# 1) 给主世界提交增加一个轻量装饰钩子，让历史 L0 叶子与本轮 WorldResult 同一次 MVU 提交落库。
runtime = read(RUNTIME)
hook_marker = "if(typeof this.beforeWorldCommit==='function')"
if hook_marker not in runtime:
    anchor = """                        next.世界[PATH].运行记录=sourceOld.运行记录.concat([{时间:base.stat.世界.时间,摘要:reply.summary,补丁数:committedPatches.length,尝试次数:attempt+1}]).slice(-20);\n\n                        const checked=validate(next);"""
    replacement = """                        next.世界[PATH].运行记录=sourceOld.运行记录.concat([{时间:base.stat.世界.时间,摘要:reply.summary,补丁数:committedPatches.length,尝试次数:attempt+1}]).slice(-20);\n                        // 可选提交装饰钩子：用于把本轮派生元数据与主世界结果原子落库，避免额外 MVU 写回。\n                        if(typeof this.beforeWorldCommit==='function')this.beforeWorldCommit(next,{\n                            messageId:base.id,fingerprint:base.fingerprint,worldResult:acceptedWorldResult,reply:copy(reply),baseStat:base.stat\n                        });\n\n                        const checked=validate(next);"""
    count = runtime.count(anchor)
    if count != 1:
        raise RuntimeError(f'[history-leaf] runtime commit anchor not found or ambiguous ({count})')
    runtime = runtime.replace(anchor, replacement, 1)
    write(RUNTIME, runtime)
    print('[history-leaf] patched runtime commit hook')
else:
    print('[history-leaf] runtime commit hook already patched')


# 2) 近期历史改为提交前同步写入：每个成功世界推进楼层一条 L0 叶子；同楼重推覆盖并失效祖先总结。
history = read(HISTORY)
if 'beforeWorldCommit(next, context={})' not in history:
    pattern = r"\n        async recordCurrentHistoryLeaf\(\) \{[\s\S]*?\n        async maintainHistoryMemory\(\) \{"
    replacement = r'''
        beforeWorldCommit(next, context={}) {
            const summary=String(context.worldResult?.摘要||context.reply?.summary||this.lastWorldResult?.摘要||'').trim();
            const messageId=Number(context.messageId);
            const backend=next?.世界?.[PATH];
            if(!summary||!Number.isInteger(messageId)||!plain(backend))return false;
            if(!plain(backend.历史))backend.历史={};
            if(!plain(backend.历史总结))backend.历史总结={};
            const key=historyMemoryLeafKey(messageId),record={
                时间:String(next.世界?.时间||backend.已处理时间||context.baseStat?.世界?.时间||''),
                事实:summary,
                关联事件:[]
            };
            const previous=backend.历史[key];
            if(plain(previous)&&String(previous.时间||'')===record.时间&&String(previous.事实||'')===record.事实)return false;
            backend.历史[key]=record;
            const invalidated=historyMemoryInvalidateAncestors(backend,'历史:'+key);
            this.lastHistoryMaintenance='近期历史已更新'+(invalidated.length?' · 旧总结失效 '+invalidated.length+' 个':'');
            return true;
        }
        async maintainHistoryMemory() {'''
    history2, count = re.subn(pattern, lambda _m: replacement, history, count=1)
    if count != 1:
        raise RuntimeError(f'[history-leaf] history leaf method anchor not found or ambiguous ({count})')
    history = history2

    old_run_piece = """                try{await this.recordCurrentHistoryLeaf();}catch(error){\n                    this.lastHistoryMaintenance='近期历史写入稍后重试：'+String(error?.message||error);\n                    try{console.warn('[世界推进] '+this.lastHistoryMaintenance);}catch(_){}\n                }\n"""
    count = history.count(old_run_piece)
    if count != 1:
        raise RuntimeError(f'[history-leaf] post-commit leaf call anchor not found or ambiguous ({count})')
    history = history.replace(old_run_piece, '', 1)
    write(HISTORY, history)
    print('[history-leaf] folded L0 leaf into primary world commit')
else:
    print('[history-leaf] L0 leaf already folded into primary world commit')


# 3) 回归中的同楼重推直接验证提交装饰逻辑，不再期待第二次 MVU 提交。
test = read(TEST)
old_test = """    x.engine.lastWorldResult={摘要:'同一楼层重推后的新世界摘要。'};\n    assert.equal(await x.engine.recordCurrentHistoryLeaf(),true);\n    const backend=x.getState().世界.后台;"""
new_test = """    const rerun=x.getState();\n    assert.equal(x.engine.beforeWorldCommit(rerun,{messageId:80,worldResult:{摘要:'同一楼层重推后的新世界摘要。'},baseStat:rerun}),true);\n    const backend=rerun.世界.后台;"""
if new_test not in test:
    count = test.count(old_test)
    if count != 1:
        raise RuntimeError(f'[history-leaf] rerun regression anchor not found or ambiguous ({count})')
    test = test.replace(old_test, new_test, 1)
    write(TEST, test)
    print('[history-leaf] updated rerun regression')
else:
    print('[history-leaf] rerun regression already updated')

print('[history-leaf] done')
