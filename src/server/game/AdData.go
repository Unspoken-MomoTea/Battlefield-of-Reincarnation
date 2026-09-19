package game

import (
	"fmt"
	"github.com/liangdas/mqant/log"
	"server/redisClient"
	"server/utils"
)

//广告数据控制
type AdDataControl struct {
	dataList map[int]*AdData
	userData *UserData
}

func NewAdDataControl(data *UserData) *AdDataControl {
	d := &AdDataControl{}
	d.userData = data
	d.dataList = make(map[int]*AdData)
	return d
}

//单个广数据
type AdData struct {
	Id    int
	Times int
}

func (this *AdDataControl) LoadFromDB() bool {
	allkeys, _ := redisClient.HKeys(fmt.Sprintf("adData:%d", this.userData.Id))
	if (allkeys == nil) {
		return false
	}
	for _, key := range allkeys {
		id := utils.StringToInt32(key)
		v := 0
		if value, err := redisClient.HGet(fmt.Sprintf("adData:%d", this.userData.Id), key); err == nil {
			v = int(utils.StringToInt32(value))
		} else {
			log.Error(err.Error())
			continue
		}
		d := &AdData{
			Id:    int(id),
			Times: v,
		}
		this.dataList[d.Id] = d
	}
	return true
}

func (this *AdDataControl) AddTimes(id int, v int) int {
	if data, ok := this.dataList[id]; ok {
		data.Times += v
		v = data.Times
	} else {
		data = &AdData{
			Id:    id,
			Times: v,
		}
		this.dataList[id] = data
	}
	this.SaveByKey(fmt.Sprintf("%v", id), v)
	return v
}

func (this *AdDataControl) SetTimes(id int, v int) {
	if data, ok := this.dataList[id]; ok {
		data.Times = v
	} else {
		data = &AdData{
			Id:    id,
			Times: v,
		}
		this.dataList[id] = data
	}
	this.SaveByKey(fmt.Sprintf("%v", id), v)
}

func (this *AdDataControl) GetTimes(id int) (times int, ok bool) {
	if data, ok := this.dataList[id]; ok {
		return data.Times, true
	}
	return 0, false
}

func (this *AdDataControl) SaveAll() {
	for _, data := range this.dataList {
		this.SaveByKey(fmt.Sprintf("%v", data.Id), data.Times)
	}
}

//保存单条数据
func (this *AdDataControl) SaveByKey(key string, val interface{}) {
	e := redisClient.HSet(fmt.Sprintf("adData:%d", this.userData.Id), key, fmt.Sprintf("%v", val))
	if (e != nil) {
		log.Error("[GameDataManager SaveByKey] Error:%v", e.Error())
	}
}
