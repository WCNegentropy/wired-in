# wired-in-dashboard

![TypeScript](https://img.shields.io/badge/TypeScript-blue) ![react](https://img.shields.io/badge/react-green) ![vite](https://img.shields.io/badge/vite-purple) ![zustand](https://img.shields.io/badge/zustand-orange)

Cyberpunk-themed, tile-based content aggregation dashboard for the Wired-In platform. Users authenticate via email/password or OAuth, then organize feeds into **Workspaces** containing configurable, draggable/resizable **Tiles**, each bound to a specific platform (Reddit, YouTube, X, RSS, News). Includes bookmarks, saved searches, content analytics, feed filtering, import/export, workspace sharing, and API key management.

## Tech Stack

- **Language:** TypeScript 5.3
- **Framework:** React 18.2
- **Build Tool:** Vite 5.1
- **State Management:** Zustand 4.5
- **Layout:** react-grid-layout 1.4 (drag-and-drop, resizable tiles)
- **Icons:** lucide-react
- **Testing:** Vitest 1.2
- **API:** REST client with JWT auth, auto-refresh, retry with exponential backoff

## Features

- **Authentication** — Email/password login & registration with JWT tokens
- **OAuth Social Login** — GitHub and Google sign-in with state validation
- **JWT Session Management** — Auto-refresh before expiry, session expired warning, force logout on failure
- **Workspace Management** — Create, switch, and delete workspaces
- **Tile-Based Layout** — Drag-and-drop grid with responsive breakpoints (xs/sm/md/lg)
- **Platform-Specific Tiles** — Reddit (subreddit/sort), YouTube (search/channel), X (query/user), RSS (URL), News (query/category/country)
- **SSE Live Updates** — Real-time content streaming via EventSource
- **Content Bookmarks** — Save items across platforms with notes, search, platform grouping, JSON export
- **Saved Searches** — Persist search queries with optional notification toggle
- **Content Analytics** — Click tracking with platform breakdown, top content ranking, daily activity chart, period filters (7/30/all days), CSV export
- **Feed Filters** — Per-tile keyword include/exclude, regex patterns, NSFW handling (hide/blur/show), min score/comments, max content age
- **Workspace Sharing** — Generate time-expiring share links with view/edit permissions, copy-to-clipboard
- **Shared View** — Read-only workspace view for shared links (`/shared/{token}`)
- **Import/Export** — Export single/all workspaces as JSON, import from JSON backup, OPML import for RSS feeds with preview
- **API Key Management** — Configure platform keys (YouTube, X, News) with enable/disable toggle
- **User Preferences** — Dark/light theme toggle, compact mode, refresh interval, notifications
- **Toast Notifications** — Success/error/info feedback with auto-dismiss (5s)
- **Connection Status** — Live/Connecting/Offline indicator in header
- **Mobile Responsive** — Collapsible sidebar, overflow menu, responsive grid breakpoints
- **Global Search** — Cross-feed search with platform filter chips

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
├── index.html                        # HTML entry point
├── vite.config.ts                    # Vite configuration
├── public/
│   └── sw.js                         # Service worker for offline support
├── src/
│   ├── main.tsx                      # React entry point
│   ├── App.tsx                       # Root component (routing: /, /oauth/*, /shared/*)
│   ├── App.test.tsx                  # App tests
│   ├── index.css                     # Global styles (dark cyberpunk theme)
│   ├── types/
│   │   └── index.ts                  # TypeScript interfaces (Workspace, Tile, ContentItem, etc.)
│   ├── store/
│   │   └── index.ts                  # Zustand store (~60 actions: auth, CRUD, bookmarks, analytics, etc.)
│   ├── hooks/
│   │   └── useSSE.ts                 # SSE connection hook (EventSource, content distribution)
│   ├── lib/
│   │   ├── api.ts                    # Gateway API client (auth, CRUD, bookmarks, analytics, sharing, import/export)
│   │   └── mockData.ts              # Sample content for demo/development
│   └── components/
│       ├── AuthScreen.tsx            # Login/register form with OAuth buttons
│       ├── OAuthCallback.tsx         # OAuth completion handler (/oauth/*)
│       ├── Header.tsx                # Branding, search, status, theme, preferences, action buttons
│       ├── Sidebar.tsx               # Workspace list, create/delete/switch, share button
│       ├── SearchBar.tsx             # Global search with platform filter chips
│       ├── TileGrid.tsx              # Responsive drag-and-drop tile layout
│       ├── TileCard.tsx              # Individual tile with content feed, filtering, bookmarking, click tracking
│       ├── AddTileModal.tsx          # Multi-step tile creation (platform select → config form)
│       ├── FilterEditor.tsx          # Per-tile filter settings (keywords, regex, NSFW, scores, age)
│       ├── BookmarksPanel.tsx        # Saved content panel (search, group by platform, export)
│       ├── SavedSearchesModal.tsx    # Saved search management with notification toggle
│       ├── AnalyticsPanel.tsx        # Click analytics with charts, period filter, CSV export
│       ├── ShareModal.tsx            # Share link management (create, copy, revoke, expiration)
│       ├── SharedView.tsx            # Read-only shared workspace view
│       ├── ImportExportModal.tsx     # JSON/OPML import & export with preview
│       ├── ApiKeySettings.tsx        # API key CRUD with enable/disable toggle
│       └── Toast.tsx                 # Toast notification component (auto-dismiss)
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
