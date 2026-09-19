package common

import (
)

const (
	CREATE       = 1 	// 新建
	LOGIN        = 2 	// 登陆
	LOGOUT       = 3 	// 登出
	ONLINE       = 4 	// 在线
	FIGHT        = 5 	// 战斗统计
	CARDS        = 6 	// 卡牌统计
	BOXS         = 7 	// 宝箱统计
	CARDSUPGRAGE = 8 	// 卡牌升级
	CARDDATA     = 9 	// 卡牌数据
	GONGXUN		 = 10	// 功勋
	LEVEL		 = 11	// 等级
	USERCARD	 = 12	// 用户卡牌
	CRYSTAL 	 = 13 	// 钻石消耗
	GOLD 		 = 14 	//
	LEGION		 = 15 	// 军团
	CITY 		 = 16 	// 国战
	SHARE		 = 17 	// 分享
	ADVERTISING	 = 18	// 广告
	NEWBIE		 = 19	// 新手引导
	FIGHTSTART	 = 20	// 战斗开始
	OTHERGAME 	 = 21 	// 其他游戏
	INVITE 		 = 22 	// 邀请
	AD_SUCCESS   = 23 	// 广告
)

const (
	ACCOUNT_CREATE 		= 1		// 帐号相关
	ACCOUNT_LOGIN  		= 2		// 帐号登陆
	ACCOUNT_LOGOUT 		= 3		// 帐号登出
	ACCOUNT_ONLINE 		= 4		// 帐号在线
	BOX            		= 5		// 帐号在线
	CRYSTAL_RECORD 		= 6		// 钻石消耗
	GOLD_RECORD			= 7		// 金币
	LEGION_RECORD   	= 8		// 军团
	CITY_RECORD 		= 9		// 国战
	FIGHT_RECORD 		= 10
	SHARE_RECORD		= 11 	// 分享
	ADVERTISING_RECORD	= 12	// 广告
	NEWBIE_RECORD		= 13	// 新手引导
	START_RECORD		= 14	// 战斗开始
	CARD_RECORD 		= 15
	CARD_UPGRADE 		= 16
	BOX_RECORD 			= 17
	CARD_DATA 			= 18
	GONXUN_RECORD 		= 19
	LEVEL_RECORD 		= 20
	USECARD_RECORD 		= 21
	OTHER_RECORD 		= 22
	INVITE_RECORD 		= 23
	AD_SUCCESS_RECORD   = 24
)

const (
	LEGION_CREATE 			= 1 // 创建
	LEGION_DESTORY 			= 2	// 解散
	LEGION_JION 			= 3 // 加入
	LEGION_EXIT 			= 4 // 退出
	LEGION_KICKOUT 			= 5 // 踢人
	LEGION_UPGRADE 			= 6 // 升级
	LEGION_OFFICICAL 		= 7 // 职位
	LEGION_JIONHONOR 		= 8 // 限制
	LEGION_ASKGIFT 			= 9 // 请求
	LEGION_SEDNGIFT 		= 10 // 赠送
)

const (
	CITY_DECLARD 	= 1 // 宣战
	CITY_ATTACK 	= 2 //
	CITY_DEFENSER 	= 3 //
	CITY_SETTLEMENT = 4 //
	CITY_REWARD 	= 5 //
	CITY_FIGHT		= 6
)

