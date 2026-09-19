package utils

import (
	"fmt"
	"math/rand"
	"time"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func ResetSeed() {
	rand.Seed(time.Now().UnixNano())
}

func Assert(must bool, format string, a ...interface{}) {
	if !must {
		panic(fmt.Sprintf(format, a...))
	}
}

func RandInt(min int, max int) int {
	if min >= max {
		return max
	}
	v := rand.Intn(max-min) + min
	return v
}

func RandInt32(min int32, max int32) int32 {
	if min >= max {
		return max
	}
	v := rand.Int31n(max-min) + min
	return v
}

func RandInt64(min int64, max int64) int64 {
	if min >= max {
		return max
	}
	v := rand.Int63n(max-min) + min
	return v
}

func RandFloat32(min float32, max float32) float32 {
	if min >= max {
		return max
	}
	v := rand.Float32() * (max-min) + min
	return v
}

func RandFloat64(min float64, max float64) float64 {
	if min >= max {
		return max
	}
	v := rand.Float64() * (max-min) + min
	return v
}

func GetNexDayZeroTime() int64 {
	t := time.Now().AddDate(0,0,1)
	t = time.Date(t.Year(),t.Month(),t.Day(),0,0,0,0,time.Local)
	return t.Unix()
}
