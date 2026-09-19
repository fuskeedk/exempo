package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

func main() {
	exe, err := os.Executable()
	if err != nil {
		fail("Kunne ikke finde programmet.", err)
	}
	root := filepath.Dir(exe)
	dataDir := filepath.Join(root, "data")
	uploadsDir := filepath.Join(root, "uploads")
	_ = os.MkdirAll(dataDir, 0o755)
	_ = os.MkdirAll(uploadsDir, 0o755)

	dbPath := filepath.Join(dataDir, "exempo.db")
	if _, err := os.Stat(dbPath); err != nil {
		seed := filepath.Join(root, "seed", "exempo.db")
		if copyErr := copyFile(seed, dbPath); copyErr != nil {
			fail("Kunne ikke oprette databasen. Mangler seed/exempo.db.", copyErr)
		}
	}

	secretPath := filepath.Join(dataDir, "auth-secret.txt")
	secret := "exempo-portable-secret-change-me-please-32b"
	if raw, err := os.ReadFile(secretPath); err == nil && len(raw) >= 16 {
		secret = string(raw)
	} else {
		_ = os.WriteFile(secretPath, []byte(secret), 0o600)
	}

	port := getenv("PORT", "3000")
	_ = os.Setenv("DATABASE_URL", "file:./data/exempo.db")
	_ = os.Setenv("AUTH_SECRET", secret)
	_ = os.Setenv("PORT", port)
	_ = os.Setenv("HOSTNAME", "127.0.0.1")
	_ = os.Setenv("NODE_ENV", "production")
	_ = os.Setenv("COOKIE_SECURE", "0")

	node := filepath.Join(root, "node.exe")
	if _, err := os.Stat(node); err != nil {
		fail("node.exe mangler i mappen. Pak filerne ud igen.", err)
	}

	cmd := exec.Command(node, "server.js")
	cmd.Dir = root
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = os.Environ()
	if err := cmd.Start(); err != nil {
		fail("Kunne ikke starte Exempo.", err)
	}

	url := "http://127.0.0.1:" + port
	ready := waitFor(url, 45*time.Second)
	if ready {
		_ = exec.Command("cmd", "/C", "start", "", url).Start()
	}

	fmt.Println("Exempo kører på", url)
	fmt.Println("Log ind med pl@exempo.dk / exempo123")
	fmt.Println("Luk dette vindue for at stoppe programmet.")

	_ = cmd.Wait()
}

func waitFor(url string, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			_ = resp.Body.Close()
			return true
		}
		time.Sleep(400 * time.Millisecond)
	}
	return false
}

func copyFile(from, to string) error {
	src, err := os.Open(from)
	if err != nil {
		return err
	}
	defer src.Close()
	dst, err := os.Create(to)
	if err != nil {
		return err
	}
	defer dst.Close()
	_, err = io.Copy(dst, src)
	return err
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func fail(message string, err error) {
	fmt.Println(message)
	if err != nil {
		fmt.Println(err)
	}
	fmt.Println("Tryk Enter for at lukke...")
	_, _ = fmt.Scanln()
	os.Exit(1)
}
