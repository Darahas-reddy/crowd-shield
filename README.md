# 🛡 CrowdShield

**Real-time crowd safety monitoring system** built with Spring Boot, MongoDB, React 18, and WebSocket.

> Designed for event venues, stadiums, and public gatherings — monitors zone occupancy, triggers density alerts, tracks attendees via GPS, and supports full evacuation workflows.

---

## Table of Contents

- [Live Demo](#live-demo)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Security](#security)

---

## Live Demo

| Service  | URL |
|----------|-----|
| Frontend | [crowdshield.vercel.app](https://crowdshield.vercel.app) |
| Backend API | [crowdshield-api.onrender.com/api](https://crowdshield-api.onrender.com/api) |

**Demo credentials**

| Role  | Email | Password |
|-------|-------|----------|
| Admin | admin@crowdshield.com | Admin@1234 |
| User  | user@crowdshield.com  | User@1234  |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React 18 (Vercel)                     │
│  Dashboard · Live Map · Alerts · Incidents · GPS Tracking    │
└───────────────────────┬──────────────────────┬──────────────┘
                        │ REST (JWT)            │ WebSocket (STOMP)
┌───────────────────────▼──────────────────────▼──────────────┐
│                 Spring Boot 3.2 (Render)                      │
│                                                               │
│  AuthController   ZoneController   AlertController           │
│       │                │                 │                    │
│  AuthService      ZoneService       AlertService             │
│       │           GeoService    AlertBroadcastService        │
│       │           ZoneService ──► StatsScheduler             │
│       │                │                 │                    │
│  UserRepository  ZoneRepository   AlertRepository            │
└───────────────────────┬──────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────┐
│                  MongoDB Atlas                                 │
│   users · zones · alerts · incidents · tracked_users          │
└──────────────────────────────────────────────────────────────┘

WebSocket Topics
  /topic/zones      → zone list + stats on every count change
  /topic/live       → GPS user positions on every ping
  /topic/alerts     → unacked alerts on create/acknowledge
  /topic/incidents  → incident list on create/update
  /topic/stats      → aggregate stats every 8s
  /topic/evacuation → evacuation state changes
```

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Java | 17 | Language |
| Spring Boot | 3.2 | Framework |
| Spring Security | 6 | JWT auth + role-based access |
| Spring WebSocket | 3.2 | Real-time push (STOMP/SockJS) |
| MongoDB | 6 | Primary database |
| Spring Data MongoDB | 3.2 | ORM layer |
| JJWT | 0.12.3 | JWT generation & validation |
| Lombok | latest | Boilerplate reduction |
| Twilio SDK | 9.14 | SMS / WhatsApp alerts |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18 | UI framework |
| Leaflet + Leaflet.draw | 1.9 | Interactive map |
| Leaflet.heat | 0.2 | Density heatmap overlay |
| SockJS + STOMP.js | latest | WebSocket client |
| Plus Jakarta Sans | — | Typography |

### Infrastructure
| Tool | Purpose |
|------|---------|
| Docker | Backend containerisation |
| Render | Backend hosting |
| Vercel | Frontend hosting |
| MongoDB Atlas | Managed database |

---

## Features

### Core
- **Real-time zone monitoring** — crowd counts pushed via WebSocket in <50ms
- **Auto density alerts** — WARNING at 75%, CRITICAL at 95% capacity
- **GPS tracking** — phones ping every 5s, appear live on map with zone detection
- **Geofencing** — Ray-casting (polygons) + Haversine (circles) for accurate zone detection
- **Incident management** — report, track, and resolve safety incidents
- **Evacuation mode** — one-click activates all zones, broadcasts alarm, notifies staff
- **Camera integration** — YOLOv8 auto-counting pushes counts from CCTV

### Security
- **JWT authentication** — stateless, 24-hour tokens
- **Role-based access** — ADMIN (full control) / USER (read + count updates)
- **BCrypt password hashing** — cost factor 10
- **Method-level security** — `@PreAuthorize` on every mutation endpoint

### Production Quality
- **Global exception handler** — all errors return structured JSON
- **Input validation** — `@Valid` + Bean Validation on all request DTOs
- **MongoDB indexes** — compound indexes on hot query paths, TTL on tracked_users
- **Audit log** — every action logged with timestamp and actor
- **CSV export** — zones and incidents exportable
- **Environment-based config** — no secrets in codebase

---

## Project Structure

```
crowd-shield/
├── backend/
│   ├── src/main/java/com/crowdshield/
│   │   ├── config/
│   │   │   ├── CorsConfig.java          # Global CORS filter
│   │   │   ├── MongoIndexConfig.java    # Creates indexes on startup
│   │   │   ├── SecurityConfig.java      # JWT filter chain + role rules
│   │   │   └── WebSocketConfig.java     # STOMP endpoint setup
│   │   ├── controller/
│   │   │   ├── AuthController.java      # POST /auth/register, /auth/login
│   │   │   ├── ZoneController.java      # CRUD + count + evacuate
│   │   │   ├── AlertController.java     # List + acknowledge
│   │   │   ├── IncidentController.java  # CRUD incidents
│   │   │   ├── DashboardController.java # GET /dashboard/stats
│   │   │   ├── TrackingController.java  # GPS ping + active users
│   │   │   └── EvacuationController.java# Activate / clear
│   │   ├── dto/
│   │   │   ├── request/                 # Validated inbound payloads
│   │   │   │   ├── ZoneRequest.java
│   │   │   │   ├── IncidentRequest.java
│   │   │   │   ├── RegisterRequest.java
│   │   │   │   └── LoginRequest.java
│   │   │   └── response/                # Clean outbound shapes
│   │   │       ├── ZoneResponse.java
│   │   │       ├── AlertResponse.java
│   │   │       └── AuthResponse.java
│   │   ├── exception/
│   │   │   ├── ResourceNotFoundException.java
│   │   │   ├── BadRequestException.java
│   │   │   └── GlobalExceptionHandler.java
│   │   ├── model/
│   │   │   ├── User.java
│   │   │   ├── Zone.java
│   │   │   ├── Alert.java
│   │   │   ├── Incident.java
│   │   │   └── TrackedUser.java
│   │   ├── repository/                  # Spring Data MongoDB interfaces
│   │   ├── security/
│   │   │   ├── JwtUtil.java             # Token generation + validation
│   │   │   ├── JwtAuthFilter.java       # Per-request Bearer token check
│   │   │   └── UserDetailsServiceImpl.java
│   │   └── service/
│   │       ├── AuthService.java
│   │       ├── ZoneService.java
│   │       ├── AlertService.java
│   │       ├── AlertBroadcastService.java # Extracted to break circular dep
│   │       ├── IncidentService.java
│   │       ├── DashboardService.java
│   │       ├── TrackingService.java
│   │       ├── GeoService.java
│   │       ├── StatsScheduler.java
│   │       └── TwilioNotificationService.java
│   ├── Dockerfile
│   └── pom.xml
│
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── track.html                   # Mobile GPS tracker (no install needed)
│   ├── src/
│   │   └── App.jsx                      # Full SPA — 1500+ lines
│   ├── .env.example
│   └── package.json
│
└── camera-counter/
    ├── camera_counter.py                # YOLOv8 people counting
    ├── zone_mapper.py
    └── config.json
```

---

## API Reference

All endpoints are prefixed with `/api`.

### Auth (public)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/auth/register` | `{fullName, email, password, role}` | `{token, email, role, expiresInMs}` |
| POST | `/auth/login` | `{email, password}` | `{token, email, role, expiresInMs}` |

### Zones

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/zones` | Public | List all zones |
| GET | `/zones/{id}` | Public | Get zone by ID |
| POST | `/zones` | ADMIN | Create zone |
| PUT | `/zones/{id}` | ADMIN | Update zone |
| PATCH | `/zones/{id}/count` | USER+ | Update crowd count |
| PATCH | `/zones/{id}/evacuate` | ADMIN | Set zone to EVACUATING |
| DELETE | `/zones/{id}` | ADMIN | Delete zone |

### Alerts

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/alerts/unacknowledged` | Public | Unacked alerts |
| PATCH | `/alerts/{id}/acknowledge` | USER+ | Ack single alert |
| POST | `/alerts/acknowledge-all` | USER+ | Ack all alerts |

### Incidents

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/incidents` | Public | All incidents |
| POST | `/incidents` | USER+ | Report incident |
| PUT | `/incidents/{id}` | USER+ | Update/resolve |
| DELETE | `/incidents/{id}` | ADMIN | Delete |

### GPS Tracking

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/track/ping` | Public | Send GPS position |
| GET | `/track/active` | Public | Active users |
| DELETE | `/track/{deviceId}` | Public | Leave tracking |

### Dashboard + Evacuation

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/dashboard/stats` | Public | Aggregate stats |
| POST | `/evacuation/activate` | ADMIN | Activate all-zones evac |
| POST | `/evacuation/clear` | ADMIN | Clear evacuation |

---

## Getting Started

### Prerequisites

```bash
java -version   # 17+
mvn -version    # 3.8+
node -v         # 18+
docker ps       # Docker running
```

### 1 — Start MongoDB

```bash
docker run -d --name mongo-cs -p 27017:27017 mongo:6
```

### 2 — Start Backend

```bash
cd backend
mvn spring-boot:run
# API available at http://localhost:8080/api
```

### 3 — Start Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
# App at http://localhost:3000
```

### 4 — Create your first admin

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Admin User",
    "email": "admin@crowdshield.com",
    "password": "Admin@1234",
    "role": "ADMIN"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzM4...",
  "email": "admin@crowdshield.com",
  "fullName": "Admin User",
  "role": "ROLE_ADMIN",
  "expiresInMs": 86400000
}
```

Use the token in subsequent requests:
```bash
curl -H "Authorization: Bearer eyJhbGci..." \
  http://localhost:8080/api/zones
```

### 5 — Seed demo zones

```bash
bash seed-demo-data.sh   # included in the repo root
```

### 6 — GPS tracking on phone

```bash
ipconfig        # Windows — find your local IP
ifconfig        # Mac/Linux

# Open on phone (same WiFi):
http://YOUR_LAPTOP_IP:3000/track.html
```

---

## Deployment

### Backend → Render

1. Push backend to a GitHub repo
2. Go to [render.com](https://render.com) → **New Web Service**
3. Select your repo, set:
   - **Runtime**: Docker
   - **Dockerfile path**: `backend/Dockerfile`
4. Add environment variables (see table below)
5. Deploy — Render builds the Docker image automatically

### Frontend → Vercel

```bash
cd frontend
npm install -g vercel
vercel --prod
```

Or connect GitHub repo at [vercel.com](https://vercel.com) and it auto-deploys on push.

---

## Environment Variables

### Backend (set in Render dashboard)

| Variable | Required | Example |
|----------|----------|---------|
| `MONGODB_URI` | ✅ | `mongodb+srv://user:pass@cluster.mongodb.net/crowdshield` |
| `JWT_SECRET` | ✅ | Any 32+ character random string |
| `JWT_EXPIRATION_MS` | — | `86400000` (24h) |
| `CORS_ALLOWED_ORIGINS` | ✅ | `https://crowdshield.vercel.app` |
| `TWILIO_ACCOUNT_SID` | — | From Twilio console |
| `TWILIO_AUTH_TOKEN` | — | From Twilio console |
| `TWILIO_FROM_NUMBER` | — | `+14155238886` |

### Frontend (set in Vercel dashboard)

| Variable | Example |
|----------|---------|
| `REACT_APP_API_URL` | `https://crowdshield-api.onrender.com/api` |
| `REACT_APP_WS_URL` | `https://crowdshield-api.onrender.com/ws` |

---

## Security

- **Passwords**: BCrypt hashed (cost 10) — plain text never stored or logged
- **JWT**: HS384 signed, 24-hour expiry, validated on every request
- **Roles**: `ROLE_ADMIN` (full CRUD) / `ROLE_USER` (read + count updates)
- **CSRF**: Disabled (stateless JWT API — no session cookies)
- **CORS**: Restricted to configured origin in production
- **Docker**: Runs as non-root `crowdshield` user
- **Secrets**: All via environment variables — nothing hardcoded in source

---

## Camera Counter (Optional)

YOLOv8-based automatic people counting from webcam or CCTV.

```bash
cd camera-counter
pip install -r requirements.txt
python camera_counter.py
```

Pushes counts to the backend every 3 seconds. Configure zone assignment in `config.json`.

---

## Keyboard Shortcuts (Frontend)

| Key | Action |
|-----|--------|
| `m` | Live Map |
| `d` | Dashboard |
| `z` | Zones |
| `i` | Incidents |
| `a` | Alerts |
| `g` | GPS Tracking |
| `l` | Audit Log |
| `Esc` | Close modal |

---

*Built as a full-stack internship project demonstrating real-time systems, JWT security, geofencing, and production deployment.*
