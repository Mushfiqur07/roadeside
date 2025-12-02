## Roadside Assistance Platform (MERN)

### Project Description
An Uber-style roadside emergency assistance platform built on the MERN stack. It connects stranded drivers with nearby verified mechanics, providing real-time location tracking, in-app chat, and request lifecycle management. The system is designed for fast response, transparency, and safety across three primary personas: Admin, User, and Mechanic.

### Tech Overview
- Frontend: React 18, React Router, Tailwind CSS, React-Leaflet, Socket.IO client, Axios
- Backend: Node.js, Express, MongoDB (Mongoose), Socket.IO, Multer, JWT
- Realtime: Socket rooms for users, mechanics, requests, and chats
- Storage: File uploads for chat attachments and profile images

### Key Capabilities (High-Level)
- Account management and role-based views (User, Mechanic, Admin)
- Service request creation, acceptance, journey and completion lifecycle
- Real-time chat and presence within request-bound chat rooms
- Live location updates from mechanics and proximity-based discovery
- Basic payments tracking and request histories by user/mechanic

## Suggested New Features (with Benefits)

### Admin Module
- Advanced Analytics & Heatmaps
  - Benefit: Data-driven operations; view high-demand areas and peak times to plan incentives and staffing.
- Dispute Center & Moderation Queue
  - Benefit: Faster resolution of issues between users and mechanics; improved trust and retention.
- Maintenance Mode Scheduler and Announcements
  - Benefit: Safe deploys and planned downtime communication to reduce confusion and failed requests.
- Promotion & Incentive Engine
  - Benefit: Boost supply in low-coverage areas and stimulate demand during off-peak hours.
- Role-Based Access Control (RBAC)
  - Benefit: Principle of least privilege; safer operations as the team grows.
- Audit Logs & Insights
  - Benefit: Compliance visibility and traceability of sensitive actions.

### Mechanic Module
- Shift Scheduling & Smart Availability
  - Benefit: Predictable supply and improved response times; reduce missed requests.
- Route Optimization & Turn-by-Turn Hints
  - Benefit: Faster arrivals and lower travel costs; better customer experience.
- Wallet & Earnings Breakdown
  - Benefit: Transparency in commissions, payouts, and tips drives mechanic satisfaction.
- Job Queue & Capacity Controls
  - Benefit: Handle multiple requests with prioritization; reduce overload and cancellations.
- Safety Toolkit (SOS, Panic, Trusted Contacts)
  - Benefit: Improves on-the-job safety; critical for field service adoption.
- Inventory & Services Catalog
  - Benefit: Show parts/tools availability and specific service offerings to set accurate expectations.

### User Module
- One‑Tap SOS & Smart Re-request
  - Benefit: Frictionless help during emergencies; automatic retries improve completion rates.
- Saved Places, Home/Work, and Favorites
  - Benefit: Faster request creation and better personalization.
- Real-Time ETA and Price Estimates
  - Benefit: Clarity on cost and arrival time increases conversion and trust.
- Subscriptions & Membership (e.g., priority response, discounted services)
  - Benefit: Predictable revenue and better user retention.
- Rich Reviews with Photos/Videos and Tips
  - Benefit: Higher quality feedback loop; incentives for good service.
- Insurance & OEM Integrations (optional)
  - Benefit: Value-added claims flows; potential B2B channel growth.

## Features Roadmap

### Phase 1 — Engagement & Reliability (Short Term)
- Notifications Center (email/SMS/push-ready hooks)
- Smart Availability for mechanics (quick toggles and reminders)
- Real-Time ETA display for users once a request is accepted
- Simple Wallet summaries (earnings to-date, pending payouts)

### Phase 2 — Growth & Monetization (Mid Term)
- Promotions & incentive rules for Admin
- Subscriptions/Memberships for users
- Job Queue & capacity controls for mechanics
- Route optimization hints and arrival SLAs

### Phase 3 — Operational Excellence (Long Term)
- Heatmaps & demand forecasting dashboards for Admin
- Safety toolkit (SOS, panic flows, trusted contacts)
- Audit logs, RBAC, and advanced moderation workflows
- Deeper analytics (cohort, churn, conversion)

## Future Improvements

### Platform & Performance
- Caching strategy for hot endpoints and lists
- Image optimization and CDN for uploads
- Background jobs for heavy tasks (reports, notifications)

### Developer Experience
- End-to-end testing flows (request → accept → complete → review)
- Type-safe shared DTOs between frontend and backend
- CI/CD pipeline with environment promotion and health checks

### Security & Compliance
- Rate limiting and anomaly detection for key endpoints
- Session/device management and optional multi-factor flows
- Data retention policies for chats and media attachments

### Observability
- Centralized logging and request tracing
- Metrics dashboards (uptime, request success, latencies)
- Alerting on error rates and realtime socket disconnect spikes

### Product & UX
- Internationalization (i18n) and RTL support
- Accessibility (a11y) standards for forms, maps, and chat
- Offline-first PWA behaviors for poor connectivity scenarios

## Implementation Pointers (Where to Extend)
- Admin features: `frontend/src/pages/admin/*`, `backend/routes/admin.js`
- Mechanic features: `frontend/src/pages/mechanic/*`, `backend/routes/mechanic.js`
- User features: `frontend/src/pages/*` (dashboards/history), `backend/routes/requests.js`
- Realtime additions: `backend/socket/socketHandler.js`, `frontend/src/context/SocketContext.js`
- Media & uploads: `backend/routes/upload.js`, `backend/uploads/*`, `frontend/src/components/*Upload*`

## Getting Started (Quick Run)
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (in a new terminal)
cd frontend
npm install
npm start
```

### Environment Variables
Backend `.env`
```
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=5002
NODE_ENV=development
CLIENT_URL=http://localhost:3000
CHAT_DELETE_ON_COMPLETE=false
```

Frontend `.env`
```
REACT_APP_API_URL=http://localhost:5002/api
REACT_APP_SOCKET_URL=http://localhost:5002
```

### Admin Login
To create or promote an admin user, use the backend CLI script.

1) Ensure the backend can connect to MongoDB. Set `MONGODB_URI` in `backend/.env` if needed.

2) From the `backend` directory, run one of the following:

```bash
# Create a new admin user (requires email and password)
node scripts/admin.js --email admin@example.com --password StrongP@ssw0rd --name "Super Admin" --phone 01712345678

# Promote an existing user to admin
node scripts/admin.js --promote --email existinguser@example.com
```

3) Log in via API or UI:
- API: `POST /api/auth/login` with JSON body `{ "email": "admin@example.com", "password": "StrongP@ssw0rd" }`
- UI: Use the same credentials on the login page; admin routes are protected via role `admin`.

Notes:
- Password must meet your security policies; the backend enforces minimum length.
- Phone must match the Bangladesh format required by the schema (e.g., `017XXXXXXXX`).

### API Quick Checks (avoid 404s)
The API mounts under `/api`. Base paths now respond with simple JSON to confirm wiring:

```bash
# Pings
GET http://localhost:5002/api/auth
GET http://localhost:5002/api/user
GET http://localhost:5002/api/upload
GET http://localhost:5002/api/chat
GET http://localhost:5002/api/payment/test
GET http://localhost:5002/api/requests

# Public login (no token required)
POST http://localhost:5002/api/auth/login
POST http://localhost:5002/api/auth/admin/login

# Private examples (require Authorization: Bearer <token>)
GET  http://localhost:5002/api/auth/me
GET  http://localhost:5002/api/user/profile
POST http://localhost:5002/api/requests
```

{
  "email": "admin@example.com",
  "password": "StrongP@ssw0rd"
}


## License
MIT
