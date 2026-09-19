package share

import (
	"fmt"
	"github.com/liangdas/mqant/log"
	"server/redisClient"
)

//分享用户管理
type ShareUser struct {
	uid   int32
	Shares []*ShareData
}

//初始化ShareUser
func NewShareUser(uid int32) *ShareUser {
	data := &ShareUser{}
	data.uid = uid
	data.init()
	return data
}

func (this *ShareUser) init() {
	this.Shares = make([]*ShareData, 0)
	this.LoadFromDB()
}

//根据分享id获取分享数据
func (this *ShareUser) GetShareDataBy(shareId int) *ShareData {
	for _, Share := range this.Shares {
		if (Share.ShareId == shareId) {
			return Share
		}
	}
	return nil
}

//添加分享次数
func (this *ShareUser) AddShareCount(shareId int, shareCount int) *ShareData {
	return this.updateShareCount(shareId, shareCount, 2)
}

//更新分享次数
func (this *ShareUser) UpdateShareCount(shareId int, shareCount int) *ShareData {
	return this.updateShareCount(shareId, shareCount, 1)
}

//更新分享次数,内部使用
//ShareId 分享id
//ShareCount 分享次数
//t 处理方式,1:设置次数,2:添加次数
func (this *ShareUser) updateShareCount(shareId int, shareCount int, t int) *ShareData {
	ShareData := this.GetShareDataBy(shareId)
	if (ShareData == nil) {
		ShareData = NewShareData(shareId, 0)
		this.Shares = append(this.Shares, ShareData)
	}
	switch t {
	case 1:
		ShareData.SetCount(shareCount)
	case 2:
		ShareData.AddCount(shareCount)
	}
	this.SaveShareToDB(ShareData)
	return ShareData
}

func (this *ShareUser) GetAllShares() []*ShareData {
	return this.Shares
}

func (this *ShareUser) LoadFromDB() {
	keys, e := redisClient.Keys(fmt.Sprintf("Share:%v:*", this.uid))
	if e == nil && keys != nil && len(keys) > 0 {
		for _, key := range keys {
			shareData := NewShareData(0, 0)
			if e := redisClient.HGetall(key, shareData); e != nil {
				log.Error(e.Error())
				continue
			}
			this.Shares = append(this.Shares, shareData)
		}
	}
}

//保存Share数据到数据库
func (this *ShareUser) SaveShareToDB(share *ShareData) {
	key := fmt.Sprintf("share:%v:%v", this.uid, share.ShareId)
	if e := redisClient.HMSet(key, share); e != nil {
		log.Error(e.Error())
	}
}

