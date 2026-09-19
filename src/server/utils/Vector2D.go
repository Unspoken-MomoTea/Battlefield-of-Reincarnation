package utils

import (
	"math"
)

type Vector2D struct {
	X float64
	Y float64
}

func (this *Vector2D) Clone() *Vector2D {
	return &Vector2D{this.X, this.Y}
}
func (this *Vector2D) ToAngle() float64 {
	y := &Vector2D{X: 1, Y: 0}
	return this.Angle(y)
}

func (this *Vector2D) ToRadian() float64 {
	y := &Vector2D{X: 1, Y: 0}
	return this.Radian(y)
}

func (this *Vector2D) ContainInRectRange(v *Vector2D, r float64) bool {
	if v.X >= this.X-r && v.X <= this.X+r && v.Y >= this.Y-r && v.Y <= this.Y+r {
		return true
	}
	return false
}

func (this *Vector2D) ContainInRange(v *Vector2D, r float64) bool {
	if this.DistanceSq(v) <= r*r {
		return true
	}
	return false
}

func (this *Vector2D) LengthSq() float64 {
	return this.X*this.X + this.Y*this.Y
}

func (this *Vector2D) Length() float64 {
	return math.Sqrt(this.LengthSq())
}

func (this *Vector2D) DistanceSq(v *Vector2D) float64 {
	return (this.X-v.X)*(this.X-v.X) + (this.Y-v.Y)*(this.Y-v.Y)
}

func (this *Vector2D) Distance(v *Vector2D) float64 {
	return math.Sqrt(this.DistanceSq(v))
}

func (this *Vector2D) Equal(v *Vector2D) bool {
	return this.X == v.X && this.Y == v.Y
}

func (this *Vector2D) Orth() *Vector2D {
	return &Vector2D{
		X: -this.Y,
		Y: this.X,
	}
}

func (this *Vector2D) Reverse() *Vector2D {
	return &Vector2D{
		X: -this.X,
		Y: -this.Y,
	}
}

func (this *Vector2D) Add(v *Vector2D) *Vector2D {
	return &Vector2D{
		X: this.X + v.X,
		Y: this.Y + v.Y,
	}
}

func (this *Vector2D) AddSelf(v *Vector2D) *Vector2D {
	this.X += v.X
	this.Y += v.Y
	return this
}

func (this *Vector2D) Sub(v *Vector2D) *Vector2D {
	return &Vector2D{
		X: this.X - v.X,
		Y: this.Y - v.Y,
	}
}

func (this *Vector2D) SubSelf(v *Vector2D) *Vector2D {
	this.X -= v.X
	this.Y -= v.Y
	return this
}

func (this *Vector2D) Mul(v float64) *Vector2D {
	return &Vector2D{
		X: this.X * v,
		Y: this.Y * v,
	}
}

func (this *Vector2D) MulSelf(v float64) *Vector2D {
	this.X *= v
	this.Y *= v
	return this
}

func (this *Vector2D) Div(v float64) *Vector2D {
	return &Vector2D{
		X: this.X / v,
		Y: this.Y / v,
	}
}

func (this *Vector2D) DivSelf(v float64) *Vector2D {
	this.X /= v
	this.Y /= v
	return this
}

func (this *Vector2D) Angle(v *Vector2D) float64 {
	return this.Radian(v) * 180 / math.Pi
}

func (this *Vector2D) Radian(v *Vector2D) float64 {
	sin := this.X*v.Y - v.X*this.Y
	cos := this.X*v.X + this.Y*v.Y
	return math.Atan2(sin, cos)
}

func (this *Vector2D) Rotate(alpha float64) *Vector2D {
	return &Vector2D{
		X: this.X*math.Cos(alpha) - this.Y*math.Sin(alpha),
		Y: this.X*math.Sin(alpha) + this.Y*math.Cos(alpha),
	}
}

func (this *Vector2D) Norm() *Vector2D {
	l := this.Length()
	return &Vector2D{
		X: this.X / l,
		Y: this.Y / l,
	}
}

func (this *Vector2D) NormSelf() *Vector2D {
	l := this.Length()
	this.X /= l
	this.Y /= l
	return this
}

func (this *Vector2D) NormSelfWidth(l float64) *Vector2D {
	this.X /= l
	this.Y /= l
	return this
}

func (this *Vector2D) Dot(v *Vector2D) float64 {
	return this.X * v.X + this.Y * v.Y
}
