package share

type ShareData struct {
	ShareId int
	Count   int   //数量
}

func NewShareData(id int, count int) *ShareData {
	data := &ShareData{
		ShareId: id,
		Count:   count,
	}
	return data
}

//设置数量
func (this *ShareData) SetCount(count int) {
	if (count < 0) {
		count = 0
	}
	this.Count = count
}

//增加数量
func (this *ShareData) AddCount(count int) {
	this.SetCount(this.Count + count)
}

//减少次数
func (this *ShareData) SubCount(count int) {
	this.SetCount(this.Count - count)
}

func (this *ShareData) GetId() int {
	return this.ShareId
}

func (this *ShareData) GetNum() int {
	return this.Count
}

