package testting

var UID int64 = 100101
var UID1 int64 = 101101

//func InitHallTest() bool {
//
//	redisClient.Initialize()
//
//	err := common.LoadConfig()
//	if (err != nil) {
//		return false
//	}
//	if !misc.InitMiscDataMgr() {
//		return false
//	}
//	if !font.InitFontLibManager() {
//		return false
//	}
//	return true
//}
//
////----------------test legion------------------------------
//
////SelfLegion
//func Test_MsgAllLegionInfo(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(128)
//	p.GetLegionMgr().Test_MsgAllLegionInfo(msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
////SelfLegion
//func Test_MsgSelfLegionInfo(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(128)
//	p.GetLegionMgr().Test_MsgSelfLegionInfo(UID, msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
////create
//func Test_MsgCreateLegion(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(128)
//	msg.WriteStringFixedLength("琅琊", 32)
//	msg.WriteStringFixedLength("L", 3)
//	msg.WriteInt32(200)
//	p.GetLegionMgr().Test_MsgCreateLegion(UID, msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
////加入
//func Test_MsgJoinLegion(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(128)
//	msg.WriteInt64(20401)
//	p.GetLegionMgr().Test_MsgJoinLegion(UID1, msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
////退出
//func Test_MsgExitLegion(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(128)
//	//msg.WriteInt64(UID1)
//	p.GetLegionMgr().Test_MsgExitLegion(UID1, msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
////成员信息
//func Test_MsgLegionMembers(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(128)
//	//msg.WriteInt64(UID1)
//	p.GetLegionMgr().Test_MsgLegionMembers(UID, msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
////踢出成员
//func Test_MsgKickOutMember(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(128)
//	msg.WriteInt64(UID1)
//	p.GetLegionMgr().Test_MsgKickOutMember(UID, msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
////官职任命
//func Test_MsgOfficicalChange(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(128)
//	msg.WriteInt64(UID1)
//	msg.WriteInt32(1)
//	p.GetLegionMgr().Test_MsgOfficicalChange(UID, msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
////个人军团信息
//func Test_MsgSelfInfo(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(128)
//	//msg.WriteStringFixedLength("什么鬼，类型的", 128)
//	p.GetLegionMgr().Test_MsgSelfInfo(UID, msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
////删除军团
//func Test_MsgDel(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(128)
//	//msg.WriteStringFixedLength("什么鬼，类型的", 128)
//	p.GetLegionMgr().Test_MsgDel(UID, msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
////设置宣言
//func Test_MsgSetDescribe(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(128)
//	msg.WriteStringFixedLength("什么鬼，类型的", 128)
//	p.GetLegionMgr().Test_MsgSetDescribe(UID, msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
////军团城池
//func Test_MsgLegionCity(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(8)
//	p.GetLegionMgr().Test_MsgLegionCity(UID, msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
//func Test_MsgLegionChat(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//
//	session := basegate.NewSessionTest("100101")
//	wBuffer := utils.NewByteBufferEmpty(256)
//	wBuffer.WriteStringDynamicLength("hello")
//	p.GetLegionMgr().MsgLegionChat(session, wBuffer.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
//func Test_MsgLegionAskBeg(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//
//	session := basegate.NewSessionTest("100101")
//	wBuffer := utils.NewByteBufferEmpty(256)
//	wBuffer.WriteInt32(2101)
//	p.GetLegionMgr().MsgLegionAskBeg(session, wBuffer.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
//func Test_MsgLegionSendBeg(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//
//	session := basegate.NewSessionTest("100101")
//	wBuffer := utils.NewByteBufferEmpty(256)
//	wBuffer.WriteInt64(100101)
//	p.GetLegionMgr().MsgLegionSendBeg(session, wBuffer.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
////宣战城池
//func Test_MsgDeclareWarCity(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(8)
//	p.GetLegionMgr().Test_MsgDeclareWarCity(UID, msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}
//
////军团配置数据测试(查看输出)
//func Test_LoadLegionData(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	data := p.GetLegionDataMgr().GetDataS()
//	for key, data := range data {
//		fmt.Println(key, data)
//	}
//	t.Log(fmt.Sprintf("ok"))
//}
//
////----------------test friend------------------------------
//
////del
//func Test_DelFriend(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//
//	msg := utils.NewByteBufferEmpty(8)
//	msg.WriteInt32(101101)
//	bytes, str := p.GetUserFriendMgr().MsgDelFriend(100101, msg.GetData())
//	t.Log(fmt.Sprintf("%v, %s", bytes, str))
//
//	msg1 := utils.NewByteBufferEmpty(8)
//	msg1.WriteInt32(102101)
//	bytes1, str1 := p.GetUserFriendMgr().MsgDelFriend(100101, msg1.GetData())
//	t.Log(fmt.Sprintf("%v, %s", bytes1, str1))
//
//	msg2 := utils.NewByteBufferEmpty(8)
//	msg2.WriteInt32(103101)
//	bytes2, str2 := p.GetUserFriendMgr().MsgDelFriend(100101, msg2.GetData())
//	t.Log(fmt.Sprintf("%v, %s", bytes2, str2))
//}
//
////审批
//func Test_Agree(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//
//	msg := utils.NewByteBufferEmpty(8)
//	msg.WriteInt32(1)
//	msg.WriteInt32(101101)
//	bytes, str := p.GetUserFriendMgr().MsgAgree(100101, msg.GetData())
//	t.Log(fmt.Sprintf("%v, %s", bytes, str))
//
//	msg1 := utils.NewByteBufferEmpty(8)
//	msg1.WriteInt32(0)
//	msg1.WriteInt32(102101)
//	bytes1, str1 := p.GetUserFriendMgr().MsgAgree(100101, msg1.GetData())
//	t.Log(fmt.Sprintf("%v, %s", bytes1, str1))
//
//	msg2 := utils.NewByteBufferEmpty(8)
//	msg2.WriteInt32(1)
//	msg2.WriteInt32(103101)
//	bytes2, str2 := p.GetUserFriendMgr().MsgAgree(100101, msg2.GetData())
//	t.Log(fmt.Sprintf("%v, %s", bytes2, str2))
//}
//
////添加对战记录
//func Test_AddFightFriend(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//
//	b := p.GetUserFriendMgr().AddFightFriend(100101, 101101)
//	t.Log(fmt.Sprintf("%v", b))
//
//	b = p.GetUserFriendMgr().AddFightFriend(100101, 102101)
//	t.Log(fmt.Sprintf("%v", b))
//
//	b = p.GetUserFriendMgr().AddFightFriend(100101, 103101)
//	t.Log(fmt.Sprintf("%v", b))
//}
//
////请求添加好友
//func Test_Request(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//
//	msg := utils.NewByteBufferEmpty(8)
//	msg.WriteInt32(0)
//	msg.WriteStringFixedLength("jiujiu2", 32)
//	bytes, str := p.GetUserFriendMgr().MsgRequest(100101, msg.GetData())
//	t.Log(fmt.Sprintf("%v, %s", bytes, str))
//
//	msg = utils.NewByteBufferEmpty(8)
//	msg.WriteInt32(0)
//	msg.WriteStringFixedLength("jiujiu3", 32)
//	bytes, str = p.GetUserFriendMgr().MsgRequest(100101, msg.GetData())
//	t.Log(fmt.Sprintf("%v, %s", bytes, str))
//
//	msg = utils.NewByteBufferEmpty(8)
//	msg.WriteInt32(0)
//	msg.WriteStringFixedLength("jiujiu4", 32)
//	bytes, str = p.GetUserFriendMgr().MsgRequest(100101, msg.GetData())
//	t.Log(fmt.Sprintf("%v, %s", bytes, str))
//}
//
//func Test_Find(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//
//	msg := utils.NewByteBufferEmpty(4)
//	msg.WriteInt32(0)
//	msg.WriteStringFixedLength("jiujiu2", 32)
//
//	bytes, str := p.GetUserFriendMgr().MsgFriendFind(100101, msg.GetData())
//	t.Log(fmt.Sprintf("%v, %s", bytes, str))
//}
//func Test_UserFights(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	bytes, str := p.GetUserFriendMgr().MsgUserFights(100101)
//	t.Log(fmt.Sprintf("%v, %s", bytes, str))
//}
//func Test_UserWait(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	bytes, str := p.GetUserFriendMgr().MsgUserWaits(100101)
//	t.Log(fmt.Sprintf("%v, %s", bytes, str))
//}
//func Test_UserFriends(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	bytes, str := p.GetUserFriendMgr().MsgUserFriends(100101)
//	t.Log(fmt.Sprintf("%v, %s", bytes, str))
//}
//
////----------------test email------------------------------
//
////mail del by user
//func Test_UseDelMail(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(4)
//	msg.WriteInt32(40301)
//	bytes, str := p.GetUserMailMgr().MsgDelMail(100101, msg.GetData())
//	t.Log(fmt.Sprintf("%v, %s", bytes, str))
//}
//
////mail get Reward
//func Test_GetReward(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(4)
//	msg.WriteInt32(40301)
//	bytes, str := p.GetUserMailMgr().MsgGetMailReward(100101, msg.GetData())
//	t.Log(fmt.Sprintf("%v, %s", bytes, str))
//}
//
////mail open
//func Test_OpenMail(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	bytes, str := p.GetUserMailMgr().MsgOpenMail(100101, 30301)
//	t.Log(fmt.Sprintf("%v, %s", bytes, str))
//}
//
////User mails
//func Test_UserMails(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	bytes, str := p.GetUserMailMgr().MsgUserMails(100101)
//	t.Log(fmt.Sprintf("%v, %s", bytes, str))
//}
//
////mail add
//func Test_AddMail(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//
//	//以下为 rpc 推送 实例
//	ms := make([]*messageType.RpcAddMail, 0)
//	m := &messageType.RpcAddMail{Title: "系统邮件1", Content: "苏格瑞的国战奖励", Items: make([]*define.Item, 0)}
//	m.Items = append(m.Items, &define.Item{Id: 0, Num: 77, Kind: 0})
//	m.Items = append(m.Items, &define.Item{Id: 0, Num: 33, Kind: 1})
//	m.Items = append(m.Items, &define.Item{Id: 2108, Num: 20, Kind: 2})
//	m.Items = append(m.Items, &define.Item{Id: 2303, Num: 20, Kind: 2})
//	ms = append(ms, m)
//
//	m1 := &messageType.RpcAddMail{Title: "系统邮件2", Content: "苏格瑞的国战奖励", Items: make([]*define.Item, 0)}
//	m1.Items = append(m1.Items, &define.Item{Id: 0, Num: 77, Kind: 0})
//	m1.Items = append(m1.Items, &define.Item{Id: 0, Num: 33, Kind: 1})
//	m1.Items = append(m1.Items, &define.Item{Id: 2108, Num: 5, Kind: 2})
//	m1.Items = append(m1.Items, &define.Item{Id: 2303, Num: 22, Kind: 2})
//	ms = append(ms, m1)
//	bytes, er := json.Marshal(ms)
//	fmt.Println(er)
//	b, str := p.GetUserMailMgr().RpcAddMail(100101, bytes)
//	//p.GetUserMailMgr().AddMail(100101,"系统邮件1", "测试期间道道xxxxxxx,奖励xxxxx个格瑞！！！", items1)
//
//	t.Log(fmt.Sprintf("%v, %s", b, str))
//}
//
////----------------test Box------------------------------
////开启宝箱
//func Test_OpenBox(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(4)
//	msg.WriteInt32(0)
//	msg.WriteInt32(0)
//	_, b := p.GetUserBoxMgr().MsgOpenBox(100101, msg.GetData())
//	t.Log(fmt.Sprintf("%v", b))
//}
//
////宝箱第一次点击
//func Test_ChangeBoxState(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(4)
//	msg.WriteInt32(3)
//	_, b := p.GetUserBoxMgr().MsgChangeBoxState(100101, msg.GetData())
//	t.Log(fmt.Sprintf("%v", b))
//}
//
////玩家宝箱s
//func Test_UserBoxS(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	uBox := p.GetUserBoxMgr().GetUserBoxS(100101)
//	for _, b := range uBox.Boxs {
//		fmt.Println(b)
//	}
//	byteS, b := p.GetUserBoxMgr().MsgUserBoxs(100101)
//	fmt.Println(byteS)
//	t.Log(fmt.Sprintf("%v", b))
//}
//
////宝箱add
//func Test_addBox(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	b := p.GetUserBoxMgr().AddBox(103101, 1000)
//	t.Log(fmt.Sprintf("%v", b))
//	b = p.GetUserBoxMgr().AddBox(103101, 1001)
//	t.Log(fmt.Sprintf("%v", b))
//	b = p.GetUserBoxMgr().AddBox(103101, 1005)
//	t.Log(fmt.Sprintf("%v", b))
//	b = p.GetUserBoxMgr().AddBox(103101, 1003)
//	t.Log(fmt.Sprintf("%v", b))
//	b = p.GetUserBoxMgr().AddBox(103101, 1004)
//	t.Log(fmt.Sprintf("%v", b))
//	b = p.GetUserBoxMgr().AddBox(103101, 1011)
//	t.Log(fmt.Sprintf("%v", b))
//}
//
////宝箱基本数据
//func Test_LoadBoxData(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	allBoxs := p.GetBoxDataMgr().GetAllBoxDataS()
//	for _, d := range allBoxs {
//		fmt.Println(d)
//		for _, v := range d.GetDropCard1() {
//			fmt.Println(v)
//		}
//		for _, v := range d.GetDropCard2() {
//			fmt.Println(v)
//		}
//		for _, v := range d.GetDropCard3() {
//			fmt.Println(v)
//		}
//		for _, v := range d.GetDropCard4() {
//			fmt.Println(v)
//		}
//
//		for _, v := range d.GetDropSpecialCard() {
//			fmt.Println(v)
//		}
//	}
//	t.Log(fmt.Sprintf("proint over"))
//}
//
////----------------test Card------------------------------
//
////已有的卡牌添加经验测试
//func Test_RpcFightCards(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	//bytes, er := p.RpcUserFightCards(100101, 101101)
//	//fmt.Println(er)
//	cardrev := make([]*messageType.RpcUseCard, 0)
//	//json.Unmarshal(bytes, &cardrev)
//	for _, d := range cardrev {
//		fmt.Println(d)
//	}
//	t.Log(fmt.Sprintf("ok"))
//}
//
////已有的卡牌升级测试
//func Test_CardUpGrade(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	cardMgr := p.GetUserCardMgr()
//	userCardS := cardMgr.GetUserCards(100101)
//	userCardS.CardUpGrade(2101)
//	t.Log(fmt.Sprintf("ok"))
//}
//
////已有的卡牌添加经验测试
//func Test_RpcAddCardExp1(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	cardMgr := p.GetUserCardMgr()
//	userCardS := cardMgr.GetUserCards(100101)
//	userCardS.AddCardExp(2101, 100)
//	t.Log(fmt.Sprintf("ok"))
//}
//
////没有的卡牌添加经验测试
//func Test_RpcAddNewCardExp(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	cardMgr := p.GetUserCardMgr()
//	userCardS := cardMgr.GetUserCards(100101)
//	userCardS.AddCardExp(2201, 100)
//	t.Log(fmt.Sprintf("ok"))
//}
//
////玩家初始卡牌配置数据测试(查看输出)
//func Test_LoadUserCards(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	cardMgr := p.GetUserCardMgr()
//	userCardS := cardMgr.GetUserCards(100102)
//	for key, data := range userCardS.CardS {
//		fmt.Println(key, data)
//	}
//	for key, data := range userCardS.CardArrS {
//		fmt.Println(key, data)
//	}
//	fmt.Println(userCardS.UseCardArrIdx)
//
//	t.Log(fmt.Sprintf("ok"))
//}
//
////卡牌配置数据测试(查看输出)
//func Test_LoadCardData(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	cards := p.GetCardDataMgr().GetAllCardDataS()
//	for key, data := range cards {
//		fmt.Println(key)
//		for _, c := range data.CardDataS {
//			fmt.Println(c)
//		}
//	}
//	t.Log(fmt.Sprintf("ok"))
//}
//
////-------------------user test -----------------------------------------
//
////玩家所有数据
//func Test_MsgUserAllData(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(8)
//	msg.WriteInt64(UID)
//	bytes, er := p.GetUserAllData(msg.GetData())
//	fmt.Println(er)
//
//	//------------
//	buffR := utils.NewByteBuffer(bytes)
//
//	//Exist		:		int32	//0=不存在 1=存在
//	exist := buffR.ReadInt32()
//	fmt.Println("exist:", exist)
//
//	//Id  		:		int64
//	uid := buffR.ReadInt64()
//	fmt.Println("uid:", uid)
//
//	//Name		:		string	// 定长(32 byte)
//	name := buffR.ReadStringFixedLength(32)
//	fmt.Println("name:", name)
//
//	//Level		:		int32
//	lv := buffR.ReadInt32()
//	fmt.Println("lv:", lv)
//
//	//Exp 		:		int32
//	exp := buffR.ReadInt32()
//	fmt.Println("exp:", exp)
//
//	//CurHonor	:		int32
//	CurHonor := buffR.ReadInt32()
//	fmt.Println("CurHonor:", CurHonor)
//
//	//CurHonorLv	:		int32	//段位
//	CurHonorLv := buffR.ReadInt32()
//	fmt.Println("CurHonorLv:", CurHonorLv)
//
//	//MaxHonor	:		int32	//历史最高荣誉
//	MaxHonor := buffR.ReadInt32()
//	fmt.Println("MaxHonor:", MaxHonor)
//
//	//MaxHonorLv	:		int32	//历史最高段位
//	MaxHonorLv := buffR.ReadInt32()
//	fmt.Println("MaxHonorLv:", MaxHonorLv)
//
//	//LegionId	:		int64	//军团id
//	LegionId := buffR.ReadInt64()
//	fmt.Println("LegionId:", LegionId)
//
//	//LegionLog	:		string	//军团log 定长(3 byte)
//	LegionLog := buffR.ReadStringFixedLength(3)
//	fmt.Println("LgionLog:", LegionLog)
//
//	//FightTimes	:		int32	//1v1战斗次数
//	FightTimes := buffR.ReadInt32()
//	fmt.Println("FightTimes:", FightTimes)
//
//	//WinTimes  	:		int32	//1v1战斗胜利次数
//	WinTimes := buffR.ReadInt32()
//	fmt.Println("WinTimes:", WinTimes)
//
//	//MaxUseCardId :		int32	//常用卡牌id
//	MaxUseCardId := buffR.ReadInt32()
//	fmt.Println("MaxUseCardId:", MaxUseCardId)
//
//	//MaxUserCardExp:		int32	//常用卡牌exp
//	MaxUserCardExp := buffR.ReadInt32()
//	fmt.Println("MaxUserCardExp:", MaxUserCardExp)
//
//	//MaxUseCardExpMax:	int32	//常用卡牌当前等级的最大exp
//	MaxUseCardExpMax := buffR.ReadInt32()
//	fmt.Println("MaxUseCardExpMax:", MaxUseCardExpMax)
//
//	//CityContribute:		int32	//军团贡献(国战积分)
//	CityContribute := buffR.ReadInt32()
//	fmt.Println("CityContribute:", CityContribute)
//
//	//GiveCardNum	:		int32	//捐赠卡牌数量
//	GiveCardNum := buffR.ReadInt32()
//	fmt.Println("GiveCardNum:", GiveCardNum)
//
//	//UserCardIds :		list<int32>//正在使用的卡牌
//	length := buffR.ReadInt16()
//	fmt.Println("UserCardIds Num :", length)
//	ids := make([]int32, 0)
//	for i := 0; i < int(length); i++ {
//		id := buffR.ReadInt32()
//		ids = append(ids, id)
//	}
//	fmt.Println(ids)
//
//	t.Log(fmt.Sprintf("ok"))
//}
//
////玩家等级配置数据测试(查看输出)
//func Test_LoadUserLevelData(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	data := p.GetUserLevelDataMgr().AllLevelData()
//	for key, data := range data {
//		fmt.Println(key, data)
//	}
//	t.Log(fmt.Sprintf("ok"))
//}
//
//func Test_Store(t *testing.T) {
//	InitHallTest()
//	p := new(hall.HallProxy)
//	p.OnInitByTest()
//	msg := utils.NewByteBufferEmpty(128)
//	session := basegate.NewSessionTest("100101")
//	p.GetStoreMgr().OnGetHotSell(session, msg.GetData())
//	t.Log(fmt.Sprintf("ok"))
//}