package game

import (
	"fmt"
	"github.com/gorilla/mux"
	"github.com/liangdas/mqant/conf"
	"github.com/liangdas/mqant/log"
	"github.com/liangdas/mqant/module"
	basemodule "github.com/liangdas/mqant/module/base"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"server/redisClient"
	"server/sdks"
	"server/utils"
	"time"
)

//qq小游戏
var QQLoginHost = ""
var QQAccessTokenHost = ""
var QQAppId = ""
var QQSecretKey = ""
var QQSigHost = ""
var QQMpSigHost = ""
var QQReportHost = ""

var host = ""
var localPath = ""
var staticPath = ""
var loginCount = int64(0)
var NextZeroTime int64 //下次0点时间

/**
一定要记得在confin.json配置这个模块的参数,否则无法使用
*/
var Module = func() module.Module {
	this := new(GameModule)
	return this
}

type GameModule struct {
	basemodule.BaseModule
	dataManager      *GameDataManager
	wechatSdkHandler *sdks.WechatSdkHandler //微信sdk控制器
	oppoSdkHandler   *sdks.OppoSdkHandler   //oppoSdk控制器
	nextZeroTime     int64                  //下次0点时间
}

func (this *GameModule) GetType() string {
	//很关键,需要与配置文件中的Module配置对应
	return "GameModule"
}

func (this *GameModule) Version() string {
	//可以在监控时了解代码版本
	return "1.0.0"
}

func (this *GameModule) OnInit(app module.App, settings *conf.ModuleSettings) {
	host, _ = settings.Settings["Host"].(string)
	localPath, _ = settings.Settings["LocalPath"].(string)
	staticPath, _ = settings.Settings["StaticPath"].(string)
	//qq小游戏
	QQAppId, _ = settings.Settings["QQAppID"].(string)
	QQSecretKey, _ = settings.Settings["QQSecretKey"].(string)
	QQSigHost, _ = settings.Settings["QQSigHost"].(string)
	QQMpSigHost, _ = settings.Settings["QQMpSigHost"].(string)
	QQReportHost, _ = settings.Settings["QQReportHost"].(string)
	QQLoginHost, _ = settings.Settings["QQGameModuleHost"].(string)
	QQAccessTokenHost, _ = settings.Settings["QQAccessTokenHost"].(string)

	this.dataManager = NewGameDataManager()
	this.wechatSdkHandler = sdks.NewWechatSdkHandler()
	this.oppoSdkHandler = sdks.NewOppoSdkHandler()

	this.BaseModule.OnInit(this, app, settings)
	this.wechatSdkHandler.Init(settings)
	this.oppoSdkHandler.Init(settings)
	this.dataManager.Init()

	this.LoadFromDB()
	if (this.nextZeroTime == 0) {
		this.setNextZeroTime()
	}
}

//从数据库加载数据
func (this *GameModule) LoadFromDB() {
	bytes, err := redisClient.Get("nextZeroTime")
	if (bytes != nil && err == nil) {
		this.nextZeroTime = utils.StringToInt64(string(bytes))
		NextZeroTime = this.nextZeroTime
	}
}

func (this *GameModule) Run(closeSig chan bool) {
	listener, err := net.Listen("tcp", host)
	if err != nil {
		log.Error("Centres Server error", err.Error())
		return
	}

	ApplicationDir, err := os.Getwd()
	if err != nil {
		file, _ := exec.LookPath(os.Args[0])
		ApplicationPath, _ := filepath.Abs(file)
		ApplicationDir, _ = filepath.Split(ApplicationPath)
	}

	log.Info("http game server Listen:%s, Path:%s", host, ApplicationDir+staticPath)
	router := mux.NewRouter()
	this.addClientListener(router)
	go func() {
		static := router.PathPrefix(localPath + "/mqant/")
		dirPath := http.FileServer(http.Dir(ApplicationDir + staticPath))
		static.Handler(http.StripPrefix(localPath+"/mqant/", dirPath))
		ServeMux := http.NewServeMux()
		ServeMux.Handle("/", router)
		http.Serve(listener, loggingHandler(ServeMux))
	}()
	go func() {
		tick := time.NewTicker(1 * time.Second)
		for {
			select {
			case <-tick.C:
				this.dataManager.UpdateClear()
				this.zeroTimeUpdate()
				//this.dataManager.UpdateEnergy()
			}
		}
	}()
}

//0点更新
func (this *GameModule) zeroTimeUpdate() {
	if (time.Now().Unix() < this.nextZeroTime) {
		return
	}
	log.Debug("到0点了")
	this.setNextZeroTime()
	this.dataManager.OnReset()
}

//设置下次0点时间
func (this *GameModule) setNextZeroTime() {
	year, month, day := time.Now().Date()
	this.nextZeroTime = time.Date(year, month, day+1, 0, 0, 0, 0, time.Local).Unix()
	NextZeroTime = this.nextZeroTime
	redisClient.Set("nextZeroTime", fmt.Sprintf("%v", this.nextZeroTime))
}

func loggingHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		w.Header().Set("Access-Control-Allow-Origin", "*")             //允许访问所有域
		w.Header().Add("Access-Control-Allow-Headers", "Content-Type") //header的类型
		w.Header().Set("content-type", "application/json")             //返回数据格式是json
		log.Info("client call function:%s %s %s [%s] in %v", r.Method, r.URL.Path, r.Proto, r.RemoteAddr, time.Since(start))
		next.ServeHTTP(w, r)
		//[26/Oct/2017:19:07:04 +0800]`-`"GET /g/c HTTP/1.1"`"curl/7.51.0"`502`[127.0.0.1]`-`"-"`0.006`166`-`-`127.0.0.1:8030`-`0.000`xd
	})
}

func (this *GameModule) OnDestroy() {
	//一定别忘了关闭RPC
	this.GetServer().OnDestroy()
}
