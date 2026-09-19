package testting

import (
	"fmt"
	"github.com/liangdas/mqant/log"
	"testing"
	"time"
)

var index = 0

func TestTimer(t *testing.T) {
	//timer := utils.NewTimer()
	//handler := &utils.TimerHandler{trace}
	//timer.AddDelayCallBack(1, handler, -1, nil)
	//for {
	//	time.Sleep(20 * time.Millisecond)
	//	timer.Update(.02)
	//}
	now := time.Now()
	ondayLater := now.AddDate(0,0,1)
	log.Debug("ondayLater v%",ondayLater)
	ondayLater = time.Date(ondayLater.Year(),ondayLater.Month(),ondayLater.Day(),0,0,0,0,time.Local)
	log.Debug("ondayLater1 v%",ondayLater)
}

func trace(d interface{}) {
	index++
	fmt.Println(index)
}
