package utils

import (
	"math"
)

type AreaType int

const (
	AT_NONE   AreaType = iota
	AT_CIRCLE  //圆形区域(包括扇形)
	AT_RECT    //矩形区域
	AT_BOX     //box
)

//Area 区域
type Area struct {
	AreaType    AreaType
	Rect        *Rect
	Circle      *Circle
	currentArea IArea
}

func NewArea() *Area {
	return &Area{}
}

func (this *Area) CheckPointIn(pt *Vector2D) bool {
	if (this.currentArea == nil) {
		return false
	}
	return this.currentArea.CheckPointIn(pt)
}

//HitTestWidthRect 圆形跟box碰撞检测
func (this *Area) HitTest(v IArea) bool {
	if (this.currentArea == nil) {
		return false
	}
	switch v.AreaType() {
	case AT_CIRCLE:
		return this.currentArea.HitTestWidthCircle(v.(*Circle))
	case AT_RECT:
		return this.currentArea.HitTestWidthRect(v.(*Rect))
	case AT_BOX:
		return this.currentArea.HitTestWidthBox(v.(*Box))
	}
	return false
}

func (this *Area) AddRect(x float64, y float64, w float64, h float64) {
	this.AreaType = AT_RECT
	this.Rect = NewRect(x, y, w, h)
	this.currentArea = this.Rect
}

func (this *Area) AddCircle(radius float64, angle float64) {
	this.AreaType = AT_CIRCLE
	this.Circle = NewCircle(0, 0, angle, radius)
	this.currentArea = this.Circle
}

func (this *Area) Clone() *Area {
	a := &Area{}
	a.AreaType = this.AreaType
	if (this.Rect != nil) {
		a.Rect = this.Rect.Clone()
		a.currentArea = a.Rect
	}
	if (this.Circle != nil) {
		a.Circle = this.Circle.Clone()
		a.currentArea = a.Circle
	}
	return a
}

//Flip 翻转
func (this *Area) Flip(b bool) {
	this.currentArea.Flip(b)
}

func (this *Area) SetPosition(v *Vector2D) {
	pos := this.currentArea.GetPosition()
	pos.X = v.X
	pos.Y = v.Y
}

func (this *Area) GetPosition() *Vector2D {
	return this.currentArea.GetPosition()
}

func (this *Area) SetX(v float64) {
	this.GetPosition().X = v
}

func (this *Area) GetX() float64 {
	return this.GetPosition().X
}

func (this *Area) SetY(v float64) {
	this.GetPosition().Y = v
}

func (this *Area) GetY() float64 {
	return this.GetPosition().Y
}

//Rect 矩形
type Rect struct {
	Position *Vector2D
	Width    float64
	Height   float64
	AnchorX  float64 //X轴锚点
	AnchorY  float64 //Y轴锚点
}

func NewRect(x float64, y float64, w float64, h float64) *Rect {
	return &Rect{
		&Vector2D{x, y},
		w,
		h,
		0,
		0,
	}
}

func (this *Rect) Flip(b bool) {
}

func (this *Rect) AreaType() AreaType {
	return AT_RECT
}

func (this *Rect) Clone() *Rect {
	return &Rect{
		this.Position.Clone(),
		this.Width,
		this.Height,
		this.AnchorX,
		this.AnchorY,
	}
}

func (this *Rect) GetPosition() *Vector2D {
	return this.Position
}

func (this *Rect) CheckPointIn(pt *Vector2D) bool {
	l := this.Position.X - this.Width*this.AnchorX      //左
	r := this.Position.X + this.Width*(1-this.AnchorX)  //右
	u := this.Position.Y + this.Height*(1-this.AnchorY) //上
	d := this.Position.Y - this.Height*this.AnchorY     //下
	return pt.X >= l && pt.X <= r && pt.Y >= d && pt.Y <= u
}

//HitTestWidthRect 检测矩形很矩形相交
func (this *Rect) HitTestWidthRect(rect *Rect) bool {
	//左下角
	ax1 := this.Position.X - this.Width*this.AnchorX
	ay1 := this.Position.Y - this.Height*this.AnchorY
	//右上角
	ax2 := this.Position.X + this.Width*(1-this.AnchorX)
	ay2 := this.Position.Y + this.Height*(1-this.AnchorY)

	bx1 := rect.Position.X - rect.Width*rect.AnchorX
	by1 := rect.Position.Y - rect.Height*rect.AnchorY
	bx2 := rect.Position.X + rect.Width*(1-rect.AnchorX)
	by2 := rect.Position.Y + rect.Height*(1-rect.AnchorY)

	cx1 := math.Max(ax1, bx1)
	cy1 := math.Max(ay1, by1)
	cx2 := math.Min(ax2, bx2)
	cy2 := math.Min(ay2, by2)

	return (cx1 <= cx2 && cy1 <= cy2)
}

