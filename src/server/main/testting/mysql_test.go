package testting

import (
	"fmt"
	"testing"
	"github.com/jmoiron/sqlx"
	_ "github.com/go-sql-driver/mysql"
)

type UserInfo struct {
	Id 	int32 `db:"id"`
	Name string `db:"nickName"`
}

func TestSqlite(t *testing.T) {
	db, err := sqlx.Open("mysql", "root:ruHTV4xpPq5VwaE6@tcp(192.168.0.219:3306)/mysql?charset=utf8")
	if err != nil {
		fmt.Println("open mysql failed,", err)
		return
	}

	db.MustExec("CREATE DATABASE IF NOT EXISTS game DEFAULT CHARSET utf8 COLLATE utf8_general_ci")
	db.Close()

	database, err := sqlx.Open("mysql", "root:ruHTV4xpPq5VwaE6@tcp(192.168.0.219:3306)/game?charset=utf8")
	if err != nil {
		fmt.Println("open mysql failed,", err)
		return
	}

 	database.MustExec("CREATE TABLE IF NOT EXISTS account (" +
		"id int(11) NOT NULL, " +
		"nickName varchar(64) NOT NULL," +
		"PRIMARY KEY(Id)" +
	") ENGINE=InnoDB DEFAULT CHARSET=utf8")

	//tx := database.MustBegin()
	//tx.MustExec("INSERT INTO account(id, nickName) VALUES (?, ?)", 100301, "Venus")
	//tx.MustExec("INSERT INTO account(id, nickName) VALUES (?, ?)", 100401, "Mouse")
	//tx.Commit()

	places := UserInfo{}
	err1 := database.Get(&places, "SELECT * FROM account WHERE Id = ?", 100101)
	if err1 != nil {
		fmt.Println("Get Error:", err1)
	} else {
		fmt.Printf("Get: Id = %d, Name = %s", places.Id, places.Name)
	}

	alls := []UserInfo{}
	err2 := database.Select(&alls, "SELECT * FROM account")
	if err2 != nil {
		fmt.Println("select Error:", err1)
	}

	database.Close()
}


