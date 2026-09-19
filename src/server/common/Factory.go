package common

import (
	"github.com/tidwall/gjson"
	"server/utils"
	"strings"
)

type Factory struct {
}

func (this *Factory) ToInt8Array(node gjson.Result, name string, split string) []int8 {
	str := node.Get(name).Raw
	return utils.StringToInt8Array(str, split)
}

func (this *Factory) ToInt16Array(node gjson.Result, name string, split string) []int16 {
	str := node.Get(name).Raw
	return utils.StringToInt16Array(str, split)
}

func (this *Factory) ToInt32Array(node gjson.Result, name string, split string) []int32 {
	str := node.Get(name).Raw
	return utils.StringToInt32Array(str, split)
}

func (this *Factory) ToInt64Array(node gjson.Result, name string, split string) []int64 {
	str := node.Get(name).Raw
	return utils.StringToInt64Array(str, split)
}

func (this *Factory) ToUint8Array(node gjson.Result, name string, split string) []uint8 {
	str := node.Get(name).Raw
	return utils.StringToUint8Array(str, split)
}

func (this *Factory) ToUint16Array(node gjson.Result, name string, split string) []uint16 {
	str := node.Get(name).Raw
	return utils.StringToUint16Array(str, split)
}

func (this *Factory) ToUint32Array(node gjson.Result, name string, split string) []uint32 {
	str := node.Get(name).Raw
	return utils.StringToUint32Array(str, split)
}

func (this *Factory) ToUint64Array(node gjson.Result, name string, split string) []uint64 {
	str := node.Get(name).Raw
	return utils.StringToUint64Array(str, split)
}
func (this *Factory) ToFloat32Array(node gjson.Result, name string, split string) []float32 {
	str := node.Get(name).Raw
	return utils.StringToFloat32Array(str, split)
}

func (this *Factory) ToFloat64Array(node gjson.Result, name string, split string) []float64 {
	str := node.Get(name).Raw
	return utils.StringToFloat64Array(str, split)
}

func (this *Factory) ToStringArray(node gjson.Result, name string, split string) []string {
	str := node.Get(name).Raw
	if str == "null" || str == "" {
		return nil
	}
	str = strings.Replace(str, "\"", "", -1)
	return utils.StringToArray(str, split)
}

func (this *Factory) ToInt8(node gjson.Result, name string) int8 {
	str := node.Get(name).Raw
	return utils.StringToInt8(str)
}

func (this *Factory) ToInt16(node gjson.Result, name string) int16 {
	str := node.Get(name).Raw
	return utils.StringToInt16(str)
}

func (this *Factory) ToInt32(node gjson.Result, name string) int32 {
	str := node.Get(name).Raw
	return utils.StringToInt32(str)
}

func (this *Factory) ToInt64(node gjson.Result, name string) int64 {
	str := node.Get(name).Raw
	return utils.StringToInt64(str)
}

func (this *Factory) ToUint8(node gjson.Result, name string) uint8 {
	str := node.Get(name).Raw
	return utils.StringToUint8(str)
}

func (this *Factory) ToUint16(node gjson.Result, name string) uint16 {
	str := node.Get(name).Raw
	return utils.StringToUint16(str)
}

func (this *Factory) ToUint32(node gjson.Result, name string) uint32 {
	str := node.Get(name).Raw
	return utils.StringToUint32(str)
}

func (this *Factory) ToUint64(node gjson.Result, name string) uint64 {
	str := node.Get(name).Raw
	return utils.StringToUint64(str)
}

func (this *Factory) ToFloat32(node gjson.Result, name string) float32 {
	str := node.Get(name).Raw
	return utils.StringToFloat32(str)
}

func (this *Factory) ToFloat64(node gjson.Result, name string) float64 {
	str := node.Get(name).Raw
	return utils.StringToFloat64(str)
}

func (this *Factory) ToBool(node gjson.Result, name string) bool {
	str := node.Get(name).Raw
	return utils.StringToBool(str)
}

func (this *Factory) ToString(node gjson.Result, name string) string {
	str := node.Get(name).Raw
	if str == "null" || str == "" {
		return ""
	}
	str = strings.Replace(str, "\"", "", -1)
	return str
}