var LoggerTables = map[int32]string{
	ACCOUNT_CREATE: "CREATE TABLE IF NOT EXISTS account_create (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '日志自增ID'," +
		"uid BIGINT(20) NOT NULL DEFAULT 0 COMMENT '用户ID'," +
		"platformId BIGINT(20) NOT NULL DEFAULT 0 COMMENT '渠道ID'," +
		"userName VARCHAR(64) NOT NULL COMMENT '昵称'," +
		"createTime BIGINT(20) NOT NULL DEFAULT 0 COMMENT '创建时间'," +
		"PRIMARY KEY(Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	ACCOUNT_LOGIN: "CREATE TABLE IF NOT EXISTS account_login (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '日志自增ID'," +
		"uid BIGINT(20) NOT NULL DEFAULT 0 COMMENT '用户ID'," +
		"userName VARCHAR(64) NOT NULL COMMENT '昵称'," +
		"loginTime BIGINT(20) NOT NULL DEFAULT 0 COMMENT '登入时间'," +
		"PRIMARY KEY(Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	ACCOUNT_LOGOUT: "CREATE TABLE IF NOT EXISTS account_logout (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '日志自增ID'," +
		"uid BIGINT(20) NOT NULL DEFAULT 0 COMMENT '用户ID'," +
		"userName VARCHAR(64) NOT NULL DEFAULT 0 COMMENT '昵称'," +
		"logoutTime BIGINT(20) NOT NULL DEFAULT 0 COMMENT '登出时间'," +
		"PRIMARY KEY(Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	ACCOUNT_ONLINE: "CREATE TABLE IF NOT EXISTS account_online (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '日志自增ID'," +
		"online BIGINT(20) NOT NULL DEFAULT 0 COMMENT '在线数'," +
		"logTime BIGINT(20) NOT NULL DEFAULT 0 COMMENT '日志时间'," +
		"PRIMARY KEY(Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	CRYSTAL_RECORD : "CREATE TABLE IF NOT EXISTS crystal (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '日志自增ID'," +
		"uid BIGINT(20) NOT NULL DEFAULT 0 COMMENT '用户ID'," +
		"cost INT(10) NOT NULL DEFAULT 0 COMMENT '数量'," +
		"final INT(10) NOT NULL DEFAULT 0 COMMENT '余额'," +
		"behavior INT(10) NOT NULL DEFAULT 0 COMMENT '行为'," +
		"rtimestamp BIGINT(20) NOT NULL DEFAULT 0 COMMENT '日志时间'," +
		"PRIMARY KEY(Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	GOLD_RECORD : "CREATE TABLE IF NOT EXISTS gold (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '日志自增ID'," +
		"uid BIGINT(20) NOT NULL DEFAULT 0 COMMENT '用户ID'," +
		"cost INT(10) NOT NULL DEFAULT 0 COMMENT '数量'," +
		"final INT(10) NOT NULL DEFAULT 0 COMMENT '余额'," +
		"behavior INT(10) NOT NULL DEFAULT 0 COMMENT '行为'," +
		"rtimestamp BIGINT(20) NOT NULL DEFAULT 0 COMMENT '日志时间'," +
		"PRIMARY KEY(Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	LEGION_RECORD : "CREATE TABLE IF NOT EXISTS legion (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '日志自增ID'," +
		"uid BIGINT(20) NOT NULL DEFAULT 0 COMMENT '用户ID'," +
		"legion BIGINT(20) NOT NULL DEFAULT 0 COMMENT '军团ID'," +
		"extend1 INT(10) NOT NULL DEFAULT 0 COMMENT '扩展字段'," +
		"extend2 INT(10) NOT NULL DEFAULT 0 COMMENT '扩展字段'," +
		"behavior INT(10) NOT NULL DEFAULT 0 COMMENT '行为: 1=创建|2=解散|3=加入|4=踢人|5=升级|6=职位'," +
		"rtimestamp BIGINT(20) NOT NULL DEFAULT 0 COMMENT '记录时间'," +
		"PRIMARY KEY(Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	CITY_RECORD : "CREATE TABLE IF NOT EXISTS city (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '日志自增ID'," +
		"uid BIGINT(20) NOT NULL DEFAULT 0 COMMENT '用户ID'," +
		"legion BIGINT(20) NOT NULL DEFAULT 0 COMMENT '军团ID'," +
		"city INT(10) NOT NULL DEFAULT 0 COMMENT '城池ID'," +
		"extend1 INT(10) NOT NULL DEFAULT 0 COMMENT '扩展字段'," +
		"extend2 INT(10) NOT NULL DEFAULT 0 COMMENT '扩展字段'," +
		"behavior INT(10) NOT NULL DEFAULT 0 COMMENT '行为: 1=宣战|2=进攻|3=防守|4=结算|5=领奖|6=战斗'," +
		"rtimestamp BIGINT(20) NOT NULL DEFAULT 0 COMMENT '记录时间'," +
		"PRIMARY KEY(Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	FIGHT_RECORD : "CREATE TABLE IF NOT EXISTS fight (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '日志自增ID'," +
		"uid BIGINT(20) NOT NULL COMMENT '用户ID'," +
		"userName VARCHAR(64) NOT NULL COMMENT '昵称'," +
		"logTime BIGINT(20) NOT NULL DEFAULT 0 COMMENT '记录时间'," +
		"winType INT(10) NOT NULL DEFAULT 0 COMMENT '胜负类型：1胜, 2负, 0平局'," +
		"fightType INT(10) NOT NULL DEFAULT 0 COMMENT '匹配模式：1:匹配模式场次; 2:邀请模式场次; 3:段位模式场次'," +
		"fightTime INT(10) NOT NULL DEFAULT 0 COMMENT '战斗时长'," +
		"PRIMARY KEY(Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	SHARE_RECORD : "CREATE TABLE IF NOT EXISTS share (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '日志自增ID'," +
		"uid BIGINT(20) NOT NULL COMMENT '用户ID'," +
		"userName VARCHAR(64) NOT NULL COMMENT '昵称'," +
		"shareType INT(10) NOT NULL DEFAULT 0 COMMENT '分享类型: 1=开箱,2=国战,3=排行分享,4=成就分享,5=结算分享'," +
		"shareStatus INT(10) NOT NULL DEFAULT 0 COMMENT '分享结果: 0=分享成功,1=分享成功'," +
		"logTime BIGINT(20) NOT NULL DEFAULT 0 COMMENT '记录时间'," +
		"PRIMARY KEY(Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	ADVERTISING_RECORD : "CREATE TABLE IF NOT EXISTS advertising (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '日志自增ID'," +
		"uid BIGINT(20) NOT NULL COMMENT '用户ID'," +
		"userName VARCHAR(64) NOT NULL COMMENT '昵称'," +
		"gongXun BIGINT(20) NOT NULL COMMENT '用户功勋'," +
		"advertisingType INT(10) NOT NULL DEFAULT 0 COMMENT '广告来源类型: 1=对战结算,2=宝箱减少时间,3=升级宝箱品质,4=大厅免费钻石,5=商场水晶抽卡,6=广告增加分享抽奖次数,7=战斗匹配广告'," +
		"logTime BIGINT(20) NOT NULL DEFAULT 0 COMMENT '记录时间'," +
		"PRIMARY KEY(Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	NEWBIE_RECORD :	"CREATE TABLE IF NOT EXISTS newbie (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '日志自增ID'," +
		"uid BIGINT(20) NOT NULL COMMENT '用户ID'," +
		"userName VARCHAR(64) NOT NULL COMMENT '昵称'," +
		"NewBieId INT(10) NOT NULL DEFAULT 0 COMMENT '新手引导id: 1第一场战斗,2开宝箱,3=第二场战斗,4=卡牌升级,5=第三场战斗'," +
		"littleBieId INT(10) NOT NULL DEFAULT 0 COMMENT '新手引导小步骤id'," +
		"iNewbie INT(10) NOT NULL DEFAULT 0 COMMENT '引导大步+小步'," +
		"logTime BIGINT(20) NOT NULL DEFAULT 0 COMMENT '记录时间'," +
		"PRIMARY KEY(Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	START_RECORD : "CREATE TABLE IF NOT EXISTS fight_start (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '日志自增ID'," +
		"uid BIGINT(20) NOT NULL COMMENT '用户ID'," +
		"logTime BIGINT(20) NOT NULL DEFAULT 0 COMMENT '记录时间'," +
		"PRIMARY KEY(Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	CARD_RECORD : "CREATE TABLE IF NOT EXISTS card (" +
		"Id BIGINT(20) NOT NULL AUTO_INCREMENT," +
		"uid BIGINT(20) NOT NULL DEFAULT 0," +
		"logTime BIGINT(20) NOT NULL DEFAULT 0," +
		"cardType INT(10) NOT NULL DEFAULT 0 COMMENT '卡牌类型'," +
		"cardID INT(10) NOT NULL DEFAULT 0," +
		"PRIMARY KEY (Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	CARD_UPGRADE : "CREATE TABLE IF NOT EXISTS cardUpgrade (" +
		"Id bigint(20) NOT NULL AUTO_INCREMENT," +
		"uid bigint(20) NOT NULL DEFAULT 0," +
		"userName varchar(64) NOT NULL," +
		"logTime bigint(20) NOT NULL DEFAULT 0," +
		"cardID int(10) NOT NULL COMMENT '卡牌ID'," +
		"cardLevel int(10) NOT NULL COMMENT '卡牌等级'," +
		"PRIMARY KEY (Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	BOX_RECORD : "CREATE TABLE IF NOT EXISTS box (" +
		"Id bigint(20) NOT NULL AUTO_INCREMENT," +
		"uid bigint(20) NOT NULL DEFAULT 0," +
		"userName varchar(64) NOT NULL," +
		"logTime bigint(20) NOT NULL DEFAULT 0," +
		"boxID int(10) NOT NULL DEFAULT 0 COMMENT '卡牌ID'," +
		"boxType int(10) NOT NULL DEFAULT 0 COMMENT '卡牌等级'," +
		"PRIMARY KEY (Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	CARD_DATA : "CREATE TABLE IF NOT EXISTS cardData (" +
		"cardID bigint(20) NOT NULL DEFAULT 0," +
		"name varchar(64) NOT NULL DEFAULT 0," +
		"PRIMARY KEY (cardID)" +
		") ENGINE=InnoDB DEFAULT CHARSET=utf8",
	GONXUN_RECORD : "CREATE TABLE IF NOT EXISTS gongXun (" +
		"Id bigint(20) NOT NULL AUTO_INCREMENT," +
		"uid bigint(20) NOT NULL DEFAULT 0," +
		"userName varchar(64) NOT NULL," +
		"logTime bigint(20) NOT NULL DEFAULT 0," +
		"PRIMARY KEY (Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	LEVEL_RECORD : "CREATE TABLE IF NOT EXISTS level (" +
		"Id bigint(20) NOT NULL AUTO_INCREMENT," +
		"uid bigint(20) NOT NULL DEFAULT 0," +
		"userName varchar(64) NOT NULL," +
		"logTime bigint(20) NOT NULL DEFAULT 0," +
		"level int(10) NOT NULL DEFAULT 0 COMMENT '等级'," +
		"PRIMARY KEY (Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	USECARD_RECORD : "CREATE TABLE IF NOT EXISTS useCard (" +
		"Id bigint(20) NOT NULL AUTO_INCREMENT," +
		"uid bigint(20) NOT NULL DEFAULT 0," +
		"userName varchar(64) NOT NULL," +
		"logTime bigint(20) NOT NULL DEFAULT 0," +
		"cardID int(10) NOT NULL DEFAULT 0 COMMENT '卡牌ID'," +
		"gongXun int(10) NOT NULL DEFAULT 0 COMMENT '卡牌ID'," +
		"PRIMARY KEY (Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	OTHER_RECORD : "CREATE TABLE IF NOT EXISTS other_game (" +
		"Id bigint(20) NOT NULL AUTO_INCREMENT," +
		"uid bigint(20) NOT NULL DEFAULT 0," +
		"logTime bigint(20) NOT NULL DEFAULT 0," +
		"gameID varchar(64) NOT NULL COMMENT '游戏ID'," +
		"PRIMARY KEY (Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	INVITE_RECORD : "CREATE TABLE IF NOT EXISTS invited (" +
		"Id bigint(20) NOT NULL AUTO_INCREMENT," +
		"uid bigint(20) NOT NULL DEFAULT 0 COMMENT '邀请者'," +
		"targetUid bigint(20) NOT NULL DEFAULT 0 COMMENT '被邀者'," +
		"logTime bigint(20) NOT NULL DEFAULT 0 COMMENT '日志时间'," +
		"PRIMARY KEY (Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
	AD_SUCCESS_RECORD : "CREATE TABLE IF NOT EXISTS ad_success (" +
		"Id bigint(20) NOT NULL AUTO_INCREMENT," +
		"uid bigint(20) NOT NULL DEFAULT 0 COMMENT '玩家ID'," +
		"iWhere bigint(20) NOT NULL DEFAULT 0 COMMENT '途径'," +
		"logTime bigint(20) NOT NULL DEFAULT 0 COMMENT '日志时间'," +
		"PRIMARY KEY (Id)" +
		") ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8",
}

var LoggerFormat = map[int32] string{
	CREATE:       	"INSERT INTO account_create(uid, platformId, userName, createTime) VALUES (%d, %d, '%s', %d)",
	LOGIN:        	"INSERT INTO account_login(uid, userName, loginTime) VALUES (%d, '%s', %d)",
	LOGOUT:       	"INSERT INTO account_logout(uid, userName, logoutTime) VALUES (%d, '%s', %d)",
	ONLINE:       	"INSERT INTO account_online(online, logTime) VALUES (%d, %d)",
	FIGHT:        	"INSERT INTO fight(uid, userName, logTime, winType, fightType, fightTime) VALUES (%d, '%s', %d, %d, %d, %d)",
	CARDS:        	"INSERT INTO card(uid, logTime, cardType, cardID) VALUES (%d, %d, %d, %d)",
	BOXS:         	"INSERT INTO box(uid, userName, logTime, boxID, boxType) VALUES (%d, '%s', %d, %d, %d)",
	CARDSUPGRAGE: 	"INSERT INTO cardUpgrade(uid, userName, logTime, cardID, cardLevel) VALUES (%d, '%s', %d, %d, %d)",
	CARDDATA: 		"INSERT INTO cardData(cardID, name) VALUES (%d, '%s') ON DUPLICATE KEY UPDATE name='%s'",
	GONGXUN:		"INSERT INTO gongXun(uid, userName, gongXun, logTime) VALUES (%d, '%s', %d, %d)",
	LEVEL:			"INSERT INTO level(uid, userName, logTime, level) VALUES (%d, '%s', %d, %d)",
	USERCARD:	 	"INSERT INTO useCard(uid, userName, logTime, cardID, gongXun) VALUES (%d, '%s', %d, %d, %d)",
	CRYSTAL: 		"INSERT INTO crystal(uid, cost, final, behavior, rtimestamp) VALUES (%d, %d, %d, %d, %d)",
	GOLD: 			"INSERT INTO gold(uid, cost, final, behavior, rtimestamp) VALUES (%d, %d, %d, %d, %d)",
	LEGION: 		"INSERT INTO legion(uid, legion, extend1, extend2, behavior, rtimestamp) VALUES (%d, %d, %d, %d, %d, %d)",
	CITY: 			"INSERT INTO city(uid, legion, city, extend1, extend2, behavior, rtimestamp) VALUES (%d, %d, %d, %d, %d, %d, %d)",
	SHARE:		 	"INSERT INTO share(uid, userName, shareType, shareStatus,logTime) VALUES (%d, '%s', %d, %d, %d)",
	ADVERTISING:	"INSERT INTO advertising(uid, userName, gongXun, advertisingType, logTime) VALUES (%d, '%s', %d, %d, %d)",
	NEWBIE:			"INSERT INTO newbie(uid, userName, NewBieId, littleBieId, iNewbie, logTime) VALUES (%d, '%s', %d, %d, %d, %d)",
	FIGHTSTART:		"INSERT INTO fight_start(uid, logTime) VALUES (%d, %d)",
	OTHERGAME:		"INSERT INTO other_game(uid, gameID, logTime) VALUES (%d, %s, %d)",
	INVITE: 		"INSERT INTO invited(uid, targetUid, logTime) VALUES (%v, %v, %v)",
	AD_SUCCESS:		"INSERT INTO ad_success(uid, iWhere, logTime) VALUES (%v, %v, %v)",
}

func As(logType int32, args ...interface{}) {
	//if format, fOk := LoggerFormat[logType]; fOk {
	//	loggerText := fmt.Sprintf(format, args...)
	//	global.App.RpcInvokeNR(define.SERVER_LOGGER, messageType.RPC_USER_ACTION.MessageName, loggerText)
	//}
}
