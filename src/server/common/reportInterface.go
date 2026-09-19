package common

import (
	"sort"
	"fmt"
	"crypto/md5"
	"encoding/hex"
	"net/http"
	"strings"
	"io/ioutil"
	"encoding/json"
	"github.com/liangdas/mqant/log"
)

func RepIn(Report map[string]interface{}) {
	return
	url 		:= ""
	appKey		:= "appKey=9fc0a0189b738a60&"
	appSecre 	:= "appSecret=29f79ddf38838395be02d1595739f2af"
	Reportdata 	:= ""

	names := []string{}
	for i := range Report{
		names = append(names, i)
	}
	sort.Strings(names)

	for _, v := range names{
		Reportdata +=  fmt.Sprintf( "%s=%v&" , v, getstring(Report,v))
	}

	//md5加密
	h := md5.New()
	Data := appKey + Reportdata  + appSecre
	h.Write([]byte(Data))
	MdData := h.Sum(nil)
	Reportdata += fmt.Sprintf("sign=%s", hex.EncodeToString(MdData))

	reqest, err := http.Post(url, "application/x-www-form-urlencoded", strings.NewReader(Reportdata))
	if err != nil {
		log.Warning("Post error [%v]", err.Error())
		return
	}

	defer reqest.Body.Close()
	body, err := ioutil.ReadAll(reqest.Body)
	if err != nil {
		log.Warning("Read All error [%v]", err.Error())
		return
	}

	//存储返回结果
	result := make(map[string]interface{}, 0)
	err = json.Unmarshal(body, &result)
	if err != nil {
		log.Warning("Unmarshal Body error [%v]", err.Error())
	}
}

func getstring (data map[string]interface{}, key string) string {
	if val, fOk := data[key]; fOk {
		return val.(string)
	}
	return ""
}