//HitTestWidthCircle 检测矩形跟圆形相交
func (this *Rect) HitTestWidthCircle(circle *Circle) bool {
	//圆形中心点
	cPt := circle.Position;

	//矩形左下角
	ax1 := this.Position.X - this.Width*this.AnchorX
	ay1 := this.Position.Y - this.Height*this.AnchorY
	//矩形右上角
	ax2 := this.Position.X + this.Width*(1-this.AnchorX)
	ay2 := this.Position.Y + this.Height*(1-this.AnchorY)
	//矩形中心点
	rPx := ax1 + this.Width*0.5
	rPy := ay1 + this.Height*0.5

	//圆到矩形中心点的向量
	v := &Vector2D{math.Abs(cPt.X - rPx), math.Abs(cPt.Y - rPy)}
	//矩形右上角到矩形重点的向量
	h := &Vector2D{ax2 - rPx, ay2 - rPy}
	u := v.Sub(h)
	u.X = math.Max(u.X, 0)
	u.Y = math.Max(u.Y, 0)

	return u.LengthSq() <= circle.radiusSQ
}

//HitTestWidthBox 检测跟box碰撞
func (this *Rect) HitTestWidthBox(box *Box) bool {
	return box.HitTestWidthRect(this)
}

type Box struct {
	PointLD    *Vector2D //左下角
	PointRU    *Vector2D //右上角
	AnchorX    float64   //X轴锚点
	AnchorY    float64   //Y轴锚点
	initPtLD   *Vector2D //初始左下角
	initPtRU   *Vector2D //初始右上角
	Position   *Vector2D
	scale      float64 //缩放
	Width      float64
	Height     float64
	initWidth  float64
	initHeight float64
}

func NewBox(width float64, height float64, anchorX float64, anchorY float64) *Box {
	box := &Box{}
	box.init(width, height, anchorX, anchorY)
	return box
}
func (b *Box) init(width float64, height float64, anchorX float64, anchorY float64) {
	b.Width = width
	b.Height = height
	b.initWidth = width
	b.initHeight = height
	b.AnchorX = anchorX
	b.AnchorY = anchorY
	b.PointLD = &Vector2D{0, 0}
	b.PointRU = &Vector2D{width, height}
	b.initPtLD = &Vector2D{0, 0}
	b.initPtRU = &Vector2D{width, height}
	b.Position = &Vector2D{0, 0}
	b.scale = 1
}
func (b *Box) SetScale(v float64) {
	if (v == 0) {
		return
	}
	b.scale = v
	b.Width = b.initWidth * v
	b.Height = b.initHeight * v
	b.UpdateBoxRect()
}

func (b *Box) SetPosition(v *Vector2D) {
	b.Position.X = v.X
	b.Position.Y = v.Y
	b.UpdateBoxRect()
}

func (this *Box) GetPosition() *Vector2D {
	return this.Position
}

func (b *Box) SetPositionXY(x float64, y float64) {
	b.Position.X = x
	b.Position.Y = y
	b.UpdateBoxRect()
}

//UpdateBoxRect 使用前需要先计算当前的边界值
func (b *Box) UpdateBoxRect() {
	b.PointLD.X = b.Position.X - b.Width*b.AnchorX
	b.PointLD.Y = b.Position.Y - b.Height*b.AnchorY
	b.PointRU.X = b.Position.X + b.Width*(1-b.AnchorX)
	b.PointRU.Y = b.Position.Y + b.Height*(1-b.AnchorY)
}

func (b *Box) Clone() *Box {
	box := &Box{}
	box.init(b.Width, b.Height, b.AnchorX, b.AnchorY)
	box.SetPosition(b.Position)
	return box
}
func (b *Box) AreaType() AreaType {
	return AT_BOX
}

func (b *Box) Flip(r bool) {

}

//CheckPointIn 检测点是否在矩形内部
func (b *Box) CheckPointIn(pt *Vector2D) bool {
	b.UpdateBoxRect()
	return pt.X >= b.PointLD.X && pt.X <= b.PointRU.X && pt.Y >= b.PointLD.Y && pt.Y <= b.PointRU.Y
}

