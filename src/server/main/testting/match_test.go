package testting

import (
	"testing"
)

func TestLoadMatchConf(t *testing.T) {
	//common.LoadConfig()
	//datas := match.GetMatchDatas()
	//if (datas != nil) {
	//	t.Logf("恭喜你，测试通过")
	//	for i := 0; i < len(datas); i++ {
	//		data := datas[i]
	//		fmt.Println(*data)
	//	}
	//} else {
	//	t.Failed()
	//}
}

func TestNewMatchController(t *testing.T) {
	//runtime.GOMAXPROCS(runtime.NumCPU())
	//common.LoadConfig()
	//datas := match.GetMatchDatas()
	//controller := match.NewMatchController(datas)
	//num := 100000
	//idIndex := 0
	//for k := 0; k < 2; k++ {
	//	roleList := make(map[string]int32)
	//	//honorList := []int32{81,137,97,59,81,68,175,40,206,50,194,11,162,89,228,24,211,195,237,106,245,216,28,8,47,197,37,138,40,15,41,158,137,81,179,106,237,131,235,26,163,90,194,63,183,147,78,74,159,103,207,221,189,199,0,205,138,38,203,105,201,10,105,156,16,78,61,202,33,246,63,126,2,218,197,94,77,213,246,170,123,203,137,133,241,59,33,143,141,2,128,86,46,107,190,3,52,93,205,98}
	//	//str := ""
	//	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	//	for i := 0; i <= num; i++ {
	//		honor := r.Int31n(5000)
	//		//honor := honorList[i-1]
	//		//str += strconv.Itoa(int(honor)) + ","
	//		roleList[strconv.Itoa(i)] = honor
	//	}
	//	//fmt.Println(str)
	//	n := 0
	//	lock := new(sync.Mutex)
	//	done := make(chan bool)
	//	for i := 0; i < len(roleList); i++ {
	//		go func(b int) {
	//			lock.Lock()
	//			idIndex++
	//			j := idIndex
	//			lock.Unlock()
	//			id := strconv.Itoa(j)
	//			honor := roleList[id]
	//			session := basegate.NewSessionTest(id)
	//			session.Set("Honor", strconv.Itoa(int(honor)))
	//			_, _, ok := controller.StartMatchPlayer(session)
	//			//fmt.Printf("开始匹配id:%s,honor:%d\n", id, honor)
	//			if (!ok) {
	//				//fmt.Println("匹配失败,等待继续匹配...")
	//			} else {
	//				n++
	//				//fmt.Printf("匹配成功!player1:%d,player2:%d\n", p1.GetID(), p2.GetID())
	//			}
	//			if (b == len(roleList)-1) {
	//				fmt.Printf("------------------------------%d\n", len(roleList))
	//				done <- true
	//			}
	//		}(i)
	//	}
	//	<-done
	//	close(done)
	//	fmt.Printf("剩余人数:%d\n", controller.GetPlayerIdLength())
	//	//for key, honor := range roleList {
	//	//	session := basegate.NewSessionTest(key)
	//	//	p1, p2, ok := controller.StartMatchPlayer(session, honor)
	//	//	fmt.Printf("开始匹配id:%s,honor:%d",key,honor)
	//	//	if (!ok) {
	//	//		fmt.Println("匹配失败,等待继续匹配...")
	//	//	} else {
	//	//		n++
	//	//		fmt.Printf("匹配成功!player1:%d,player2:%d\n", p1.GetID(), p2.GetID())
	//	//	}
	//	//}
	//	fmt.Printf("totoal match:%d===================\n", n)
	//}
	//
	//nomatchSession := controller.GetAllNoMatchPalyers()
	//n:=1
	//for _, s := range nomatchSession {
	//	_, _, ok := controller.StartMatchPlayer(s)
	//	//fmt.Printf("开始匹配id:%s,honor:%d\n", id, honor)
	//	if (!ok) {
	//		//fmt.Println("匹配失败,等待继续匹配...")
	//	} else {
	//		n++
	//		//fmt.Printf("匹配成功!player1:%d,player2:%d\n", p1.GetID(), p2.GetID())
	//	}
	//}
	//fmt.Printf("最后剩余的重新匹配人数:%d",n)
}
