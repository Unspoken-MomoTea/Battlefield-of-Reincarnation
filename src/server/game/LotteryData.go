package game

import (
	"fmt"
	"github.com/liangdas/mqant/log"
	"server/common"
	"server/redisClient"
)

//抽奖数据
type LotteryData struct {
	FreeTimes    int   //免费次数
	AdTimes      int   //广告次数
	userData     *UserData
}

//创建抽奖数据
func NewLotteryData(userData *UserData) *LotteryData {
	data := &LotteryData{}
	data.userData = userData
	data.initData()
	return data
}

func (this *LotteryData) initData() {
	this.FreeTimes = common.MiscMgr.GetMiscDataBy("lotteryFree").ValueToInt()
	this.AdTimes = common.MiscMgr.GetMiscDataBy("lotteryAd").ValueToInt()
}

func (this *LotteryData) loadFromDB() bool {
	err := redisClient.HGetall(fmt.Sprintf("lotteryData:%d", this.userData.Id), this)
	if (err != nil) {
		log.Error("[LotteryData Load] Load LotteryData data from db Error:%v", err.Error())
		return false
	}

	return true
}

//重置次数
func (this *LotteryData) ResetTimes() {
	freeTimes := common.MiscMgr.GetMiscDataBy("lotteryFree").ValueToInt()
	adTimes := common.MiscMgr.GetMiscDataBy("lotteryAd").ValueToInt()
	this.SetFreeTimes(freeTimes)
	this.SetFreeTimes(adTimes)
}

//设置免费次数
func (this *LotteryData) SetFreeTimes(v int) {
	this.FreeTimes = v
	this.SaveByKey("FreeTimes", v)
}

//是否可以抽奖
func (this *LotteryData) StartLottery() (errorCode int) {
	if (this.FreeTimes > 0) {
		this.SetFreeTimes(this.FreeTimes - 1)
		return 0
	}
	if (this.AdTimes > 0) {
		this.SetAdTimes(this.AdTimes - 1)
		return 0
	}
	return 9
}

//设置广告次数
func (this *LotteryData) SetAdTimes(v int) {
	this.AdTimes = v
	this.SaveByKey("AdTimes", v)
}

//所有属性保存到数据库
func (this *LotteryData) SaveAll() {
	e := redisClient.HMSet(fmt.Sprintf("lotteryData:%d", this.userData.Id), this)
	if (e != nil) {
		log.Error("[GameDataManager SaveUserDataToDB] Error:%v", e.Error())
	}
}

//保存单条数据
func (this *LotteryData) SaveByKey(key string, val interface{}) {
	e := redisClient.HSet(fmt.Sprintf("user:%d", this.userData.Id), key, fmt.Sprintf("%v", val))
	if (e != nil) {
		log.Error("[GameDataManager SaveByKey] Error:%v", e.Error())
	}
}
