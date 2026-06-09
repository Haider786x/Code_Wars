# Metrics Dashboard Guide

Expose metrics from:

- `GET /metrics` (Prometheus text format)

## Key Metrics

- `codebattle_active_matches`
- `codebattle_active_sockets`
- `codebattle_queue_size{queue="code|analysis|timers"}`
- `codebattle_queue_processing_latency_ms_avg`
- `codebattle_submission_count`
- `codebattle_match_creation_count`
- `codebattle_match_completion_count`
- `codebattle_redis_latency_ms`
- `codebattle_mongo_query_latency_ms_avg`

## Suggested Dashboard Panels

1. **Match Activity**
   - Active matches
   - Match creations vs completions
2. **Real-time Load**
   - Active sockets
3. **Queue Health**
   - Queue size per queue
   - Queue processing latency
4. **Data/Cache Health**
   - Redis latency
   - Mongo query latency
5. **Submission Throughput**
   - Submission count (rate)

## Alerts (recommended)

- queue size sustained growth > threshold
- queue processing latency spike
- Redis latency spike
- Mongo query latency spike
- active matches collapsing unexpectedly during peak hours
