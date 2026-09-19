package logger

import (
	"fmt"
	"time"
	"github.com/jmoiron/sqlx"
	"github.com/liangdas/mqant/module"
	"github.com/liangdas/mqant/module/base"
	"github.com/liangdas/mqant/conf"
	"github.com/liangdas/mqant/log"
	_ "github.com/go-sql-driver/mysql"
	"server/common"
	"sync"
)

var Module = func() module.Module {
	this := new(LoggerProxy)
	this.lock = new(sync.RWMutex)
	this.writeChan = make(chan string, 2048)
	return this
}
// 玩家行为日志
type LoggerProxy struct {
	basemodule.BaseModule
	lock *sync.RWMutex
	UserName string // 用户名
	PassWord string // 密码
	HostUrl  string // 数据库地址
	Database string // 数据库名
	database *sqlx.DB // 日志数据库
	writeChan chan string
}

func (this *LoggerProxy) GetType() string {
	return "Logger"
}

func (this *LoggerProxy) Version() string {
	return "1.0.0"
}

func (this *LoggerProxy) OnInit(app module.App, settings *conf.ModuleSettings) {
	this.BaseModule.OnInit(this, app, settings)
	this.UserName = settings.Settings["UserName"].(string)
	this.PassWord = settings.Settings["PassWord"].(string)
	this.HostUrl = settings.Settings["HostUrl"].(string)
	this.Database = settings.Settings["DatabaseName"].(string)

	dataSourceName := fmt.Sprintf("%s:%s@tcp(%s)/mysql?charset=utf8",
		this.UserName, this.PassWord, this.HostUrl)
	db, err := sqlx.Open("mysql", dataSourceName)
	if err != nil {
		log.Error("init mysql connect: %v", err.Error())
		return
	}
	// 创建数据库
	szQuery := fmt.Sprintf("CREATE DATABASE IF NOT EXISTS %s DEFAULT CHARSET utf8 COLLATE utf8_general_ci", this.Database)
	db.MustExec(szQuery)
	db.Close()
	// 日志数据库
	dataSourceName2 := fmt.Sprintf("%s:%s@tcp(%s)/%s?charset=utf8",
		this.UserName, this.PassWord, this.HostUrl, this.Database)
	this.database, err = sqlx.Open("mysql", dataSourceName2)
	if err != nil {
		log.Error("init mysql connect: %v", err.Error())
		return
	}
	// 启用连接池
	this.database.SetMaxOpenConns(32)
	this.database.SetMaxIdleConns(16)
	this.database.SetConnMaxLifetime(300 * time.Second)
	this.database.Ping()
	// 创建日志表
	for _, sqlQuery := range common.LoggerTables {
		this.database.MustExec(sqlQuery)
	}
	// 消息注册
	//this.GetServer().RegisterGO(messageType.RPC_USER_ACTION.MessageName, this.OnAction)
}

func (this *LoggerProxy) Run(closeSig chan bool) {
	tick := time.NewTicker(5 * time.Second)
	for {
		select {
		case sQLText, rOk := <-this.writeChan:
			if true == rOk {
				this.database.Exec(sQLText)
			}
		case <-closeSig:
			goto LOOP_END
		case <-tick.C:
			this.database.Ping()
		}
	}

LOOP_END:
	log.Info("Logger Server Shutting down...")
}

func (this *LoggerProxy) OnDestroy() {
	close(this.writeChan)
	this.database.Close()
	this.GetServer().OnDestroy()
}

func (this *LoggerProxy) OnAction(loggerText string) {
	defer func() {
		if err := recover(); err != nil {
			log.Error("sql logger text error:%s", loggerText)
		}
	}()

	select {
	case this.writeChan <- loggerText:
	default:
		log.Warning("logger write_channel is full")
	}
}
