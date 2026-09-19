package define

const VERSION = 1 //服务器版本号
const TIME_FORMAT = "2006-01-02 15:04:05"

var WcQuery string = ""

//玩家权限
const (
	USER_POWER_NORMAL    = 0   //普通
	USER_POWER_DEL       = 1   //删号
	USER_POWER_NO_LOGION = 2   //禁止登录
	USER_POWER_NO_CHAT   = 3   //禁言
	USER_POWER_GM        = 999 //GM
)

const (
	PLATFORM_NONE   = 0 //无平台
	PLATFORM_WECHAT = 1 //微信平台
	PLATFORM_QQ     = 2 //qq小游戏平台
	PLATfORM_OPPO   = 3 //oppo平台
)

//排行榜名称
const (
	RANK_SCENE_LEVEL = "rankSceneLevel" //关卡排行
)
