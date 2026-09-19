package gameLevel

import (
	"fmt"
	"github.com/liangdas/mqant/log"
	"server/redisClient"
)

//关卡用户管理
type GameLevelUser struct {
	uid        int32
	GameLevels []*GameLevelData
}

//初始化GameLevelUser
func NewGameLevelUser(uid int32) *GameLevelUser {
	data := &GameLevelUser{}
	data.uid = uid
	data.init()
	return data
}

func (this *GameLevelUser) init() {
	this.GameLevels = make([]*GameLevelData, 0)
	this.LoadFromDB()
}

//根据关卡id获取关卡数据
func (this *GameLevelUser) GetGameLevelDataBy(GameLevelId int) *GameLevelData {
	for _, GameLevel := range this.GameLevels {
		if (GameLevel.GameLevelId == GameLevelId) {
			return GameLevel
		}
	}
	return nil
}

//更新关卡次数,内部使用
//GameLevelId 关卡id
//startCount 星星数量
//state 状态
func (this *GameLevelUser) UpdateGameLevelCount(chapter int, GameLevelId int, startCount int, state int) (GameLevelData *GameLevelData, errorCode int) {
	GameLevelData = this.GetGameLevelDataBy(GameLevelId)
	if (GameLevelData == nil) {
		GameLevelData = NewGameLevelData(chapter, GameLevelId)
		this.GameLevels = append(this.GameLevels, GameLevelData)
	} else {
		if (GameLevelData.Chapter != chapter) {
			return nil, 15
		}
	}
	GameLevelData.UpdateState(startCount, state)
	this.SaveGameLevelToDB(GameLevelData)
	return GameLevelData, 0
}

func (this *GameLevelUser) GetAllGameLevels() []*GameLevelData {
	return this.GameLevels
}

func (this *GameLevelUser) LoadFromDB() {
	keys, e := redisClient.Keys(fmt.Sprintf("GameLevel:%v:*", this.uid))
	if e == nil && keys != nil && len(keys) > 0 {
		for _, key := range keys {
			GameLevelData := NewGameLevelData(0, 0)
			if e := redisClient.HGetall(key, GameLevelData); e != nil {
				log.Error(e.Error())
				continue
			}
			this.GameLevels = append(this.GameLevels, GameLevelData)
		}
	}
}

//保存GameLevel数据到数据库
func (this *GameLevelUser) SaveGameLevelToDB(GameLevel *GameLevelData) {
	key := fmt.Sprintf("GameLevel:%v:%v", this.uid, GameLevel.GameLevelId)
	if e := redisClient.HMSet(key, GameLevel); e != nil {
		log.Error(e.Error())
	}
}
