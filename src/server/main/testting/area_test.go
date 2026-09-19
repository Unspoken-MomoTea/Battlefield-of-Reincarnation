package testting

import (
	"server/utils"
	"testing"
)

func TestCircle(t *testing.T) {
	area := utils.NewArea()
	area.AddCircle(50, 90)
	//area.GetPosition().X = 35
	//area.GetPosition().Y = 35
	area.Flip(true)
	pt := &utils.Vector2D{-35, -35}
	result := area.CheckPointIn(pt)
	t.Logf("%t", result)
}
