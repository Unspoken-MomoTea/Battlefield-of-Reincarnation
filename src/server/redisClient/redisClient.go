package redisClient

import (
	"fmt"
	"github.com/garyburd/redigo/redis"
	"github.com/tidwall/gjson"
	"io/ioutil"
	"server/global"
	"server/utils"
	"strconv"
	"time"
)

var redisPool *redis.Pool

func Initialize() {
	ApplicationDir := global.App.GetApplicationPath()
	ConfPath := global.App.GetConfigPath()
	defaultConfPath := fmt.Sprintf("%s/%s", ApplicationDir, ConfPath)
	confData, err := ioutil.ReadFile(defaultConfPath)
	utils.Assert(err == nil, "not find server.json from %s", ApplicationDir)
	redisConf := gjson.GetBytes(confData, "redis").Map()

	address := redisConf["host"].Str
	database := int(redisConf["database"].Int())
	password := redisConf["password"].Str
	maxIdle := int(redisConf["maxIdle"].Int())
	maxActive := int(redisConf["maxActive"].Int())
	idleTimeout := time.Duration(redisConf["idleTimeout"].Int())
	fmt.Println("RedisClient address:", address, ",database:", database)

	dailDatabase := redis.DialDatabase(database)
	dailPassword := redis.DialPassword(password)
	redisConn, err1 := redis.Dial("tcp", address, dailDatabase, dailPassword)
	utils.Assert(err1 == nil, "cannot connect redis, check server.json")
	redisConn.Close()

	redisPool = &redis.Pool{
		Wait:        true,
		MaxIdle:     maxIdle,
		MaxActive:   maxActive,
		IdleTimeout: idleTimeout * time.Second,
		Dial: func() (redis.Conn, error) {
			redisConn, err := redis.Dial("tcp", address, dailDatabase, dailPassword)
			if err != nil {
				return nil, err
			}

			return redisConn, nil
		},
		TestOnBorrow: func(c redis.Conn, t time.Time) error {
			_, err := c.Do("PING")
			return err
		},
	}
}

func Do(cmd string, args ...interface{}) (interface{}, error) {
	redisConn := redisPool.Get()
	defer redisConn.Close()
	return redisConn.Do(cmd, args...)
}

func HAll(redisKe string, mValues map[string]string) (error, bool) {
	rValues, err := redis.Values(Do("HGETALL", redisKe))
	if err != nil {
		return err, false
	}

	if len(rValues)%2 != 0 {
		return fmt.Errorf("ScanValues: number of values not a multiple of 2"), false
	}

	for i := 0; i < len(rValues); i += 2 {
		bn, bv := rValues[i], rValues[i+1]
		if bn == nil || bv == nil {
			continue
		}

		name, ok1 := bn.([]byte)
		value, ok2 := bv.([]byte)
		if false == ok1 || false == ok2 {
			return fmt.Errorf("redisKe or redisVa not []byte"), false
		}

		szKe, szValue := string(name[:]), string(value[:])
		mValues[szKe] = szValue
	}
	// OK
	return nil, true
}

func Exists(key string) (bool, error) {
	res, err := Do("EXISTS", key)
	if err != nil {
		return false, err
	}
	return res.(int64) == 1, nil
}

func Keys(pattern string) ([]string, error) {
	return redis.Strings(Do("KEYS", pattern))
}

func SetEx(key string, val string, expiresIn int) (bool, error) {
	szEx := strconv.Itoa(expiresIn)
	res, err := Do("SET", key, val, "EX", szEx)
	if err != nil {
		return false, err
	}

	return res.(string) == "OK", nil
}

func Set(key string, val string) (bool, error) {
	if key == "" {
		return false, fmt.Errorf("Error: key:%s", key)
	}

	res, err := Do("SET", key, val)
	if err != nil {
		return false, err
	}

	return res.(string) == "OK", nil
}

func Get(key string) ([]byte, error) {
	if key == "" {
		return nil, fmt.Errorf("Error: key:%s", key)
	}
	res, err := Do("GET", key)
	if err != nil {
		return nil, err
	}
	if res == nil {
		return nil, nil
	}

	return res.([]byte), nil
}

