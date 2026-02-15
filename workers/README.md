# wired-in-workers

![Python](https://img.shields.io/badge/Python-blue) ![flask](https://img.shields.io/badge/flask-green) ![postgres](https://img.shields.io/badge/postgres-orange)

A backend api built with Python and flask.

## Tech Stack

- **Language:** Python
- **Framework:** flask
- **Database:** postgres
- **Runtime:** native

## Getting Started

### Prerequisites

- Python 3.12+
- pip

### Installation

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the application
python main.py

# Run tests
pytest
```

## Project Structure

```
wired-in-workers/
├── main.py
├── requirements.txt
├── tests/
└── README.md
```

## Development

### Database

This project uses postgres. Make sure you have it running locally or update the connection string in your environment variables.

### Docker

You can run this project using Docker:

```bash
docker-compose up
```

## License

MIT
