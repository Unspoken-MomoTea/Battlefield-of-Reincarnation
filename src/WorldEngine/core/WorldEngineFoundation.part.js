/* 轮回战场 · 世界引擎
 * 从参考异步助手迁移：旧状态回读、增量补丁、分层投影、楼层隔离、后台调度。
 * 专用实现：六个业务模块共用一次推演；MVU 是唯一持久状态；复用主神终端 API。
 * 在酒馆脚本库中独立加载。接口位于父窗口 Samsara.worldEngine。
 */
(function (root) {
    'use strict';
    const WORLD_ENGINE_VERSION='2.0.10';