func Del(key string) (bool, error) {
	res, err := Do("DEL", key)
	if err != nil {
		return false, err
	}

	return res.(int64) == 1, nil
}

func HGet(key string, field string) (string, error) {
	if key == "" || field == "" {
		return "", fmt.Errorf("Error: key or field is Empty")
	}
	res, err := Do("HGet", key, field)
	if err != nil {
		return "", err
	} else if res == nil {
		return "", nil
	} else {
		return redis.String(res, err)
	}
	return "", nil
}

func HSet(key string, field, val string) error {
	if key == "" || field == "" {
		return fmt.Errorf("Error: key or field is Empty")
	}
	_, err := Do("HSET", key, field, val)
	if err != nil {
		fmt.Println("HSet err:", err)
	}
	return err
}

func HMSet(key string, val interface{}) error {
	args := redis.Args{}.Add(key).AddFlat(val)
	if len(args) == 0 {
		return nil
	}
	_, err := Do("HMSET", args...)
	if err != nil {
		fmt.Println("HMSet err:", err)
		return err
	}
	return nil
}

func HMGet(key string, pattern ...interface{}) ([]string, error) {
	args := redis.Args{}.Add(key).Add(pattern...)
	return redis.Strings(Do("HMGET", args...))
}

func HGetall(key string, val interface{}) error {
	if key == "" {
		return fmt.Errorf("Error: key:%s", key)
	}

	v, err := redis.Values(Do("HGETALL", key))
	if err != nil {
		fmt.Println(err)
		return err
	}

	if err := redis.ScanStruct(v, val); err != nil {
		fmt.Println(err)
		return err
	}

	return nil
}

func HKeys(pattern string) ([]string, error) {
	return redis.Strings(Do("HKeys", pattern))
}

func Zadd(lb string, value string, score string) error {
	_, err := Do("zadd", lb, value, score)
	if err != nil {
		fmt.Println(err)
		return err
	}
	return nil
}

func Zscore(lb string, value string) (score string, err error) {
	v, err := Do("zscore", lb, value)
	if err != nil {
		fmt.Println(err)
		return "", err
	}
	score, err = redis.String(v, err)
	if err != nil {
		fmt.Println(err)
		return "", err
	}
	return score, err
}

//单人排行从小到大查询
func Zrank(lb string, value string) (rank int64, err error) {
	v, err := Do("zrank", lb, value)
	if err != nil {
		fmt.Println(err)
		return 0, err
	}
	if v == nil {
		v = int64(-1)
	}
	return v.(int64), nil
}

//单人排行从大到小查询
func Zrevrank(lb string, value string) (rank int64, err error) {
	v, err := Do("zrevrank", lb, value)
	if err != nil {
		fmt.Println(err)
		return 0, err
	}
	if v == nil {
		v = int64(-1)
	}
	return v.(int64), nil
}

//分数从大到小排序
func Zrevrange(lb string, start int, stop int) (list []string, err error) {
	result, err := redis.Values(Do("zrevrange", lb, start, stop))
	if err != nil {
		fmt.Println(err)
		return nil, err
	}
	list = make([]string, 0)
	for _, v := range result {
		str := string(v.([]byte))
		list = append(list, str)
	}
	return list, nil
}

//分数从小到大排序
func Zrange(lb string, start int, stop int) (list []string, err error) {
	result, err := redis.Values(Do("zrange", lb, start, stop))
	if err != nil {
		fmt.Println(err)
		return nil, err
	}
	list = make([]string, 0)
	for _, v := range result {
		str := string(v.([]byte))
		list = append(list, str)
	}
	return list, nil
}

func HDel(key string, pattern string) (bool, error) {
	res, err := Do("HDel", key, pattern)
	if err != nil {
		return false, err
	}

	return res.(int64) == 1, nil
}

func CleanCacheData(pattern string) {
	redisKeArr, err := Keys(pattern)
	if err != nil {
		panic(err.Error())
		return
	}
	// 删除所有数据
	for _, redisKe := range redisKeArr {
		Del(redisKe)
	}
}
