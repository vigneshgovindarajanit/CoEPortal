# COE Portal Monorepo

COE Portal is a full-stack exam administration system for a Controller of Examinations office. It brings hall management, faculty assignment, student records, course data, seating allocation, and exam schedule generation into one application.

## What the application does

The portal is designed to support the full exam preparation cycle:

1. Admin logs in to the portal.
2. Master data is prepared:
   - halls
   - faculty
   - students
   - courses
3. Seating allocation is generated using active halls and selected year filters.
4. Faculty can be assigned to the generated seating allocation.
5. Exam schedules are created manually or generated automatically using course demand, hall capacity, dates, sessions, and study-leave rules.
6. The dashboard shows the current operational summary across all modules.

## Tech stack

- Frontend: React 19, Vite, Material UI, React Router, Axios, Recharts, jsPDF
- Backend: Node.js, Express, MySQL2, Morgan, CORS, Dotenv
- Database: MySQL
- Auth: custom JWT-based authentication

## Repository structure

```text
COEPORTAL/
|-- client/    # React frontend
|-- backend/   # Express + MySQL backend
|-- README.md
|-- PROJECT_REPORT.md
```

## Architecture

### Frontend

The frontend is a route-based React application. It uses:

- `AuthProvider` to restore and manage login state
- protected routes for authenticated pages
- Axios for API communication
- Material UI for forms, tables, dialogs, and layout

Main frontend pages:

- Dashboard
- Halls
- Faculty
- Students
- Courses
- Seating
- Exam Schedule
- Login / Logout

### Backend

The backend follows a layered structure:

- `routes`: exposes API endpoints
- `controller`: handles request/response
- `service`: business rules and workflow logic
- `repository`: database queries and persistence
- `model`: normalization and validation

Main backend modules:

- `auth`
- `hall`
- `faculty`
- `student`
- `course`
- `allocation`
- `examSchedule`
- `dashboard`
- `seatingFilter`
- `courseRegistration`

## Full workflow of the application

### 1. Authentication workflow

- The frontend login page sends credentials to `POST /api/auth/login`.
- The backend validates the username and password.
- If no admin user exists yet, the backend bootstraps a default admin automatically.
- On successful login, a JWT token is returned.
- The frontend stores the token in local storage and attaches it to future API requests.
- On reload, the frontend calls `GET /api/auth/me` to restore the session.
- If any request returns `401`, the frontend clears the session and redirects the user back to login.

Default fallback credentials used by the backend if env values are not set:

- username: `admin`
- password: `admin123`

### 2. Master data preparation workflow

Before generation features are useful, the admin usually prepares the core datasets.

#### Hall workflow

- Add regular halls or practical halls/labs.
- Enter hall code, row count, column count, exam type, and bench configuration.
- Capacity is derived from rows, columns, and students per bench.
- Halls can be activated or deactivated.
- Only active halls are considered during seating and schedule generation.

#### Faculty workflow

- Add faculty with department, role, workload, and active status.
- The system enforces workload rules based on role.
- Certain roles such as principal are excluded from supervisor assignment logic.
- Faculty assignment can happen per hall or across the latest allocation.

#### Student workflow

- Add students manually or generate them in bulk.
- Each student record stores ID, name, email, year, and department.
- Filters and summaries support seating preparation.
- Bulk generation creates roll numbers automatically using the configured pattern.

#### Course workflow

- Add courses with code, name, department, year/semester, and course type.
- These courses become the input for exam scheduling.
- Schedule generation groups courses and estimates demand using course count and student strength.

### 3. Seating allocation workflow

Seating allocation is one of the central workflows of the system.

Input used:

- selected exam type
- selected year filter
- active halls for that exam type
- available students in the selected year(s)
- optional primary and secondary departments

How it works:

- The backend loads active halls and students matching the chosen year filter.
- Students are grouped by department.
- Departments are split into two alternating streams so rows are distributed with better separation.
- Halls are processed one by one.
- Each hall row is filled using department queues.
- The engine alternates department streams across rows and falls back intelligently when a department runs out.
- Each row stores:
  - row label
  - department label
  - roll numbers placed in that row
