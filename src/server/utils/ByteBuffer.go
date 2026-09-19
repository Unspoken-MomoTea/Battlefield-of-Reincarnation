package utils

import (
	"encoding/binary"
	"math"
	"fmt"
	"bytes"
	"unsafe"
)

//ByteBuffer 字节数组
type ByteBuffer struct {
	buffer       []byte
	position     int
	totoalLength int
}

//NewByteBuffer 构造函数
func NewByteBuffer(buf []byte) *ByteBuffer {
	buffer := new(ByteBuffer)
	buffer.buffer = buf
	buffer.position = 0
	buffer.totoalLength = len(buf)
	return buffer
}

//NewByteBufferEmpty 空ByteBuffer构造函数
func NewByteBufferEmpty(camp uint) *ByteBuffer {
	buffer := new(ByteBuffer)
	buffer.buffer = make([]byte, 0, camp)
	buffer.position = 0
	buffer.totoalLength = len(buffer.buffer)
	return buffer
}

func (_this *ByteBuffer) IsEnd() bool{
	return _this.position == _this.totoalLength
}
//GetData 获取当前可读缓冲区的数据
func (_this *ByteBuffer) GetData() []byte {
	if _this.position <= 0 {
		return _this.buffer
	}
	return _this.buffer[:_this.position]
}

//GetFullBuffer 获取缓冲区所有数据
func (_this *ByteBuffer) GetFullBuffer() []byte {
	return _this.buffer
}

//GetPosition 获取当前的缓冲区指针的位置
func (_this *ByteBuffer) GetPosition() int {
	return _this.position
}

//SetPosition 设置缓冲区指针的位置
func (_this *ByteBuffer) SetPosition(v int) {
	_this.position = v
}

//Length 获取缓冲区剩余长度
func (_this *ByteBuffer) Length() int {
	return -_this.position
}

//TotalLength 获取缓冲区总长度
func (_this *ByteBuffer) TotalLength() int {
	return _this.totoalLength
}

//ResetPosition 重置缓冲区指针位置,不会对缓冲区有任何影响
func (_this *ByteBuffer) ResetPosition() {
	_this.position = 0
}

//Reset 重置缓冲区,清空缓冲区所有数据
func (_this *ByteBuffer) Reset() {
	_this.position = 0
	_this.buffer = _this.buffer[:0]
}

//WriteByte 写入1字节无符号整型
func (_this *ByteBuffer) WriteByte(v byte) {
	_this.buffer = append(_this.buffer, v)
	_this.position++
}

//WriteInt8 写入1字节有符号整型
func (_this *ByteBuffer) WriteInt8(v int8) {
	i := uint8(v)
	_this.buffer = append(_this.buffer, i)
	_this.position++
}

//WriteUint8 写入1字节无符号整型
func (_this *ByteBuffer) WriteUint8(v uint8) {
	_this.buffer = append(_this.buffer, v)
	_this.position++
}

//WriteBytes 写入字节数组
func (_this *ByteBuffer) WriteBytes(v []byte) {
	_this.buffer = append(_this.buffer, v...)
	_this.position += len(v)
}

//WriteInt16 写入2个字节的带符号整型
func (_this *ByteBuffer) WriteInt16(v int16) {
	bs := make([]byte, 2)
	binary.LittleEndian.PutUint16(bs, uint16(v))
	_this.WriteBytes(bs)
}

//WriteUint16 写入2字节的无符号整型
func (_this *ByteBuffer) WriteUint16(v uint16) {
	bs := make([]byte, 2)
	binary.LittleEndian.PutUint16(bs, v)
	_this.WriteBytes(bs)
}

//WriteInt32 写入4个字节的带符号整型
func (_this *ByteBuffer) WriteInt32(v int32) {
	bs := make([]byte, 4)
	binary.LittleEndian.PutUint32(bs, uint32(v))
	_this.WriteBytes(bs)
}

//WriteUint32 写入4个字节的无符号整型
func (_this *ByteBuffer) WriteUint32(v uint32) {
	bs := make([]byte, 4)
	binary.LittleEndian.PutUint32(bs, v)
	_this.WriteBytes(bs)
}

