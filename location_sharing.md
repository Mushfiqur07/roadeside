## Location Sharing Plan

### Current flow observed
- Mechanic page `frontend/src/pages/mechanic/MechanicRequests.js`:
  - Starts sharing on accept via `startLocationSharing(requestId)`: updates REST (`PUT /mechanics/location`) then emits `mechanic:location_update` with `{ requestId, location: {lat,lng} }` and begins a `geolocation.watchPosition` stream emitting the same event.
  - Stops sharing via `stopLocationSharing(requestId)`: clears geolocation watch and emits `mechanicLocationStop`.
  - Listens for window events `autoStartLocationSharing` and `autoStopLocationSharing` to auto start/stop.
- Request tracking page `frontend/src/pages/RequestTracking.js`:
  - Joins `request_${id}` room.
  - Listens to `mechanic_location_update` (legacy; payload has `coordinates`) and updates the map; also uses ETA/status events.
- Socket context `frontend/src/context/SocketContext.js` (partial view):
  - Listens to `mechanic:location_update` and stores a global `mechanicLocation`.
  - Listens to `mechanicLocationStop` and clears that global location.
  - Does not currently show listeners for `auto_start_location_sharing`/`auto_stop_location_sharing` (mentioned in docs) — likely missing.
- Backend socket `backend/socket/socketHandler.js`:
  - Accepts incoming `mechanic:location_update` and `location_update` events; persists location and emits to `request_${requestId}` both `mechanic_location_update` (legacy with `coordinates`) and `mechanic:location_update` (normalized with `location: {lat,lng}`) when a valid `requestId` is provided.
  - No explicit handler for a client-emitted `mechanicLocationStop` event (server only broadcasts that name elsewhere if at all).
- REST: `PUT /mechanics/location` persists the mechanic’s current location.

### Issues and mismatches to fix
- Inconsistent stop event:
  - Frontend emits `mechanicLocationStop` to server on stop; backend has no listener for this event. Outcome: no room broadcast that location sharing stopped. Define a single normalized stop event, e.g. `mechanic:location_stop` with `{ requestId }`, and handle on server to notify room and clean up if needed. Keep a UI-only local event if desired, but don’t rely on it for room peers.
- Missing auto-start/stop listeners in SocketContext:
  - Docs reference `auto_start_location_sharing` and `auto_stop_location_sharing` socket events that should map to window events. These listeners appear missing. Add them so server-driven automation works after status changes.
- Dual location streams and formats:
  - Backend emits both `mechanic_location_update` (coordinates array) and `mechanic:location_update` (lat/lng). Frontend pages use a mix. Choose one normalized event (`mechanic:location_update`) across app and phase out legacy usage to reduce conversion logic.
- Mechanic dashboard periodic sharing:
  - `MechanicDashboard` sends periodic `mechanic:location_update` without `requestId`. This updates availability/broadcast but won’t update a specific request room. Keep for availability, but ensure request-scoped sharing comes only from `MechanicRequests` with a `requestId`.
- Persistence mismatch:
  - `localStorage.active_location_sharing_request` is written/read in `MechanicRequests` but isn’t set/cleared by socket auto events because those listeners are missing. Add them in `SocketContext` so restore works after reload.
- Privacy/rate control:
  - `watchPosition` has high-frequency updates; ensure throttling/debouncing server emits (e.g., min interval 2–5s) to avoid excessive traffic.

### When location sharing should start
- Manual start (mechanic side):
  - Immediately after the mechanic accepts a request (status transitions to `accepted`).
  - Also when a mechanic taps an explicit “Start Journey” action (status `accepted` → `on_way`) — auto-start if not already running.
- Automatic start (server-driven):
  - On backend status change to `accepted` or `on_way`, emit `auto_start_location_sharing` with `{ requestId }` to the assigned mechanic’s socket. Socket context should map this to a window `autoStartLocationSharing` event.
- Preconditions:
  - Geolocation permission granted; if denied, show a toast and do not loop endlessly. Allow retry.
  - Mechanic assigned to request; if assignment missing, do not start.

### When location sharing should stop
- Manual stop (mechanic side):
  - When mechanic marks `arrived` or `completed`.
  - When mechanic explicitly ends/cancels the job.
- Automatic stop (server-driven):
  - On backend status change to `arrived`, `working` (if you prefer to pause), `completed`, `cancelled`, or `rejected`, emit `auto_stop_location_sharing` with `{ requestId }` to the assigned mechanic’s socket. Socket context should map this to a window `autoStopLocationSharing` event.
- Cleanup actions:
  - Clear geolocation watch, clear `active_location_sharing_request` in `localStorage`, and emit a normalized stop event `mechanic:location_stop` to the room so the user UI can clear “live” indicators.

### Definitive event and data conventions
- Outgoing from mechanic client while sharing:
  - Event: `mechanic:location_update`
  - Payload: `{ requestId, location: { lat: number, lng: number }, timestamp: ISOString }`
  - Emit no more than every 2–5 seconds or on significant movement (e.g., ≥10–25 meters) to limit noise.
- Stop from mechanic client:
  - Event: `mechanic:location_stop`
  - Payload: `{ requestId }`
- Server to room subscribers (user + mechanic):
  - Primary update: `mechanic:location_update` with `{ mechanicId, location: { lat, lng }, timestamp, requestId }`
  - Stop: `mechanic:location_stop` with `{ mechanicId, requestId, timestamp }`
- Auto-control server → mechanic:
  - Start: `auto_start_location_sharing` with `{ requestId }`
  - Stop: `auto_stop_location_sharing` with `{ requestId }`

### UI/UX rules
- Show "Location sharing active" badge only when:
  - `active_location_sharing_request === request._id` AND status in `['accepted','on_way','arrived','in_progress']`.
- On stop, immediately remove the badge and fade the live marker; keep the last known position in gray if helpful, with timestamp.
- Handle permission errors gracefully with a single toast and a retry action.

### Recovery and persistence
- On page reload or app resume:
  - Read `active_location_sharing_request` and automatically resume `watchPosition` and emits if the corresponding request is still in an active status.
  - If the request is no longer active, clear the key and do not resume.

### Testing checklist
- Accept request → sharing auto-starts; user map updates within seconds.
- Start Journey → sharing continues (no duplicate watches).
- Arrived/Completed/Cancelled → sharing stops; room receives `mechanic:location_stop`; user map clears “live” state.
- Reload mechanic page during active sharing → sharing resumes automatically.
- Location permission denied → no sharing; clear banner; provide retry.
- Network loss → queue or skip emits; resume on reconnect without duplicate intervals.


