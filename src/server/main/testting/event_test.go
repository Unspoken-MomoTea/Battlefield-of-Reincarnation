package testting

import (
	"testing"
	"server/event"
	"fmt"
)

func TestEvent(t *testing.T) {
	ed := new(Ev1)
	ed.OnInit()
	ls1 := &event.Listener{onEnterFrame1}
	ls2 := &event.Listener{onEnterFrame2}
	ls3 := &event.Listener{onEnterFrame3}
	ed.AddEventListener(event.ENTER_FRAME, ls1, 2)
	ed.AddEventListener(event.ENTER_FRAME, ls2, 1)
	ed.AddEventListener(event.ENTER_FRAME, ls3, 3)
	ed.trace()
}

func onEnterFrame1(e *event.Event) {
	fmt.Println("onEnterFrame1")
}

func onEnterFrame2(e *event.Event) {
	fmt.Println("onEnterFrame2")
}

func onEnterFrame3(e *event.Event) {
	fmt.Println("onEnterFrame3")
}

type Ev1 struct {
	event.EventDispatcher
}

func (this *Ev1) trace() {
	this.DispatchEventWidth(event.ENTER_FRAME, nil, nil)
}
