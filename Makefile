.PHONY: start-dev build run tidy

start-dev:
	air

run:
	go run main.go

build:
	go build -o bin/app .

tidy:
	go mod tidy
