from pathlib import Path

root = Path(__file__).resolve().parents[1]

builder = root / 'tools' / 'build-world-engine.py'
text = builder.read_text(encoding='utf-8')
old = "    '59-world-integrity-guard.part.js',\n    '59-causal-stability-gate.part.js',"
new = "    '59-world-integrity-guard.part.js',\n    '59-world-time-daypart-aliases.part.js',\n    '59-causal-stability-gate.part.js',"
if old not in text:
    raise SystemExit('builder anchor not found')
builder.write_text(text.replace(old, new, 1), encoding='utf-8')

modules = root / 'tests' / 'world-engine-modules.cjs'
text = modules.read_text(encoding='utf-8')
old = "  '59-world-integrity-guard.part.js',\n  '59-causal-stability-gate.part.js',"
new = "  '59-world-integrity-guard.part.js',\n  '59-world-time-daypart-aliases.part.js',\n  '59-causal-stability-gate.part.js',"
if old not in text:
    raise SystemExit('module list anchor not found')
text = text.replace(old, new, 1)
anchor = "assert.match(texts['59-world-integrity-guard.part.js'], /softNormalizeCausalOffsets/);"
insert = """assert.match(texts['59-world-integrity-guard.part.js'], /softNormalizeCausalOffsets/);
assert.match(texts['59-world-time-daypart-aliases.part.js'], /^    \/\/ 世界时间段别名兼容/);
assert.match(texts['59-world-time-daypart-aliases.part.js'], /'夜晚':'晚上'/);"""
if anchor not in text:
    raise SystemExit('module assertion anchor not found')
modules.write_text(text.replace(anchor, insert, 1), encoding='utf-8')

integrity = root / 'tests' / 'world-engine-integrity-guard.cjs'
text = integrity.read_text(encoding='utf-8')
anchor = "  {\n    const impact=WORLD_RESULT_SCHEMA.properties.因果.properties.偏移记录.items.properties.影响程度;"
block = """  {
    const stat=fresh();
    stat.世界.时间='2004年1月30日-下午';
    assert.doesNotThrow(
      ()=>compileWorldResult(stat,{摘要:'同日时段前进',时间:'2004年-01月-30日-夜晚'}),
      '同一天的“下午 -> 夜晚”必须识别为时间前进，而不是回退'
    );

    const reverse=fresh();
    reverse.世界.时间='2004年-01月-30日-夜晚';
    assert.throws(
      ()=>compileWorldResult(reverse,{摘要:'同日时段回退',时间:'2004年1月30日-下午'}),
      /世界时间不可回退/,
      '同一天的“夜晚 -> 下午”仍必须被判为真实回退'
    );
  }

"""
if anchor not in text:
    raise SystemExit('integrity test anchor not found')
integrity.write_text(text.replace(anchor, block + anchor, 1), encoding='utf-8')
