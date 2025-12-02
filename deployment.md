### RoadAssist BD — Deployment Guide

This guide shows two reliable ways to deploy this app to production:
- Method A: Docker Compose (recommended; simplest + reproducible)
- Method B: Bare‑metal Node.js with PM2 and Nginx

Repo layout assumed:
```
backend/    # Express + Mongo models + REST + sockets
frontend/   # React SPA (Vite/CRA) served as static files in prod
```

---

## 1) Requirements

- Linux host (Ubuntu 22.04+ recommended). Windows Server works but commands differ.
- Domain pointing to your server IP (e.g., api.example.com, app.example.com)
- MongoDB 6+ (managed Atlas or self‑hosted)
- Node.js 18+ and npm 9+ (only for Method B)
- Docker 24+ and Docker Compose v2 (only for Method A)
- Nginx 1.20+ (for Method B; optional with Docker if you proxy outside)

Environment you’ll need (see full examples below):
- BACKEND: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `SERVER_URL`
- FRONTEND: `VITE_API_BASE_URL` (or `REACT_APP_API_BASE_URL` if CRA)

---

## 2) Environment files

Create these files before building.

backend/.env
```
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/roadassist
JWT_SECRET=replace-with-strong-secret

# CORS / App URLs
CLIENT_URL=https://app.example.com
SERVER_URL=https://api.example.com

# Optional (tune as needed)
CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
LOG_LEVEL=info
```

frontend/.env.production (Vite)
```
VITE_API_BASE_URL=https://api.example.com
```

If your frontend uses CRA, name the var `REACT_APP_API_BASE_URL` instead and reference accordingly.

---

## 3) Method A — Docker Compose (Recommended)

This runs 3 services: MongoDB, backend API, and a static file server for the built frontend.

Create `docker-compose.yml` at the repo root:
```yaml
version: "3.9"
services:
  mongo:
    image: mongo:6
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017" # remove if using managed MongoDB

  backend:
    build: ./backend
    env_file: ./backend/.env
    environment:
      # If you use the local mongo service:
      - MONGODB_URI=mongodb://mongo:27017/roadassist
    ports:
      - "3001:3001"
    depends_on:
      - mongo
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
    ports:
      - "3000:80"  # exposes the static site via nginx/alpine or similar
    restart: unless-stopped

volumes:
  mongo_data:
```

Dockerfile (backend/backend.Dockerfile example if you prefer split):
```Dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

Dockerfile (frontend/Dockerfile example):
```Dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Single‑page app routing
RUN sed -i 's|try_files \$uri \$uri/ =404;|try_files \$uri /index.html;|g' /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Build and run:
```bash
docker compose build
docker compose up -d
```

- Frontend: http://<server>:3000
- Backend:  http://<server>:3001

Put Nginx/Traefik/Caddy in front if you need TLS + domains, or attach TLS directly on the host proxy.

---

## 4) Method B — Bare‑metal (PM2 + Nginx)

Install system packages:
```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# (Optional) Install MongoDB if not using Atlas
# https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/

# PM2 (process manager)
sudo npm i -g pm2
```

Clone and build:
```bash
git clone <your-repo-url>.git roadassist && cd roadassist

# Backend
cd backend
cp .env.example .env  # if you have one, else create using the sample above
npm ci

# Frontend (build static assets)
cd ../frontend
npm ci
npm run build

# Move built assets to /var/www/roadassist
sudo mkdir -p /var/www/roadassist
sudo cp -r dist/* /var/www/roadassist/
```

Run backend with PM2:
```bash
cd ../backend
pm2 start server.js --name roadassist-api
pm2 save
pm2 startup  # follow the instructions to enable on boot
```

Nginx: reverse proxy API + serve frontend
```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name app.example.com;

    root /var/www/roadassist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}
```

Enable TLS (Let’s Encrypt):
```bash
sudo ln -s /etc/nginx/sites-available/roadassist /etc/nginx/sites-enabled/roadassist
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.example.com -d api.example.com --redirect -m you@example.com --agree-tos -n
```

Ensure backend env matches public URLs:
- `CLIENT_URL=https://app.example.com`
- `SERVER_URL=https://api.example.com`

