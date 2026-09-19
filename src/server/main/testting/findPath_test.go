package testting

import (
	"testing"
	"server/common"
	"server/fight"
	"runtime"
	"time"
	"fmt"
	"server/utils"
)

//寻路算法测试
func TestFindPath(t *testing.T) {
	//common.LoadConfig()
	//room := getRoom()
	//currentPos := &utils.Vector2D{-565.00, -12}
	//targetPos := &utils.Vector2D{560.00, -12}
	//path := room.FightMap().FindPath(currentPos, targetPos)
	//
	//str := "path:"
	//for _, p := range path {
	//	str += fmt.Sprintf("%v,", *p)
	//}
	//log.Debug(str)
}

//寻路性能测试
func TestFinPathPerformance(t *testing.T) {
	runtime.GOMAXPROCS(runtime.NumCPU())
	common.LoadConfig()
	roomNum := 10000
	rooms := make([]*fight.FightRoom, roomNum, roomNum)
	fmt.Println("初始化数据中...")
	for i := 0; i < roomNum; i++ {
		rooms[i] = getRoom()
	}
	fmt.Println("开始寻路...")
	dt := time.Now().UnixNano() / 1e6
	ch := make(chan bool)
	for i := 0; i < roomNum; i++ {
		go finath(rooms[i], ch)
	}
	for i := 0; i < roomNum; i++ {
		<-ch
	}
	t.Logf("used time:%d", time.Now().UnixNano()/1e6-dt)
}

//放置点位置测试
func TestPlacePoint(t *testing.T) {
	common.LoadConfig()
	room := getRoom()
	v1 := &utils.Vector2D{-310, -125}
	b1 := room.FightMap().CheckPlaceable(1, v1, false)
	t.Logf("%t", b1)
}

func getRoom() *fight.FightRoom {
	//dataManager := fightData.NewFightDataManager()
	//room := fight.NewFightRoom(1, dataManager)
	//p1 := basegate.NewSessionTest("1")
	//p2 := basegate.NewSessionTest("2")
	//room.InitDataTest(p1, p2, nil)

	return nil
}

func finath(room *fight.FightRoom, ch chan bool) {
	//currentPos := &utils.Vector2D{-565.00, -12}
	//targetPos := &utils.Vector2D{560.00, -12}
	//for i := 0; i < 100; i++ {
	//	room.FightMap().FindPath(currentPos, targetPos)
	//}
	//ch <- true
}
