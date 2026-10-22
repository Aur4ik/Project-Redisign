package app

import "time"

type User struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name"`
	Email     string    `json:"email" gorm:"uniqueIndex;not null"`
	Password  string    `json:"-"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}
type Session struct {
	ID        string `gorm:"primaryKey"`
	UserID    uint   `gorm:"index"`
	ExpiresAt time.Time
}
type Car struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Brand       string    `json:"brand"`
	Model       string    `json:"model"`
	Year        int       `json:"year"`
	Price       int64     `json:"price"`
	Mileage     int       `json:"mileage"`
	Body        string    `json:"body"`
	Fuel        string    `json:"fuel"`
	Engine      string    `json:"engine"`
	Power       int       `json:"power"`
	Drive       string    `json:"drive"`
	Color       string    `json:"color"`
	Tag         string    `json:"tag"`
	Description string    `json:"description"`
	Image       string    `json:"image"`
	Active      bool      `json:"active"`
	CreatedAt   time.Time `json:"createdAt"`
}
type Favorite struct {
	UserID uint `json:"-" gorm:"primaryKey"`
	CarID  uint `json:"carId" gorm:"primaryKey"`
}
type Booking struct {
	ID     uint   `json:"id" gorm:"primaryKey"`
	UserID uint   `json:"userId" gorm:"index"`
	User   User   `json:"user" gorm:"foreignKey:UserID"`
	CarID  uint   `json:"carId" gorm:"index"`
	Car    Car    `json:"car" gorm:"foreignKey:CarID"`
	Name   string `json:"name"`
	Phone  string `json:"phone"`
	Date   string `json:"date"`
	Time   string `json:"time"`
	Status string `json:"status"`
	// A non-null unique slot prevents concurrent reservations of the same car/time.
	Slot      *string   `json:"-" gorm:"uniqueIndex"`
	CreatedAt time.Time `json:"createdAt"`
}
