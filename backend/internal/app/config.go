package app

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Config struct {
	Address      string
	DatabaseURL  string
	DataDir      string
	Secret       []byte
	SecureCookie bool
}

func LoadConfig() (Config, error) {
	dir := os.Getenv("DATA_DIR")
	if dir == "" {
		dir = "data"
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return Config{}, err
	}
	key := []byte(os.Getenv("JWT_SECRET"))
	if len(key) == 0 {
		path := filepath.Join(dir, "session.key")
		value, err := os.ReadFile(path)
		if errors.Is(err, os.ErrNotExist) {
			bytes := make([]byte, 32)
			if _, err = rand.Read(bytes); err != nil {
				return Config{}, err
			}
			value = []byte(hex.EncodeToString(bytes))
			if err = os.WriteFile(path, value, 0600); err != nil {
				return Config{}, err
			}
		} else if err != nil {
			return Config{}, err
		}
		key = value
	}
	if len(key) < 32 {
		return Config{}, fmt.Errorf("JWT_SECRET must contain at least 32 bytes")
	}
	address := os.Getenv("ADDRESS")
	if address == "" {
		address = "127.0.0.1:8081"
	}
	return Config{Address: address, DatabaseURL: os.Getenv("DATABASE_URL"), DataDir: dir, Secret: key, SecureCookie: os.Getenv("COOKIE_SECURE") == "true"}, nil
}
func OpenDB(cfg Config) (*gorm.DB, error) {
	var driver gorm.Dialector = sqlite.Open(filepath.Join(cfg.DataDir, "alaauto.db") + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if cfg.DatabaseURL != "" {
		driver = postgres.Open(cfg.DatabaseURL)
	}
	db, err := gorm.Open(driver, &gorm.Config{TranslateError: true, Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	if cfg.DatabaseURL == "" {
		sqlDB.SetMaxOpenConns(1)
	} else {
		sqlDB.SetMaxOpenConns(10)
	}
	sqlDB.SetConnMaxLifetime(time.Hour)
	if err = db.AutoMigrate(&User{}, &Session{}, &Car{}, &Favorite{}, &Booking{}); err != nil {
		return nil, err
	}
	return db, nil
}