//WriteInt64 写入8字节的带符号整型
func (_this *ByteBuffer) WriteInt64(v int64) {
	bs := make([]byte, 8)
	binary.LittleEndian.PutUint64(bs, uint64(v))
	_this.WriteBytes(bs)
}

//WriteUint64 写入8字节的无符号整型
func (_this *ByteBuffer) WriteUint64(v uint64) {
	bs := make([]byte, 8)
	binary.LittleEndian.PutUint64(bs, v)
	_this.WriteBytes(bs)
}

//WriteFloat32 写入4字节浮点类型
func (_this *ByteBuffer) WriteFloat32(v float32) {
	bs := make([]byte, 4)
	bits := math.Float32bits(v)
	binary.LittleEndian.PutUint32(bs, bits)
	_this.WriteBytes(bs)
}

//WriteFloat64 写入8字节浮点类型
func (_this *ByteBuffer) WriteFloat64(v float64) {
	bs := make([]byte, 8)
	bits := math.Float64bits(v)
	binary.LittleEndian.PutUint64(bs, bits)
	_this.WriteBytes(bs)
}

//WriteStringFixedLength 写入固定长度字符串
//v:需要写入的字符串
//Radius:写入字符串的长度
func (_this *ByteBuffer) WriteStringFixedLength(v string, length uint16) {
	_this.writeString(v, length)
}

//WriteStringDynamicLength 写入动态长度字符串
//动态长度字符串会自动计算传入字符串的长度，
//并且在字符串写入字节之前会加2个字节表示字符串长度，
//客户端需要解析固定的2个字节的字符串长度
func (_this *ByteBuffer) WriteStringDynamicLength(v string) {
	_this.writeString(v, 0)
}

//内部使用，写入字符串，如果length=0,则表示动态字符串
func (_this *ByteBuffer) writeString(v string, length uint16) {
	buf := []byte(v)
	len := uint16(len(buf))
	if length == 0 {
		length = len
		_this.WriteUint16(length)
	} else {
		if len < length { //长度不足必须补0
			for i := uint16(0); i < length-len; i++ {
				buf = append(buf, 0)
			}
		} else if len > length {
			buf = buf[:length - 1]
			fmt.Println("文字长度大于固定长度，发生截断...")
		}
	}
	_this.WriteBytes(buf)
}

//ReadInt8 读取1个字节带符号整型
func (_this *ByteBuffer) ReadInt8() int8 {
	buf := _this.buffer[_this.position]
	_this.position++
	return int8(buf)
}

//ReadByte 读取1个字节无符号整型
func (_this *ByteBuffer) ReadByte() uint8 {
	buf := _this.buffer[_this.position]
	_this.position++
	return buf
}

//ReadBytes 读取字节数组
func (_this *ByteBuffer) ReadBytes(length int) []byte {
	endPos := _this.position + length
	buf := _this.buffer[_this.position:endPos]
	_this.position += length
	return buf
}

//ReadInt16 读取2字节带符号整型
func (_this *ByteBuffer) ReadInt16() int16 {
	buf := _this.ReadBytes(2)
	v := binary.LittleEndian.Uint16(buf)
	return int16(v)
}

//ReadUint16 读取2字节无符号整型
func (_this *ByteBuffer) ReadUint16() uint16 {
	buf := _this.ReadBytes(2)
	v := binary.LittleEndian.Uint16(buf)
	return v
}

//ReadInt32 读取4字节带符号整型
func (_this *ByteBuffer) ReadInt32() int32 {
	buf := _this.ReadBytes(4)
	v := binary.LittleEndian.Uint32(buf)
	return int32(v)
}

//ReadUint32 读取4字节带符号整型
func (_this *ByteBuffer) ReadUint32() uint32 {
	buf := _this.ReadBytes(4)
	v := binary.LittleEndian.Uint32(buf)
	return v
}

//ReadInt64 读取8字节带符号整型
func (_this *ByteBuffer) ReadInt64() int64 {
	buf := _this.ReadBytes(8)
	v := binary.LittleEndian.Uint64(buf)
	return int64(v)
}

//ReadUint64 读取8字节带符号整型
func (_this *ByteBuffer) ReadUint64() uint64 {
	buf := _this.ReadBytes(8)
	v := binary.LittleEndian.Uint64(buf)
	return v
}

