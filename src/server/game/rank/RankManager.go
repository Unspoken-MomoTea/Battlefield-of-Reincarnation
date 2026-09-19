package rank

import (
	"github.com/liangdas/mqant/log"
	"server/define"
	"server/redisClient"
	"sync"
)

var rankLength = 50

type RankManager struct {
	ranks  map[string]*RankData
	locker *sync.RWMutex
}

func NewRankManager() *RankManager {
	data := &RankManager{}
	data.ranks = make(map[string]*RankData)
	data.locker = new(sync.RWMutex)
	data.ranks[define.RANK_SCENE_LEVEL] = NewRankData(define.RANK_SCENE_LEVEL)
	return data
}

func (this *RankManager) Rank() {
	this.locker.Lock()
	defer this.locker.Unlock()

	for _, rank := range this.ranks {
		rank.Rank()
	}
}

func (this *RankManager) GetRankDataBy(rankType string) (data *RankData, errorCode int) {
	this.locker.Lock()
	defer this.locker.Unlock()

	if data, ok := this.ranks[rankType]; ok {
		return data, 0
	}
	if list, err := redisClient.Zrevrange(rankType, 0, rankLength); err != nil || len(list) == 0 {
		if (err != nil) {
			log.Error(err.Error())
		}
	} else {
		data := NewRankData(rankType)
		this.ranks[rankType] = data
		return data, 0
	}
	return nil, 14
}
