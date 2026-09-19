package testting

import (
	"testing"
	"net/url"
	"fmt"
	"strings"
	"encoding/base64"
	"encoding/json"
	"crypto/md5"
	"encoding/hex"
	"github.com/liangdas/mqant/log"
)

func Test_Misc(t *testing.T){
	// common.LoadConfig()
	// misc.InitMiscDataMgr()
	//value1 := math.Ceil(float64(5.000000000000000000000001))
	//value2 := math.Ceil(float64(5.900000000000000000000001))
	//fmt.Println(value1)
	//fmt.Println(value2)

	body := "AppID=14804158&OrderSerial=53OkMFK4fFYRYUiUxC-1125-2018112906&CooperatorOrderSerial=2781ddb6-36b3-433c-b860-c57660c7d860&Sign=610e03827dda48cf3f26deaccdf54dae&Content=eyJCYW5rRGF0ZVRpbWUiOiIyMDE4LTExLTI5IDE4OjE5OjI3IiwiRXh0SW5mbyI6IjEyNzEwMSIsIk1lcmNoYW5kaXNlTmFtZSI6IuawtOaZtiIsIk9yZGVyTW9uZXkiOiIwLjAxIiwiT3JkZXJTdGF0dXMiOjEsIlN0YXJ0RGF0ZVRpbWUiOiIyMDE4LTExLTI5IDE4OjE4OjU0IiwiU3RhdHVzTXNnIjoi5oiQ5YqfIiwiVUlEIjoiODIwMTgxMTI5MTQxMjIwNTE3MiIsIlZvdWNoZXJNb25leSI6MH0%3D"
	m, _ := url.ParseQuery(body)
	fmt.Println(m)
	mValues := make(map[string]string, 0)
	for key, vals := range m {
		mValues[key] = strings.Join(vals, "")
	}
	// 检查订单ID
	OrderId, fOk1  := mValues["OrderSerial"] 	// 平台订单号
	cpOrderId, fOk := mValues["CooperatorOrderSerial"]	// 本地订单号
	if false == fOk || false == fOk1 || OrderId == "" || cpOrderId == "" {
		log.Debug("baidu result no find order 1: cpOrderId = %s", cpOrderId)
		return
	}

	// 查找签名数据
	signature, fOk1 := mValues["Sign"]
	szContent, fOk  := mValues["Content"]
	if false == fOk || false == fOk1 || szContent == "" || signature == "" {
		log.Debug("baidu result no find order 2: cpOrderId = %s", cpOrderId)
		return
	}

	uDec, _ := base64.URLEncoding.DecodeString(szContent)
	fmt.Println(uDec)

	md5ctx := md5.New()
	AppId 		:= "14804158"
	AecretKe 	:= "RZWtAKPU12Bnp2D0NyiWuT1glUNpHK6f"
	Data := AppId + OrderId + cpOrderId + szContent + AecretKe
	md5ctx.Write([]byte(Data))
	szMd5Data := hex.EncodeToString(md5ctx.Sum(nil))
	if szMd5Data != signature {
		log.Debug("baidu result signature: %s != %s", szMd5Data, signature)
		return
	}

	mResult := make(map[string]interface{}, 0)
	json.Unmarshal(uDec, &mResult)

	fmt.Println(mResult)
}