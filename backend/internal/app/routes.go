package app

import (
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func New(db *gorm.DB, cfg Config) *gin.Engine {
	s := &Server{DB: db, Config: cfg, attempts: map[string]attempt{}}
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.SetTrustedProxies(nil)
	r.Use(func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.Header("Cache-Control", "no-store")
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 64*1024)
		if !oneOf(c.Request.Method, "GET", "HEAD", "OPTIONS") {
			if origin := c.GetHeader("Origin"); origin != "" {
				parsed, err := url.Parse(origin)
				if err != nil || parsed.Host != c.Request.Host && origin != "http://127.0.0.1:5173" && origin != "http://localhost:5173" {
					fail(c, 403, "Источник запроса не разрешён.")
					return
				}
			}
			if !strings.HasPrefix(c.GetHeader("Content-Type"), "application/json") {
				fail(c, 415, "Ожидается application/json.")
				return
			}
		}
		c.Next()
	})
	api := r.Group("/api")
	api.GET("/health", func(c *gin.Context) {
		sql, err := db.DB()
		if err != nil || sql.PingContext(c.Request.Context()) != nil {
			fail(c, 503, "База данных недоступна.")
			return
		}
		c.JSON(200, gin.H{"status": "ok"})
	})
	auth := api.Group("/auth", s.authThrottle)
	auth.POST("/register", s.register)
	auth.POST("/login", s.login)
	api.GET("/cars", s.listCars)
	api.GET("/cars/:id", s.getCar)
	api.GET("/cars/:id/availability", s.availability)
	protected := api.Group("", s.requireAuth)
	protected.GET("/me", func(c *gin.Context) { c.JSON(200, current(c)) })
	protected.POST("/auth/logout", s.logout)
	protected.GET("/favorites", s.favorites)
	protected.PUT("/favorites/:id", s.addFavorite)
	protected.DELETE("/favorites/:id", s.removeFavorite)
	protected.GET("/bookings", s.listBookings)
	protected.POST("/bookings", s.createBooking)
	protected.DELETE("/bookings/:id", s.cancelBooking)
	admin := protected.Group("/admin", adminOnly)
	admin.GET("/cars", s.adminCars)
	admin.POST("/cars", s.saveCar)
	admin.PUT("/cars/:id", s.saveCar)
	admin.DELETE("/cars/:id", s.archiveCar)
	admin.GET("/bookings", s.adminBookings)
	admin.PATCH("/bookings/:id/status", s.setBookingStatus)
	admin.GET("/users", func(c *gin.Context) {
		users := []User{}
		if db.Order("id DESC").Find(&users).Error != nil {
			fail(c, 500, "Не удалось загрузить пользователей.")
			return
		}
		c.JSON(200, users)
	})
	// A production build can be served by Go on the same origin as the API.
	if _, err := os.Stat("../dist/index.html"); err == nil {
		r.Static("/assets", "../dist/assets")
		r.NoRoute(func(c *gin.Context) {
			if strings.HasPrefix(c.Request.URL.Path, "/api") || c.Request.Method != "GET" {
				fail(c, 404, "Страница не найдена.")
				return
			}
			if filepath.Ext(c.Request.URL.Path) != "" {
				c.Status(404)
				return
			}
			c.File("../dist/index.html")
		})
	} else {
		r.NoRoute(func(c *gin.Context) {
			fail(c, 404, "Маршрут не найден. Для интерфейса запустите npm run dev.")
		})
	}
	return r
}
