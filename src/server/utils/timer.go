package utils

type TimerCallBack func(data interface{})

type Timer struct {
	callBackDatas []*CallBackData
	isRunning     bool
}

type TimerHandler struct {
	CallBack TimerCallBack
}

//回调数据
type CallBackData struct {
	//频率
	frequence float32
	//回调数据
	data interface{}
	//现在的时间
	nowTime float32
	//总共的回调的次数
	times int32
	//是否是下一帧回调
	isNextFrame bool
	//回调函数
	handler  *TimerHandler
	// 延迟时间
	delayTime float32

	disposed bool
}

func NewTimer() *Timer {
	timmer := new(Timer)
	timmer.callBackDatas = make([]*CallBackData, 0)
	timmer.isRunning = false
	return timmer
}

func (this *Timer) Update(dt float32) {
	if (!this.isRunning) {
		return
	}

	if (len(this.callBackDatas) == 0) {
		this.Stop()
		return
	}
	cbs := this.callBackDatas[:]
	for i := len(cbs) - 1; i >= 0; i-- {
		cbd := cbs[i]
		cbd.nowTime += dt
		if cbd.delayTime > cbd.nowTime {
			continue // 延迟
		}

		diffTime := cbd.delayTime + cbd.frequence
		if cbd.nowTime >= diffTime {
			cbd.nowTime = cbd.delayTime + cbd.nowTime - diffTime
			if cbd.times != -1 {
				cbd.times--
			}

			if (cbd.times == 0 || cbd.disposed) {
				this.callBackDatas = append(this.callBackDatas[0:i], this.callBackDatas[i+1:]...)
			}

			if (!cbd.disposed) {
				cbd.handler.CallBack(cbd.data)
			}
		}
	}
}

func (this *Timer) Start() {
	this.isRunning = true
}

func (this *Timer) Stop() {
	this.isRunning = false
}

func (this *Timer) Clear() {
	this.isRunning = false
	this.callBackDatas = this.callBackDatas[:0]

}

//RemoveDelayCallBack 移除延迟回调
func (this *Timer) RemoveDelayCallBack(callBack *TimerHandler) {
	for i := 0; i < len(this.callBackDatas); i++ {
		data := this.callBackDatas[i]
		if (data.handler == callBack) {
			//this.callBackDatas = append(this.callBackDatas[0:i], this.callBackDatas[i+1:]...)
			data.disposed = true
			return
		}
	}
}

//AddDelayCallBack 延迟回调
//
// time:延迟时间
// times:回调次数,-1为无限循环
// callBack:回调函数
// data:回调参数
func (this *Timer) AddDelayCallBack(time float32, callBack *TimerHandler, times int32, data interface{}) {
	if(time == 0){
		callBack.CallBack(data)
		return
	}
	cbData := this.getCallBackData(callBack)
	if (cbData == nil) {
		cbData = new(CallBackData)
		this.callBackDatas = append(this.callBackDatas, cbData)
	}

	if (times == 0) {
		times = 1
	}

	cbData.frequence = time
	cbData.data = data
	cbData.nowTime = 0
	cbData.delayTime = 0
	cbData.times = times
	cbData.isNextFrame = false
	cbData.handler = callBack
	cbData.disposed = false

	if (!this.isRunning) {
		this.Start()
	}
}

func (this *Timer) AddDelayCallBack2(delay, time float32, callBack *TimerHandler, times int32, data interface{}) {
	if delay == 0 && time == 0 {
		callBack.CallBack(data)
		return
	}

	cbData := this.getCallBackData(callBack)
	if cbData == nil {
		cbData = new(CallBackData)
		this.callBackDatas = append(this.callBackDatas, cbData)
	}

	if times == 0 {
		times = 1
	}

	cbData.frequence = time
	cbData.data = data
	cbData.nowTime = 0
	cbData.times = times
	cbData.delayTime = delay
	cbData.isNextFrame = false
	cbData.handler = callBack
	cbData.disposed = false

	if !this.isRunning {
		this.Start()
	}
}

//RemoveAllCallBacks 移除所有回调
func (this *Timer) RemoveAllCallBacks() {
	this.callBackDatas = this.callBackDatas[:0]
}

func (this *Timer) getCallBackData(callBack *TimerHandler) *CallBackData {
	for _, data := range this.callBackDatas {
		if (data.handler == callBack) {
			return data
		}
	}
	return nil
}
