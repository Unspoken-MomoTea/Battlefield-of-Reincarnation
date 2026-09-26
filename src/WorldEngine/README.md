# WorldEngine

`src/WorldEngine/` 是世界推进的长期开发源码与架构文档目录。

运行时仍由 `tools/build-world-engine.py` 生成单文件 `script/世界推进系统.js`，酒馆安装方式不变。旧的 `script/world-engine-src/` 在迁移期间作为 legacy source 保留；新代码优先进入这里，并通过构建器按固定顺序拼接。

## 目标

- `SamsaraWorldEngine` 最终只负责生命周期与模块编排，不再继续承载事件、人物、提示词等业务实现。
- 每个业务域通过独立 class 暴露稳定接口。
- 所有实际发送给 AI 的 system 提示词必须登记在 `WorldPromptRegistry`，并在“提示词预设”页面可见、可编辑、可保存到预设文档。
- UI、领域逻辑、MVU 写回、提示词配置分离。
- 迁移期间保持单文件交付和现有存档兼容。

## 当前类

- `WorldEngineServiceContainer`：服务容器。
- `WorldMutationService`：世界推进变量的原子写回与 replay 合并入口。
- `WorldEventService`：事件修正、重命名、删除。
- `WorldPersonActivityService`：只管理 `世界.后台.人物` 活动记录。
- `WorldPromptRegistry`：所有实际 system 提示词的唯一注册表。

后续继续把历史、探索/势力、传闻、请求编译、世界书读取与 UI 控制器迁成同样的领域类。
