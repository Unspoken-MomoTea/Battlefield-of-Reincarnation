package testting

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/liangdas/mqant/log"
	"io/ioutil"
	"net/http"
	"net/url"
	"server/common"
	"server/define"
	"testing"
	"time"
)

func TestWechatPay(t *testing.T) {
	//url := "https://api.weixin.qq.com/cgi-bin/midas/%s?access_token=%s" //正式
	url := "https://api.weixin.qq.com/cgi-bin/midas/sandbox/%s?access_token=%s" //测试

	openId := "oqQOv4oyd5Te7FJ2qTlkUWvCdVE0"
	token := "wat9UYwa75d9v735rT3OJA=="
	sessionKey := ""
	url = fmt.Sprintf(url, define.WC_GET_BALANCE, token)

	time := fmt.Sprintf("%d", time.Now().Unix())

	report := map[string]interface{}{
		"openid":   openId,
		"appid":    common.WechatAppId, //小程序 appId
		"offer_id": common.MiOfferId,         //米大师分配的应用ID
		"ts":       time,                 //UNIX 时间戳，单位是秒
		"zone_id":  "1",                  //游戏服务器大区id,游戏不分大区则默认zoneId ="1",String类型
		"pf":       "android",            //平台 安卓：android
	}

	b := common.GetWCSigData(define.WC_GET_BALANCE, token, sessionKey, report)
	if (!b) {
		log.Error("get sig error")
		return
	}
	urlBody, _ := json.Marshal(report)
	req_new := bytes.NewBuffer(urlBody)
	reqest, err := http.Post(url, "application/x-www-form-urlencoded", req_new)
	if err != nil {
		log.Debug("wechat buy request: %v", err.Error())
		return
	}

	defer reqest.Body.Close()
	rebody, err := ioutil.ReadAll(reqest.Body)
	if err != nil {
		log.Debug("QQBey read body: %v", err.Error())
		return
	}
	//存储返回结果
	result := make(map[string]interface{}, 0)
	err = json.Unmarshal(rebody, &result)
	if err != nil {
		log.Debug("QQBey body Unmarshal: %v", err.Error())
		return
	}
}

func TestGuangYuLogin(t *testing.T)  {
	testKey := "/login/third/106?account=user1234&timestamp=1556099630testkey"
	md5ctx := md5.New()
	md5ctx.Write([]byte(testKey))
	signCode := hex.EncodeToString(md5ctx.Sum(nil))
	log.Debug("sign=%v",signCode)
}
//POST&%2Fapi%2Fjson%2FopenApiPay%2FGamePrePay&amt=10&app_remark=xxxxx&appid=1107981003&bill_no=69ae13a3a87f2551109a2ed26bc704201f56d664&good_num=1&goodid=43&openid=55107C3B8501CD7CBD90AEE4626E6D17&pf=qq_m_qq-2001-android-2011&ts=1507530737&zone_id=1&session_key=VUNQZ0hRYURxNlZZbmNOZw==
//POST&%2Fapi%2Fjson%2FopenApiPay%2FGamePrePay&amt=10&app_remark=xxxxx&appid=1107981003&bill_no=69ae13a3a87f2551109a2ed26bc704201f56d664&good_num=1&goodid=43&openid=55107C3B8501CD7CBD90AEE4626E6D17&pf=qq_m_qq-2001-android-2011&ts=1507530737&zone_id=1&session_key=VUNQZ0hRYURxNlZZbmNOZw==
//38181bd0acf24eda203655a3be9f2e42b62d4fcf1c1de61a98b0573d13531449
//38181bd0acf24eda203655a3be9f2e42b62d4fcf1c1de61a98b0573d13531449
func TestQQGamePay(t *testing.T)  {
	//hostPath := "https://api.q.qq.com"
	session_key := "VUNQZ0hRYURxNlZZbmNOZw=="
	sinDecodeData := "/api/json/openApiPay/GamePrePay"
	sinDecodeData = url.QueryEscape(sinDecodeData)
	report := map[string]interface{}{
		"openid":"55107C3B8501CD7CBD90AEE4626E6D17",
		"appid":"1107981003",
		"ts":1507530737,
		"zone_id":"1",
		"pf":"qq_m_qq-2001-android-2011",
		"amt":10,
		"goodid":"43",
		"good_num":1,
		"bill_no":"69ae13a3a87f2551109a2ed26bc704201f56d664",
		"app_remark":"xxxxx",
	}
	ps := common.WcGetSortUri(report)
	sinDecodeData = fmt.Sprintf("POST&%s&%s&session_key=%s", sinDecodeData,ps,session_key)
	sinKey := common.WcGetHMacData(sinDecodeData,session_key)
	log.Debug(sinKey)
}
