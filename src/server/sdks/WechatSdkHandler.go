package sdks

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/liangdas/mqant/conf"
	"github.com/liangdas/mqant/log"
	"io/ioutil"
	"net/http"
	"server/define"
	"server/redisClient"
	"sort"
)

//微信sdk控制器
type WechatSdkHandler struct {
	//微信小游戏
	WechatLoginHost        string
	WAccessTokenHost       string
	WechatAppId            string
	WechatSecretKey        string
	WechatSigHost          string
	WechatMpSigHost        string
	WechatReportHost       string
	SigKey                 string
	MiOfferId              string
	WeiXinCheckSessionHost string
}

func NewWechatSdkHandler() *WechatSdkHandler {
	return &WechatSdkHandler{}
}

func (this *WechatSdkHandler) Init(settings *conf.ModuleSettings) {
	//微信小游戏
	this.WechatAppId, _ = settings.Settings["WeiXinAppID"].(string)
	this.WechatSecretKey, _ = settings.Settings["WeiXinSecretKey"].(string)
	this.WechatSigHost, _ = settings.Settings["WeiXinSigHost"].(string)
	this.WechatMpSigHost, _ = settings.Settings["WeiXinMpSigHost"].(string)
	this.WechatReportHost, _ = settings.Settings["WeiXinReportHost"].(string)
	this.WechatLoginHost, _ = settings.Settings["WeiXinLoginHost"].(string)
	this.WAccessTokenHost, _ = settings.Settings["WAccessTokenHost"].(string)
	this.WeiXinCheckSessionHost, _ = settings.Settings["WeiXinCheckSessionHost"].(string)
	this.SigKey, _ = settings.Settings["this.SigKey"].(string)
	this.MiOfferId, _ = settings.Settings["MiOfferId"].(string)
}

//微信
//测试接口地址：https://sandbox.api.unipay.qq.com
//正式接口地址：https://caccts.midas.qq.com
//现网AppKey：MUExAOcBYjTb6SH8eNqDwpALNIRPISYX
//沙箱AppKey：2rK22qPkc2BmiPp61ftNo9AmokbVdYqt
//支付应用ID：1450021450
//获取微信sig数据，包含sig,mp_sig
func (this *WechatSdkHandler) GetWCSigData(pType string, accessToken string, sessionKey string, report map[string]interface{}) bool {
	signatureText := ""
	signatureText = this.WcGetSortUri(report)
	signatureText = fmt.Sprintf(this.WechatSigHost, signatureText, pType, this.SigKey)
	log.Debug("signatureText-->%s", signatureText)

	encodeSig := this.WcGetHMacData(signatureText, this.SigKey)
	log.Debug("sig = %s", encodeSig)

	report["access_token"] = accessToken
	report["sig"] = encodeSig

	signatureText = this.WcGetSortUri(report)
	signatureText = fmt.Sprintf(this.WechatMpSigHost, signatureText, pType, sessionKey)
	log.Debug("mp_signatureText-->%s", signatureText)

	encode_mp_sig := this.WcGetHMacData(signatureText, sessionKey)
	log.Debug("pm_sig = %s", encode_mp_sig)
	report["mp_sig"] = encode_mp_sig
	return true
}

// 微信登陆
func (this *WechatSdkHandler) WcGetSessionKey(openCode string) (string, string, bool) {
	szQuery := fmt.Sprintf(this.WechatLoginHost, this.WechatAppId, this.WechatSecretKey, openCode)
	define.WcQuery = szQuery
	log.Debug("wechat getSessionKey--->%s", szQuery)
	response, err := http.Get(szQuery)
	if err != nil {
		log.Warning("getSessionKey http get: %v", err.Error())
		return "", "", false
	}

	defer response.Body.Close()
	rebody, err := ioutil.ReadAll(response.Body)
	if err != nil {
		log.Warning("weixin read body: %v", err.Error())
		return "", "", false
	}
	//存储返回结果
	rValues := make(map[string]interface{}, 0)
	err = json.Unmarshal(rebody, &rValues)
	if err != nil {
		log.Warning("weixin body Unmarshal: %v", err.Error())
		return "", "", false
	}
	// 返回的错误码, 0 = 请求成功
	errCodeStr, fOk := rValues["errcode"]
	errCode := int32(0)
	if (errCodeStr != nil){
		errCode = int32(errCodeStr.(float64))
	}
	if true == fOk && 0 != errCode && 40163 != errCode {
		log.Warning("weixin getSessionKey errcode = %v", errCode)
		return "", "", false
	}
	if (40163 == errCode) {
		log.Warning("weixin getSessionKey errcode = %v", errCode)
		return "", "", true
	}
	// 读取平台数据
	vOpenID, _ := rValues["openid"].(string)
	vSessionKey, _ := rValues["session_key"].(string)

	return vOpenID, vSessionKey, true
}
func (this *WechatSdkHandler) WcGetHMacData(data string, key string) string {
	szkey := []byte(key)
	mac := hmac.New(sha256.New, szkey)
	mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}

func (this *WechatSdkHandler) WcGetSortUri(data map[string]interface{}) string {
	//排序拼接
	names := []string{}
	for i := range data {
		names = append(names, i)
	}
	sortStr := ""
	sort.Strings(names)
	for _, v := range names {
		sortStr += fmt.Sprintf("%s=%v&", v, data[v])
	}
	sortStr = sortStr[:len(sortStr)-1]
	return sortStr
}

var iTimestamp int64 = 0

func (this *WechatSdkHandler) GetWeiXinAccessToken(currentTime int64) (string, bool) {
	szQuery := fmt.Sprintf(this.WAccessTokenHost, this.WechatAppId, this.WechatSecretKey)
	response, err := http.Get(szQuery)
	if err != nil {
		log.Warning("weixin get access token: %v", err.Error())
		return "", false
	}

	defer response.Body.Close()
	rebody, err := ioutil.ReadAll(response.Body)
	if err != nil {
		log.Warning("weixin access token read body: %v", err.Error())
		return "", false
	}
	//存储返回结果
	rValues := make(map[string]interface{}, 0)
	err = json.Unmarshal(rebody, &rValues)
	if err != nil {
		log.Warning("weixin access token body Unmarshal: %v", err.Error())
		return "", false
	}
	// 返回的错误码, 0 = 请求成功
	errCode, fOk := rValues["errcode"]
	if true == fOk && 0 != int32(errCode.(float64)) {
		log.Warning("weixin access token errcode = %v", errCode)
		return "", false
	}
	// 读取平台数据
	vExpiresIn, fOk1 := rValues["expires_in"]
	vAccessToken, fOk2 := rValues["access_token"]
	if fOk1 == false || fOk2 == false {
		log.Warning("weixin access token access_token = %v, expires_in = %v", vAccessToken, vExpiresIn)
		return "", false
	}
	// 缓存获取的TOKEN
	szAccessToken := vAccessToken.(string)
	iExpiresIn := int(vExpiresIn.(float64))
	_, err2 := redisClient.SetEx("WeiXinAccessToken", szAccessToken, iExpiresIn)
	if err2 != nil {
		log.Warning("weixin access token cache access_token = %v, expires_in = %v, error = %v", vAccessToken, vExpiresIn, err2.Error())
		return "", false
	}

	iTimestamp = currentTime + int64(iExpiresIn/2)

	return szAccessToken, true
}
