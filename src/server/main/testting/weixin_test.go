package testting

import (
	"testing"
	"crypto/aes"
	"crypto/cipher"
	"fmt"
	"encoding/base64"
	"bytes"
	"encoding/json"
	"encoding/hex"
)

// 使用PKCS7进行填充
func PKCS7Padding(ciphertext []byte, blockSize int) []byte {
	padding := blockSize - len(ciphertext) % blockSize
	padtext := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(ciphertext, padtext...)
}
// AES 加密，填充秘钥key的16位，24，32分别对应AES-128, AES-192, or AES-256
func AesCBCEncrypt(rawData, key, iv []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		panic(err)
	}

	blockSize := block.BlockSize()
	// 填充原文
	rawData = PKCS7Padding(rawData, blockSize)
	// 初始向量IV必须是唯一，但不需要保密
	cipherText := make([]byte, len(rawData))
	// block 大小和初始向量大小一定要一致
	mode := cipher.NewCBCEncrypter(block, iv)

	mode.CryptBlocks(cipherText, rawData)

	return cipherText, nil
}

func PKCS7UnPadding(origData []byte) []byte {
	length := len(origData)
	unpadding := int(origData[length-1])
	return origData[:(length - unpadding)]
}

func AesCBCDecrypt(encryptData, key, iv []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		panic(err)
	}

	blockSize := block.BlockSize()
	if len(encryptData) < blockSize {
		panic("ciphertext too short")
	}
	// CBC mode always works in whole blocks.
	if len(encryptData) % blockSize != 0 {
		panic("ciphertext is not a multiple of the block size")
	}

	mode := cipher.NewCBCDecrypter(block, iv)
	// CryptBlocks can work in-place if the two arguments are the same.
	mode.CryptBlocks(encryptData, encryptData)
	//解填充
	encryptData = PKCS7UnPadding(encryptData)
	return encryptData, nil
}

func Test_WeiXin(t *testing.T){
	appID := "wx4f4bc4dec97d474b"
    sessionKey := "tiihtNczf5v6AKRyjwEUhQ=="
    encryptedData := "CiyLU1Aw2KjvrjMdj8YKliAjtP4gsMZMQmRzooG2xrDcvSnxIMXFufNstNGTyaGS9uT5geRa0W4oTOb1WT7fJlAC+oNPdbB+3hVbJSRgv+4lGOETKUQz6OYStslQ142dNCuabNPGBzlooOmB231qMM85d2/fV6ChevvXvQP8Hkue1poOFtnEtpyxVLW1zAo6/1Xx1COxFvrc2d7UL/lmHInNlxuacJXwu0fjpXfz/YqYzBIBzD6WUfTIF9GRHpOn/Hz7saL8xz+W//FRAUid1OksQaQx4CMs8LOddcQhULW4ucetDf96JcR3g0gfRK4PC7E/r7Z6xNrXd2UIeorGj5Ef7b1pJAYB6Y5anaHqZ9J6nKEBvB4DnNLIVWSgARns/8wR2SiRS7MNACwTyrGvt9ts8p12PKFdlqYTopNHR1Vf7XjfhQlVsAJdNiKdYmYVoKlaRv85IfVunYzO0IKXsyl7JCUjCpoG20f0a04COwfneQAGGwd5oa+T8yO5hzuyDb/XcxxmK01EpqOyuxINew=="
	iv := "r7BXXKkLb8qrSNn05n0qiA=="

	iv1, _ := base64.StdEncoding.DecodeString(iv)
	sessionKey1, _ := base64.StdEncoding.DecodeString(sessionKey)
	encryptedData1, _ := base64.StdEncoding.DecodeString(encryptedData)

	ciphertext, _ := AesCBCDecrypt(encryptedData1, sessionKey1, iv1)
	fmt.Printf("Aes CBC Descrpyt[%s]\n", string(ciphertext))

	//encryptData, _ := AesCBCEncrypt(ciphertext, sessionKey1, iv1)
	//fmt.Printf("Aes CBC Enscrpyt[%s]\n", base64.StdEncoding.EncodeToString(encryptData))
	//
	//ciphertext1, _ := AesCBCDecrypt(encryptData, sessionKey1, iv1)
	//fmt.Printf("Aes CBC Descrpyt[%s]\n", string(ciphertext1))

	mValues := make(map[string]interface{}, 0)
	err := json.Unmarshal(ciphertext, &mValues)
	if err != nil {
		fmt.Printf("Json Unmarshal err: %s \n", err.Error())
		return
	}

	waterMark, fOk := mValues["watermark"]
	if fOk == false || waterMark == nil {
		fmt.Println("return values no find watermark")
		return
	}

 	waterValues := waterMark.(map[string]interface{})
	appid, fOk := waterValues["appid"]
	if fOk == false || appid == nil {
		fmt.Println("watermark no find appid")
		return
	}

	if appID != appid.(string) {
		fmt.Printf("APP ID Error[%s != %s] \n", appID, appid.(string))
		return
	}


	bytes := hex.EncodeToString([]byte("志在必得"))
	fmt.Println(bytes)

	ih, err := hex.DecodeString(bytes)
	fmt.Println(string(ih[:]))
}