from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'script' / 'world-engine-src' / '40-engine-runtime.part.js'
PERSIST = ROOT / 'script' / 'world-engine-src' / '59-world-replay-persistence.part.js'
COMMIT_SERVICE = ROOT / 'src' / 'WorldEngine' / 'domains' / 'WorldCommitService.part.js'
RUN_ORCHESTRATOR = ROOT / 'src' / 'WorldEngine' / 'domains' / 'WorldRunOrchestrator.part.js'


def read_preserve(path: Path):
    raw = path.read_bytes()
    text = raw.decode('utf-8')
    newline = '\r\n' if '\r\n' in text else '\n'
    return text, newline


def block(text: str, newline: str) -> str:
    return text.replace('\n', newline)


def replace_once_or_accept(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'[replay-single-write] {label} anchor count != 1: {count}')
    return text.replace(old, new, 1)


# 世界结果与恢复包在同一次 replaceMvuData 中提交。
# 这样不需要依赖第二次 MVU 写回，也避免同一世界推进产生额外变量更新事件。
runtime, rnl = read_preserve(RUNTIME)
old_commit = block("""                this.committing=true;
                const result=prepared.current.raw;
                result.stat_data=prepared.next;
                await prepared.current.mvu.replaceMvuData(result,{type:'message',message_id:base.id});
""", rnl)
new_commit = block("""                this.committing=true;
                const result=prepared.current.raw;
                result.stat_data=prepared.next;
                const replay=typeof this.buildWorldReplayPackage==='function'
                    ?this.buildWorldReplayPackage(base.stat,prepared.next,base.fingerprint):null;
                if(replay)result.__samsaraWorldReplay=replay;
                await prepared.current.mvu.replaceMvuData(result,{type:'message',message_id:base.id});
""", rnl)
commit_service = COMMIT_SERVICE.read_text(encoding='utf-8') if COMMIT_SERVICE.is_file() else ''
run_orchestrator = RUN_ORCHESTRATOR.read_text(encoding='utf-8') if RUN_ORCHESTRATOR.is_file() else ''
commit_service_owns_replay = (
    'class WorldCommitService' in commit_service
    and 'buildWorldReplayPackage' in commit_service
    and '__samsaraWorldReplay' in commit_service
)
commit_call_is_classized = (
    'services.commit.persist' in runtime
    or 'services?.commit' in runtime
    or 'services?.commit?.persist' in run_orchestrator
    or 'services.commit.persist' in run_orchestrator
)
if commit_service_owns_replay and commit_call_is_classized:
    # Phase 8+: replay 已由 WorldCommitService 在同一次 MVU 提交内写入。
    # 旧 runtime 锚点消失属于预期迁移，不应再把旧实现补回主循环。
    pass
else:
    runtime = replace_once_or_accept(runtime, old_commit, new_commit, 'inline replay package')
RUNTIME.write_bytes(runtime.encode('utf-8'))


# 旧实现成功后会再次读取当前楼并 replaceMvuData 一次来补 replay。
# replay 已在主提交内原子写入后，这条第二写路径必须删除。
persist, pnl = read_preserve(PERSIST)
start_marker = block("""        async worldReplayPersistAfterSuccess(beforeSnapshot) {
""", pnl)
class_end = block("""    };
""", pnl)
start = persist.find(start_marker)
if start >= 0:
    end = persist.find(class_end, start)
    if end < 0:
        raise RuntimeError('[replay-single-write] persistence class end missing')
    persist = persist[:start] + persist[end:]

if 'worldReplayPersistAfterSuccess' in persist:
    raise RuntimeError('[replay-single-write] legacy second-write persistence still present')
PERSIST.write_bytes(persist.encode('utf-8'))

print('patched replay persistence into the primary world commit')
