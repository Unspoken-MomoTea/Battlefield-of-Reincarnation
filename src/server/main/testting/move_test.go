package testting

import (
	"testing"
	"server/fight"
	"github.com/liangdas/mqant/log"
	"server/utils"
)

var mc *fight.MoveController
var room *fight.FightRoom

func TestMove(t *testing.T) {
	//common.LoadConfig()
	//dataManager := fightData.NewFightDataManager()
	//room = fight.NewFightRoom(1, dataManager)
	//node := NewTestNode()
	//mc = fight.NewMoveController(room)
	//mc.AddData(node)
	//room.Start()
	//ch := make(chan bool)
	//startMoveHandler = &utils.TimerHandler{startMove}
	//startMove(nil)
	//<-ch
}

func startMove(data interface{}) {
	w := 1198 / 2
	h := 456 / 2
	posX := float64(utils.RandInt32(-int32(w), int32(w)))
	posY := float64(utils.RandInt32(-int32(h), int32(h)))
	speed := 100.0;
	targetPos := &utils.Vector2D{
		X: posX,
		Y: posY,
	}
	log.Info("start move --> x:%f,y:%f", targetPos.X, targetPos.Y)
	mc.MoveBySpeed(targetPos, speed, moveEnd)
}
var startMoveHandler *utils.TimerHandler
func moveEnd() {
	log.Info("move end.............")
	//startMove(nil)
	room.AddDelayCallBack(1, startMoveHandler, 1, nil)
}

type TestNode struct {
	position *utils.Vector2D
}

func NewTestNode() *TestNode {
	node := new(TestNode)
	node.position = new(utils.Vector2D)
	return node
}
func (this *TestNode) SetX(v float64) {
	this.position.X = v
	log.Info("x:%f", v)
}
func (this *TestNode) GetX() float64 {
	return this.position.X
}
func (this *TestNode) SetY(v float64) {
	this.position.Y = v
	log.Info("y:%f", v)
}
func (this *TestNode) GetY() float64 {
	return this.position.Y
}
func (this *TestNode) GetPosition() *utils.Vector2D {
	return this.position
}
