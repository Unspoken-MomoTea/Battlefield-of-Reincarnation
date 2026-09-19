package event

var (
	ENTER_FRAME string = "enterFrame"
)
//战斗
var (
	USER_OFFLINE       string = "userOffline"    //断线
	USER_LOAD_COMPLETE string = "loadComplete"   // 加载完成
	ROOM_END           string = "roomEnd"        //退出房间
	INIT_CARD_DATA     string = "initCardData"   //初始化卡牌
	ADD_ROLE_TO_SCENE  string = "addRoleToScene" //添加人物到场景
	USE_CARD           string = "useCard"        //使用卡牌
	USE_CARD_AI        string = "useCardAI"      //使用AI卡牌
	TIME_OVER          string = "TimeOver"       //战斗时间结束
	BATTLE_OVER        string = "BattleOver"     //战斗结果出现
	EFFECT_CREATE      string = "EffectCreate"   // 生成特效
	EFFECT_DEATH       string = "EffectDeath"    // 特效消亡
	HURT               string = "hurt"           // 受伤
	DEATH              string = "death"          //死亡
	USE_SKILL          string = "useSkill"       //使用技能
	OVERTIME           string = "overtime"       //加时赛
	GM_KILL_ONE        string = "GmKillOne"      //GM杀掉一方
)