Logs and troubleshooting:
```bash
pm2 logs roadassist-api --lines 100
journalctl -u nginx -e
tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

---

## 5) Socket.IO & CORS notes

- The backend emits realtime events on the request room channels. Ensure your proxy forwards WebSocket upgrade headers (`Upgrade`, `Connection`). The provided Nginx config does this.
- If you change domains/ports, update `CLIENT_URL` and `CORS_ALLOWED_ORIGINS` in backend `.env` and rebuild/restart.

---

## 6) Common production tasks

- Update app:
```bash
git pull
(cd backend && npm ci)
(cd frontend && npm ci && npm run build && sudo rsync -a --delete dist/ /var/www/roadassist/)
pm2 restart roadassist-api
```

- Backup Mongo (self‑hosted):
```bash
mongodump --uri "$MONGODB_URI" --out /backups/roadassist-$(date +%F)
```

---

## 7) Quick smoke test

- API health: `GET https://api.example.com/api/payment/stats` (should respond 200 after auth)
- App: open `https://app.example.com` and create a request; ensure Pay Now modal loads and payment can be submitted.

---

## 8) Security checklist

- Use strong `JWT_SECRET` and rotate periodically
- Restrict MongoDB to private network / use Atlas IP allowlist
- Enforce HTTPS everywhere; redirect HTTP to HTTPS
- Keep Node, Nginx, and OS patched
- Run as non‑root users inside Docker where possible

---

If you want, I can generate ready‑to‑use `docker-compose.yml`, production Dockerfiles, and an `ecosystem.config.js` for PM2 tailored to your exact environment.

---

## 9) Netlify, Vercel, Railway (Managed PaaS)

These platforms are great for fast production deployments. Typical pattern:
- Host the React frontend on Netlify or Vercel
- Host the Node/Express backend on Railway (or Vercel functions if you accept serverless limits)

### A) Netlify (Frontend)

1. Repo settings
   - Ensure frontend env has `VITE_API_BASE_URL=https://<your-backend-host>` in Netlify site settings → Build & deploy → Environment.
2. Create site
   - Netlify → Add new site → Import from Git.
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`
3. SPA routing
   - In `frontend/` add `_redirects` file:
     ```
     /*   /index.html   200
     ```
   - Commit and redeploy so client routing works.
4. Custom domain + SSL
   - Netlify → Domain management → Add domain → point DNS. SSL is automatic.

### B) Vercel (Frontend and/or Serverless API)

Frontend only (recommended when API runs elsewhere):
1. Import repo → Project root: `frontend`
2. Framework: Vite/React
3. Build command: `npm run build`, Output: `dist`
4. Env vars: `VITE_API_BASE_URL=https://api.example.com`

Backend on Vercel (serverless):
- This app is an Express server with sockets; serverless is not ideal for WebSockets and long‑lived connections. If you still want Vercel functions:
  - Extract API endpoints into `frontend/api` or a separate project using Vercel Functions (Edge/Node). Avoid WebSockets; use polling or SSE instead.
  - Set your frontend `VITE_API_BASE_URL` to that Vercel project URL.
- For full Express + Socket.IO, prefer Railway/Render/Fly.io/Docker VPS.

### C) Railway (Backend recommended; Frontend optional)

Deploy backend with Railway:
1. Click “New Project” → “Deploy from GitHub”. Select repo.
2. Service settings → Build
   - Root directory: `backend`
   - If Railway uses Nixpacks/Buildpacks it will detect Node and `npm start`.
   - Otherwise set:
     - Install: `npm ci`
     - Build: (empty)
     - Start: `node server.js`
3. Variables → add backend `.env` values:
   - `NODE_ENV=production`
   - `PORT=3001` (Railway will also provide `PORT`, prefer their injected port: set Start to `node server.js` and read `process.env.PORT`)
   - `MONGODB_URI` (use Railway Mongo add‑on or Atlas)
   - `JWT_SECRET`, `CLIENT_URL`, `SERVER_URL`
4. Networking
   - Expose HTTP port. Railway provides a public URL like `https://roadassist-api.up.railway.app`
5. Logs & redeploy
   - View deploy logs in Railway UI. Redeploy on pushes to main.

Frontend on Railway (optional):
1. Create another service from repo
   - Root directory: `frontend`
   - Install: `npm ci`
   - Build: `npm run build`
   - Start: `npx serve -s dist -l $PORT` (or add a tiny Node server)
2. Variables: `VITE_API_BASE_URL=https://<railway-backend-url>`

Notes
- If you use a custom domain on Railway, add it in Networking and point CNAME; enable HTTPS there.
- Keep CORS aligned: backend `CLIENT_URL` must include your Netlify/Vercel/Railway frontend origins.
- Socket.IO on Railway works well with the default proxy.


