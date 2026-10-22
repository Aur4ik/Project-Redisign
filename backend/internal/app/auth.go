package app

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type attempt struct {
	Count int
	Until time.Time
}
type Server struct {
	DB       *gorm.DB
	Config   Config
	mutex    sync.Mutex
	attempts map[string]attempt
}

func fail(c *gin.Context, status int, message string) {
	c.AbortWithStatusJSON(status, gin.H{"error": message})
}
func (s *Server) authThrottle(c *gin.Context) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	now := time.Now()
	for k, a := range s.attempts {
		if now.After(a.Until) {
			delete(s.attempts, k)
		}
	}
	key := c.ClientIP()
	a := s.attempts[key]
	if a.Count >= 30 {
		fail(c, 429, "Слишком много попыток. Повторите через 10 минут.")
		return
	}
	if a.Count == 0 {
		a.Until = now.Add(10 * time.Minute)
	}
	a.Count++
	s.attempts[key] = a
}
func (s *Server) register(c *gin.Context) {
	var input struct {
		Name     string `json:"name" binding:"required"`
		Email    string `json:"email" binding:"required,email,max=254"`
		Password string `json:"password" binding:"required"`
	}
	if c.ShouldBindJSON(&input) != nil {
		fail(c, 400, "Проверьте имя, email и пароль.")
		return
	}
	input.Name = strings.TrimSpace(input.Name)
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	if len([]rune(input.Name)) < 2 || len([]rune(input.Name)) > 80 || len(input.Password) < 8 || len(input.Password) > 72 {
		fail(c, 400, "Имя: 2–80 символов. Пароль: 8–72 байта.")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		fail(c, 500, "Не удалось создать аккаунт.")
		return
	}
	user := User{Name: input.Name, Email: input.Email, Password: string(hash), Role: "customer"}
	if err = s.DB.Create(&user).Error; err != nil {
		var count int64
		s.DB.Model(&User{}).Where("email = ?", input.Email).Count(&count)
		if count > 0 {
			fail(c, 409, "Этот email уже зарегистрирован.")
		} else {
			fail(c, 500, "Не удалось создать аккаунт.")
		}
		return
	}
	s.signIn(c, user, 201)
}
func (s *Server) login(c *gin.Context) {
	var input struct {
		Email    string `json:"email" binding:"required,email,max=254"`
		Password string `json:"password" binding:"required,max=72"`
	}
	if c.ShouldBindJSON(&input) != nil {
		fail(c, 400, "Введите email и пароль.")
		return
	}
	var user User
	err := s.DB.Where("email = ?", strings.ToLower(strings.TrimSpace(input.Email))).First(&user).Error
	if err != nil {
		bcrypt.CompareHashAndPassword(dummyHash, []byte(input.Password))
		fail(c, 401, "Неверный email или пароль.")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)) != nil {
		fail(c, 401, "Неверный email или пароль.")
		return
	}
	s.signIn(c, user, 200)
}

var dummyHash = []byte("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy")

func (s *Server) signIn(c *gin.Context, user User, status int) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		fail(c, 500, "Не удалось создать сессию.")
		return
	}
	session := Session{ID: hex.EncodeToString(bytes), UserID: user.ID, ExpiresAt: time.Now().Add(7 * 24 * time.Hour)}
	if err := s.DB.Create(&session).Error; err != nil {
		fail(c, 500, "Не удалось сохранить сессию.")
		return
	}
	claims := jwt.RegisteredClaims{Subject: strconv.Itoa(int(user.ID)), ID: session.ID, Issuer: "alaauto", ExpiresAt: jwt.NewNumericDate(session.ExpiresAt), IssuedAt: jwt.NewNumericDate(time.Now())}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.Config.Secret)
	if err != nil {
		s.DB.Delete(&session)
		fail(c, 500, "Не удалось создать сессию.")
		return
	}
	s.cookie(c, token, 7*24*60*60)
	c.JSON(status, user)
}
func (s *Server) cookie(c *gin.Context, value string, age int) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("alaauto_session", value, age, "/", "", s.Config.SecureCookie, true)
}
func (s *Server) requireAuth(c *gin.Context) {
	raw, err := c.Cookie("alaauto_session")
	if err != nil {
		fail(c, 401, "Войдите в аккаунт.")
		return
	}
	claims := &jwt.RegisteredClaims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(token *jwt.Token) (any, error) { return s.Config.Secret, nil }, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired(), jwt.WithIssuer("alaauto"))
	if err != nil || !token.Valid {
		fail(c, 401, "Сессия истекла. Войдите снова.")
		return
	}
	var session Session
	if s.DB.Where("id = ? AND expires_at > ?", claims.ID, time.Now()).First(&session).Error != nil || strconv.Itoa(int(session.UserID)) != claims.Subject {
		fail(c, 401, "Войдите в аккаунт.")
		return
	}
	var user User
	if s.DB.First(&user, session.UserID).Error != nil {
		fail(c, 401, "Аккаунт не найден.")
		return
	}
	c.Set("user", user)
	c.Set("sessionID", session.ID)
	c.Next()
}
func current(c *gin.Context) User { return c.MustGet("user").(User) }
func adminOnly(c *gin.Context) {
	if current(c).Role != "admin" {
		fail(c, 403, "Раздел доступен только администратору.")
		return
	}
	c.Next()
}
func (s *Server) logout(c *gin.Context) {
	if err := s.DB.Delete(&Session{}, "id = ?", c.GetString("sessionID")).Error; err != nil {
		fail(c, 500, "Не удалось завершить сессию.")
		return
	}
	s.cookie(c, "", -1)
	c.Status(204)
}
