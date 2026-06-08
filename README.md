# Istiqama (استقامة)

A web application for managing a local Quran teaching center — tracking student memorization (hifz), attendance, class timetables, and parent communications. Designed to replace paper logbooks with a fast, mobile-friendly Arabic-RTL interface.

---

## Features

- **Hifz tracking** — record new memorization, recent revision (sabqi), and older revision (manzil) per student per session with ratings 1–4
- **Attendance** — mark present / absent / late / excused in the same daily session workflow
- **Calendar view** — monthly grid showing complete / partial / missed days, tap any day to open the session
- **Reports & analytics** — per-class and center-wide dashboards, memorization velocity charts, at-risk student flags
- **Parent messages** — template mode (offline-capable) and Groq AI mode for WhatsApp-ready Arabic messages; group copy or individual `wa.me` link
- **Report cards** — on-demand Arabic/RTL PDF with progress summary for any student
- **Guest students** — teachers add temporary students offline; principal converts them to permanent
- **Backup / export** — JSON full backup, attendance CSV, and hifz history CSV from `/admin/backup`
- **PWA-ready** — installable on Android, service worker app-shell caching

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui (RTL configured) |
| ORM | Prisma + PostgreSQL (Neon) |
| Auth | Auth.js credentials provider, bcrypt, JWT |
| AI messages | Groq API (`llama-3.3-70b-versatile`) — server-side only |
| Photo storage | Vercel Blob |
| PDF | @react-pdf/renderer + Amiri font (Arabic RTL) |
| PWA | @ducanh2912/next-pwa |

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# PostgreSQL connection string (Neon or any hosted Postgres)
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"

# Auth.js secret — generate with: openssl rand -base64 32
NEXTAUTH_SECRET="your-secret-here"

# Base URL (required in production; not needed in local dev)
NEXTAUTH_URL="https://your-domain.com"

# Vercel Blob — for student photo uploads
BLOB_READ_WRITE_TOKEN=""

# Groq API — for AI parent message generation (optional; falls back to template mode)
GROQ_API_KEY=""
```

---

## Local Setup

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) (required — npm will fail with this repo)
- A PostgreSQL database (local or Neon free tier)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-org/istiqama.git
cd istiqama

# 2. Install dependencies (must use pnpm)
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and NEXTAUTH_SECRET

# 4. Run database migrations
pnpm prisma migrate dev

# 5. Seed the database (Quran reference + default message categories + first principal account)
pnpm prisma db seed

# 6. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## First Principal Account

The seed script automatically creates a principal account:

| Field | Value |
|-------|-------|
| Email | `admin@istiqama.local` |
| Password | `admin123` |

**Change the password immediately** after first login via Profile → Change Password.

The principal can then create teacher accounts from `/admin/users`.

---

## Deployment (Vercel + Neon)

### 1. Create a Neon database

Go to [console.neon.tech](https://console.neon.tech) → New Project → copy the connection string.

### 2. Deploy to Vercel

```bash
# Install Vercel CLI if needed
pnpm add -g vercel

# Deploy
vercel deploy --prod
```

Or connect the GitHub repo in the Vercel dashboard.

### 3. Set environment variables in Vercel

In **Vercel dashboard → Settings → Environment Variables**, add:

- `DATABASE_URL` — Neon connection string (use the pooled URL for serverless)
- `NEXTAUTH_SECRET` — random 32-byte base64 string
- `NEXTAUTH_URL` — your production URL (e.g. `https://istiqama.vercel.app`)
- `BLOB_READ_WRITE_TOKEN` — from Vercel Blob storage setup
- `GROQ_API_KEY` — optional, for AI message mode

### 4. Run migrations on first deploy

In the Vercel dashboard or via CLI:

```bash
vercel env pull .env.production.local
DATABASE_URL=$(grep DATABASE_URL .env.production.local | cut -d= -f2-) \
  pnpm prisma migrate deploy && pnpm prisma db seed
```

---

## Data Backup

### In-app export (from `/admin/backup`)

The principal can download:
- **Full JSON backup** — all students, classes, teachers, sessions, sard records, message logs
- **Attendance CSV** — all attendance records (Excel/Sheets compatible, with Arabic BOM)
- **Hifz history CSV** — all recitation entries

### Database-level backup (recommended weekly)

```bash
# Dump the full database
pg_dump $DATABASE_URL > backup-$(date +%Y-%m-%d).sql

# Restore
psql $DATABASE_URL < backup-2025-01-01.sql
```

Neon also provides automated backups in the dashboard under **Branches → Restore**.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # All authenticated pages (layout enforces login)
│   │   ├── dashboard/   # Role-aware dashboard (teacher / principal)
│   │   ├── daily/       # Daily session entry
│   │   ├── calendar/    # Monthly calendar per class
│   │   ├── classes/     # Class management + roster
│   │   ├── students/    # Student management + history
│   │   ├── timetable/   # Weekly schedule grid
│   │   ├── messages/    # Parent message generator
│   │   ├── report-cards/ # Arabic PDF report cards
│   │   ├── teachers/    # Principal drill-down (teacher → class → calendar)
│   │   └── admin/       # Principal-only: users, guests, message categories, backup
│   ├── api/             # Route handlers (auth, photo upload, AI messages, PDF, backup)
│   └── login/           # Login page
├── components/          # Shared UI components (nav, charts, PDF, forms)
└── lib/
    ├── actions/         # Server actions (all RBAC enforced)
    └── prisma.ts        # Prisma client singleton
prisma/
├── schema.prisma        # Full data model
├── migrations/          # Migration history
└── seed.ts              # Quran reference + initial accounts
```

---

## Roles & Access

| Role | Access |
|------|--------|
| **Principal** | Everything — all students, all classes, all reports, user management, backup |
| **Teacher** | Own classes and students only — daily session, calendar, messages, report cards |

RBAC is enforced **server-side** on every route and server action. Teachers cannot access other teachers' data even if they construct URLs manually.
