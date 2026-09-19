package game

import (
	"github.com/liangdas/mqant/log"
	"net/http"
	"server/define"
)

//普通登陆
func (this *GameModule) OnGeneralLogin(w http.ResponseWriter, r *http.Request) (errorCode int, data map[string]interface{}) {
	if (r.Form["account"] == nil) {
		return 2, nil
	}
	account := r.Form["account"][0]
	userData := this.dataManager.OnLogin(account)
	data = map[string]interface{}{
		"uid":userData.Id,
	}
	return 0, data
}

//微信登陆
func (this *GameModule) OnWechatLogin(w http.ResponseWriter, r *http.Request) (errorCode int, data map[string]interface{}) {
	if (r.Form["openCode"] == nil) {
		return 2, nil
	}
	openCode := r.Form["openCode"][0]
	log.Debug("[GameModule OnWechatLogin] openCode:%v", openCode)
	openId, sessionKey, b := this.wechatSdkHandler.WcGetSessionKey(openCode)
	if (!b) {
		return 4, nil
	}

	userData := this.dataManager.OnLogin(openId)
	userData.PlatformId = define.PLATFORM_WECHAT
	userData.SessionKey = sessionKey
	data = map[string]interface{}{
		"openId": openId,
		"uid":userData.Id,
	}
	return 0, data
}

//qq登陆
func (this *GameModule) OnQQLogin(w http.ResponseWriter, r *http.Request) (errorCode int, data map[string]interface{}) {
	return 0, nil
}

//oppo登陆
func (this *GameModule) OnOppoLogin(w http.ResponseWriter, r *http.Request) (errorCode int, data map[string]interface{}) {
	if (r.Form["account"] == nil) {
		return 2, nil
	}
	account := r.Form["account"][0]
	userData := this.dataManager.OnLogin(account)
	data = map[string]interface{}{
		"uid":userData.Id,
	}
	return 0, data
}
