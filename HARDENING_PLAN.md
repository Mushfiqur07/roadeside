## Hardening Plan (Server and Database)

### Objectives
- Improve resilience under intermittent networks, high latency, and partial failures
- Prevent data loss and ensure consistency for requests, chats, and locations
- Reduce operational toil with better observability and safe defaults

### Server (Node/Socket) Hardening
1) Authentication and socket lifecycle
- Enforce token exp/refresh handling in socket auth; reject near-expiry tokens and surface a re-auth flow
- Rate-limit connection attempts per IP/user to mitigate reconnect storms
- Implement backpressure on event ingestion (queue with size limits) and drop non-critical events when saturated

2) Event schema normalization and versioning
- Adopt normalized events only: `mechanic:location_update`, `mechanic:location_stop`, `request:eta_update`, etc.
- Keep a compatibility layer with a sunset date; log WARN on legacy usage
- Validate payloads server-side with a schema (e.g., zod/yup) and emit error acks for bad inputs

3) Location pipeline robustness
- Throttle incoming mechanic location updates per socket/user (e.g., min 1 update per 2s) and discard bursts
- Persist last-known mechanic location with an indexed TTL field for cleanup of stale entries
- On `mechanic:location_stop`, mark a ‘stoppedAt’ timestamp and broadcast a stop event consistently

4) Request lifecycle safety
- Enforce authorization checks for every status transition (mechanic must be assigned, requester can only cancel, etc.)
- Use idempotent handlers: ignore duplicate status updates with same `(requestId, status, actor, timestampBucket)`
- Emit both generic `request_status_changed` and specific typed events; ensure room membership checks before emit

5) Chat subsystem
- Require room membership validation on `join_chat` and `send_message` (already present) and add per-room message rate limits
- Store messages with write concern; if DB write fails, do not emit delivery, return ack failure
- Add audit/log hooks for moderation events (delete/close chat)

6) Error handling and observability
- Structured logging (pino/winston) with request IDs and socket IDs
- Central error boundary; never emit raw exceptions. Map to typed error codes
- Metrics: counters for socket connects, emits by event, errors by type; histograms for handler latency
- Tracing: wrap critical handlers (status update, payment) with traces (OpenTelemetry)

7) Configuration and timeouts
- Distinguish API URL vs Socket URL via env; validate at startup
- Set sane timeouts for external calls; use abort controllers and retries with jitter
- Feature flags for legacy events and chat deletion-on-complete behavior

8) Security
- Validate all IDs (ObjectId format), sanitize user inputs
- Limit payload size on socket and HTTP (e.g., 100KB) to prevent abuse
- CORS: restrict origins to known hosts; use HTTPS in production

### Database Hardening (MongoDB)
1) Schema and indexing
- Requests: index `userId`, `mechanicId`, `status`, `updatedAt`; compound index `(mechanicId, status)` for dashboards
- Mechanics: geospatial index on `currentLocation.coordinates` (2dsphere);
- Chats: index `serviceRequestId`, `participants.userId`, `updatedAt`; TTL or archiving policy for closed chats
- Payments (if/when added): unique index on `(requestId, transactionRef)` for idempotency

2) Data integrity and idempotency
- Use transactions for multi-document updates (e.g., accept → create chat → emit) to avoid partial state
- Store event ledger for critical transitions with dedupe keys `(requestId, eventType, actorId, timeBucket)`
- Validate coordinates server-side: reject zeros or out-of-range values

3) Backups and retention
- Automated daily backups with PITR (if using Atlas); verify restore quarterly
- Archival strategy: move completed requests > N days to a cold collection with reduced indexes

4) Performance and capacity
- Enable connection pooling with sane limits; monitor with serverStatus
- Use read preferences and projections to limit payload sizes (avoid full doc loads in socket handlers)
- Paginate all list endpoints; cap page size

5) Monitoring and alerts
- Dashboards: ops (connections, locks), app (request transitions/min), chat throughput, location updates rate
- Alerts: replication lag, slow queries, rising error rate, memory/CPU thresholds

### Operational Playbooks
- Incident: socket storm — reduce broadcast frequency via feature flag; enable stricter rate limits; scale out socket workers
- Incident: DB slow queries — enable profiler temporarily, inspect indexes, add missing index, roll out with zero-downtime migration
- Incident: location spikes — raise throttling, drop legacy events, reduce geocoding frequency client-side via config

### Rollout Plan
- Phase 1: Add schema validators and normalized event emissions alongside legacy; add metrics and logs
- Phase 2: Deploy throttling and idempotency; add indexes; enable backups and alerts
- Phase 3: Remove legacy events; enforce stricter payload limits; enable archiving and cleanup jobs

