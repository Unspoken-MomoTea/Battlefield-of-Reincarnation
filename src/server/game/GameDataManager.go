package game

import (
	"fmt"
	"github.com/liangdas/mqant/log"
	"github.com/liangdas/mqant/utils"
	"server/common"
	"server/game/gameLevel"
	"server/game/item"
	"server/game/rank"
	"server/game/share"
	"server/redisClient"
	utils2 "server/utils"
	"sync"
	"time"
)

var clearTickTime = int64(60)
var userTimeOut = int64(3600)

type GameDataManager struct {
	itemDataManager         *item.ItemDataManager           //物品数据管理
	shareDataManager        *share.ShareDataManager         //分享数据管理
	rankManager             *rank.RankManager               //排行管理
	gameLevelManager        *gameLevel.GameLevelDataManager //关卡管理
	userDataListById        *utils.BeeMap                   //玩家数据map[int64]*UserData
	userDataListByAccount   *utils.BeeMap                   //玩家数据map[string]*UserData
	idIndex                 int32
	locker                  sync.RWMutex
	clearTime               int64              //清除过期用户时间
	energyData              *EnergyData        //体力回复
	lotteryItemDataList     []*LotteryItemData //抽奖物品列表
	lotteryWeightTotalCount int                //抽奖权重总数
	favoriteItemData        *item.ItemData     //收藏奖励数据
}

//抽奖物品
type LotteryItemData struct {
	itemId    int //物品id
	itemNum   int //物品数量
	minRandom int //物品权重最小值
	maxRandom int //物品权重最大值
}

//检测权重范围
func (this *LotteryItemData) checkWight(v int) bool {
	return v >= this.minRandom && v < this.maxRandom
}

func (this *LotteryItemData) GetId() int {
	return this.itemId
}

func (this *LotteryItemData) GetNum() int {
	return this.itemNum
}

//体力回复值
type EnergyData struct {
	initCount       int //初始值
	consume         int //关卡消耗
	recoveryTime    int //回复时间
	maxCount        int //最大值
	adRecoveryCount int //看广告回复值
}

//检查回复时间是否已到,return true可以回复,false 不能回复
func (this *EnergyData) checkRecoveryTime(lastTime int64) (int, int64, bool) {
	if (lastTime == 0) {
		return 0, 0, true
	}
	currentTime := time.Now().Unix()
	dt := currentTime - lastTime
	rt := int64(this.recoveryTime)
	if (dt < rt) {
		return 0, 0, false
	}
	times := int(dt / rt)
	lastSecond := dt % rt
	return times, lastSecond, true
}

func NewGameDataManager() *GameDataManager {
	d := &GameDataManager{}
	d.initData()
	return d
}

func (this *GameDataManager) initData() {
	this.itemDataManager = item.NewItemDataManager()
	this.shareDataManager = share.NewShareDataManager()
	this.rankManager = rank.NewRankManager()
	this.gameLevelManager = gameLevel.NewGameLevelDataManager()
	this.userDataListById = utils.NewBeeMap()      //map[int64]*UserData
	this.userDataListByAccount = utils.NewBeeMap() //map[string]*UserData
	this.idIndex = 10000
	this.clearTime = clearTickTime
	energyData := &EnergyData{}
	this.energyData = energyData

	energyData.initCount = common.MiscMgr.GetMiscDataBy("energyInit").ValueToInt()
	energyData.consume = common.MiscMgr.GetMiscDataBy("energyConsume").ValueToInt()
	energyData.recoveryTime = common.MiscMgr.GetMiscDataBy("energyCd").ValueToInt()
	energyData.maxCount = common.MiscMgr.GetMiscDataBy("energyFull").ValueToInt()
	energyData.adRecoveryCount = common.MiscMgr.GetMiscDataBy("energyAd").ValueToInt()

	this.lotteryItemDataList = make([]*LotteryItemData, 0)
	lotteryItemValue := common.MiscMgr.GetMiscDataBy("lotteryReward").Value
	tempStrs := utils2.StringToArray(lotteryItemValue, ";")
	i := 1
	for _, str := range tempStrs {
		ints := utils2.StringToInt32Array(str, "|")
		itemData := &LotteryItemData{}
		itemData.itemId = int(ints[0])
		itemData.itemNum = int(ints[1])
		weight := int(ints[2])
		itemData.minRandom = i
		i += weight
		itemData.maxRandom = i
		this.lotteryItemDataList = append(this.lotteryItemDataList, itemData)
	}
	this.lotteryWeightTotalCount = i
	favoriteStrAry := common.MiscMgr.GetMiscDataBy("favoriteReward").ValueToInt32Array("|")

	this.favoriteItemData = &item.ItemData{
		ItemId: int(favoriteStrAry[0]),
		Count:  int(favoriteStrAry[1]),
	}
}

func (this *GameDataManager) Init() {
	bytes, err := redisClient.Get("idIndex")
	if err == nil && 0 != len(bytes) {
		this.idIndex = utils2.StringToInt32(string(bytes[:]))
	}
	this.saveIdIndex()
}

func (this *GameDataManager) OnReset() {
	this.rankManager.Rank()
	for _, user := range this.userDataListById.Items() {
		user.(*UserData).OnReset()
	}
}

