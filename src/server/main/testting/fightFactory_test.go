package testting

import (
	"testing"
	"server/common"
	"fmt"
	"server/fight/fightData"
)

func TestFightFactory(t *testing.T)  {
	common.LoadConfig()
	factory := fightData.NewFightFactory()
	data := factory.GetPlayerDatas()
	data1 := factory.GetSkillDatas()
	data2 := factory.GetEffectDatas()
	data3 := factory.GetAIDatas()
	data4 := factory.GetTriggerDatas()
	data5 := factory.GetMapData()

	fmt.Println(data)
	fmt.Println(data1)
	fmt.Println(data2)
	fmt.Println(data3)
	fmt.Println(data4)
	fmt.Println(data5)
	t.Log("测试通过。。。")
}
