import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

export const Schema = z.object({
  章节管理: z.object({
    学年: z.enum(['第一学年', '第二学年', '第三学年']).prefault('第一学年'),
    学期: z.enum(['第一学期', '暑假', '第二学期', '寒假', '第三学期', '春假']).prefault('第一学期')
  }).prefault({}),

  学生证: z.object({
    姓名: z.string().prefault(''),
    性别: z.enum(['男', '女']).prefault('男'),
    生日: z.string().prefault(''),
    年龄: z.coerce.number().transform(v => Math.max(0, v)).prefault(0),
    所属年级: z.string().prefault(''),
    班级: z.enum(['A班', 'B班', 'C班', 'D班', '高年级', '低年级', '校方', '校外人士']).prefault('A班'),
    实际班级: z.string().prefault(''),
    社团: z.string().prefault('无'),
    个人点数: z.coerce.number().transform(v => Math.max(0, v)).prefault(0),
    当前时间: z.string().prefault(''),
    当前地点: z.string().prefault(''),
    能力档案: z.object({
      学力: z.object({
        评级: z.string().prefault(''),
        分数: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0),
        经验值: z.coerce.number().transform(v => Math.max(0, v)).prefault(0)
      }).prefault({}),
      身体能力: z.object({
        评级: z.string().prefault(''),
        分数: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0),
        经验值: z.coerce.number().transform(v => Math.max(0, v)).prefault(0)
      }).prefault({}),
      灵活思考力: z.object({
        评级: z.string().prefault(''),
        分数: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0),
        经验值: z.coerce.number().transform(v => Math.max(0, v)).prefault(0)
      }).prefault({}),
      社会贡献性: z.object({
        评级: z.string().prefault(''),
        分数: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0),
        经验值: z.coerce.number().transform(v => Math.max(0, v)).prefault(0)
      }).prefault({})
    }).prefault({}),
    效果状态: z.record(
      z.string().describe('状态名'),
      z.object({
        类型: z.enum(['增益', '减益', '特殊', '学籍状态', '身份标签', '消费观念']).prefault('特殊'),
        效果: z.string().prefault(''),
        剩余时间: z.string().prefault(''),
        来源: z.string().prefault('')
      }).prefault({})
    ).prefault({})
  }).prefault({}),

  班级终端: z.object({
    班级排名: z.record(
      z.enum(['A班', 'B班', 'C班', 'D班']),
      z.object({
        显示名: z.string().prefault(''),
        领导者: z.string().prefault(''),
        排名: z.string().prefault(''),
        班级点数: z.coerce.number().transform(v => Math.max(0, v)).prefault(0)
      }).prefault({})
    ).prefault({})
  }).prefault({}),

  事件: z.object({
    开启: z.boolean().prefault(false),
    标题: z.string().prefault('无'),
    阶段: z.string().prefault('无'),
    结束: z.boolean().prefault(true),
    信号: z.array(z.string()).prefault([]),
    已完成事件: z.array(z.string()).prefault([])
  }).prefault({}),

  学生系统: z.object({
    男: z.record(
      z.string().describe('NPC名称'),
      z.object({
        班级: z.enum(['A班', 'B班', 'C班', 'D班', '高年级', '低年级', '校方', '校外人士']).prefault('A班'),
        实际班级: z.string().prefault(''),
        在场状态: z.enum(['在场', '不在场']).prefault('不在场'),
        关系: z.string().prefault(''),
        年龄: z.coerce.number().transform(v => Math.max(0, v)).prefault(0),
        社团: z.string().prefault('无'),
        态度: z.enum(['厌恶', '反感', '冷淡', '陌生', '熟识', '友善', '要好', '亲密', '倾心']).prefault('陌生'),
        个人点数: z.coerce.number().transform(v => Math.max(0, v)).prefault(0),
        能力档案: z.object({
          学力: z.object({
            评级: z.string().prefault(''),
            分数: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0)
          }).prefault({}),
          身体能力: z.object({
            评级: z.string().prefault(''),
            分数: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0)
          }).prefault({}),
          灵活思考力: z.object({
            评级: z.string().prefault(''),
            分数: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0)
          }).prefault({}),
          社会贡献性: z.object({
            评级: z.string().prefault(''),
            分数: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0)
          }).prefault({})
        }).prefault({}),
        外观特征: z.object({
          身高: z.string().prefault(''),
          体型: z.string().prefault(''),
          发色: z.string().prefault(''),
          发型: z.string().prefault(''),
          瞳色: z.string().prefault('')
        }).prefault({}),
        当前服装: z.object({
          上装: z.string().prefault(''),
          下装: z.string().prefault(''),
          鞋子: z.string().prefault(''),
          配饰: z.string().prefault('')
        }).prefault({}),
        效果状态: z.record(
          z.string().describe('状态名'),
          z.object({
            类型: z.enum(['增益', '减益', '特殊', '学籍状态', '身份标签', '消费观念']).prefault('特殊'),
            效果: z.string().prefault(''),
            剩余时间: z.string().prefault(''),
            来源: z.string().prefault('')
          }).prefault({})
        ).prefault({}),
        互动记录: z.object({
          难忘事件: z.record(
            z.string().describe('事件简述'),
            z.string().describe('详细内容')
          ).prefault({}),
          最近互动: z.string().prefault('')
        }).prefault({})
      }).prefault({})
    ).prefault({}),

    女: z.record(
      z.string().describe('NPC名称'),
      z.object({
        班级: z.enum(['A班', 'B班', 'C班', 'D班', '高年级', '低年级', '校方', '校外人士']).prefault('A班'),
        实际班级: z.string().prefault(''),
        在场状态: z.enum(['在场', '不在场']).prefault('不在场'),
        关系: z.string().prefault(''),
        年龄: z.coerce.number().transform(v => Math.max(0, v)).prefault(0),
        社团: z.string().prefault('无'),
        态度: z.enum(['厌恶', '反感', '冷淡', '陌生', '熟识', '友善', '要好', '亲密', '倾心']).prefault('陌生'),
        个人点数: z.coerce.number().transform(v => Math.max(0, v)).prefault(0),
        能力档案: z.object({
          学力: z.object({
            评级: z.string().prefault(''),
            分数: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0)
          }).prefault({}),
          身体能力: z.object({
            评级: z.string().prefault(''),
            分数: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0)
          }).prefault({}),
          灵活思考力: z.object({
            评级: z.string().prefault(''),
            分数: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0)
          }).prefault({}),
          社会贡献性: z.object({
            评级: z.string().prefault(''),
            分数: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0)
          }).prefault({})
        }).prefault({}),
        外观特征: z.object({
          身高: z.string().prefault(''),
          体型: z.string().prefault(''),
          发色: z.string().prefault(''),
          发型: z.string().prefault(''),
          瞳色: z.string().prefault('')
        }).prefault({}),
        当前服装: z.object({
          上装: z.string().prefault(''),
          下装: z.string().prefault(''),
          内衣: z.string().prefault(''),
          内裤: z.string().prefault(''),
          袜子: z.string().prefault(''),
          鞋子: z.string().prefault(''),
          配饰: z.string().prefault('')
        }).prefault({}),
        效果状态: z.record(
          z.string().describe('状态名'),
          z.object({
            类型: z.enum(['增益', '减益', '特殊', '学籍状态', '身份标签', '消费观念']).prefault('特殊'),
            效果: z.string().prefault(''),
            剩余时间: z.string().prefault(''),
            来源: z.string().prefault('')
          }).prefault({})
        ).prefault({}),
        性经验: z.object({
          处女: z.boolean().prefault(true),
          性交次数: z.coerce.number().transform(v => Math.max(0, v)).prefault(0),
          性伴侣数: z.coerce.number().transform(v => Math.max(0, v)).prefault(0),
          初次对象: z.string().prefault(''),
          口交经验: z.string().prefault(''),
          后庭经验: z.string().prefault(''),
          性交经验: z.string().prefault(''),
          性癖好: z.record(
            z.string().describe('癖好名称'),
            z.string().describe('发现过程或表现')
          ).prefault({})
        }).prefault({}),
        生理状态: z.object({
          阴道润滑: z.string().prefault(''),
          乳头状态: z.string().prefault(''),
          阴蒂状态: z.string().prefault(''),
          子宫状态: z.string().prefault('')
        }).prefault({}),
        互动记录: z.object({
          难忘事件: z.record(
            z.string().describe('事件简述'),
            z.string().describe('详细内容')
          ).prefault({}),
          最近互动: z.string().prefault('')
        }).prefault({})
      }).prefault({})
    ).prefault({}),
  }).prefault({}),

  角色档案名单: z.object({
    同届A班: z.array(z.string()).prefault([]),
    同届B班: z.array(z.string()).prefault([]),
    同届C班: z.array(z.string()).prefault([]),
    同届D班: z.array(z.string()).prefault([]),
    高年级: z.array(z.string()).prefault([]),
    低年级: z.array(z.string()).prefault([]),
    校方: z.array(z.string()).prefault([]),
    校外人士: z.array(z.string()).prefault([])
  }).prefault({}),

  日历: z.record(
    z.enum(['临时', '重复']),
    z.record(
      z.string().describe('事件ID'),
      z.object({
        标题: z.string().prefault(''),
        内容: z.string().prefault(''),
        时间: z.string().optional(),
        结束时间: z.string().optional(),
        重复规则: z.enum(['无', '每天', '每周', '每月', '每年', '仅工作日', '仅节假日']).prefault('无'),
        完成后: z.enum(['自动清理']).optional(),
        重要度: z.enum(['普通', '重要']).optional()
      }).prefault({})
    ).prefault({})
  ).prefault({ 临时: {}, 重复: {} })
});

$(() => {
  registerMvuSchema(Schema);
});
