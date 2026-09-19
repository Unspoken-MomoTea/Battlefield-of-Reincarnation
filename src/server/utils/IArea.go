package utils

type IArea interface {
	CheckPointIn(pt *Vector2D) bool
	HitTestWidthRect(rect *Rect) bool
	HitTestWidthBox(box *Box) bool
	HitTestWidthCircle(circle *Circle) bool
	AreaType() AreaType
	Flip(b bool)
	GetPosition() *Vector2D
}

