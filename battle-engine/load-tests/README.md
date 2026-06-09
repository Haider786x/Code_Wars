# Load Testing Scripts

These scripts are designed for k6 and target the required scenarios:

- `100-concurrent-matches.js`
- `500-concurrent-matches.js`
- `1000-concurrent-submissions.js`
- `500-spectators.js`

## Prerequisites

- Backend running (`battle-engine`)
- MongoDB + Redis running
- k6 installed: https://k6.io/docs/get-started/installation/

## Run

```bash
cd battle-engine/load-tests
k6 run 100-concurrent-matches.js
k6 run 500-concurrent-matches.js
k6 run 1000-concurrent-submissions.js
k6 run 500-spectators.js
```

Optional environment values:

- `BASE_URL` (default `http://localhost:3000`)
- `SLEEP_SECONDS` (default `0.2`)

## Required Outputs

Each script prints `/metrics` output in the summary, including:

- average latency (k6 summary `http_req_duration`)
- queue delay (`codebattle_queue_processing_latency_ms_avg`)
- Redis utilization proxy (`codebattle_redis_latency_ms`)
- Mongo utilization proxy (`codebattle_mongo_query_latency_ms_avg`)

Record these values per run for scalability verification.
