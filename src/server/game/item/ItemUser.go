package item

import (
	"fmt"
	"github.com/liangdas/mqant/log"
	"server/redisClient"
)

//物品用户管理
type ItemUser struct {
	uid   int32
	items []*ItemData
}

//初始化itemUser
func NewItemUser(uid int32) *ItemUser {
	data := &ItemUser{}
	data.uid = uid
	data.init()
	return data
}

func (this *ItemUser) init() {
	this.items = make([]*ItemData, 0)
	this.LoadFromDB()
}

//根据物品id获取物品数据
func (this *ItemUser) GetItemDataBy(itemId int) *ItemData {
	for _, item := range this.items {
		if (item.ItemId == itemId) {
			return item
		}
	}
	return nil
}

//添加物品数量
func (this *ItemUser) AddItemCount(itemId int, itemCount int) *ItemData {
	return this.updateItemCount(itemId, itemCount, 2)
}

//更新物品数量
func (this *ItemUser) UpdateItemCount(itemId int, itemCount int) *ItemData {
	return this.updateItemCount(itemId, itemCount, 1)
}

//减少物品数量
func (this *ItemUser) SubItemCount(itemId int, itemCount int) *ItemData {
	return this.updateItemCount(itemId, itemCount, 3)
}

//更新物品数量,内部使用
//itemId 物品id
//itemCount 物品数量
//t 处理方式,1:设置数量,2:添加数量,3:减少数量
func (this *ItemUser) updateItemCount(itemId int, itemCount int, t int) *ItemData {
	itemData := this.GetItemDataBy(itemId)
	if (itemData == nil) {
		itemData = NewItemData(itemId, 0)
		this.items = append(this.items, itemData)
	}
	switch t {
	case 1:
		itemData.SetCount(itemCount)
	case 2:
		itemData.AddCount(itemCount)
	case 3:
		itemData.SubCount(itemCount)
	}
	this.SaveItemToDB(itemData)
	return itemData
}

func (this *ItemUser) GetAllItems() []*ItemData {
	return this.items
}

func (this *ItemUser) LoadFromDB() {
	keys, e := redisClient.Keys(fmt.Sprintf("item:%v:*", this.uid))
	if e == nil && keys != nil && len(keys) > 0 {
		for _, key := range keys {
			itemData := NewItemData(0, 0)
			if e := redisClient.HGetall(key, itemData); e != nil {
				log.Error(e.Error())
				continue
			}
			this.items = append(this.items, itemData)
		}
	}
}

//保存item数据到数据库
func (this *ItemUser) SaveItemToDB(item *ItemData) {
	key := fmt.Sprintf("item:%v:%v", this.uid, item.ItemId)
	if e := redisClient.HMSet(key, item); e != nil {
		log.Error(e.Error())
	}
}
