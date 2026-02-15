# wired-in-cli

![TypeScript](https://img.shields.io/badge/TypeScript-blue) ![commander](https://img.shields.io/badge/commander-green) ![sqlite](https://img.shields.io/badge/sqlite-orange)

A cli tool built with TypeScript and commander.

## Tech Stack

- **Language:** TypeScript
- **Framework:** commander
- **Database:** sqlite
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
wired-in-cli/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Database

This project uses sqlite. Make sure you have it running locally or update the connection string in your environment variables.

### Docker

You can run this project using Docker:

```bash
docker-compose up
```

## License

MIT
