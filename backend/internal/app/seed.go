package app

import (
	_ "embed"
	"encoding/json"
	"gorm.io/gorm"
)

//go:embed seed.json
var seedData []byte

func Seed(db *gorm.DB) error {
	var count int64
	if err := db.Model(&Car{}).Count(&count).Error; err != nil {
		return err
	}
	if count != 0 {
		return nil
	}
	var cars []Car
	if err := json.Unmarshal(seedData, &cars); err != nil {
		return err
	}
	// Let both database engines assign IDs and advance their sequences correctly.
	for i := range cars {
		cars[i].ID = 0
	}
	return db.Create(&cars).Error
}