//根据账号从数据库加载数据
func (this *GameDataManager) loadUserDataFromDBByAccount(account string) (*UserData, bool) {
	accountKey := fmt.Sprintf("account:%s", account)
	bytes, err := redisClient.Get(accountKey)
	if (bytes == nil || err != nil) {
		return nil, false
	}
	uid := utils2.StringToInt32(string(bytes))
	userData := NewUserData(uid, account)
	if (!userData.Load()) {
		return nil, false
	}
	if (userData.LastRecoveryEnergyTime == 0) {
		userData.SetEnergy(this.energyData.initCount)
		userData.SetLastRecoveryTime(time.Now().Unix())
	}
	return userData, true
}

//玩家登陆
func (this *GameDataManager) OnLogin(account string) *UserData {
	loginCount++
	userData := this.GetUserDataByAccountByAccount(account)
	this.userDataListById.Set(userData.Id, userData)
	this.userDataListByAccount.Set(userData.Account, userData)
	userData.LoginTime = time.Now().Unix()
	userData.SaveUserDataToDB()
	this.itemDataManager.OnLogin(userData.Id)
	this.shareDataManager.OnLogin(userData.Id)
	this.gameLevelManager.OnLogin(userData.Id)
	log.Debug("[GameDataManager OnLogin] account:%v,uid:%v,loginTime:%v", account, userData.Id, userData.LoginTime)
	return userData
}

//玩家登出
func (this *GameDataManager) OnLogout(data *UserData) {
	this.itemDataManager.OnLogout(data.Id)
	this.shareDataManager.OnLogout(data.Id)
	this.gameLevelManager.OnLogout(data.Id)
	this.userDataListById.Delete(data.Id)
	this.userDataListByAccount.Delete(data.Account)
}

//根据用户id获取用户数据
func (this *GameDataManager) GetUserDataById(id int32) *UserData {
	d := this.userDataListById.Get(id)
	if (d == nil) {
		log.Warning("[GameDataManager GetUserDataById] can not found user by id:%v", id)
		return nil
	}
	return d.(*UserData)
}

//根据skdId获取用户数据
func (this *GameDataManager) GetUserDataByAccountByAccount(account string) *UserData {
	d := this.userDataListByAccount.Get(account)
	if (d == nil) {
		dd, b := this.loadUserDataFromDBByAccount(account)
		if (!b) {
			dd = this.createUser(account)
		}
		d = dd
	}
	return d.(*UserData)
}

//创建用户
func (this *GameDataManager) createUser(account string) *UserData {
	this.locker.Lock()
	this.idIndex = this.idIndex + 1
	id := this.idIndex
	this.locker.Unlock()
	userData := NewUserData(id, account)
	userData.SetEnergy(this.energyData.initCount)
	userData.SetLastRecoveryTime(time.Now().Unix())
	this.saveIdIndex()
	this.saveAccount(userData)
	return userData
}

func (this *GameDataManager) UpdateClear() {
	t := time.Now().Unix()
	this.clearTime--
	if (this.clearTime > 0) {
		return
	}
	this.clearTime = clearTickTime
	items := this.userDataListById.Items()
	for _, data := range items {
		userData := data.(*UserData)
		if (t-userData.LoginTime >= userTimeOut) {
			log.Debug("user login time out,uid:%v,nowTime:%v,loginTime:%v,timeOut:%v", userData.Id, t, userData.LoginTime, userTimeOut)
			this.OnLogout(userData)
		}
	}
	dt := time.Now().Unix() - t
	log.Debug("[GameDataManager UpdateClear] used time:%v,itemLength:%v", dt, len(items))
}

//保存自定义共享数据
func (this *GameDataManager) SaveCustomShareData(ctype string,key string, val string) {
	e := redisClient.HSet(fmt.Sprintf("customShare:%s", ctype), key, fmt.Sprintf("%v", val))
	if (e != nil) {
		log.Error("[GameDataManager SaveByKey] Error:%v", e.Error())
	}
}

//获取自定义共享数据
func (this *GameDataManager) GetCustomShareData(ctype string,key string) (value string, ok bool) {
	rkey := fmt.Sprintf("customShare:%s", ctype)
	v, err := redisClient.HGet(rkey, fmt.Sprintf("%v", key))
	if (err == nil && v != "") {
		return v, true
	}
	return "", false
}

//获取抽奖物品数据
func (this *GameDataManager) GetLotteryItemData() []*LotteryItemData {
	return this.lotteryItemDataList
}

//更新体力
func (this *GameDataManager) UpdateEnergy() {
	for _, obj := range this.userDataListById.Items() {
		userData := obj.(*UserData)
		userData.onUpdateEnergyRecovery(this.energyData)
	}
}

func (this *GameDataManager) saveIdIndex() {
	_, e := redisClient.Set("idIndex", fmt.Sprintf("%v", this.idIndex))
	if (e != nil) {
		log.Error("[GameDataManager saveIdIndex] save id index Error:%v", e.Error())
	}
}

func (this *GameDataManager) saveAccount(userData *UserData) {
	key := fmt.Sprintf("account:%v", userData.Account)
	_, e := redisClient.Set(key, fmt.Sprintf("%v", userData.Id))
	if (e != nil) {
		log.Error("[GameDataManager saveIdIndex] save id index Error:%v", e.Error())
	}
}
