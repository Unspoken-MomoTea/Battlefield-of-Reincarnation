package game

import (
	"server/common"
)

type GameFactory struct {
	common.Factory
}

func NewGameFactory() *GameFactory {
	return &GameFactory{}
}