//HitTestWidthRect 检测矩形跟矩形相交
func (this *Box) HitTestWidthRect(rect *Rect) bool {
	//左下角
	ax1 := this.PointLD.X
	ay1 := this.PointLD.Y
	//右上角
	ax2 := this.PointRU.X
	ay2 := this.PointRU.Y

	bx1 := rect.Position.X - rect.Width*rect.AnchorX
	by1 := rect.Position.Y - rect.Height*rect.AnchorY
	bx2 := rect.Position.X + rect.Width*(1-rect.AnchorX)
	by2 := rect.Position.Y + rect.Height*(1-rect.AnchorY)

	cx1 := math.Max(ax1, bx1)
	cy1 := math.Max(ay1, by1)
	cx2 := math.Min(ax2, bx2)
	cy2 := math.Min(ay2, by2)

	return (cx1 <= cx2 && cy1 <= cy2)
}

//HitTestWidthRect 检测矩形跟Box相交
func (this *Box) HitTestWidthBox(box *Box) bool {
	//左下角
	ax1 := this.PointLD.X
	ay1 := this.PointLD.Y
	//右上角
	ax2 := this.PointRU.X
	ay2 := this.PointRU.Y

	bx1 := box.PointLD.X
	by1 := box.PointLD.Y
	bx2 := box.PointRU.X
	by2 := box.PointRU.Y

	cx1 := math.Max(ax1, bx1)
	cy1 := math.Max(ay1, by1)
	cx2 := math.Min(ax2, bx2)
	cy2 := math.Min(ay2, by2)

	return (cx1 <= cx2 && cy1 <= cy2)
}

//HitTestWidthCircle 跟圆形碰撞检测
func (this *Box) HitTestWidthCircle(circle *Circle) bool {
	//圆形中心点
	cPt := circle.Position;

	//矩形左下角
	ax1 := this.PointLD.X
	ay1 := this.PointLD.Y
	//矩形右上角
	ax2 := this.PointRU.X
	ay2 := this.PointRU.Y
	//矩形中心点
	rPx := ax1 + this.Width*0.5
	rPy := ay1 + this.Height*0.5

	//圆到矩形中心点的向量
	v := &Vector2D{math.Abs(cPt.X - rPx), math.Abs(cPt.Y - rPy)}
	//矩形右上角到矩形重点的向量
	h := &Vector2D{ax2 - rPx, ay2 - rPy}
	u := v.Sub(h)
	u.X = math.Max(u.X, 0)
	u.Y = math.Max(u.Y, 0)

	return u.LengthSq() <= circle.radiusSQ
}

//Circle 圆形
type Circle struct {
	Position  *Vector2D //原点位置
	Angle     float64   //角度
	halfAngle float64   //角度的一半
	Radius    float64   //半径
	radiusSQ  float64   //半径平方
	flip      bool      //是否翻转
}

func NewCircle(x float64, y float64, angle float64, radius float64) *Circle {
	t := &Circle{}
	t.Position = &Vector2D{x, y}
	t.Angle = angle
	t.halfAngle = angle * .5
	t.Radius = radius
	t.radiusSQ = radius * radius
	t.flip = false
	return t
}

func (t *Circle) Flip(b bool) {
	if (t.flip == b) {
		return
	}
	t.flip = b
	t.halfAngle = t.Angle * .5
	if(b){
		t.halfAngle = 180 - t.halfAngle
	}
}

func (t *Circle) AreaType() AreaType {
	return AT_CIRCLE
}

func (t *Circle) Clone() *Circle {
	triangle := &Circle{}
	triangle.Position = t.Position.Clone()
	triangle.Angle = t.Angle
	triangle.halfAngle = t.halfAngle
	triangle.Radius = t.Radius
	triangle.radiusSQ = t.radiusSQ
	return triangle
}

func (this *Circle) GetPosition() *Vector2D {
	return this.Position
}

func (t *Circle) CheckPointIn(pt *Vector2D) bool {
	v := pt.Sub(t.Position)
	if (v.LengthSq() > t.radiusSQ) {
		return false
	}
	if (t.Angle == 360) {
		return true
	}
	angle := v.ToAngle()
	if (t.flip) {
		return angle >= t.halfAngle || angle <= -t.halfAngle
	}
	return angle >= -t.halfAngle && angle <= t.halfAngle
}

//HitTestWidthRect 圆形跟box碰撞检测
func (t *Circle) HitTestWidthBox(b *Box) bool {
	return b.HitTestWidthCircle(t)
}

//HitTestWidthRect 圆形跟矩形碰撞检测
func (t *Circle) HitTestWidthRect(v *Rect) bool {
	return v.HitTestWidthCircle(t)
}

//HitTestWidthCircle 圆形跟圆形碰撞检测
func (t *Circle) HitTestWidthCircle(c *Circle) bool {
	d := t.Position.DistanceSq(c.Position)
	r := math.Pow((t.Radius+c.Radius)*.5, 2)
	return d <= r
}
