package app

import (
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"
)

func idParam(c *gin.Context) (uint, bool) {
	n, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || n == 0 {
		fail(c, 400, "Некорректный идентификатор.")
		return 0, false
	}
	return uint(n), true
}
func (s *Server) listCars(c *gin.Context) {
	cars := []Car{}
	query := s.DB.Where("active = ?", true)
	if brand := c.Query("brand"); brand != "" {
		query = query.Where("brand = ?", brand)
	}
	if body := c.Query("body"); body != "" {
		query = query.Where("body = ?", body)
	}
	if max := c.Query("maxPrice"); max != "" {
		price, err := strconv.ParseInt(max, 10, 64)
		if err != nil || price < 0 {
			fail(c, 400, "Некорректный бюджет.")
			return
		}
		query = query.Where("price <= ?", price)
	}
	order := "id ASC"
	switch c.Query("sort") {
	case "low":
		order = "price ASC"
	case "high":
		order = "price DESC"
	case "new":
		order = "year DESC"
	}
	if query.Order(order).Find(&cars).Error != nil {
		fail(c, 500, "Не удалось загрузить каталог.")
		return
	}
	if search := strings.ToLower(strings.TrimSpace(c.Query("q"))); search != "" {
		matches := []Car{}
		for _, car := range cars {
			if strings.Contains(strings.ToLower(car.Brand+" "+car.Model), search) {
				matches = append(matches, car)
			}
		}
		cars = matches
	}
	c.JSON(200, cars)
}
func (s *Server) getCar(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var car Car
	if s.DB.Where("id = ? AND active = ?", id, true).First(&car).Error != nil {
		fail(c, 404, "Автомобиль не найден.")
		return
	}
	c.JSON(200, car)
}
func (s *Server) favorites(c *gin.Context) {
	items := []Favorite{}
	if s.DB.Where("user_id = ?", current(c).ID).Find(&items).Error != nil {
		fail(c, 500, "Не удалось загрузить избранное.")
		return
	}
	ids := []uint{}
	for _, v := range items {
		ids = append(ids, v.CarID)
	}
	c.JSON(200, ids)
}
func (s *Server) addFavorite(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var car Car
	if s.DB.Where("id = ? AND active = ?", id, true).First(&car).Error != nil {
		fail(c, 404, "Автомобиль не найден.")
		return
	}
	f := Favorite{UserID: current(c).ID, CarID: id}
	if s.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&f).Error != nil {
		fail(c, 500, "Не удалось сохранить автомобиль.")
		return
	}
	c.Status(204)
}
func (s *Server) removeFavorite(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	if s.DB.Where("user_id = ? AND car_id = ?", current(c).ID, id).Delete(&Favorite{}).Error != nil {
		fail(c, 500, "Не удалось убрать автомобиль.")
		return
	}
	c.Status(204)
}

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func validateCar(car *Car) string {
	car.Brand = strings.TrimSpace(car.Brand)
	car.Model = strings.TrimSpace(car.Model)
	car.Description = strings.TrimSpace(car.Description)
	if len([]rune(car.Brand)) < 2 || len([]rune(car.Brand)) > 40 || len([]rune(car.Model)) < 1 || len([]rune(car.Model)) > 60 {
		return "Укажите марку и модель (до 40 и 60 символов)."
	}
	if car.Year < 1950 || car.Year > time.Now().Year()+1 || car.Price < 1 || car.Price > 10000000000 || car.Mileage < 0 || car.Mileage > 2000000 || car.Power < 1 || car.Power > 2000 {
		return "Проверьте год, цену, пробег и мощность."
	}
	if !oneOf(car.Body, "Седан", "Кроссовер", "Хэтчбек", "Купе", "Универсал", "Пикап") || !oneOf(car.Fuel, "Бензин", "Дизель", "Гибрид", "Электро") || !oneOf(car.Drive, "Передний", "Задний", "Полный") {
		return "Выберите кузов, топливо и привод из списка."
	}
	if !hexColor.MatchString(car.Color) || len([]rune(car.Engine)) < 1 || len([]rune(car.Engine)) > 30 || len([]rune(car.Description)) < 10 || len([]rune(car.Description)) > 2000 || len([]rune(car.Tag)) > 40 {
		return "Проверьте цвет, двигатель, описание (10–2000 символов) и метку."
	}
	if car.Image != "" {
		u, err := url.Parse(car.Image)
		if err != nil || u.Host == "" || u.Scheme != "https" || len(car.Image) > 2000 {
			return "Для изображения нужна HTTPS-ссылка."
		}
	}
	return ""
}
func oneOf(value string, options ...string) bool {
	for _, o := range options {
		if value == o {
			return true
		}
	}
	return false
}
func (s *Server) adminCars(c *gin.Context) {
	cars := []Car{}
	if s.DB.Order("id DESC").Find(&cars).Error != nil {
		fail(c, 500, "Не удалось загрузить машины.")
		return
	}
	c.JSON(200, cars)
}
func (s *Server) saveCar(c *gin.Context) {
	var car Car
	if c.ShouldBindJSON(&car) != nil {
		fail(c, 400, "Проверьте данные автомобиля.")
		return
	}
	if message := validateCar(&car); message != "" {
		fail(c, 400, message)
		return
	}
	if c.Request.Method == "POST" {
		car.ID = 0
		car.CreatedAt = time.Time{}
		if s.DB.Create(&car).Error != nil {
			fail(c, 500, "Не удалось добавить автомобиль.")
			return
		}
		c.JSON(201, car)
		return
	}
	id, ok := idParam(c)
	if !ok {
		return
	}
	var old Car
	if s.DB.First(&old, id).Error != nil {
		fail(c, 404, "Автомобиль не найден.")
		return
	}
	car.ID = id
	car.CreatedAt = old.CreatedAt
	if s.DB.Save(&car).Error != nil {
		fail(c, 500, "Не удалось обновить автомобиль.")
		return
	}
	c.JSON(200, car)
}
func (s *Server) archiveCar(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	result := s.DB.Model(&Car{}).Where("id = ?", id).Update("active", false)
	if result.Error != nil {
		fail(c, 500, "Не удалось архивировать автомобиль.")
		return
	}
	if result.RowsAffected == 0 {
		fail(c, 404, "Автомобиль не найден.")
		return
	}
	c.Status(204)
}
