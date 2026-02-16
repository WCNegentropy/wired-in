# wired-in-cli

![TypeScript](https://img.shields.io/badge/TypeScript-blue) ![commander](https://img.shields.io/badge/commander-green)

Local management CLI tool for the Wired-In platform. Manages configuration, workspaces, and platform API keys. Stores all data as JSON at `~/.wiredin/config.json`.

## Tech Stack

- **Language:** TypeScript
- **Framework:** Commander.js
- **Storage:** JSON file (`~/.wiredin/config.json`)
- **Build:** tsup
- **Testing:** vitest

## Commands

```
wiredin config show|set|reset|path    Manage CLI configuration (gateway URL, theme)
wiredin workspace list|create|switch|delete   Manage workspaces (alias: ws)
wiredin platform list|set-key|remove-key|test Manage API keys for platforms
wiredin status                        Show overall system status
wiredin start [--dev]                 Show docker compose startup instructions
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Build
npm run build

# Run (after build)
./bin/wiredin --help

# Run tests
npm test

# Development mode
npm run dev
```

## Project Structure

```
cli/
├── src/
│   ├── index.ts                   # CLI entry point (Commander program setup)
│   ├── lib/
│   │   └── config-store.ts        # JSON config file read/write (~/.wiredin/config.json)
│   ├── commands/
│   │   ├── config.ts              # config show/set/reset/path
│   │   ├── workspace.ts           # workspace list/create/switch/delete
│   │   ├── platform.ts            # platform list/set-key/remove-key/test
│   │   ├── status.ts              # system status
│   │   └── start.ts               # startup instructions
│   └── __tests__/
│       └── config.test.ts         # Config store unit tests
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

## Configuration

The CLI stores configuration at `~/.wiredin/config.json`. Default values:

| Key | Default | Description |
|-----|---------|-------------|
| `gatewayUrl` | `http://localhost:8080` | Gateway API URL |
| `theme` | `dark` | UI theme |
| `workspaces` | `[]` | Local workspace definitions |
| `apiKeys` | `{}` | Platform API keys |
| `activeWorkspace` | `null` | Currently active workspace name |

## Notes

The CLI is a local-only tool that does not participate in the gateway's JWT authentication flow. It communicates directly with the gateway API using the configured `gatewayUrl` and manages platform API keys locally in `~/.wiredin/config.json`. For authenticated operations (workspaces, tiles, etc.), use the dashboard.

## License

MIT
