package game

import (
	"encoding/json"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/liangdas/mqant/log"
	"io/ioutil"
	"net/http"
	"server/define"
	"server/utils"
)

func (this *GameModule) addClientListener(router *mux.Router) {
	router.PathPrefix(localPath + "/login").HandlerFunc(this.onLogin)
	router.PathPrefix(localPath + "/userinfo").HandlerFunc(this.onGetUserInfo)
	router.PathPrefix(localPath + "/updateuserinfo").HandlerFunc(this.onUpdateUserInfo)
	router.PathPrefix(localPath + "/useEnergy").HandlerFunc(this.onUseEnergy)
	router.PathPrefix(localPath + "/getEnergy").HandlerFunc(this.onGetEnergy)
	router.PathPrefix(localPath + "/AdSuccess").HandlerFunc(this.onAdSuccess)
	router.PathPrefix(localPath + "/lottery").HandlerFunc(this.onLottery)
	router.PathPrefix(localPath + "/getLotteryTimes").HandlerFunc(this.onGetLotteryTimes)
	router.PathPrefix(localPath + "/getAdTimes").HandlerFunc(this.getAdTimes)
	router.PathPrefix(localPath + "/setAdTimes").HandlerFunc(this.setAdTimes)
	router.PathPrefix(localPath + "/getFavoriteReward").HandlerFunc(this.onGetFavoriteReward)
	router.PathPrefix(localPath + "/updateItemCount").HandlerFunc(this.onUpdateItemCount)
	router.PathPrefix(localPath + "/getAllItems").HandlerFunc(this.onGetAllItems)
	router.PathPrefix(localPath + "/getItem").HandlerFunc(this.onGetItem)
	router.PathPrefix(localPath + "/shareSuccessed").HandlerFunc(this.onShareSuccessed)
	router.PathPrefix(localPath + "/getAllShares").HandlerFunc(this.onGetAllShares)
	router.PathPrefix(localPath + "/getShare").HandlerFunc(this.onGetShare)
	router.PathPrefix(localPath + "/addRanks").HandlerFunc(this.onAddRanks)
	router.PathPrefix(localPath + "/getRanks").HandlerFunc(this.onGetRanks)
	router.PathPrefix(localPath + "/updateGameLevel").HandlerFunc(this.onUpdateGameLevel)
	router.PathPrefix(localPath + "/getGameLevels").HandlerFunc(this.onGetGameLevels)
	router.PathPrefix(localPath + "/uploadData").HandlerFunc(this.onUploadData)
	router.PathPrefix(localPath + "/downloadData").HandlerFunc(this.onDownloadData)
	router.PathPrefix(localPath + "/uploadShareData").HandlerFunc(this.onUploadShareData)
	router.PathPrefix(localPath + "/downloadShareData").HandlerFunc(this.onDownloadShareData)
}

//玩家登陆
func (this *GameModule) onLogin(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	log.Debug("[GameModule onLogin] %v", r.Form)
	if (len(r.Form) == 0) {
		this.responseToClient(w, r, 2, nil)
		return
	}
	if (r.Form["platform"] == nil) {
		this.responseToClient(w, r, 3, nil)
		return
	}

	platformIdStr := r.Form["platform"][0]
	platformId := utils.StringToInt32(platformIdStr)

	errorCode := 0
	var data map[string]interface{} = nil
	switch platformId {
	case define.PLATFORM_NONE:
		errorCode, data = this.OnGeneralLogin(w, r)
	case define.PLATFORM_WECHAT:
		errorCode, data = this.OnWechatLogin(w, r)
	case define.PLATFORM_QQ:
		errorCode, data = this.OnQQLogin(w, r)
	case define.PLATfORM_OPPO:
		errorCode, data = this.OnOppoLogin(w, r)
	}

	this.responseToClient(w, r, errorCode, data)
}

//获取玩家属性
func (this *GameModule) onGetUserInfo(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		result = map[string]interface{}{}
		result["level"] = userData.Level
		result["sceneLevel"] = userData.SceneLevel
		result["sceneLevelPass"] = userData.SceneLevelPass
		result["gold"] = userData.Gold
		result["huDunCount"] = userData.HuDunCount
		result["isFavorite"] = userData.IsFavorite
		result["name"] = userData.Name
		result["avatarUrl"] = userData.AvatarUrl
	}
	this.responseToClient(w, r, errorCode, result)
}

