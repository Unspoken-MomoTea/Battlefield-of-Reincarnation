package gameLevel

import (
	"github.com/liangdas/mqant/utils"
)

type GameLevelDataManager struct {
	GameLevelUsers *utils.BeeMap //玩家关卡数据列表,map[int64][]*GameLevelData
}

func NewGameLevelDataManager() *GameLevelDataManager {
	manager := &GameLevelDataManager{}
	manager.initData()
	return manager
}

func (this *GameLevelDataManager) initData() {
	this.GameLevelUsers = utils.NewBeeMap()
}

//玩家登录
func (this *GameLevelDataManager) OnLogin(uid int32) {
	if (uid == 0) {
		return
	}
	obj := this.GameLevelUsers.Get(uid)
	if (obj == nil) {
		GameLevelUser := NewGameLevelUser(uid)
		this.GameLevelUsers.Set(uid, GameLevelUser)
	}
}

//玩家登出
func (this *GameLevelDataManager) OnLogout(uid int32) {
	if (uid == 0) {
		return
	}
	if ok := this.GameLevelUsers.Check(uid); ok {
		this.GameLevelUsers.Delete(uid)
	}
}

// 添加关卡
func (this *GameLevelDataManager) OnUpdateGameLevel(uid int32, chapter int, GameLevelId int, startCount int, state int) (GameLevelData *GameLevelData, errorCode int) {
	GameLevelUser, errorCode := this.GetGameLevelUser(uid)
	if (errorCode == 0) {
		GameLevelData, errorCode = GameLevelUser.UpdateGameLevelCount(chapter, GameLevelId, startCount, state)
	}
	return GameLevelData, errorCode
}

// 获取关卡用户管理
func (this *GameLevelDataManager) GetGameLevelUser(uid int32) (user *GameLevelUser, errorCode int) {
	if ok := this.GameLevelUsers.Check(uid); ok {
		return this.GameLevelUsers.Get(uid).(*GameLevelUser), 0
	}
	return nil, 1
}
