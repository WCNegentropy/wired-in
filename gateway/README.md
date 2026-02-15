# wired-in-gateway

![Rust](https://img.shields.io/badge/Rust-blue) ![actix](https://img.shields.io/badge/actix-green) ![postgres](https://img.shields.io/badge/postgres-orange)

A backend api built with Rust and actix.

## Tech Stack

- **Language:** Rust
- **Framework:** actix
- **Database:** postgres
- **Runtime:** native

## Getting Started

### Prerequisites

- Rust 1.75+
- Cargo

### Installation

```bash
# Build
cargo build

# Run the application
cargo run

# Run tests
cargo test

# Build for release
cargo build --release
```

## Project Structure

```
wired-in-gateway/
├── src/
│   └── main.rs
├── Cargo.toml
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