func (this *GameModule) getUserInfo(w http.ResponseWriter, r *http.Request) (userData *UserData, errorCode int) {
	r.ParseForm()
	if (len(r.Form) == 0) {
		return nil, 2
	}
	if (r.Form["uid"] == nil) {
		return nil, 3
	}
	uidStr := r.Form["uid"][0]
	uid := utils.StringToInt32(uidStr)
	userData = this.dataManager.GetUserDataById(uid)
	if (userData == nil) {
		return nil, 1
	}
	return userData, 0
}

//客户端更新用户数据
func (this *GameModule) onUpdateUserInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		result := make(map[string]string, 0)
		body, err := ioutil.ReadAll(r.Body)
		if err != nil {
			log.Debug("%v", err)
			this.responseToClient(w, r, 7, nil)
			return
		}
		err = json.Unmarshal(body, &result)
		if err != nil {
			fmt.Println("json 转换错误", err)
			this.responseToClient(w, r, 3, nil)
			return
		}

		var userData *UserData = nil
		if uidStr, ok := result["uid"]; !ok {
			this.responseToClient(w, r, 6, nil)
			return
		} else {
			uid := utils.StringToInt32(uidStr)
			userData = this.dataManager.GetUserDataById(uid)
			if (userData == nil) {
				this.responseToClient(w, r, 1, nil)
				return
			}
		}

		if level, ok := result["level"]; ok {
			userData.SetLevel(utils.StringToInt32(level))
		}

		if sceneLevel, ok := result["sceneLevel"]; ok {
			userData.SetSceneLevel(utils.StringToInt32(sceneLevel))
		}

		if gold, ok := result["gold"]; ok {
			userData.SetGold(utils.StringToInt32(gold))
		}

		if huDunCount, ok := result["huDunCount"]; ok {
			userData.SetHuDun(utils.StringToInt32(huDunCount))
		}

		if sceneLevelPass, ok := result["sceneLevelPass"]; ok {
			userData.SetSceneLevelPass(utils.StringToInt32(sceneLevelPass))
		}

		if name, ok := result["name"]; ok {
			userData.SetName(name)
		}

		if avatarUrl, ok := result["avatarUrl"]; ok {
			userData.SetAvatarUrl(avatarUrl)
		}

		this.responseToClient(w, r, 0, nil)
	} else {
		this.responseToClient(w, r, 2, nil)
	}
}

