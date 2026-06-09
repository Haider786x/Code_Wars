# CodeBattle Engine

The backend for CodeBattle. It exposes match APIs with Express, broadcasts live match events with Socket.IO, stores state in MongoDB, runs submissions through Piston, and optionally sends code to Gemini for post-match analysis. For scaled deployments, Redis powers Socket.IO fanout and BullMQ background jobs.

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/server.js` | Express routes, Socket.IO server, match orchestration, code execution, and AI review |
| `src/db.js` | MongoDB connection helper |
| `src/models/Match.js` | Match state schema |
| `src/models/MatchHistory.js` | Persistent match history schema |
| `src/models/Analytics.js` | Persistent analytics counters schema |
| `src/models/Question.js` | Coding problem schema |
| `src/utils/lang.js` | Frontend language to Piston runtime mapping |
| `load-tests/` | k6 load-testing scenarios |
| `docs/metrics-dashboard.md` | Metrics dashboard setup guide |
| `docs/chaos-testing.md` | Failure/chaos testing plans |

## Setup

```bash
npm install
```

Create `battle-engine/.env`:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/codebattle
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:2000
GEMINI_API_KEY=your_gemini_key_here
```

`REDIS_URL` is optional for local development. If it is missing, the backend uses local in-process timers and local Socket.IO only. For production scale, set `REDIS_URL`.

`GEMINI_API_KEY` is optional. If it is missing, the backend returns a lightweight fallback review.

## Redis Scaling

Redis is used for:

| Concern | Implementation |
| --- | --- |
| Multi-instance WebSocket fanout | `@socket.io/redis-adapter` |
| Code runner jobs | BullMQ queue `code` with Redis key prefix `codebattle` |
| AI review jobs | BullMQ queue `analysis` with Redis key prefix `codebattle` |
| Match expiry timers | BullMQ delayed queue `timers` with Redis key prefix `codebattle` |

Recommended production env:

```env
NODE_ENV=production
PORT=3000
MONGO_URI=mongodb+srv://...
REDIS_URL=redis://default:password@your-redis-host:6379
CORS_ORIGIN=https://your-frontend.example.com
REQUIRE_REDIS=true
RUN_WORKERS=true
BULLMQ_PREFIX=codebattle
JSON_BODY_LIMIT=256kb
MAX_CODE_BYTES=65536
MAX_AI_CODE_BYTES=32768
CODE_WORKER_CONCURRENCY=4
CODE_WORKER_RATE_LIMIT_MAX=20
CODE_WORKER_RATE_LIMIT_DURATION_MS=1000
AI_WORKER_CONCURRENCY=2
AI_WORKER_RATE_LIMIT_MAX=5
AI_WORKER_RATE_LIMIT_DURATION_MS=60000
TIMER_WORKER_CONCURRENCY=8
MATCH_READ_RATE_LIMIT_MAX=240
MATCH_WRITE_RATE_LIMIT_MAX=120
CODE_REQUEST_RATE_LIMIT_MAX=30
AI_REQUEST_RATE_LIMIT_MAX=8
PISTON_REQUEST_TIMEOUT_MS=15000
GEMINI_REQUEST_TIMEOUT_MS=20000
```

`REQUIRE_REDIS=true` makes deployment fail fast if Redis is unavailable instead of falling back to local-only behavior.
If Redis is optional and unavailable, `/health` reports `redis.mode` as `local-fallback`.

For separate API and worker processes:

```env
# API instances
RUN_WORKERS=false

# Worker instances
RUN_WORKERS=true
```

All API instances must share the same `REDIS_URL` and `MONGO_URI`.

## Production Hardening

The server now enforces production safety checks when `NODE_ENV=production`.
Production boot fails unless `MONGO_URI`, `REDIS_URL`, `REQUIRE_REDIS=true`, and explicit `CORS_ORIGIN` are configured. Set `ALLOW_INSECURE_PRODUCTION=true` only for temporary diagnostics.

Security and reliability defaults include request IDs, API security headers, JSON body limits, Redis-backed rate limits, bounded code payload size, Piston/Gemini request timeouts, graceful shutdown, and recovery of active match timers after worker restart.

Run the production readiness check before deployment:

```bash
npm run check:prod
```

## Scripts

```bash
npm run dev
npm run build
npm start
```

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/match/create` | Create a room and select a random problem |
| `POST` | `/match/join` | Join a waiting room |
| `POST` | `/match/run` | Run a subset of test cases |
| `POST` | `/match/submit` | Submit final code for judging |
| `POST` | `/match/analyze` | Start AI review |
| `GET` | `/match/:matchId` | Fetch match state |
| `GET` | `/history/` | Fetch match history scoped to current identity |
| `GET` | `/admin/analytics` | Fetch analytics snapshot (supports `x-admin-key`) |
| `GET` | `/metrics` | Prometheus-style observability metrics |
| `GET` | `/health` | Health check |

## Real-Time Events

Clients connect with Socket.IO and emit `match:join` with a match ID. The server broadcasts `match:update` events such as `PLAYER_JOINED`, `START_RACE`, `CODE_FEEDBACK`, `GAME_OVER`, `AI_STATUS`, and `AI_ANALYSIS`.

## Operations Docs

- Metrics dashboard guide: `docs/metrics-dashboard.md`
- Load testing scenarios: `load-tests/README.md`
- Chaos/failure testing plan: `docs/chaos-testing.md`
