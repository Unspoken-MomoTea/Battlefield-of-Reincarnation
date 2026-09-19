package game

import (
	"fmt"
	"github.com/liangdas/mqant/log"
	"server/define"
	"server/redisClient"
	"time"
)

type UserData struct {
	Id                     int32
	Name                   string
	AvatarUrl              string            //头像
	Account                string            //登陆账号
	Gold                   int32             //金币
	Level                  int32             //等级
	SceneLevel             int32             //关卡
	SceneLevelPass         int32             //已经通关的关卡id
	HuDunCount             int32             //护盾数量
	SessionKey             string            //wechat sessionKey
	PlatformId             int32             //平台ID
	RegisterTime           int64             //注册时间
	LoginTime              int64             //最后登陆时间
	Energy                 int               //体力
	LastRecoveryEnergyTime int64             //最后回复体力的时间
	NextResetTime          int64             //下次重置数据的时间
	IsFavorite             int               //是否收藏了
	lotteryData            *LotteryData      //转盘数据
	adDataCtrl             *AdDataControl    //广告数据
	clientCustomData       map[string]string //客户端自定义存储数据
}

func NewUserData(id int32, account string) *UserData {
	userData := &UserData{
		Id:                     id,
		Name:                   "未授权",
		AvatarUrl:              "未授权",
		Account:                account,
		Gold:                   0,
		Level:                  0,
		SceneLevel:             0,
		RegisterTime:           time.Now().Unix(),
		LoginTime:              time.Now().Unix(),
		LastRecoveryEnergyTime: 0,
		NextResetTime:          NextZeroTime,
		IsFavorite:             0,
		clientCustomData:       make(map[string]string),
	}
	userData.init()
	return userData
}

//第一次创建角色的会到这里,已经创建过角色的会走Load()函数
func (this *UserData) init() {
	this.lotteryData = NewLotteryData(this)
	this.adDataCtrl = NewAdDataControl(this)
}

//读取数据
//已经创建过的角色会走这里
func (this *UserData) Load() bool {
	log.Debug("%v:Load", this.Id)
	err := redisClient.HGetall(fmt.Sprintf("user:%d", this.Id), this)
	if (err != nil) {
		log.Error("[GameDataManager Load] Load user data from db Error:%v", err.Error())
		return false
	}

	this.lotteryData.loadFromDB()
	this.adDataCtrl.LoadFromDB()

	if (time.Now().Unix() >= this.NextResetTime) {
		this.OnReset()
	}
	return true
}

//重置
func (this *UserData) OnReset() {
	this.NextResetTime = NextZeroTime
	this.lotteryData.ResetTimes()
}

//更新体力回复
func (this *UserData) onUpdateEnergyRecovery(energyData *EnergyData) {
	if (this.Energy >= energyData.maxCount) {
		log.Debug("%v:energy recovery is count max", this.Id)
		return //已经到达上限值,不回复
	}

	times, lastSecond, ok := energyData.checkRecoveryTime(this.LastRecoveryEnergyTime)
	if (!ok) {
		log.Debug("%v:energy recovery had no times up", this.Id)
		return //时间未到,不回复
	}
	lastSecond = time.Now().Unix() - lastSecond
	times += this.Energy //到这里可以肯定体力值是小于最大体力值的,随意可以大胆简单的加上去,然后下面再进行越界判断
	if (times >= energyData.maxCount) {
		times = energyData.maxCount
		lastSecond = time.Now().Unix()
	}
	this.SetEnergy(times)
	this.SetLastRecoveryTime(lastSecond)
}

//看广告成功
func (this *UserData) onAdSuccess(energyData *EnergyData) {
	log.Debug("%v:AD success", this.Id)
	this.AddEnergy(energyData.adRecoveryCount)
}

//使用体力
//return true:使用成功,false:使用失败
func (this *UserData) useEnergy(energyData *EnergyData) int {
	if (this.Energy > 0) {
		if (this.Energy >= energyData.maxCount) {
			this.SetLastRecoveryTime(time.Now().Unix())
		}
		this.SetEnergy(this.Energy - 1)
		log.Debug("%v:use energy success,energy:", this.Id, this.Energy)
		this.onUpdateEnergyRecovery(energyData)
		return 0
	}
	this.onUpdateEnergyRecovery(energyData)
	log.Debug("%v:use energy fail,energy:", this.Id, this.Energy)
	return 8
}

