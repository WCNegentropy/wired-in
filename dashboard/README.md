# wired-in-dashboard

![TypeScript](https://img.shields.io/badge/TypeScript-blue) ![react](https://img.shields.io/badge/react-green) ![vite](https://img.shields.io/badge/vite-purple) ![zustand](https://img.shields.io/badge/zustand-orange)

Cyberpunk-themed, tile-based content aggregation dashboard for the Wired-In platform. Users organize feeds into **Workspaces** containing configurable, draggable/resizable **Tiles**, each bound to a specific platform (Reddit, YouTube, X, RSS, News).

## Tech Stack

- **Language:** TypeScript
- **Framework:** React 18
- **Build Tool:** Vite
- **State Management:** Zustand
- **Layout:** react-grid-layout (drag-and-drop, resizable tiles)
- **Icons:** lucide-react
- **Database:** None (connects to Gateway API)

## Features

- Dark cyberpunk-themed UI
- Workspace management (create, switch, delete)
- Tile-based content display with drag-and-drop grid layout
- Platform-specific tile configuration (Reddit subreddit, YouTube channel, RSS URL, etc.)
- Global search with platform filter chips
- SSE-based live content updates via the gateway

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run typecheck
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_GATEWAY_URL` | `http://localhost:8080` | Gateway API URL |

## Project Structure

```
dashboard/
├── index.html                     # HTML entry point
├── vite.config.ts                 # Vite configuration
├── src/
│   ├── main.tsx                   # React entry point
│   ├── App.tsx                    # Root component
│   ├── App.test.tsx               # App tests
│   ├── index.css                  # Global styles (dark cyberpunk theme)
│   ├── types/
│   │   └── index.ts               # TypeScript interfaces (Workspace, Tile, Platform, ContentItem)
│   ├── store/
│   │   └── index.ts               # Zustand store (workspaces, tiles, content cache, UI state)
│   ├── lib/
│   │   ├── api.ts                 # Gateway API client (feeds, search, SSE)
│   │   └── mockData.ts            # Sample content for demo/development
│   └── components/
│       ├── Header.tsx             # Branding, workspace name, search, "Add Tile"
│       ├── Sidebar.tsx            # Workspace list, create/delete/switch
│       ├── SearchBar.tsx          # Global search with platform filter chips
│       ├── TileGrid.tsx           # Responsive drag-and-drop tile layout
│       ├── TileCard.tsx           # Individual tile with content items
│       └── AddTileModal.tsx       # Multi-step tile creation modal
├── package.json
├── tsconfig.json
├── Dockerfile
├── nginx.conf
└── README.md
```

## Docker

```bash
docker compose up
```

## License

MIT
