package share

import (
	"github.com/liangdas/mqant/utils"
)

type ShareDataManager struct {
	ShareUsers *utils.BeeMap //玩家分享数据列表,map[int64][]*ShareData
}

func NewShareDataManager() *ShareDataManager {
	manager := &ShareDataManager{}
	manager.initData()
	return manager
}

func (this *ShareDataManager) initData() {
	this.ShareUsers = utils.NewBeeMap()
}

//玩家登录
func (this *ShareDataManager) OnLogin(uid int32) {
	if (uid == 0) {
		return
	}
	obj := this.ShareUsers.Get(uid)
	if (obj == nil) {
		ShareUser := NewShareUser(uid)
		this.ShareUsers.Set(uid, ShareUser)
	}
}

//玩家登出
func (this *ShareDataManager) OnLogout(uid int32) {
	if (uid == 0) {
		return
	}
	if ok := this.ShareUsers.Check(uid); ok {
		this.ShareUsers.Delete(uid)
	}
}

// 添加分享
func (this *ShareDataManager) OnAddShare(uid int32, ShareId int, ShareCount int) (errorCode int, ShareData *ShareData) {
	ShareUser, errorCode := this.GetShareUser(uid)

	if (errorCode == 0) {
		ShareData = ShareUser.AddShareCount(ShareId, ShareCount)
	}

	return errorCode, ShareData
}

// 添加分享
func (this *ShareDataManager) OnUpdateShare(uid int32, ShareId int, ShareCount int) (errorCode int, ShareData *ShareData) {
	ShareUser, errorCode := this.GetShareUser(uid)
	if (errorCode == 0) {
		ShareData = ShareUser.UpdateShareCount(ShareId, ShareCount)
	}

	return errorCode, ShareData
}

// 获取分享用户管理
func (this *ShareDataManager) GetShareUser(uid int32) (user *ShareUser, errorCode int) {
	if ok := this.ShareUsers.Check(uid); ok {
		return this.ShareUsers.Get(uid).(*ShareUser), 0
	}
	return nil, 1
}
