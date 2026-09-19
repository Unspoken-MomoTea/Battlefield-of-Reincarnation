package sdks

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"github.com/liangdas/mqant/conf"
	"github.com/liangdas/mqant/log"
	"server/common"
	"strings"
	"time"
)

//OPPOsdk控制器
type OppoSdkHandler struct {
	appKey    string //游戏上架时分配的Key
	appSecret string //游戏上架时分配的密钥
	pkgName   string //游戏包名
}

func NewOppoSdkHandler() *OppoSdkHandler {
	return &OppoSdkHandler{}
}

func (this *OppoSdkHandler) Init(settings *conf.ModuleSettings) {
	this.pkgName = common.MiscMgr.GetMiscDataBy("pkgName").Value
	this.appKey = common.MiscMgr.GetMiscDataBy("appId").Value
	this.appSecret = common.MiscMgr.GetMiscDataBy("appSecret").Value
}

func (this *OppoSdkHandler) Login(token string) (errorCode int) {

	return 0
}

func (this *OppoSdkHandler) GetSigData(token string) (sign string, errorCode int) {
	str := fmt.Sprintf("appKey=%v&appSecret=%v&pkgName=%v&timeStamp=%v&token=%v",this.appKey,this.appSecret,this.pkgName,time.Now().Unix(),token);
	h := md5.New()
	h.Write([]byte(str))
	MdData := h.Sum(nil)
	str = fmt.Sprintf("sign=%s", strings.ToUpper(hex.EncodeToString(MdData)))
	log.Debug(str)
	return "", 0
}