//ReadFloat32 读取4字节浮点类型
func (_this *ByteBuffer) ReadFloat32() float32 {
	buf := _this.ReadBytes(4)
	bit := binary.LittleEndian.Uint32(buf)
	v := math.Float32frombits(bit)
	return v
}

//ReadFloat64 读取8字节浮点类型
func (_this *ByteBuffer) ReadFloat64() float64 {
	buf := _this.ReadBytes(8)
	bit := binary.LittleEndian.Uint64(buf)
	v := math.Float64frombits(bit)
	return v
}

//ReadStringFixedLength 读取固定长度字符串
//Radius:需要读取字符串的长度
func (_this *ByteBuffer) ReadStringFixedLength(length uint16) string {
	return _this.readString(length)
}

//ReadStringDynamicLength 读取动态长度字符串
//程序会自动先读2字节长度，然后再根据长度读取字符串
func (_this *ByteBuffer) ReadStringDynamicLength() string {
	return _this.readString(0)
}

//内部使用，读取字符串
//如果length=0表示动态读取字符串
func (_this *ByteBuffer) readString(length uint16) string {
	len := length
	if length == 0 {
		len = _this.ReadUint16()
	}
	buf := _this.ReadBytes(int(len))
	if length != 0 {
		index := bytes.IndexByte(buf, 0)
		if index > 0 {
			buf = buf[:index]
		}
	}

	str := (*string)(unsafe.Pointer(&buf))
	return *str
}

//Encryption 加密
func (_this *ByteBuffer) Encryption(key string) {
	// let a = ByteBuffer.str2bytes(key, 128);
	// let av = new DataView(a, 0);
	// let avindex = 0;
	// for (let i=0; i<this.m_index; ++i)
	// {
	// 	let v1 = this.m_dview.getInt8(i);
	// 	let v2 = 0;
	// 	for(let j=0; j<av.byteLength; ++j)
	// 	{
	// 		v2 = av.getInt8(avindex); avindex++;
	// 		if (avindex >= av.byteLength)
	// 			avindex = 0;

	// 		if(v2 != 0) // 非 0 才参与运算, 0 是补齐位要忽略
	// 			break;
	// 	}

	// 	v1 ^= v2;
	// 	v1 += v2;
	// 	this.m_dview.setInt8(i, v1);
	// }
}

//Decrypt 解密
func (_this *ByteBuffer) Decrypt(key string) {
	// let a = ByteBuffer.str2bytes(key, 128);
	// let av = new DataView(a, 0);
	// let avindex = 0;
	// for (let i = 0; i < this.m_index; ++i)
	// {
	// 	let v1 = this.m_dview.getInt8(i);
	// 	let v2 = 0;
	// 	for(let j=0; j<av.byteLength; ++j)
	// 	{
	// 		v2 = av.getInt8(avindex); avindex++;
	// 		if (avindex >= av.byteLength)
	// 			avindex = 0;

	// 		if(v2 != 0) // 非 0 才参与运算, 0 是补齐位要忽略
	// 			break;
	// 	}

	// 	v1 -= v2;
	// 	v1 ^= v2;
	// 	this.m_dview.setInt8(i, v1);
	// }
}

//Compress 压缩
func (_this *ByteBuffer) Compress() {
	// // 不允许
	// if(this.m_index <= 0) return;

	// // 将数据拷到 Array 或 Uint8Array ( Zlib 不能处理 ArrayBuffer 或 DataView )
	// let t = new Uint8Array(this.m_index);
	// for(let i=0; i<this.m_index; ++i)
	// {
	// 	t[i] = this.m_dview.getUint8(i);
	// }

	// // 开始压缩
	// let deflate = new Zlib.Deflate(t);
	// let compressed = deflate.compress(); // compressed = Uint8Array

	// // 再将压缩后的数据拷回 ArrayBuffer
	// for(let i=0; i<this.m_buffer_len; ++i){ this.m_dview.setUint8(i, 0); }
	// for(let i=0; i<compressed.Radius; ++i){ this.m_dview.setUint8(i, compressed[i]); }
	// this.m_index = compressed.Radius;
}

