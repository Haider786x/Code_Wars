# CodeBattle Frontier

The React + Vite frontend for CodeBattle. It provides the landing page, create/join match modal, live battle arena, Monaco code editor, real-time match updates, and AI review display.

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/main.jsx` | Browser entry point |
| `src/App.jsx` | Lightweight SPA router |
| `app/page.jsx` | Home screen and match modal launcher |
| `app/battle/live/[id]/page.jsx` | Live battle arena |
| `components/MatchModel.jsx` | Create and join match modal |
| `hooks/useMatchStream.js` | Socket.IO match event hook |
| `lib/services/apiRequests.js` | Axios API wrapper |

## Setup

```bash
npm install
```

Create `battle-frontier/.env`:

```env
VITE_API_GATEWAY_URL=http://localhost:3000
VITE_WS_GATEWAY_URL=http://localhost:3000
```

## Run

```bash
npm run dev
```

The app runs on `http://localhost:2000`.

## Backend Contract

HTTP actions:

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/match/create` | Creates a new match |
| `POST` | `/match/join` | Joins an existing match |
| `POST` | `/match/run` | Runs code against sample test cases |
| `POST` | `/match/submit` | Submits the final solution |
| `POST` | `/match/analyze` | Starts AI review |
| `GET` | `/match/:matchId` | Fetches match state |

Real-time updates use Socket.IO. The frontend emits `match:join` and listens for `match:update`.
