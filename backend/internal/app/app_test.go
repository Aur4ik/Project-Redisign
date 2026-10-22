package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func testApp(t *testing.T) (http.Handler, *gorm.DB, Config) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	cfg := Config{DataDir: t.TempDir(), Secret: []byte(strings.Repeat("test-key", 8))}
	db, err := OpenDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	sql, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sql.Close() })
	if err = Seed(db); err != nil {
		t.Fatal(err)
	}
	return New(db, cfg), db, cfg
}
func request(t *testing.T, handler http.Handler, method, path string, body any, cookie *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		req.AddCookie(cookie)
	}
	result := httptest.NewRecorder()
	handler.ServeHTTP(result, req)
	return result
}
func expect(t *testing.T, result *httptest.ResponseRecorder, code int) {
	t.Helper()
	if result.Code != code {
		t.Fatalf("want status %d, got %d: %s", code, result.Code, result.Body.String())
	}
}
func registerUser(t *testing.T, h http.Handler, email string) (User, *http.Cookie) {
	t.Helper()
	result := request(t, h, "POST", "/api/auth/register", map[string]any{"name": "Test Customer", "email": email, "password": "test-password-123", "role": "admin"}, nil)
	expect(t, result, 201)
	var user User
	if err := json.Unmarshal(result.Body.Bytes(), &user); err != nil {
		t.Fatal(err)
	}
	if user.Role != "customer" {
		t.Fatal("client assigned itself admin role")
	}
	cookies := result.Result().Cookies()
	if len(cookies) == 0 || !cookies[0].HttpOnly {
		t.Fatal("missing HttpOnly session cookie")
	}
	if strings.Contains(result.Body.String(), "password") {
		t.Fatal("password exposed")
	}
	return user, cookies[0]
}
func TestAuthenticationAndPermissions(t *testing.T) {
	h, db, cfg := testApp(t)
	user, cookie := registerUser(t, h, "customer@example.com")
	expect(t, request(t, h, "GET", "/api/me", nil, cookie), 200)
	expect(t, request(t, h, "POST", "/api/auth/register", map[string]any{"name": "Test Customer", "email": user.Email, "password": "test-password-123"}, nil), 409)
	expect(t, request(t, h, "POST", "/api/auth/login", map[string]string{"email": user.Email, "password": "incorrect"}, nil), 401)
	login := request(t, h, "POST", "/api/auth/login", map[string]string{"email": user.Email, "password": "test-password-123"}, nil)
	expect(t, login, 200)
	expect(t, request(t, h, "GET", "/api/admin/users", nil, cookie), 403)
	expect(t, request(t, h, "GET", "/api/bookings", nil, nil), 401)
	if err := Promote(db, user.Email); err != nil {
		t.Fatal(err)
	}
	expect(t, request(t, h, "GET", "/api/admin/users", nil, cookie), 200)
	// Restarting the handler with the same persistent DB preserves sessions.
	h = New(db, cfg)
	expect(t, request(t, h, "GET", "/api/me", nil, cookie), 200)
	expect(t, request(t, h, "POST", "/api/auth/logout", map[string]string{}, cookie), 204)
	expect(t, request(t, h, "GET", "/api/me", nil, cookie), 401)
	var stored User
	if err := db.First(&stored, user.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.Password == "test-password-123" || !strings.HasPrefix(stored.Password, "$2") {
		t.Fatal("password not hashed")
	}
	cross := httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(`{}`))
	cross.Header.Set("Origin", "https://untrusted.example")
	cross.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, cross)
	expect(t, w, 403)
	badCookie := &http.Cookie{Name: "alaauto_session", Value: cookie.Value + "invalid"}
	expect(t, request(t, h, "GET", "/api/me", nil, badCookie), 401)
}
func TestCatalogFavoritesAndArchive(t *testing.T) {
	h, db, _ := testApp(t)
	admin, adminCookie := registerUser(t, h, "admin@example.com")
	_, other := registerUser(t, h, "other@example.com")
	result := request(t, h, "GET", "/api/cars?body="+"%D0%9A%D1%80%D0%BE%D1%81%D1%81%D0%BE%D0%B2%D0%B5%D1%80"+"&maxPrice=20000000", nil, nil)
	expect(t, result, 200)
	var cars []Car
	json.Unmarshal(result.Body.Bytes(), &cars)
	if len(cars) != 1 || cars[0].Model != "Tucson" {
		t.Fatalf("unexpected filtered cars: %+v", cars)
	}
	expect(t, request(t, h, "PUT", "/api/favorites/1", map[string]string{}, adminCookie), 204)
	expect(t, request(t, h, "PUT", "/api/favorites/1", map[string]string{}, adminCookie), 204)
	result = request(t, h, "GET", "/api/favorites", nil, other)
	if strings.TrimSpace(result.Body.String()) != "[]" {
		t.Fatal("favorites leaked between users")
	}
	if err := Promote(db, admin.Email); err != nil {
		t.Fatal(err)
	}
	expect(t, request(t, h, "DELETE", "/api/admin/cars/1", map[string]string{}, other), 403)
	expect(t, request(t, h, "DELETE", "/api/admin/cars/1", map[string]string{}, adminCookie), 204)
	expect(t, request(t, h, "GET", "/api/cars/1", nil, nil), 404)
	expect(t, request(t, h, "PUT", "/api/favorites/1", map[string]string{}, other), 404)
	var car Car
	db.First(&car, 1)
	car.Active = true
	car.Price = 19900000
	expect(t, request(t, h, "PUT", "/api/admin/cars/1", car, adminCookie), 200)
	expect(t, request(t, h, "GET", "/api/cars/1", nil, nil), 200)
	car.ID = 100
	car.Model = "Test model"
	created := request(t, h, "POST", "/api/admin/cars", car, adminCookie)
	expect(t, created, 201)
	var added Car
	json.Unmarshal(created.Body.Bytes(), &added)
	if added.ID <= 6 || added.ID == 100 {
		t.Fatal("unexpected auto-generated id")
	}
	car.Price = -1
	expect(t, request(t, h, "POST", "/api/admin/cars", car, adminCookie), 400)
	expect(t, request(t, h, "DELETE", "/api/favorites/1", map[string]string{}, adminCookie), 204)
}
func TestBookingsOwnershipAndSlotConflict(t *testing.T) {
	h, db, _ := testApp(t)
	admin, cookie := registerUser(t, h, "buyer@example.com")
	_, other := registerUser(t, h, "second@example.com")
	date := time.Now().In(showroomZone).AddDate(0, 0, 2).Format("2006-01-02")
	body := map[string]any{"carId": 1, "name": "Test Buyer", "phone": "+7 700 000 00 00", "date": date, "time": "10:00", "consent": true}
	r := request(t, h, "POST", "/api/bookings", body, cookie)
	expect(t, r, 201)
	var b Booking
	if err := json.Unmarshal(r.Body.Bytes(), &b); err != nil {
		t.Fatal(err)
	}
	expect(t, request(t, h, "POST", "/api/bookings", body, other), 409)
	list := request(t, h, "GET", "/api/bookings", nil, other)
	if strings.TrimSpace(list.Body.String()) != "[]" {
		t.Fatal("bookings leaked between users")
	}
	expect(t, request(t, h, "DELETE", fmt.Sprintf("/api/bookings/%d", b.ID), map[string]string{}, other), 404)
	available := request(t, h, "GET", "/api/cars/1/availability?date="+date, nil, nil)
	expect(t, available, 200)
	if strings.Contains(available.Body.String(), "10:00") {
		t.Fatal("occupied slot returned as available")
	}
	expect(t, request(t, h, "DELETE", fmt.Sprintf("/api/bookings/%d", b.ID), map[string]string{}, cookie), 204)
	r = request(t, h, "POST", "/api/bookings", body, other)
	expect(t, r, 201)
	json.Unmarshal(r.Body.Bytes(), &b)
	if err := Promote(db, admin.Email); err != nil {
		t.Fatal(err)
	}
	path := fmt.Sprintf("/api/admin/bookings/%d/status", b.ID)
	expect(t, request(t, h, "PATCH", path, map[string]string{"status": "completed"}, cookie), 409)
	expect(t, request(t, h, "PATCH", path, map[string]string{"status": "confirmed"}, cookie), 200)
	expect(t, request(t, h, "PATCH", path, map[string]string{"status": "completed"}, cookie), 409)
	expect(t, request(t, h, "PATCH", path, map[string]string{"status": "cancelled"}, cookie), 200)
	expect(t, request(t, h, "PATCH", path, map[string]string{"status": "confirmed"}, cookie), 409)
	body["date"] = "2000-01-01"
	expect(t, request(t, h, "POST", "/api/bookings", body, cookie), 400)
	body["date"] = date
	body["consent"] = false
	expect(t, request(t, h, "POST", "/api/bookings", body, cookie), 400)
	body["consent"] = true
	body["phone"] = "123"
	expect(t, request(t, h, "POST", "/api/bookings", body, cookie), 400)
}
func TestConcurrentReservationsAndPersistence(t *testing.T) {
	h, db, cfg := testApp(t)
	_, cookie := registerUser(t, h, "concurrent@example.com")
	body := map[string]any{"carId": 2, "name": "Test Buyer", "phone": "87000000000", "date": time.Now().In(showroomZone).AddDate(0, 0, 3).Format("2006-01-02"), "time": "11:00", "consent": true}
	var wg sync.WaitGroup
	codes := make(chan int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); r := request(t, h, "POST", "/api/bookings", body, cookie); codes <- r.Code }()
	}
	wg.Wait()
	close(codes)
	success, conflict := 0, 0
	for code := range codes {
		if code == 201 {
			success++
		}
		if code == 409 {
			conflict++
		}
	}
	if success != 1 || conflict != 1 {
		t.Fatalf("want one success and one conflict; got %d, %d", success, conflict)
	}
	sql, _ := db.DB()
	sql.Close()
	reopened, err := OpenDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	sql2, _ := reopened.DB()
	defer sql2.Close()
	result := request(t, New(reopened, cfg), "GET", "/api/bookings", nil, cookie)
	expect(t, result, 200)
	var bookings []Booking
	json.Unmarshal(result.Body.Bytes(), &bookings)
	if len(bookings) != 1 {
		t.Fatal("bookings did not persist after reopening database")
	}
}
