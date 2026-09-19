package gameLevel

type GameLevelData struct {
	Chapter     int //章节
	GameLevelId int //关卡id
	StartCount  int //星星数量
	State       int //关卡状态
}

func NewGameLevelData(chapter int, id int) *GameLevelData {
	data := &GameLevelData{
		Chapter:     chapter,
		GameLevelId: id,
		StartCount:  0,
		State:       0,
	}
	return data
}

//设置星星数量
func (this *GameLevelData) UpdateState(startCount int, state int) {
	if (startCount < 0) {
		startCount = 0
	}
	this.StartCount = startCount
	this.State = state
}
