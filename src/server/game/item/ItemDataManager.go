package item

import (
	"github.com/liangdas/mqant/utils"
)

type ItemDataManager struct {
	itemUsers *utils.BeeMap //玩家物品列表,map[int64][]*ItemData
}

func NewItemDataManager() *ItemDataManager {
	manager := &ItemDataManager{}
	manager.initData()
	return manager
}

func (this *ItemDataManager) initData() {
	this.itemUsers = utils.NewBeeMap()
}

//玩家登录
func (this *ItemDataManager) OnLogin(uid int32) {
	if (uid == 0) {
		return
	}
	obj := this.itemUsers.Get(uid)
	if (obj == nil) {
		itemUser := NewItemUser(uid)
		this.itemUsers.Set(uid, itemUser)
	}
}

//玩家登出
func (this *ItemDataManager) OnLogout(uid int32) {
	if (uid == 0) {
		return
	}
	if ok := this.itemUsers.Check(uid); ok {
		this.itemUsers.Delete(uid)
	}
}

// 添加物品
func (this *ItemDataManager) OnAddItem(uid int32, itemId int, itemCount int) (errorCode int, itemData *ItemData) {
	itemUser, errorCode := this.GetItemUser(uid)

	if (errorCode == 0) {
		itemData = itemUser.AddItemCount(itemId, itemCount)
	}

	return errorCode, itemData
}

// 更新物品
func (this *ItemDataManager) OnUpdateItem(uid int32, itemId int, itemCount int) (errorCode int, itemData *ItemData) {
	itemUser, errorCode := this.GetItemUser(uid)
	if (errorCode == 0) {
		itemData = itemUser.UpdateItemCount(itemId, itemCount)
	}

	return errorCode, itemData
}

// 使用物品
func (this *ItemDataManager) OnUseItem(uid int32, itemId int, itemCount int) (errorCode int, itemData *ItemData) {
	itemUser, errorCode := this.GetItemUser(uid)

	if (errorCode == 0) {
		itemData = itemUser.SubItemCount(itemId, itemCount)
	}

	return errorCode, itemData
}

// 获取物品用户管理
func (this *ItemDataManager) GetItemUser(uid int32) (user *ItemUser, errorCode int) {
	if ok := this.itemUsers.Check(uid); ok {
		return this.itemUsers.Get(uid).(*ItemUser), 0
	}
	return nil, 1
}
