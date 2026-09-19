package rank

import (
	"fmt"
	"github.com/liangdas/mqant/log"
	"server/redisClient"
)

type RankData struct {
	rankType string
	ranks    []*RankUserData
}

func NewRankData(tp string) *RankData {
	data := &RankData{
		rankType: tp,
	}
	data.init()
	return data
}

func (this *RankData) init() {
	this.Rank()
}

func (this *RankData) Rank() {
	this.ranks = make([]*RankUserData, 0)
	if uidList, err := redisClient.Zrevrange(this.rankType, 0, rankLength); err != nil {
		log.Error(err.Error())
	} else {
		for _, idStr := range uidList {
			userData := &RankUserData{}
			e := redisClient.HGetall(fmt.Sprintf("user:%s", idStr), userData)
			if (e != nil) {
				log.Error("[RankData rank] Error:%v", e.Error())
				continue
			}
			score, e := redisClient.Zscore(this.rankType, idStr)
			if (e != nil) {
				log.Error("[RankData rank] Error:%v", e.Error())
				continue
			}
			userData.Score = score
			this.ranks = append(this.ranks, userData)
		}
	}
}

func (this *RankData) GetRanks() []*RankUserData {
	return this.ranks
}

func (this *RankData) GetRankByUid(uid int32) int {
	for i := 0; i < len(this.ranks); i++ {
		data := this.ranks[i]
		if (data.Id == uid) {
			return i + 1
		}
	}
	if rank, e := redisClient.Zrevrank(this.rankType, fmt.Sprintf("%v", uid)); e == nil && rank != -1 {
		return int(rank) + 1
	}
	return 0
}
