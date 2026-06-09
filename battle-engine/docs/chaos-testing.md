# Chaos Testing Plan

## 1) Redis Failure

### Injection
- Stop Redis while API + workers are running.

### Expected Behavior
- If `REQUIRE_REDIS=true`: health endpoint should become unhealthy and API should fail fast.
- If Redis is optional: service should degrade to local fallback behavior where possible.
- Socket fanout and queues may degrade; API process should remain alive.

### Recovery
- Restart Redis.
- Verify `/health` returns healthy Redis state.
- Verify queue and socket traffic resumes.

## 2) Mongo Failure

### Injection
- Stop MongoDB while active requests are in flight.

### Expected Behavior
- API returns controlled 5xx errors for DB operations.
- Process remains running and monitoring captures failures.

### Recovery
- Restart MongoDB.
- Verify create/join/match fetch/history/analytics APIs recover.

## 3) Worker Restart

### Injection
- Restart worker process with in-flight BullMQ jobs.

### Expected Behavior
- In-flight jobs are retried based on queue retry policy.
- No backend crash.
- Worker failures are captured in monitoring logs.

### Recovery
- Ensure workers reconnect.
- Confirm queue depth drains and no stuck delayed jobs.

## 4) Piston Timeout

### Injection
- Artificially increase latency or block outbound Piston request.

### Expected Behavior
- Submission should return runtime error/timeout verdict.
- Match service should continue processing other requests.

### Recovery
- Restore network to Piston.
- Verify new submissions process normally.

## 5) Gemini Timeout

### Injection
- Block Gemini API or set tiny `GEMINI_REQUEST_TIMEOUT_MS`.

### Expected Behavior
- AI review falls back to automated fallback review text.
- Match remains playable; no crash.

### Recovery
- Restore Gemini connectivity.
- Verify analysis endpoint resumes normal responses.