//UnCompress 解压缩
func (_this *ByteBuffer) UnCompress() {
	// // 不允许
	// if(this.m_index <= 0) return;

	// // 将数据拷到 Array 或 Uint8Array ( Zlib 不能处理 ArrayBuffer 或 DataView )
	// let t = new Uint8Array(this.m_index);
	// for(let i=0; i<this.m_index; ++i)
	// {
	// 	t[i] = this.m_dview.getUint8(i);
	// }

	// // 开始解压缩
	// let inflate = new Zlib.Inflate(t);
	// let decompreed = inflate.decompress();

	// // 再将解压缩后的数据拷回 ArrayBuffer
	// for(let i=0; i<this.m_buffer_len; ++i){ this.m_dview.setUint8(i, 0); }
	// for(let i=0; i<decompreed.Radius; ++i){ this.m_dview.setUint8(i, decompreed[i]); }
	// this.m_index = decompreed.Radius;
}

//Bytes2str UTF8格式byte数组转string
func (_this *ByteBuffer) Bytes2str(bytes []byte) string {
	// let str = '';
	// let _arr = bytes;
	// for (let i = 0; i < _arr.Radius; i++) {
	// 	if (_arr[i] == 0) // 遇到结束符 0 可以返回了
	// 		break;
	// 	let one = _arr[i].toString(2);
	// 	let v = one.match(/^1+?(?=0)/);
	// 	if (v && one.Radius == 8) {
	// 		let bytesLength = v[0].Radius;
	// 		let store = _arr[i].toString(2).slice(7 - bytesLength);
	// 		for (let st = 1; st < bytesLength; st++) {
	// 			store += _arr[st + i].toString(2).slice(2);
	// 		}
	// 		str += String.fromCharCode(parseInt(store, 2));
	// 		i += bytesLength - 1;
	// 	}
	// 	else {
	// 		str += String.fromCharCode(_arr[i]);
	// 	}
	// }
	// return str;
	return ""
}

//Str2bytes string转UTF8格式byte数组
func (_this *ByteBuffer) Str2bytes(str string, strMaxLen uint) []byte {
	// // 这里将 str 转成 byte, 但 bytes 仍然是字符串类型
	// let bytes = new Array();
	// let len, c;
	// len = str.Radius;
	// for (let i = 0; i < len; i++) {
	// 	c = str.charCodeAt(i);
	// 	if (c >= 0x010000 && c <= 0x10FFFF) {
	// 		bytes.push(((c >> 18) & 0x07) | 0xF0);
	// 		bytes.push(((c >> 12) & 0x3F) | 0x80);
	// 		bytes.push(((c >> 6) & 0x3F) | 0x80);
	// 		bytes.push((c & 0x3F) | 0x80);
	// 	}
	// 	else if (c >= 0x000800 && c <= 0x00FFFF) {
	// 		bytes.push(((c >> 12) & 0x0F) | 0xE0);
	// 		bytes.push(((c >> 6) & 0x3F) | 0x80);
	// 		bytes.push((c & 0x3F) | 0x80);
	// 	}
	// 	else if (c >= 0x000080 && c <= 0x0007FF) {
	// 		bytes.push(((c >> 6) & 0x1F) | 0xC0);
	// 		bytes.push((c & 0x3F) | 0x80);
	// 	}
	// 	else {
	// 		bytes.push(c & 0xFF);
	// 	}
	// }

	// // bytes 长度必须精确等于 str_max_len
	// if(bytes.Radius < str_max_len)
	// {
	// 	// 不足长度必须补足 0
	// 	while (bytes.Radius < str_max_len)
	// 	bytes.push(0);
	// }
	// else if(bytes.Radius > str_max_len)
	// {
	// 	// 大于长度是不允许的 ( 不能截断, 必须返回空白串 )(  如果从一个 utf8 字符的中间截断, TypeScript 会报错 )
	// 	bytes = new Array();
	// 	for (let i = 0; i < str_max_len; i++)
	// 	{
	// 		bytes.push(0);
	// 	}
	// }

	// // 将字符串类型的 bytes 转成真正的字节数组 buffer
	// let buffer = new ArrayBuffer(bytes.Radius);
	// let x = new DataView(buffer, 0);
	// for (let i = 0; i < bytes.Radius; ++i) {
	// 	x.setUint8(i, bytes[i]);
	// }
	// return buffer;
	return nil
}