- A snapshot of the generated allocation is stored in the database.

Result returned:

- allocation id
- hall-wise row layouts
- assigned student counts
- unallocated students, if capacity is insufficient
- analysis summary by department

This allocation snapshot is later reused by other parts of the system, especially schedule generation and faculty assignment.

### 4. Faculty assignment workflow

After seating is generated, faculty can be assigned to the latest allocation.

How it works:

- The backend loads the selected allocation.
- For each hall with assigned students, it reads the hall layout.
- It tries to choose an eligible faculty member, preferring a matching department when possible.
- It excludes ineligible roles and checks workload availability.
- Assigned workload is incremented.
- The hall allocation record is updated with the chosen faculty member.

The faculty module also supports:

- single auto-assignment
- assign-all for the latest allocation
- latest assignment viewing
- historical assignment viewing
- clearing one faculty assignment
- clearing all assigned workloads

### 5. Exam schedule generation workflow

The exam schedule module supports both manual schedule entry and automatic generation.

Input used for generation:

- start date
- end date
- session
- exam type
- department
- year
- optional hall selection
- optional holiday dates

How automatic schedule generation works:

- The backend validates date range, session, exam type, department, and year.
- Sundays and selected holidays are removed from available dates.
- Courses are filtered by year, department, and exam type.
- Practical courses are separated from theory courses.
- Student strength is loaded to estimate real demand.
- The system tries to reuse the latest seating allocation for hall capacity.
- If no usable seating allocation exists, it falls back to active hall capacity.
- Courses are grouped by course code or course name.
- Demand is calculated per group.
- Candidate date/session windows are built.
- The engine places courses while enforcing:
  - no Sunday exams
  - no selected holiday exams
  - no duplicate department clash on the same day
  - at least one full day gap for study leave between exams of the same department
  - enough hall capacity for the required student strength
- Preview can be generated before saving.
- Final generation inserts the schedules into the database after duplicate checks.

This makes the schedule generator one of the most rule-driven parts of the application.

### 6. Dashboard workflow

The dashboard aggregates information from multiple modules and gives an overview of current exam operations.

Typical metrics include:

- total students
- faculty count
- active hall count
- schedule count
- allocation/hall usage insights
- recent schedule activity

The dashboard acts as the monitoring page after master data and generation workflows are completed.

## Detailed working of the application

### Frontend working

- `client/src/main.jsx` mounts the React app.
- `client/src/App.jsx` sets up the Material UI theme and date localization.
- `client/src/hooks/useAuth.js` manages:
  - token storage
  - user storage
  - session restoration
  - login
  - logout
- `client/src/lib/api.js` defines the shared Axios instance and attaches the bearer token automatically.
- `client/src/routes/index.jsx` defines public and protected routes.
- `client/src/layout/AppLayout.jsx` wraps authenticated pages with shared navigation.

Page-level responsibility:

- `Dashboard`: analytics and overview
- `Hall`: hall CRUD and status management
- `Faculty`: faculty CRUD, rules, and supervisor assignment
- `Students`: student CRUD, filtering, and bulk generation
- `Course`: course CRUD and filtering
- `Seating`: allocation generation, latest allocation viewing, and faculty assignment support
- `Exam Schedule`: preview, generation, CRUD, and filtering

### Backend working

#### App bootstrap

- `backend/server.js` starts the HTTP server.
- `backend/src/app.js` creates the Express app.
- It enables JSON parsing, CORS, and request logging.
- It mounts all API routes under `/api`.

#### Authentication

- `auth.service.js` ensures the admin table exists.
- If the admin table is empty, it inserts a default admin account.
- Passwords are hashed with PBKDF2 using a salt.
- Tokens are generated after successful login.
- Auth middleware validates bearer tokens for protected routes.

#### Hall management

- Hall input is normalized and validated.
- Duplicate hall codes are blocked.
- Hall capacity and supervisor requirements can be previewed and derived from layout inputs.
- Hall status decides whether the hall is available for operational workflows.

#### Student management

- Student IDs and emails are validated for uniqueness.
- Student listing supports filters and summaries.
- Bulk generation creates multiple student rows programmatically using department strength configuration.

