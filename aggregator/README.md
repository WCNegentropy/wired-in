# wired-in-aggregator

![TypeScript](https://img.shields.io/badge/TypeScript-blue) ![nestjs](https://img.shields.io/badge/nestjs-green) ![postgres](https://img.shields.io/badge/postgres-orange)

A backend api built with TypeScript and nestjs.

## Tech Stack

- **Language:** TypeScript
- **Framework:** nestjs
- **Database:** postgres
- **Runtime:** node

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```

## Project Structure

```
wired-in-aggregator/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
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