//使用体力
func (this *GameModule) onUseEnergy(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		errorCode = userData.useEnergy(this.dataManager.energyData)
		result = map[string]interface{}{
			"energy":               userData.Energy,
			"energyRecoveryCdTime": userData.getEnergyRecoveryCdTime(this.dataManager.energyData),
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//获取体力
func (this *GameModule) onGetEnergy(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		userData.onUpdateEnergyRecovery(this.dataManager.energyData)
		result = map[string]interface{}{
			"energy":               userData.Energy,
			"energyRecoveryCdTime": userData.getEnergyRecoveryCdTime(this.dataManager.energyData),
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//看广告成功
func (this *GameModule) onAdSuccess(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		userData.onAdSuccess(this.dataManager.energyData)
		result = map[string]interface{}{
			"energy":               userData.Energy,
			"energyRecoveryCdTime": userData.getEnergyRecoveryCdTime(this.dataManager.energyData),
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//抽奖
func (this *GameModule) onLottery(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		errorCode = userData.lotteryData.StartLottery()
		if (errorCode == 0) {
			itemData := this.startLottery()
			userData.SetRewardByItem(itemData)
			result = map[string]interface{}{
				"freeTimes": userData.lotteryData.FreeTimes,
				"adTimes":   userData.lotteryData.AdTimes,
				"itemId":    itemData.itemId,
				"itemCount": itemData.itemNum,
				"energy":    userData.Energy,
			}
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//获取抽奖次数
func (this *GameModule) onGetLotteryTimes(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		result = map[string]interface{}{
			"freeTimes": userData.lotteryData.FreeTimes,
			"adTimes":   userData.lotteryData.AdTimes,
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//抽奖奖励
func (this *GameModule) startLottery() *LotteryItemData {
	n := utils.RandInt(1, this.dataManager.lotteryWeightTotalCount)
	items := this.dataManager.GetLotteryItemData()
	for _, item := range items {
		if (item.checkWight(n)) {
			return item
		}
	}
	log.Error("抽奖错误,找不到抽奖物品:物品权重总数:%v,随机值:%v", this.dataManager.lotteryWeightTotalCount, n)
	return nil
}

//获取广告次数
func (this *GameModule) getAdTimes(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		if (r.Form["adId"] == nil) {
			errorCode = 10
		}
		if (errorCode == 0) {
			adId := utils.StringToInt32(r.Form["adId"][0])
			times, ok := userData.adDataCtrl.GetTimes(int(adId))
			if (!ok) {
				errorCode = 10
			} else {
				result = map[string]interface{}{
					"times": times,
				}
			}
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//设置广告次数
func (this *GameModule) setAdTimes(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		if (r.Form["adId"] == nil) {
			errorCode = 10
		}
		if (errorCode == 0) {
			adId := utils.StringToInt32(r.Form["adId"][0])
			times := userData.adDataCtrl.AddTimes(int(adId), 1)
			result = map[string]interface{}{
				"times": times,
			}
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//获取分享奖励
func (this *GameModule) onGetFavoriteReward(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		if (userData.IsFavorite == 1) {
			errorCode = 11
		} else {
			userData.SetRewardByItem(this.dataManager.favoriteItemData)
			userData.SetIsFavorite(1)
			result = map[string]interface{}{
				"itemId":     this.dataManager.favoriteItemData.GetId(),
				"itemCount":  this.dataManager.favoriteItemData.GetNum(),
				"energy":     userData.Energy,
				"isFavorite": 1,
			}
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//更新物品数据
func (this *GameModule) onUpdateItemCount(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		if (r.Form["itemId"] == nil || r.Form["itemCount"] == nil) {
			errorCode = 2
		} else {
			itemId := utils.StringToInt(r.Form["itemId"][0])
			itemCount := utils.StringToInt(r.Form["itemCount"][0])
			e, itemData := this.dataManager.itemDataManager.OnUpdateItem(userData.Id, itemId, itemCount)
			errorCode = e
			if (errorCode == 0) {
				result = map[string]interface{}{
					"itemId":    itemData.ItemId,
					"itemCount": itemData.Count,
				}
			}
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//获取所有物品数据
func (this *GameModule) onGetAllItems(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		itemUser, _ := this.dataManager.itemDataManager.GetItemUser(userData.Id)
		result = map[string]interface{}{
			"items": itemUser.GetAllItems(),
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//获取物品数据
func (this *GameModule) onGetItem(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		itemUser, _ := this.dataManager.itemDataManager.GetItemUser(userData.Id)
		if (r.Form["itemId"] == nil) {
			errorCode = 2
		} else {
			itemId := utils.StringToInt(r.Form["itemId"][0])
			item := itemUser.GetItemDataBy(itemId)
			if (item == nil) {
				errorCode = 12
			} else {
				result = map[string]interface{}{
					"item": item,
				}
			}
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//分享成功
func (this *GameModule) onShareSuccessed(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		shareUser, _ := this.dataManager.shareDataManager.GetShareUser(userData.Id)
		if (r.Form["shareId"] == nil) {
			errorCode = 2
		} else {
			shareId := utils.StringToInt(r.Form["shareId"][0])
			shareData := shareUser.AddShareCount(shareId, 1)
			result = map[string]interface{}{
				"share": shareData,
			}
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//获取所有分享数据
func (this *GameModule) onGetAllShares(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		shareUser, _ := this.dataManager.shareDataManager.GetShareUser(userData.Id)
		result = map[string]interface{}{
			"shares": shareUser.GetAllShares(),
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//获取分享数据
func (this *GameModule) onGetShare(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		shareUser, _ := this.dataManager.shareDataManager.GetShareUser(userData.Id)
		if (r.Form["shareId"] == nil) {
			errorCode = 2
		} else {
			shareId := utils.StringToInt(r.Form["shareId"][0])
			share := shareUser.GetShareDataBy(shareId)
			if (share == nil) {
				errorCode = 13
			} else {
				result = map[string]interface{}{
					"share": share,
				}
			}
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//添加排行榜数据
func (this *GameModule) onAddRanks(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		if (r.Form["rankType"] == nil || r.Form["score"] == nil) {
			errorCode = 2
		} else {
			rankType := r.Form["rankType"][0]
			score := r.Form["score"][0]
			userData.AddCustomRank(rankType,score);
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//获取排行榜数据
func (this *GameModule) onGetRanks(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		if (r.Form["rankType"] == nil) {
			errorCode = 2
		} else {
			rankType := r.Form["rankType"][0]
			rankData, err := this.dataManager.rankManager.GetRankDataBy(rankType)
			errorCode = err
			if(errorCode == 0){
				myRank := rankData.GetRankByUid(userData.Id)
				result = map[string]interface{}{
					"myRank": myRank,
					"ranks":  rankData.GetRanks(),
				}
			}
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//更新关卡数据
func (this *GameModule) onUpdateGameLevel(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		if (r.Form["chapter"] == nil || r.Form["gameLevel"] == nil || r.Form["startCount"] == nil || r.Form["state"] == nil) {
			errorCode = 2
		} else {
			chapter := utils.StringToInt(r.Form["chapter"][0])
			gameLevel := utils.StringToInt(r.Form["gameLevel"][0])
			startCount := utils.StringToInt(r.Form["startCount"][0])
			state := utils.StringToInt(r.Form["state"][0])

			_, errorCode = this.dataManager.gameLevelManager.OnUpdateGameLevel(userData.Id, chapter, gameLevel, startCount, state)
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//获取关卡数据
func (this *GameModule) onGetGameLevels(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	var result map[string]interface{}
	if (errorCode == 0) {
		levelUser, err := this.dataManager.gameLevelManager.GetGameLevelUser(userData.Id)
		errorCode = err
		if errorCode == 0 {
			result = map[string]interface{}{
				"gameLevelData": levelUser.GameLevels,
			}
		}
	}
	this.responseToClient(w, r, errorCode, result)
}

//上传数据
func (this *GameModule) onUploadData(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	if (errorCode == 0) {
		if (r.Form["key"] == nil || r.Form["value"] == nil) {
			errorCode = 2
		}
		keys := r.Form["key"]
		values := r.Form["value"]
		if (len(keys) != len(values)) {
			errorCode = 18
		} else {
			for i := 0; i < len(keys); i++ {
				key := keys[i]
				val := values[i]
				if (key != "" && key != "\"\"" && val != "" && val != "\"\"") {
					userData.SaveCustomData(key, val)
				}
			}
		}
	}
	this.responseToClient(w, r, errorCode, nil)
}

//下载数据
func (this *GameModule) onDownloadData(w http.ResponseWriter, r *http.Request) {
	userData, errorCode := this.getUserInfo(w, r)
	value := ""
	if (errorCode == 0) {
		if (r.Form["key"] == nil) {
			errorCode = 2
		}
		keys := r.Form["key"]
		for i := 0; i < len(keys); i++ {
			key := keys[i]
			v, ok := userData.GetCustomData(key)
			if (!ok) {
				errorCode = 16
			} else {
				if (value == "") {
					value = v
				} else {
					value = fmt.Sprintf("%s,%s", value, v)
				}
			}
		}
	}
	this.responseToClient(w, r, errorCode, value)
}

//上传数据
func (this *GameModule) onUploadShareData(w http.ResponseWriter, r *http.Request) {
	_, errorCode := this.getUserInfo(w, r)
	if (r.Form["key"] == nil || r.Form["value"] == nil) {
		errorCode = 2
	}
	keys := r.Form["key"]
	values := r.Form["value"]
	ctype := r.Form["type"][0]
	if (len(keys) != len(values)) {
		errorCode = 18
	} else {
		for i := 0; i < len(keys); i++ {
			key := keys[i]
			val := values[i]
			if (key != "" && key != "\"\"" && val != "" && val != "\"\"") {
				this.dataManager.SaveCustomShareData(ctype, key, val)
			}
		}
	}
	this.responseToClient(w, r, errorCode, nil)
}

//下载数据
func (this *GameModule) onDownloadShareData(w http.ResponseWriter, r *http.Request) {
	value := ""
	_, errorCode := this.getUserInfo(w, r)
	if (errorCode == 0) {
		if (r.Form["key"] == nil) {
			errorCode = 2
		}
		keys := r.Form["key"]
		ctype := r.Form["type"][0]
		for i := 0; i < len(keys); i++ {
			key := keys[i]
			v, ok := this.dataManager.GetCustomShareData(ctype,key)
			if (!ok) {
				errorCode = 16
			} else {
				if (value == "") {
					value = v
				} else {
					value = fmt.Sprintf("%s,%s", value, v)
				}
			}
		}
	}
	this.responseToClient(w, r, errorCode, value)
}

//回应客户端
func (this *GameModule) responseToClient(w http.ResponseWriter, r *http.Request, errorCode int, data interface{}) {
	result := map[string]interface{}{
		"errorCode": errorCode,
	}
	if (data != nil) {
		result["data"] = data
	}
	rd, e := json.Marshal(result)
	if (e != nil) {
		fmt.Fprintln(w, "{\" errorCode \":4}") //数据解析错误
		log.Error("打包json数据错误:%v", e.Error())
		return
	}
	d := string(rd)
	fmt.Fprintf(w, d)
}
