package testting

import (
	"testing"
	"net/http"
	"io/ioutil"
	"fmt"
	"strings"

	"strconv"
	"time"
	"sort"
	"crypto/md5"
	"encoding/hex"
)


func TestGet(t *testing.T) {
	szQuery := "appId=2882303761517239138&cpOrderId=9786bffc-996d-4553-aa33-f7e92c0b29d5&orderConsumeType=10" +
		"&orderId=21140990160359583390&orderStatus=TRADE_SUCCESS&payFee=1&payTime=2014-09-05%2015:20:27" +
		"&productCode=com.demo_1&productCount=1&productName=%E9%93%B6%E5%AD%901%E4%B8%A4&uid=100010" +
		"&signature=1388720d978021c20aa885d9b3e1b70cec751496"
	url := fmt.Sprintf("http://localhost:8282/xmpayresult?%s", szQuery)
	reqest, err := http.Get(url)
	if err != nil {
		fmt.Println(err)
	}

	defer reqest.Body.Close()
}

func TestHttp(t *testing.T) {
	//client := &http.Client{}
	//values := map[string]interface{}{
	//	"gameId":2,
	//	"channelId":0,
	//	"zoneId":0,
	//	"zoneName":"",
	//	"playerId":104101,
	//	"playerName":"123456",
	//	"playerGender":2,
	//	"playerLevel":0,
	//	"playerVipLevel":0,
	//	"playerIp":"192.168.0.42:51950",
	//	"platform":0,
	//	"deviceKey":"",
	//	"phoneModel":"",
	//	"loginTime":1542938916,
	//	"timeStamp":1542938916,
	//	"signType":"md5",
	//	"reportType":"login",
	//	"sign":"4fbe67fd5cecc010a036cef87dc40d5e",
	//}
	//body, _ := json.Marshal(values)
	//req_new := bytes.NewBuffer(body)
	//request, _ := http.NewRequest("POST", "https://dev.xxx.com/api/data/report", req_new)
	//request.Header.Set("Content-type", "application/x-www-form-urlencoded")
	//response, _ := client.Do(request)
	//if response.StatusCode == 200 {
	//	body, _ := ioutil.ReadAll(response.Body)
	//	fmt.Println(string(body[:]))
	//}
	Report := map[string]interface{}{
		"gameId"		:	"2",
		"channelId"		:	"0",
		"zoneId"		:	"0",
		"zoneName"		:	"s",
		"playerId"		:	strconv.FormatInt(100564, 10),
		"playerName"	:	"s",
		"playerGender"	:	"2",
		"playerLevel"	:	"0",
		"playerVipLevel":	"0",
		"playerIp"		:	"192.168.0.42:56756",
		"platform"		:	"0",
		"deviceKey"		:	"29f79ddf38838395be02d1595739f2af",
		"phoneModel"	:	"MI MAX2",
		"loginTime"		:	strconv.FormatInt(time.Now().Unix(),10),
		"timeStamp"		:	strconv.FormatInt(time.Now().Unix(),10),
		"signType"		:	"md5",
		"reportType"	:	"login",
	}

	appSecre := "appSecret=29f79ddf38838395be02d1595739f2af"
	appKey	:= "appKey=9fc0a0189b738a60&"
	names := []string{}
	for i := range Report{
		names = append(names, i)
	}
	sort.Strings(names)

	Reportdata := ""
	for _, v := range names{
		Reportdata +=  fmt.Sprintf( "%s=%v&" , v, getstring(Report,v))
	}

	h := md5.New()
	Data := appKey + Reportdata  + appSecre
	h.Write([]byte(Data))
	MdData := h.Sum(nil)
	Reportdata += fmt.Sprintf("sign=%s", hex.EncodeToString(MdData))
	resp, err := http.Post("",
		"application/x-www-form-urlencoded",
		strings.NewReader(Reportdata))
	if err != nil {
		fmt.Println(err)
	}

	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		// handle error
	}

	fmt.Println(string(body))
	fmt.Print(time.Now().Unix())
}
func getstring (data map[string]interface{}, key string) string {
	if data[key] != nil{
		return data[key].(string)
	}
	return ""
}
