package common

import (
	"github.com/liangdas/mqant/log"
	"server/global"
	"server/utils"
)

var MiscMgr *MiscManager

type MiscManager struct {
	Factory
	miscData map[string]*MiscData //杂项表
}

func InitMiscData() {
	m := &MiscManager{}
	log.Debug("InitMiscData..")
	m.miscData = m.getMiscData()
	MiscMgr = m
}

//杂项数据
type MiscData struct {
	Property string
	Value    string
}

func (this *MiscManager) getMiscData() map[string]*MiscData {
	miscData := make(map[string]*MiscData)
	jsonData := GetJsonDataById(1)
	log.Debug("[getMiscData] decode misc data.")
	for _, node := range jsonData {
		property := this.ToString(node, "property")
		gameIds := this.ToInt32Array(node, "gameId", ",")
		if (!this.checkGameId(gameIds)) {
			continue
		}
		data := &MiscData{}
		data.Property = property
		data.Value = this.ToString(node, "value")
		miscData[property] = data
	}
	miscData["none"] = &MiscData{
		Property: "0",
		Value:    "0",
	}
	return miscData
}

func (this *MiscManager) GetMiscDataBy(id string) *MiscData {
	if val,ok := this.miscData[id];ok{
		return val
	}
	return this.miscData["none"]
}

func (this *MiscManager) checkGameId(ids []int32) bool {
	for _, id := range ids {
		if (id == 0) {
			return true
		}
		if (id == global.GameId) {
			return true
		}
	}
	return false
}

func (this *MiscData) ValueToInt() int {
	return int(utils.StringToInt32(this.Value))
}
func (this *MiscData) ValueToInt32() int32 {
	return utils.StringToInt32(this.Value)
}

func (this *MiscData) ValueToInt32Array(split string) []int32 {
	return utils.StringToInt32Array(this.Value, split)
}

func (this *MiscData) ValueToInt64Array(split string) []int64 {
	return utils.StringToInt64Array(this.Value, split)
}
func (this *MiscData) ValueToInt64() int64 {
	return utils.StringToInt64(this.Value)
}
