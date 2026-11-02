# UCRSystem — UNICROSS University Course Registration System

A production-ready full-stack web application for course registration at UNICROSS University, built with **Node.js + Express.js + EJS + MySQL**.

## Architecture
```
Three-Tier Architecture:
  [Presentation]  EJS Views + Flat CSS (ucrs-* prefix)
  [Application]   Express.js + engine/ucrsEngine.js (business logic)
  [Data]          MySQL (centralized single database)
```

## Features
- ✅ **Role-Based Authentication** — Student, Lecturer, Admin (bcrypt + express-session)
- ✅ **Course Catalog** — filterable by department, level, search
- ✅ **Course Registration** — per-course prerequisite + credit-limit validation
- ✅ **Real-Time Feedback** — specific error reasons (missing prereq names, credit totals)
- ✅ **Finalized Schedule** — with assigned venue, lecturer, and time slot
- ✅ **Lecturer Dashboard** — teaching assignments with enrollment count
- ✅ **Admin CRUD** — courses (with prerequisites), venues, timetable, and semester-based course lecturer assignments
- ✅ **Reports** — enrollment, venue utilization, credit distribution; CSV export
- ✅ **Docker Compose** — one command brings up app + MySQL with seeded data

---

## Quick Start (Local — without Docker)

### Prerequisites
- Node.js ≥ 18
- MySQL 8.0 running locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and set your DB credentials
```

### 3. Initialize Database
```bash
# Run schema
mysql -u root -p < database/schema.sql

# Run seed data
mysql -u root -p ucrsystem < database/seed.sql
```

### 4. Start the Server
```bash
npm run dev     # Development (nodemon)
# or
npm start       # Production
```

Visit: **http://localhost:3000**

---

## Quick Start (Docker Compose)

```bash
# Copy and configure env
cp .env.example .env

# Build and start (schema + seed run automatically)
docker compose up --build

# App available at:
# http://localhost:3000
```

---

## Default Test Credentials

| Role | Email | Password |
|------|-------|----------|
| **Administrator** | admin@unicross.edu.ng | `password123` |
| **Lecturer** | amaka.eze@unicross.edu.ng | `password123` |
| **Lecturer** | chukwudi.nwosu@unicross.edu.ng | `password123` |
| **Student** | carol@unicross.edu.ng | `password123` |
| **Student** | alice@unicross.edu.ng | `password123` |
| **Student** | bob@unicross.edu.ng | `password123` |
| **Student** | daniel@unicross.edu.ng | `password123` |
| **Student** | eve@unicross.edu.ng | `password123` |

---

## Validation Test Scenarios

| Scenario | Account | Action |
|----------|---------|--------|
| **Prerequisite failure (partial)** | daniel@unicross.edu.ng | Try to register CSC301 → FAIL: has CSC201 but missing CSC202 |
| **Prerequisite failure (all missing)** | alice@unicross.edu.ng | Try to register CSC301 → FAIL: missing CSC201 and CSC202 |
| **Success** | carol@unicross.edu.ng | Register CSC301 → PASS: has CSC201 + CSC202 |
| **Credit-limit test** | Any student | Select enough courses to exceed 24 units |
| **MTH prereq** | eve@unicross.edu.ng | Can register MTH201 (has MTH101) |

---

## Project Structure
```
UCRSystem/
├── app.js                    # Express entry point
├── config/db.js              # MySQL connection pool
├── engine/ucrsEngine.js      # ALL business logic (prereqs, credit, reports)
├── middleware/auth.js        # requireAuth, requireRole, injectUser
├── routes/
│   ├── pages/                # EJS page rendering routes
│   │   ├── auth.js           # Login / Logout
│   │   ├── student.js        # Dashboard, Catalog, Register, Schedule
│   │   ├── lecturer.js       # Dashboard, Schedule, Students
│   │   └── admin.js          # Dashboard, Courses, Venues, Timetable, Reports
│   └── api/                  # JSON API endpoints
│       ├── courses.js        # GET/POST/PUT/DELETE /api/courses
│       ├── registrations.js  # POST /validate, POST /submit, etc.
│       ├── venues.js         # Venues CRUD
│       └── reports.js        # Enrollment/Venue/Credit reports
├── views/
│   ├── partials/             # header, footer, navbar-student/lecturer/admin
│   ├── auth/login.ejs
│   ├── student/              # dashboard, catalog, register, schedule
│   ├── lecturer/             # dashboard, schedule, students
│   ├── admin/                # dashboard, courses, assignments, venues, timetable, users, reports
│   └── errors/               # 404, 500
├── public/
│   ├── css/ucrs.css          # Complete flat design system (ucrs-* prefix)
│   └── js/ucrs.js            # Client-side JS
├── database/
│   ├── schema.sql            # 8-table normalized schema
│   └── seed.sql              # Admin, lecturers across departments, sample students/courses, prereqs
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/courses` | Any | List all courses |
| `GET` | `/api/courses/:id` | Any | Get single course |
| `POST` | `/api/courses` | Admin | Create course |
| `PUT` | `/api/courses/:id` | Admin | Update course |
| `DELETE` | `/api/courses/:id` | Admin | Delete course |
| `POST` | `/api/registrations/validate` | Student | Validate single course |
| `POST` | `/api/registrations/submit` | Student | Submit registrations |
| `GET` | `/api/registrations/mine` | Student | Get own registrations |
| `DELETE` | `/api/registrations/:courseId` | Student | Drop a course |
| `GET` | `/api/reports/enrollment` | Admin | Enrollment report |
| `GET` | `/api/reports/venue` | Admin | Venue utilization |
| `GET` | `/api/reports/credit` | Admin | Credit load report |

---

## Technology Stack
- **Runtime**: Node.js ≥ 18
- **Framework**: Express.js 4
- **Views**: EJS with partials
- **Auth**: express-session + bcrypt
- **DB**: MySQL 8 via mysql2 (parameterized queries, no ORM)
- **CSS**: Vanilla flat design system — all `ucrs-*` prefixed, Inter font, no gradients
- **Container**: Docker + Docker Compose

---

*Built for UNICROSS University — Waterfall/OOADM methodology, Three-Tier Architecture*
