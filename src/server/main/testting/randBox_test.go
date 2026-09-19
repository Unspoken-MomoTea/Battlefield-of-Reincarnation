package testting

import (
	"testing"
	"server/common"
	"fmt"
)

func TestRandBox(t *testing.T) {
	common.LoadConfig()

	//dataManager := box.GetBoxDataManager()
	//cBox := dataManager.BoxDataByCid(1003)

	//for i := 0; i < 100000; i++ {
	//	_, _, items := cBox.RandBoxReward()
	//	utils.Assert(len(items) == 4, "len %d != 4", len(items))
	//}

	fmt.Println("testing run over")
}