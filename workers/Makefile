PYTHON := python3
VENV := .venv

.PHONY: setup dev test lint clean

setup:
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install -r requirements.txt -r requirements-dev.txt

dev:
	FLASK_DEBUG=1 $(VENV)/bin/flask run --host=0.0.0.0 --port=8000

test:
	$(VENV)/bin/pytest

lint:
	$(VENV)/bin/ruff check .
	$(VENV)/bin/mypy .

clean:
	rm -rf $(VENV) __pycache__ .pytest_cache .mypy_cache
