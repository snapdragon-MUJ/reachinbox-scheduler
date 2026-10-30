# ReachInbox Cold Email Scheduler & Dispatch Engine

A distributed, production-grade cold email scheduling system and analytics dashboard built with **Next.js 14**, **Node.js/Express**, **TypeScript**, **BullMQ**, **Upstash Redis**, and **Neon PostgreSQL**.

---

## Architecture Overview

```text
[ Next.js 14 Dashboard ] (Port 3000 / Tailwind)
           |
           | HTTP / REST API
           v
[ Express API Server ] (Port 5000 / Node.js)
     |                   |
     | Prisma Client       | BullMQ Enqueue
     v                   v
[ Neon PostgreSQL Cloud ] [ Upstash Redis Cloud ] (TLS / rediss://)
                           |
                           v
                    [ BullMQ Worker ] (Concurrency: 5)
                           |
       +-------------------+-------------------+-------------------+
       |                   |                   |                   |
       v                   v                   v                   v
[ Hourly Rate Limiter ] [ Stagger Delay ] [ Nodemailer Ethereal ] [ Search / DB Fallback ]
```

---

## Features Completed

- **Scheduled & Staggered Outbound Dispatch:** Support for setting exact execution dates/times with configurable delays (staggering) between individual emails to prevent domain reputation burning.
- **Distributed Queue Engine:** BullMQ managing persistent task queues over Upstash Redis with TLS (`rediss://`), exponential backoffs, and delayed job execution.
- **Sliding-Window Hourly Rate Limiter:** Per-sender hourly limit tracking in Redis. Exceeded jobs are automatically calculated, postponed, and rescheduled without loss.
- **Database Persistence:** Neon PostgreSQL integration via Prisma schema capturing email states (`SCHEDULED`, `PROCESSING`, `SENT`, `FAILED^, `RATE_LIMITED`).
- **CSV Contact Importer:** Client-side CSV file parsing via PapaParse and address extraction directly into campaign recipients.
- **Real-Time Queue Observability:** Bull-Board dashboard integrated at `/admin/queues` showing active, waiting, completed, failed, and delayed job counts.
- **Search Engine with Transparent Fallback:** Elasticsearch integration with automatic fallback to PostgreSQL pattern matching when an external cluster is unavailable.
- **Mock SMTP Transport:** Nodemailer configured with disposable Ethereal SMTP accounts for safe sandbox email verification and generated preview links.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 14 (App Router), Tailwind CSS, Lucide React, PapaParse, Axios |
| **Backend** | Node.js, Express.js, TypeScript, tsx |
| **Task Queue & Cache** | BullMQ, Upstash Redis (`rediss://`) |
| **Database & ORM**| PostgreSEL (Neon Cloud), Prisma ORM |
| **Queue Monitoring** | Bull-Board (`@bull-board/api`, `@bull-board/express`) |
| **Email Transport** | Nodemailer (Ethereal SMTP test accounts) |

---

## Project Structure

```text
reachinbox-scheduler/
├─ backend/
    ├┠ prisma/
        └─ schema.prisma         # Database models (User, ScheduledEmail)
    ├┠ src/
        ├─ lib/
���   ⠂   ⠂   �R�─ prisma.ts         # Prisma client instance
���   ⠂   �\�─ queue/
���   ⠂   ⠂   �\�─ emailQueue.ts     # BullMQ queue & Upstash Redis configuration
            └─ emailWorker.ts    # Worker process & SMTP transport handler
    │   ├┠ services/
    │   │   ├┠ rateLimiter.ts    # Redis sliding-window hourly limiter
            ├─ searchService.ts  # Elasticsearch service with DB fallback
���   ⠂   ⠂   �R�─ slackService.ts   # Rate limit notification handler
���   ⠂   �R�─ server.ts             # Express server, REST endpoints & Bull-Board
    ├┠ package.json
    ├┠ tsconfig.json
    └─ .env
├─ frontend/
⠂   ├─ app/
    │   ├┠ layout.tsx
        └─ page.tsx              # Email scheduling UI, CSV upload & live log table
    ├─ package.json
    ├─ tailwind.config.ts
    └─ tsconfig.json
├─ README.md
└─ .gitignore
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"
REDIS_URL="rediss://default:<token>@<host>:6379"
ELASTICSEARCH_URL="http://localhost:9200"
WORKER_CONCURRENCY=5

# Nodemailer / Ethereal (leave empty for auto-generated test accounts)
ETHEREAL_USER=""
ETHEREAL_PASSER=""
ETHEREAL_HOST="smtp.ethereal.email"

# Slack OAuth (Optional)
SLACK_CLIENT_ID=""
SLACK_CLIENT_SECRET=""
SLACK_REDIRECT_URI="http://localhost:5000/api/slack/oauth/callback"
```

---

## Setup & Local Run Instructions

### 1. Prerequisites
- Node.js v18 or higher
- Git

### 2. Backend Setup
```bash
cd backend
npm install
npx prisma db push
npx tsx src/server.ts
```
- API Server: http://localhost:5000
- Bull-Board Queue Dashboard: http://localhost:5000/admin/queues

### 3. Frontend Setup
Open a separate terminal window:
```bash
cd frontend
npm install
npm run dev
```
- Web Application: http://localhost:3000

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/schedule` | Schedules batch emails with custom delay, target time, and hourly limits |
| `GET` | `/api/emails` | Fetches email dispatch history and statuses (`userId`, `status`) |
| `GET` | `/api/emails/search` | Performs query search across email bodies and recipients |
| `GET` | `/admin/queues` | Bull-Board graphical queue monitoring interface |
