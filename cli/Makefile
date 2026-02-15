NPM := npm

.PHONY: build dev test lint clean install-global

build:
	$(NPM) run build

dev:
	$(NPM) run dev

test:
	$(NPM) test

lint:
	$(NPM) run lint

clean:
	rm -rf dist node_modules

install-global: build
	npm link
