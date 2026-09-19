package main

import (
	"github.com/liangdas/mqant/log"
	"github.com/liangdas/mqant/module/modules"
	"github.com/opentracing/opentracing-go"
	"server/common"
	"server/game"
	"sourcegraph.com/sourcegraph/appdash"

	"github.com/liangdas/mqant"
	"runtime"
	"server/gate"
	"server/global"
	"server/redisClient"
)

var (
	collector *appdash.RemoteCollector = nil

	// Here we use the local collector to create a new opentracing.Tracer
	tracer  opentracing.Tracer = nil
	version                    = "1.1.5"
)

func DefaultTracer() opentracing.Tracer {
	return tracer
}

func main() {
	log.Debug("Server version:%v", version)
	runtime.GOMAXPROCS(runtime.NumCPU())
	app := mqant.CreateApp()

	global.App = app

	err := common.LoadConfig()
	if (err != nil) {
		return
	}

	redisClient.Initialize()

	//先不用分布式跟踪服务了
	//app.DefaultTracer(func()opentracing.Tracer {
	//	if collector==nil{
	//		collector=appdash.NewRemoteCollector("127.0.0.1:7701")
	//		tracer=appdashtracer.NewTracer(collector)
	//	}
	//	return tracer
	//})
	app.Run(true, //只有是在调试模式下才会在控制台打印日志, 非调试模式下只在日志文件中输出日志
		game.Module(),
		modules.MasterModule(),
		mgate.Module(), //这是默认网关模块,是必须的支持 TCP,websocket,MQTT协议
	) //这是聊天模块

	//app.SetProtocolMarshal(func(Result interface{},Error string)(module.ProtocolMarshal,string){
	//	//下面可以实现你自己的封装规则(数据结构)
	//	r := &resultInfo{
	//		Error:  Error,
	//		Result: Result,
	//	}
	//	b,err:= json.Marshal(r)
	//	if err == nil {
	//		//解析得到[]byte后用NewProtocolMarshal封装为module.ProtocolMarshal
	//		return app.NewProtocolMarshal(b),""
	//	} else {
	//		return nil,err.Error()
	//	}
	//})
}
