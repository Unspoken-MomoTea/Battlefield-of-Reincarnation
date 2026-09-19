package event

import (
	"sort"
)

type Event struct {
	Target    *EventDispatcher
	EventType string
	Data      interface{}
	CallBack  func()
}

func (this *Event) clear() {
	this.Target = nil
	this.EventType = ""
	this.Data = nil
	this.CallBack = nil
}

type Listener struct {
	CallBack EventCallback
}

type EventCallback func(e *Event)

//事件派发器，注意：此类非线程安全
type EventDispatcher struct {
	eventCallBacks map[string][]*EventCBObject
	events         []*Event
}

type EventCBObject struct {
	//优先级
	priority int
	//事件回调
	handler *Listener
	//是否已经清除
	isClear bool
}

func NewEventDispatcher() *EventDispatcher {
	event := new(EventDispatcher)
	event.OnInit()
	return event
}

func (this *EventDispatcher) OnInit() {
	this.eventCallBacks = make(map[string][]*EventCBObject, 0)
	this.events = make([]*Event, 0)
}

//AddEventListener 添加事件监听
//eventType 事件类型
//callback 监听回调
//priority 优先级 值越大优先级越高
func (this *EventDispatcher) AddEventListener(eventType string, callback *Listener, priority int) {
	if (this.HasEventListener(eventType, callback)) {
		return
	}
	var list []*EventCBObject = nil
	if (!this.HasEventListener(eventType, nil)) {
		list = make([]*EventCBObject, 0)

	} else {
		list = this.eventCallBacks[eventType]
	}

	cbObj := &EventCBObject{
		priority: priority,
		handler:  callback,
		isClear:  false,
	}
	list = append(list, cbObj)
	sort.Sort(ListSort(list))
	this.eventCallBacks[eventType] = list
}

type ListSort []*EventCBObject

func (this ListSort) Len() int {
	return len(this)
}

func (this ListSort) Less(i, j int) bool {
	return this[i].priority > this[j].priority
}

func (this ListSort) Swap(i, j int) {
	this[i], this[j] = this[j], this[i]
}

//RemoveEventListener 移除事件监听
//eventType 事件类型
//handler 事件回调
func (this *EventDispatcher) RemoveEventListener(eventType string, callBack *Listener) {
	if (!this.HasEventListener(eventType, callBack)) {
		return
	}
	list, ok := this.eventCallBacks[eventType]
	if (!ok) {
		return
	}
	for i := 0; i < len(list); i++ {
		item := list[i]
		if (item.handler == callBack) {
			item.isClear = true
			list = append(list[:i], list[i+1:]...)
			this.eventCallBacks[eventType] = list
			return
		}
	}
}

//RemoveAllEventListeners 移除所有事件监听
func (this *EventDispatcher) RemoveAllEventListeners() {
	this.eventCallBacks = make(map[string][]*EventCBObject, 0)
	this.events = this.events[:0]
}

//RemoveEventListeners 移除某个事件的所有监听
func (this *EventDispatcher) RemoveEventListeners(eventType string) {
	if (this.HasEventListener(eventType, nil)) {
		delete(this.eventCallBacks, eventType)
	}
}

//DispatchEventWidth 派发事件
//eventType 事件类型
//data 派发的数据
//handler 事件派发后的回调
func (this *EventDispatcher) DispatchEventWidth(eventType string, data interface{}, callBack func()) {
	if (!this.HasEventListener(eventType, nil)) {
		return
	}
	e := this.getEvent()
	e.Target = this
	e.EventType = eventType
	e.Data = data
	e.CallBack = callBack

	list := this.eventCallBacks[eventType]
	list = list[:] //这里进行拷贝是因为在事件派发过程中有可能修改此列表
	for i := 0; i < len(list); i++ {
		item := list[i]
		if (item.isClear) {
			continue
		}
		item.handler.CallBack(e)
	}

	e.clear()
	this.events = append(this.events, e)
}

func (this *EventDispatcher) getEvent() *Event {
	if (len(this.events) == 0) {
		event := &Event{}
		return event
	}
	event := this.events[0]
	this.events = this.events[1:]
	return event
}

//HasEventListener 是否已经有该事件在监听
func (this *EventDispatcher) HasEventListener(eventType string, callback *Listener) bool {

	list, ok := this.eventCallBacks[eventType];
	if !ok {
		return false
	}
	if (callback == nil) {
		return true
	}

	for _, item := range list {
		if (item.handler == callback) {
			return true
		}
	}
	return false
}
