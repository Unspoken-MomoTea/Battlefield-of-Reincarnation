package common

import (
	"io/ioutil"
	"fmt"
	"github.com/tidwall/gjson"
	"strconv"
	"server/utils"
	"strings"
)

var jsonDatas map[int]map[string]gjson.Result
var names []string
var ActivityJsonConf string
//LoadConfig 开始加载配置文件
func LoadConfig() error {
	jsonDatas = make(map[int]map[string]gjson.Result)

	filePath := "conf/jsonConf.json"
	byteData, err := ioutil.ReadFile(filePath)

	if (err != nil) {
		fmt.Errorf("加载jsonConf.json失败...")
		return err
	}

	res := gjson.ParseBytes(byteData).Map()
	for key, value := range res {
		f := fmt.Sprintf("conf/%s", value)
		b, e := ioutil.ReadFile(f)
		utils.Assert(e == nil, fmt.Sprintf("加载%s文件失败", f))
		r := gjson.ParseBytes(b).Map()
		id, _ := strconv.Atoi(key)
		jsonDatas[id] = r
	}
	fmt.Println("初始化配置文件成功...")
	return nil
}

func loadNamesConf() error {
	filePath := "conf/robotNames.txt"
	byteData, err := ioutil.ReadFile(filePath)
	if (err != nil) {
		return err
	}
	str := string(byteData)
	names = strings.Split(str, ",")
	return nil
}

//GetRandomName 获取随机名字
func GetRandomName() string {
	n := utils.RandInt(0, len(names))
	return names[n]
}

//GetJsonDataById 根据配置文件ID获取json文件数据
func GetJsonDataById(id int) map[string]gjson.Result {
	jsonData, ok := jsonDatas[id]
	utils.Assert(ok, fmt.Sprintf("找不到json数据，jsonID:%d", id))
	return jsonData
}

func DeleteJsonDataById(id int) {
	_, ok := jsonDatas[id]
	if (ok) {
		delete(jsonDatas, id)
	}
}
