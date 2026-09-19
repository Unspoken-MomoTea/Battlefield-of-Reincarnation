package item

type ItemData struct {
	ItemId        int
	Count         int   //数量
	NextResetTime int64 //下次重置时间
}

func NewItemData(id int, count int) *ItemData {
	data := &ItemData{
		ItemId: id,
		Count:  count,
	}
	return data
}

//设置数量
func (this *ItemData) SetCount(count int) {
	if (count < 0) {
		count = 0
	}
	this.Count = count
}

//增加数量
func (this *ItemData) AddCount(count int) {
	this.SetCount(this.Count + count)
}

//减少次数
func (this *ItemData) SubCount(count int) {
	this.SetCount(this.Count - count)
}

//设置重置时间
func (this *ItemData) SetRestTime(t int64) {
	this.NextResetTime = t
}

func (this *ItemData) GetId() int {
	return this.ItemId
}

func (this *ItemData) GetNum() int {
	return this.Count
}