//获取体力回复cd时间
func (this *UserData) getEnergyRecoveryCdTime(energyData *EnergyData) int {
	if (this.Energy >= energyData.maxCount) {
		return 0
	}
	deltaTime := time.Now().Unix() - this.LastRecoveryEnergyTime
	cd := energyData.recoveryTime - int(deltaTime)
	log.Debug("%v:getEnergyRecoveryCdTime: lastTime:%v,currentTime:%v,deltaTime:%v,recoveryConfTime:%v,cdTime:%v",
		this.Id, this.LastRecoveryEnergyTime, time.Now().Unix(), deltaTime, energyData.recoveryTime, cd)
	if (cd < 0) {
		cd = 0
	}
	return cd
}

//设置等级
func (this *UserData) SetLevel(value int32) {
	this.Level = value
	this.SaveByKey("Level", value)
}

//设置当前关卡id
func (this *UserData) SetSceneLevel(value int32) {
	this.SceneLevel = value
	this.SaveByKey("SceneLevel", value)
	redisClient.Zadd(define.RANK_SCENE_LEVEL, fmt.Sprintf("%v", value), this.IdToString())
}

//添加自定义排行
func (this *UserData) AddCustomRank(rankType string,value string) {
	redisClient.Zadd(rankType, value, this.IdToString())
}
//设置通关关卡id
func (this *UserData) SetSceneLevelPass(value int32) {
	this.SceneLevelPass = value
	this.SaveByKey("SceneLevelPass", value)
}

//设置金币
func (this *UserData) SetGold(value int32) {
	this.Gold = value
	this.SaveByKey("Gold", value)
}

//设置名字
func (this *UserData) SetName(value string) {
	this.Name = value
	this.SaveByKey("Name", value)
}

//设置名字
func (this *UserData) SetAvatarUrl(value string) {
	this.AvatarUrl = value
	this.SaveByKey("AvatarUrl", value)
}

//设置金币
func (this *UserData) SetIsFavorite(value int) {
	this.IsFavorite = value
	this.SaveByKey("IsFavorite", value)
}

//设置护盾值
func (this *UserData) SetHuDun(value int32) {
	this.HuDunCount = value
	this.SaveByKey("HuDunCount", value)
}

//设置体力
func (this *UserData) SetEnergy(value int) {
	this.Energy = value
	log.Debug("%v:set energy delta value:%v,current value:%v", this.Id, value, this.Energy)
	this.SaveByKey("Energy", value)
}

//添加体力
func (this *UserData) AddEnergy(value int) {
	this.SetEnergy(this.Energy + value)
}

//物品奖励
func (this *UserData) SetRewardByItem(itemData IItemData) {
	switch itemData.GetId() {
	case 100:
		this.AddEnergy(itemData.GetNum())
	}
}

//设置体力回复时间
func (this *UserData) SetLastRecoveryTime(value int64) {
	this.LastRecoveryEnergyTime = value
	log.Debug("%v:Set Last RecoveryTime delta value:%v,current value:%v", this.Id, value, this.LastRecoveryEnergyTime)
	this.SaveByKey("LastRecoveryEnergyTime", value)
}

//根据账号从数据库加载数据
func (this *UserData) SaveUserDataToDB() {
	e := redisClient.HMSet(fmt.Sprintf("user:%d", this.Id), this)
	if (e != nil) {
		log.Error("[GameDataManager SaveUserDataToDB] Error:%v", e.Error())
	}
	this.lotteryData.SaveAll()
}

//保存单条数据
func (this *UserData) SaveByKey(key string, val interface{}) {
	e := redisClient.HSet(fmt.Sprintf("user:%d", this.Id), key, fmt.Sprintf("%v", val))
	if (e != nil) {
		log.Error("[GameDataManager SaveByKey] Error:%v", e.Error())
	}
}

//保存自定义数据
func (this *UserData) SaveCustomData(key string, val string) {
	this.clientCustomData[key] = val
	e := redisClient.HSet(fmt.Sprintf("custom:%d", this.Id), key, fmt.Sprintf("%v", val))
	if (e != nil) {
		log.Error("[GameDataManager SaveByKey] Error:%v", e.Error())
	}
}

//获取自定义数据
func (this *UserData) GetCustomData(key string) (value string, ok bool) {
	if value, ok = this.clientCustomData[key]; ok {
		return value, true
	}
	rkey := fmt.Sprintf("custom:%d", this.Id)
	v, err := redisClient.HGet(rkey, fmt.Sprintf("%v", key))
	if (err == nil && v != "") {
		this.clientCustomData[key] = v
		return v, true
	}
	return "", false
}

func (this *UserData) IdToString() string {
	return fmt.Sprintf("%v", this.Id)
}
