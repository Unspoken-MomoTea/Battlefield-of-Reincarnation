// 辅助计算模块入口
// 构建阶段会把 domains/core 模块合并为 script/辅助计算脚本.js

export const CALCULATOR_VERSION = '1.0.0';

export * from './domains/attributes.js';
export * from './domains/combat.js';
export * from './domains/world.js';
export * from './domains/npc.part.js';
export * from './domains/task.part.js';
export * from './domains/lifecycle.part.js';
