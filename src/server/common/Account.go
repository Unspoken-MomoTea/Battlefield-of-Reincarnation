package common

type Account struct {
	Uid 			string 	// 用户ID
	PlatformId 		string 	// 平台ID
	PlatformName 	string 	// 平台名称
	NickName 		string 	// 用户昵称
	AvatarUrl		string	// 头像
	AppExt1 		string	// 符加参数1
	AppExt2 		string	// 符加参数2
	PlatformType 	int32	// 渠道ID
	Authorize		int32	// 是否授权
}

func NewAccount(platformName, platformId string) *Account {
	this := new(Account)
	this.Authorize = 0 //
	this.PlatformId = platformId
	this.PlatformName = platformName
	return this
}
