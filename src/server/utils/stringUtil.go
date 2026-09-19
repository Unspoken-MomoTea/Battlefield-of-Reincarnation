package utils

import (
	"regexp"
	"strconv"
	"strings"
)

func StringToInt8Array(v string, split string) []int8 {
	str := StringToArray(v, split)
	if (str == nil) {
		return nil
	}

	data := make([]int8, 0)

	for i := 0; i < len(str); i++ {
		d := str[i]
		if (d != "") {
			va, err := strconv.ParseInt(d, 10, 8)
			if (err == nil) {
				data = append(data, int8(va))
			}
		}
	}
	return data
}

func StringToInt16Array(v string, split string) []int16 {
	str := StringToArray(v, split)
	if (str == nil) {
		return nil
	}

	data := make([]int16, 0)

	for i := 0; i < len(str); i++ {
		d := str[i]
		if (d != "") {
			va, err := strconv.ParseInt(d, 10, 16)
			if (err == nil) {
				data = append(data, int16(va))
			}
		}
	}
	return data
}

func StringToInt32Array(v string, split string) []int32 {
	str := StringToArray(v, split)
	if (str == nil) {
		return nil
	}

	data := make([]int32, 0)

	for i := 0; i < len(str); i++ {
		d := str[i]
		if (d != "") {
			va, err := strconv.ParseInt(d, 10, 32)
			if (err == nil) {
				data = append(data, int32(va))
			}
		}
	}
	return data
}

func StringToInt64Array(v string, split string) []int64 {
	str := StringToArray(v, split)
	if (str == nil) {
		return nil
	}

	data := make([]int64, 0)

	for i := 0; i < len(str); i++ {
		d := str[i]
		if (d != "") {
			va, err := strconv.ParseInt(d, 10, 64)
			if (err == nil) {
				data = append(data, int64(va))
			}
		}
	}
	return data
}

func StringToUint8Array(v string, split string) []uint8 {
	str := StringToArray(v, split)
	if (str == nil) {
		return nil
	}

	data := make([]uint8, 0)

	for i := 0; i < len(str); i++ {
		d := str[i]
		if (d != "") {
			va, err := strconv.ParseUint(d, 10, 8)
			if (err == nil) {
				data = append(data, uint8(va))
			}
		}
	}
	return data
}

func StringToUint16Array(v string, split string) []uint16 {
	str := StringToArray(v, split)
	if (str == nil) {
		return nil
	}

	data := make([]uint16, 0)

	for i := 0; i < len(str); i++ {
		d := str[i]
		if (d != "") {
			va, err := strconv.ParseInt(d, 10, 16)
			if (err == nil) {
				data = append(data, uint16(va))
			}
		}
	}
	return data
}

func StringToUint32Array(v string, split string) []uint32 {
	str := StringToArray(v, split)
	if (str == nil) {
		return nil
	}

	data := make([]uint32, 0)

	for i := 0; i < len(str); i++ {
		d := str[i]
		if (d != "") {
			va, err := strconv.ParseInt(d, 10, 32)
			if (err == nil) {
				data = append(data, uint32(va))
			}
		}
	}
	return data
}

func StringToUint64Array(v string, split string) []uint64 {
	str := StringToArray(v, split)
	if (str == nil) {
		return nil
	}

	data := make([]uint64, 0)

	for i := 0; i < len(str); i++ {
		d := str[i]
		if (d != "") {
			va, err := strconv.ParseInt(d, 10, 64)
			if (err == nil) {
				data = append(data, uint64(va))
			}
		}
	}
	return data
}

func StringToFloat32Array(v string, split string) []float32 {
	str := StringToArray(v, split)
	if (str == nil) {
		return nil
	}

	data := make([]float32, 0)

	for i := 0; i < len(str); i++ {
		d := str[i]
		if (d != "") {
			va, err := strconv.ParseFloat(d, 32)
			if (err == nil) {
				data = append(data, float32(va))
			}
		}
	}
	return data
}

func StringToFloat64Array(v string, split string) []float64 {
	str := StringToArray(v, split)
	if (str == nil) {
		return nil
	}

	data := make([]float64, 0)

	for i := 0; i < len(str); i++ {
		d := str[i]
		if (d != "") {
			va, err := strconv.ParseFloat(d, 64)
			if (err == nil) {
				data = append(data, float64(va))
			}
		}
	}
	return data
}

func StringToArray(v string, split string) []string {
	if (v == "null" || v == "") {
		return nil
	}
	reg := regexp.MustCompile("\\[|\\]|\"")
	v = reg.ReplaceAllString(v, "")
	str := strings.Split(v, split)
	return str
}

func StringToInt8(v string) int8 {
	result, err := strconv.ParseInt(v, 10, 8)
	if (err == nil) {
		return int8(result)
	}
	return 0
}

func StringToInt16(v string) int16 {
	result, err := strconv.ParseInt(v, 10, 16)
	if (err == nil) {
		return int16(result)
	}
	return 0
}

func StringToInt(v string) int {
	result, err := strconv.ParseInt(v, 10, 32)
	if (err == nil) {
		return int(result)
	}
	return 0
}
func StringToInt32(v string) int32 {
	result, err := strconv.ParseInt(v, 10, 32)
	if (err == nil) {
		return int32(result)
	}
	return 0
}

func StringToInt64(v string) int64 {
	result, err := strconv.ParseInt(v, 10, 64)
	if (err == nil) {
		return int64(result)
	}
	return 0
}

func StringToUint8(v string) uint8 {
	result, err := strconv.ParseInt(v, 10, 8)
	if (err == nil) {
		return uint8(result)
	}
	return 0
}

func StringToUint16(v string) uint16 {
	result, err := strconv.ParseInt(v, 10, 16)
	if (err == nil) {
		return uint16(result)
	}
	return 0
}

func StringToUint32(v string) uint32 {
	result, err := strconv.ParseInt(v, 10, 32)
	if (err == nil) {
		return uint32(result)
	}
	return 0
}

func StringToUint64(v string) uint64 {
	result, err := strconv.ParseInt(v, 10, 64)
	if (err == nil) {
		return uint64(result)
	}
	return 0
}

func StringToFloat32(v string) float32 {
	result, err := strconv.ParseFloat(v, 32)
	if (err == nil) {
		return float32(result)
	}
	return 0
}

func StringToFloat64(v string) float64 {
	result, err := strconv.ParseFloat(v, 64)
	if (err == nil) {
		return float64(result)
	}
	return 0
}

func StringToBool(v string) bool {
	result, err := strconv.ParseBool(v)
	if (err == nil) {
		return result
	}
	return false
}