#### Course management

- Courses are validated and normalized before insert/update.
- Duplicate course combinations are prevented.
- Filter endpoints help the frontend build course selection UIs.

#### Seating allocation engine

- The allocation engine loads halls and students.
- It groups students by department.
- It alternates departments row-wise for separation.
- It tracks assigned and unassigned students.
- It stores the generated layout as a snapshot so later modules can reuse the same seating reality.

#### Exam schedule engine

- The scheduling engine builds valid date windows first.
- Then it filters courses and estimates required capacity.
- It prefers capacity from the latest seating allocation because that reflects real assigned seating.
- If not available, it uses active hall capacity.
- It assigns courses into available windows while checking capacity and study-leave constraints.
- It supports preview before final insert.

## Active routes

All backend routes are mounted under `/api`.

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`

### Dashboard

- `GET /api/dashboard/overview`

### Halls

- `GET /api/halls`
- `GET /api/halls/stats`
- `POST /api/halls`
- `PUT /api/halls/:id`
- `PATCH /api/halls/:id/status`
- `DELETE /api/halls/:id`

### Faculty

- `GET /api/faculty`
- `GET /api/faculty/departments`
- `GET /api/faculty/rules`
- `GET /api/faculty/assignments/latest`
- `GET /api/faculty/assignments/historical`
- `POST /api/faculty`
- `PUT /api/faculty/:id`
- `POST /api/faculty/auto-assign`
- `POST /api/faculty/auto-assign-all`
- `POST /api/faculty/cancel-all-assigned`
- `POST /api/faculty/:id/cancel-assignment`

### Students

- `GET /api/students`
- `GET /api/students/summary`
- `POST /api/students`
- `POST /api/students/generate-bulk`
- `PUT /api/students/:id`
- `DELETE /api/students/:id`

### Courses

- `GET /api/courses`
- `GET /api/courses/filters`
- `POST /api/courses`
- `PUT /api/courses/:id`

### Seating allocations

- `GET /api/allocations/latest`
- `POST /api/allocations/generate`
- `POST /api/allocations/:id/assign-faculty`

### Exam schedules

- `GET /api/exam-schedules`
- `GET /api/exam-schedules/filters`
- `POST /api/exam-schedules/generate/preview`
- `POST /api/exam-schedules/generate`
- `POST /api/exam-schedules`
- `PUT /api/exam-schedules/:id`
- `DELETE /api/exam-schedules`
- `DELETE /api/exam-schedules/:id`

### Seating filters

- `POST /api/seating-filters`
- `GET /api/seating-filters/latest`

## Local setup

### Prerequisites

- Node.js
- npm
- MySQL running locally

### Backend setup

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

Example backend environment:

```env
PORT=4000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=coeportal
DB_PORT=3306
DB_SSL=false
DB_CONNECT_TIMEOUT=10000
CORS_ORIGIN=http://localhost:5173
```

Optional backend auth environment values:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=coeportal-dev-secret
JWT_EXPIRES_IN_SECONDS=43200
```

### Frontend setup

```bash
cd client
npm install
npm run dev
```

Frontend API base URL:

```env
VITE_API_BASE_URL=http://localhost:4000
```

## How to run the application end to end

1. Start MySQL and create the database named `coeportal`.
2. Start the backend on port `4000`.
3. Start the frontend on port `5173`.
4. Open the frontend in the browser.
5. Log in with the admin credentials.
6. Create halls, faculty, students, and courses.
7. Generate seating.
8. Assign faculty if required.
9. Generate or manage exam schedules.
10. Review the dashboard for the latest operational summary.

## Useful checks

The current backend root endpoint is:

```http
GET http://localhost:4000/
```

Expected response:

```json
{ "message": "COE Portal API" }
```

After login, a useful authenticated check is:

```http
GET http://localhost:4000/api/auth/me
Authorization: Bearer <token>
```

## Notes

- The old `GET /api/health` check is not part of the current backend.
- The backend contains maintenance scripts inside `backend/scripts/`.
- `PROJECT_REPORT.md` contains an extended academic-style write-up of the project.
