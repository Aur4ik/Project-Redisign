package app

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var showroomZone = time.FixedZone("Kazakhstan", 5*60*60)
var phoneNumber = regexp.MustCompile(`^[78][0-9]{10}$`)
var slots = []string{"10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"}

func slotTime(date, clock string) (time.Time, error) {
	return time.ParseInLocation("2006-01-02 15:04", date+" "+clock, showroomZone)
}
func (s *Server) createBooking(c *gin.Context) {
	var input struct {
		CarID   uint   `json:"carId" binding:"required"`
		Name    string `json:"name"`
		Phone   string `json:"phone"`
		Date    string `json:"date"`
		Time    string `json:"time"`
		Consent bool   `json:"consent"`
	}
	if c.ShouldBindJSON(&input) != nil {
		fail(c, 400, "Проверьте данные заявки.")
		return
	}
	input.Name = strings.TrimSpace(input.Name)
	input.Phone = regexp.MustCompile(`[^0-9]`).ReplaceAllString(input.Phone, "")
	if !input.Consent || len([]rune(input.Name)) < 2 || len([]rune(input.Name)) > 80 || !phoneNumber.MatchString(input.Phone) {
		fail(c, 400, "Укажите имя, телефон из 11 цифр с 7/8 и согласие на сохранение.")
		return
	}
	start, err := slotTime(input.Date, input.Time)
	if err != nil || !oneOf(input.Time, slots...) || !start.After(time.Now()) || start.After(time.Now().AddDate(0, 0, 90)) {
		fail(c, 400, "Выберите будущее время в пределах 90 дней. Часовой пояс: UTC+5.")
		return
	}
	var car Car
	if s.DB.Where("id = ? AND active = ?", input.CarID, true).First(&car).Error != nil {
		fail(c, 404, "Автомобиль недоступен.")
		return
	}
	key := fmt.Sprintf("%d/%s/%s", car.ID, input.Date, input.Time)
	booking := Booking{UserID: current(c).ID, CarID: car.ID, Name: input.Name, Phone: input.Phone, Date: input.Date, Time: input.Time, Status: "pending", Slot: &key}
	if err = s.DB.Create(&booking).Error; err != nil {
		var count int64
		s.DB.Model(&Booking{}).Where("slot = ?", key).Count(&count)
		if count > 0 {
			fail(c, 409, "Это время уже занято. Выберите другое.")
		} else {
			fail(c, 500, "Не удалось сохранить заявку.")
		}
		return
	}
	s.DB.Preload("Car").Preload("User").First(&booking, booking.ID)
	c.JSON(201, booking)
}
func (s *Server) listBookings(c *gin.Context) {
	bookings := []Booking{}
	if s.DB.Preload("Car").Where("user_id = ?", current(c).ID).Order("created_at DESC").Find(&bookings).Error != nil {
		fail(c, 500, "Не удалось загрузить заявки.")
		return
	}
	c.JSON(200, bookings)
}
func (s *Server) cancelBooking(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var booking Booking
	if s.DB.Where("id = ? AND user_id = ?", id, current(c).ID).First(&booking).Error != nil {
		fail(c, 404, "Заявка не найдена.")
		return
	}
	if !oneOf(booking.Status, "pending", "confirmed") {
		fail(c, 409, "Эту заявку уже нельзя отменить.")
		return
	}
	result := s.DB.Model(&Booking{}).Where("id = ? AND user_id = ? AND status IN ?", id, current(c).ID, []string{"pending", "confirmed"}).Updates(map[string]any{"status": "cancelled", "slot": nil})
	if result.Error != nil {
		fail(c, 500, "Не удалось отменить заявку.")
		return
	}
	if result.RowsAffected == 0 {
		fail(c, 409, "Статус уже изменился. Обновите список.")
		return
	}
	c.Status(204)
}
func (s *Server) adminBookings(c *gin.Context) {
	items := []Booking{}
	if s.DB.Preload("Car").Preload("User").Order("created_at DESC").Find(&items).Error != nil {
		fail(c, 500, "Не удалось загрузить заявки.")
		return
	}
	c.JSON(200, items)
}
func (s *Server) setBookingStatus(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var input struct {
		Status string `json:"status"`
	}
	if c.ShouldBindJSON(&input) != nil || !oneOf(input.Status, "confirmed", "completed", "cancelled") {
		fail(c, 400, "Недопустимый статус.")
		return
	}
	var booking Booking
	if s.DB.First(&booking, id).Error != nil {
		fail(c, 404, "Заявка не найдена.")
		return
	}
	allowed := booking.Status == "pending" && oneOf(input.Status, "confirmed", "cancelled") || booking.Status == "confirmed" && oneOf(input.Status, "completed", "cancelled")
	if !allowed {
		fail(c, 409, "Такой переход статуса недоступен.")
		return
	}
	if input.Status == "completed" {
		start, err := slotTime(booking.Date, booking.Time)
		if err != nil || start.After(time.Now()) {
			fail(c, 409, "Нельзя завершить тест-драйв до его начала.")
			return
		}
	}
	updates := map[string]any{"status": input.Status}
	if input.Status == "cancelled" {
		updates["slot"] = nil
	}
	result := s.DB.Model(&Booking{}).Where("id = ? AND status = ?", id, booking.Status).Updates(updates)
	if result.Error != nil {
		fail(c, 500, "Не удалось обновить статус.")
		return
	}
	if result.RowsAffected == 0 {
		fail(c, 409, "Статус уже изменён. Обновите список.")
		return
	}
	c.JSON(200, gin.H{"status": input.Status})
}
func (s *Server) availability(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var car Car
	if s.DB.Where("id = ? AND active = ?", id, true).First(&car).Error != nil {
		fail(c, 404, "Автомобиль не найден.")
		return
	}
	var items []Booking
	if s.DB.Where("car_id = ? AND date = ? AND slot IS NOT NULL", id, c.Query("date")).Find(&items).Error != nil {
		fail(c, 500, "Не удалось получить время.")
		return
	}
	busy := map[string]bool{}
	for _, b := range items {
		busy[b.Time] = true
	}
	available := []string{}
	for _, clock := range slots {
		start, err := slotTime(c.Query("date"), clock)
		if err == nil && !busy[clock] && start.After(time.Now()) && !start.After(time.Now().AddDate(0, 0, 90)) {
			available = append(available, clock)
		}
	}
	c.JSON(200, available)
}

// Promote is a local administration command; clients cannot choose their own role.
func Promote(db *gorm.DB, email string) error {
	result := db.Model(&User{}).Where("email = ?", strings.ToLower(strings.TrimSpace(email))).Update("role", "admin")
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("account not found; register it in the application first")
	}
	return nil
}
