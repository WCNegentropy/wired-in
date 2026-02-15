CARGO := cargo

.PHONY: build run dev test lint fmt clean docker-build docker-up docker-down

build:
	$(CARGO) build --release

run:
	$(CARGO) run

dev:
	RUST_LOG=debug $(CARGO) watch -x run

test:
	$(CARGO) test

check:
	$(CARGO) check

lint:
	$(CARGO) clippy -- -D warnings

fmt:
	$(CARGO) fmt

clean:
	$(CARGO) clean

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down
