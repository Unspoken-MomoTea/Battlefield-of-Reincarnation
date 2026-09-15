from pathlib import Path

root = Path(__file__).resolve().parents[1]

ownership = root / 'script' / 'world-engine-src' / '59-world-time-ownership.part.js'
text = ownership.read_text(encoding='utf-8')
old_rules = """    const WORLD_TIME_RULES=`【世界时间所有权】
1. 世界.时间由世界推进独占维护。WorldResult 顶层“时间”用于初始化或推进当前世界时间；不要通过人物更新时间、事件未来时间或其他字段间接代替世界时钟。
2. 当前世界时间为空或“待初始化”时，本轮必须根据最新正文与明确时间资料建立一个可理解的当前时间锚点。能确定具体日期/时段就写具体值；只能确定季节、阶段或时段时保留该精度，禁止为了格式完整凭空编造更精确日期。
3. 任何字段只要已经精确到某月某日，都必须使用程序可解析的数字月日格式：{yyy}年-{mm}月-{dd}日-{时间段}。纪年名称可保留在年份前，但月份必须写数字；禁止用自定义月份名称或“第12日”替代数字月日。此规则同时适用于顶层“时间”、事件时间、历史时间、传播时间、地区近期变化等。只能确定季节/阶段时就保留粗粒度，不要编造月日。
4. 当前世界时间已有值时，只有正文明确发生了时间流逝才提交“时间”；没有实际经过时间就省略该字段并保持原值。禁止倒退时钟，禁止把待发生事件的计划时间提前写成当前时间。
5. 人物/地区等“更新时间”属于派生时间戳。模型负责事实内容，程序会用本轮最终世界时间统一盖章；无需反复抄写世界时间。`;"""
new_rules = """    const WORLD_TIME_RULES=`【世界时间所有权】
1. 世界.时间由世界推进独占维护。顶层“时间”只用于初始化或实际推进当前世界时钟；人物更新时间、事件计划时间不能代替世界时钟。
2. 当前时间为空/待初始化时，按最新正文与明确资料建立时间锚点；资料只能确定季节、阶段或时段时保持该精度，不为格式完整编造月日。
3. 精确到月日时统一写 {yyy}年-{mm}月-{dd}日-{时间段}；月份必须为数字。时间段只能选：凌晨 / 黎明 / 清晨 / 早晨 / 上午 / 中午 / 午后 / 下午 / 傍晚 / 入夜 / 晚上 / 深夜。不要输出“夜晚/黄昏/早上”等其它同义词。
4. 时间段是粗粒度时间锚点，不是每轮计数器。没有足够时间流逝跨过当前时段时，省略“时间”并保持原值；只有正文或明确时间资料表明确实经过了合理时长，才推进到后续时段或日期。禁止仅因本轮执行了世界推进就机械跳时段。
5. 世界时间不得回退，也不得把待发生事件的计划时间提前写成当前时间。人物/地区等“更新时间”由程序按本轮最终世界时间统一盖章。`;"""
if old_rules not in text:
    raise SystemExit('WORLD_TIME_RULES anchor not found')
text = text.replace(old_rules, new_rules, 1)
old_desc = "const MACHINE_TIME_DESCRIPTION='精确到月日时使用 {yyy}年-{mm}月-{dd}日-{时间段}；只能确定季节/阶段时可保留粗粒度。';"
new_desc = "const MACHINE_TIME_DESCRIPTION='精确到月日时使用 {yyy}年-{mm}月-{dd}日-{时间段}；时间段仅限：凌晨/黎明/清晨/早晨/上午/中午/午后/下午/傍晚/入夜/晚上/深夜；只能确定季节/阶段时可保留粗粒度。';"
if old_desc not in text:
    raise SystemExit('MACHINE_TIME_DESCRIPTION anchor not found')
text = text.replace(old_desc, new_desc, 1)
old_payload = """                    精确日期格式:'顶层时间及所有事件/历史/传播等日期，只要精确到月日就使用 {yyy}年-{mm}月-{dd}日-{时间段}。月份必须是数字；不要用自定义月份名称替代数字月。'"""
new_payload = """                    精确日期格式:'顶层时间及所有事件/历史/传播等日期，只要精确到月日就使用 {yyy}年-{mm}月-{dd}日-{时间段}。月份必须是数字；不要用自定义月份名称替代数字月。',
                    时间段候选:['凌晨','黎明','清晨','早晨','上午','中午','午后','下午','傍晚','入夜','晚上','深夜'],
                    推进原则:'时间段是粗粒度锚点，不是每轮计数器；没有足够时间流逝跨过当前时段就保持原值，只有正文或明确资料表明确实经过合理时长才推进。'"""
if old_payload not in text:
    raise SystemExit('world time payload anchor not found')
text = text.replace(old_payload, new_payload, 1)
ownership.write_text(text, encoding='utf-8')

editable = root / 'script' / 'world-engine-src' / '59-editable-module-prompts.part.js'
text = editable.read_text(encoding='utf-8')
if 'const WORLD_MODULE_PROMPT_VERSION=3;' not in text:
    raise SystemExit('module prompt version anchor not found')
text = text.replace('const WORLD_MODULE_PROMPT_VERSION=3;', 'const WORLD_MODULE_PROMPT_VERSION=4;', 1)
old_fallback = """fallback:`【世界时间所有权】
世界.时间由世界推进维护：为空时据已确认资料初始化；正文没有实际时间流逝就不改。精确到月日使用 {yyy}年-{mm}月-{dd}日-{时间段}；不确定则保留粗粒度，不编造。不得回退，也不得把未来事件时间当当前时间。人物/地区更新时间由程序统一盖章。`"""
new_fallback = """fallback:`【世界时间所有权】
世界.时间由世界推进维护。为空时据已确认资料初始化；没有足够时间流逝跨过当前时段就保持原值，不因每轮推进而机械跳时段。精确到月日使用 {yyy}年-{mm}月-{dd}日-{时间段}；时间段只能选：凌晨 / 黎明 / 清晨 / 早晨 / 上午 / 中午 / 午后 / 下午 / 傍晚 / 入夜 / 晚上 / 深夜。只有正文或明确资料表明确实经过合理时长才推进时段/日期；不得回退或把未来计划时间当当前时间。人物/地区更新时间由程序统一盖章。`"""
if old_fallback not in text:
    raise SystemExit('editable world-time fallback anchor not found')
text = text.replace(old_fallback, new_fallback, 1)
editable.write_text(text, encoding='utf-8')

test = root / 'tests' / 'world-engine-module-prompts.cjs'
text = test.read_text(encoding='utf-8')
text = text.replace("assert.equal(engine.config.worldModulePromptVersion,3);", "assert.equal(engine.config.worldModulePromptVersion,4);", 1)
anchor = "assert.doesNotMatch(layer,/帝历1024年-09月-12日-下午/,'runtime module defaults must not hard-code a world-specific date example');"
extra = """assert.match(layer,/凌晨 \/ 黎明 \/ 清晨 \/ 早晨 \/ 上午 \/ 中午 \/ 午后 \/ 下午 \/ 傍晚 \/ 入夜 \/ 晚上 \/ 深夜/,'world-time prompt must restrict AI output to the canonical 12 dayparts');
assert.match(layer,/没有足够时间流逝跨过当前时段就保持原值/,'world-time prompt must not force a daypart change every world-engine run');
"""
if anchor not in text:
    raise SystemExit('module prompt test anchor not found')
text = text.replace(anchor, anchor + '\n' + extra, 1)
test.write_text(text, encoding='utf-8')
