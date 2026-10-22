package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"alaauto/internal/app"
	"github.com/joho/godotenv"
)

func main() {
	promote := flag.String("promote", "", "promote an existing account by email to admin")
	flag.Parse()
	godotenv.Load()
	cfg, err := app.LoadConfig()
	if err != nil {
		log.Fatal(err)
	}
	db, err := app.OpenDB(cfg)
	if err != nil {
		log.Fatal("Database connection failed: ", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal(err)
	}
	defer sqlDB.Close()
	if *promote != "" {
		if err = app.Promote(db, *promote); err != nil {
			log.Fatal(err)
		}
		log.Println("Administrator role assigned. Refresh your account page.")
		return
	}
	if err = app.Seed(db); err != nil {
		log.Fatal("Seed failed: ", err)
	}
	server := &http.Server{Addr: cfg.Address, Handler: app.New(db, cfg), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second}
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)
	go func() {
		log.Printf("AlaAuto API: http://%s", cfg.Address)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()
	<-done
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	server.Shutdown(ctx)
}
