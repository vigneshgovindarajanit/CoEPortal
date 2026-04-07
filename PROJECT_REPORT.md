# COE Portal Project Report

## 1. Project Title
COE Portal and its features are Exam Hall, Faculty, Student, Course, Seating, and Exam Schedule Management System

## 2. Project Overview
The COE Portal is a full-stack web application developed to support the workflow of a Controller of Examinations office. The system centralizes hall management, faculty allocation, student records, course information, seating arrangement generation, and exam scheduling in one platform. It reduces manual coordination, improves visibility of academic resources, and helps the exam cell generate printable operational outputs such as seating layouts, assigned faculty lists, and exam schedules.

The application follows a monorepo structure with two main parts:
- `client`: React + Vite frontend for the user interface.
- `backend`: Node.js + Express + MySQL backend for business logic, APIs, authentication, and persistence.

## 3. Main Objectives
- Manage exam halls and practical laboratories with capacity details.
- Maintain faculty records and assign faculty as hall supervisors.
- Maintain student records and generate bulk student datasets programmatically.
- Maintain course details with semester, department, type, and course count.
- Generate exam seating layouts based on active halls and selected year filters.
- Generate and manage exam schedules for semester, periodic test, and practical exams.
- Provide a dashboard with operational summary and analytics.
- Export important reports as PDF for administration and submission work.

## 4. Core Functionalities Implemented
### 4.1 Authentication
- Admin login with username and password.
- Token-based session handling using a custom JWT implementation.
- Persistent login state on the frontend using local storage.
- Protected routes for authenticated access to the portal.

### 4.2 Dashboard
- Displays total students, active halls, faculty count, and exam schedule count.
- Shows capacity versus usage data.
- Shows course distribution and recent exam schedule activity.
- Refreshes dashboard data periodically for a live feel.

### 4.3 Hall Management
- Add, edit, activate, deactivate, and delete halls.
- Support for both regular exam halls and practical halls.
- Auto-calculates hall capacity from rows, columns, and students per bench.
- Maintains hall statistics such as active hall count and total active capacity.
- Groups regular halls by block and practical halls by lab category.

### 4.4 Faculty Management
- Add and edit faculty details including department, role, workload, and active status.
- Maintain workload rules based on faculty role.
- Automatically assign a supervisor to a specific hall/date/session.
- Automatically assign faculty to all halls across a selected date range and exam type.
- Cancel individual or all faculty assignments.
- View latest and historical assignment details.
- Export currently assigned faculty details as PDF.

### 4.5 Student Management
- Add, edit, search, filter, paginate, and delete student records.
- Filter by year and department.
- Generate bulk student records automatically using roll-number logic.
- Provide summary information by year for seating analysis.

### 4.6 Course Management
- Add and edit course details.
- Filter courses by semester, department, and course type.
- Store course type information such as core, elective, and add-on.
- Store elective subtype information.
- Track course-wise registration count.

### 4.7 Seating Arrangement
- Generate seating layouts using active halls and selected academic year filters.
- Separate logic for semester, periodic test, and practical seating contexts.
- Alternate departments row-wise to improve distribution.
- Save and reuse latest generated allocation snapshots.
- Search seating layouts by hall or faculty.
- Show supervisor details on seating layouts.
- Export seating arrangements as PDF.
- Save selected seating filters such as year, exam type, exam date, and session.

### 4.8 Exam Schedule
- Add, edit, delete, and bulk-delete exam schedules.
- Filter schedules by date, exam type, department, and search text.
- Generate schedules automatically within a date range.
- Preview generated schedules before saving.
- Avoid Sunday scheduling.
- Enforce study leave gaps between department exams.
- Allocate halls based on seating capacity and latest seating allocation when available.
- Export schedules as PDF.

### 4.9 Additional Backend Support
- Course registration listing API is available for future integration.
- Department catalog repository is available with seeded department data for future extension.
- Several migration and inspection scripts are included for database support and debugging.

## 5. Technology Stack
- Frontend: React 19, Vite, Material UI, React Router, Axios, Recharts, jsPDF
- Backend: Node.js, Express, MySQL2, Morgan, CORS, Dotenv
- Database: MySQL
- Authentication: Custom JWT with HMAC SHA-256 signing

## 6. Architecture Summary
- The frontend is component-driven and route-based.
- The backend follows a layered structure:
  - `routes`: API endpoint mapping
  - `controller`: request/response handling
  - `service`: business logic
  - `repository`: database access
  - `model`: normalization and validation logic
- This separation improves maintainability, testability, and clarity of responsibility.

## 7. File-Wise Description

### 7.1 Root Files
- `README.md`: Root-level setup instructions for running frontend and backend.
- `.gitignore`: Git ignore rules for the monorepo.
- `PROJECT_REPORT.md`: Submit-ready project description and file explanation document.

### 7.2 Backend Root Files
- `backend/package.json`: Backend package metadata, dependencies, and npm scripts.
- `backend/package-lock.json`: Exact backend dependency lock file.
- `backend/.env.example`: Sample environment variables for backend setup.
- `backend/server.js`: Backend entry point; ensures auth setup and starts the server.

### 7.3 Backend Configuration, App, Middleware, and Utilities
- `backend/src/app.js`: Creates the Express app, enables CORS/JSON logging, adds mobile response wrapping, and mounts routes.
- `backend/src/routes/index.routes.js`: Central route registry for all active backend modules.
- `backend/src/config/env.js`: Loads environment variables and default configuration values.
- `backend/src/config/db.js`: Creates the MySQL connection pool.
- `backend/src/config/jwt.js`: Exposes JWT secret and expiry configuration.
- `backend/src/middleware/auth.middleware.js`: Validates bearer tokens and attaches authenticated user data.
- `backend/src/middleware/error.middleware.js`: Global error response handler.
- `backend/src/middleware/notFound.js`: Handles unknown API routes with 404 responses.
- `backend/src/utils/jwt.js`: Custom JWT creation and verification utility.
- `backend/src/utils/response.js`: Adds an optional mobile-friendly API response envelope.
- `backend/src/services/seating.service.js`: Older seating utility service for simple department-wise row arrangement; now mostly superseded by allocation logic.

### 7.4 Backend Auth Module
- `backend/src/modules/auth/auth.routes.js`: Auth route definitions.
- `backend/src/modules/auth/auth.controller.js`: Handles login and profile endpoints.
- `backend/src/modules/auth/auth.service.js`: Handles admin bootstrap, password hashing, login validation, token creation, and profile fetch.
- `backend/src/modules/auth/auth.repository.js`: Creates and queries the `admin_users` table.
- `backend/src/modules/auth/auth.model.js`: Normalizes usernames and validates login input.

### 7.5 Backend Hall Module
- `backend/src/modules/hall/hall.routes.js`: Hall API routes.
- `backend/src/modules/hall/hall.controller.js`: Handles hall CRUD and hall statistics responses.
- `backend/src/modules/hall/hall.service.js`: Applies hall business rules such as duplicate checks and status updates.
- `backend/src/modules/hall/hall.repository.js`: Creates and queries the hall table and statistics.
- `backend/src/modules/hall/hall.model.js`: Normalizes hall input, validates hall data, computes capacity, and computes supervisor count.

### 7.6 Backend Faculty Module
- `backend/src/modules/faculty/faculty.routes.js`: Faculty and faculty-assignment API routes.
- `backend/src/modules/faculty/faculty.controller.js`: Handles faculty CRUD, auto-assignment, history, and cancellation endpoints.
- `backend/src/modules/faculty/faculty.service.js`: Enforces faculty business rules and delegates assignment operations.
- `backend/src/modules/faculty/faculty.repository.js`: Performs complex faculty queries, workload updates, latest/historical assignment lookup, and auto-assignment logic.
- `backend/src/modules/faculty/faculty.model.js`: Validates faculty input, role text, and workload rules.

### 7.7 Backend Student Module
- `backend/src/modules/student/student.routes.js`: Student CRUD, summary, and bulk-generation routes.
- `backend/src/modules/student/student.controller.js`: Handles student API requests.
- `backend/src/modules/student/student.service.js`: Checks duplicates, performs CRUD logic, and generates bulk students.
- `backend/src/modules/student/student.repository.js`: Creates the students table and handles filtered, paginated, and summary queries.
- `backend/src/modules/student/student.model.js`: Validates student data, validates bulk generation settings, and builds roll numbers.

### 7.8 Backend Course Module
- `backend/src/modules/course/course.routes.js`: Course listing, filter, create, and update routes.
- `backend/src/modules/course/course.controller.js`: Handles course API requests.
- `backend/src/modules/course/course.service.js`: Validates input, returns filters, and prevents duplicate semester/course-code entries.
- `backend/src/modules/course/course.repository.js`: Creates/seeds the courses table and executes course queries.
- `backend/src/modules/course/course.model.js`: Normalizes and validates course input and constants for course types.

### 7.9 Backend Allocation Module
- `backend/src/modules/allocation/allocation.routes.js`: Seating allocation routes.
- `backend/src/modules/allocation/allocation.controller.js`: Handles generate/latest/faculty-assignment allocation endpoints.
- `backend/src/modules/allocation/allocation.service.js`: Main seating engine that distributes students across halls and stores allocation snapshots.
- `backend/src/modules/allocation/allocation.repository.js`: Creates allocation tables and stores/loads hall layout snapshots from the database.
- `backend/src/modules/allocation/allocation.model.js`: Validates allocation generation input such as year filter, department, and exam type.

### 7.10 Backend Exam Schedule Module
- `backend/src/modules/examSchedule/examSchedule.routes.js`: Exam schedule CRUD and generation routes.
- `backend/src/modules/examSchedule/examSchedule.controller.js`: Handles schedule listing, preview generation, save generation, update, and delete operations.
- `backend/src/modules/examSchedule/examSchedule.service.js`: Main schedule-generation engine with date-range logic, hall-capacity allocation, and study-leave rules.
- `backend/src/modules/examSchedule/examSchedule.repository.js`: Creates exam schedule tables, manages schema migration handling, and persists schedules.
- `backend/src/modules/examSchedule/examSchedule.model.js`: Validates exam schedule input and exam-type/session rules.

### 7.11 Backend Dashboard Module
- `backend/src/modules/dashboard/dashboard.routes.js`: Dashboard route definition.
- `backend/src/modules/dashboard/dashboard.controller.js`: Returns dashboard overview data.
- `backend/src/modules/dashboard/dashboard.service.js`: Thin service layer for dashboard overview.
- `backend/src/modules/dashboard/dashboard.repository.js`: Aggregates hall, faculty, student, course, schedule, and allocation metrics from the database.
- `backend/src/modules/dashboard/dashboard.model.js`: Maps and formats numeric dashboard aggregation output.

### 7.12 Backend Seating Filter Module
- `backend/src/modules/seatingFilter/seatingFilter.routes.js`: Routes to save and load latest seating filter settings.
- `backend/src/modules/seatingFilter/seatingFilter.controller.js`: Handles seating filter API requests.
- `backend/src/modules/seatingFilter/seatingFilter.service.js`: Saves and retrieves seating filter state.
- `backend/src/modules/seatingFilter/seatingFilter.repository.js`: Creates and queries the `seating_filters` table.

### 7.13 Backend Additional and Support Modules
- `backend/src/modules/courseRegistration/courseRegistration.routes.js`: Course registration listing route.
- `backend/src/modules/courseRegistration/courseRegistration.controller.js`: Reads query filters and returns course registration data.
- `backend/src/modules/courseRegistration/courseRegistration.service.js`: Thin service for course registration listing.
- `backend/src/modules/courseRegistration/courseRegistration.repository.js`: Joins students and courses with course registrations for reporting.
- `backend/src/modules/department/department.model.js`: Validates department catalog input.
- `backend/src/modules/department/department.repository.js`: Creates and seeds a department catalog table and provides department CRUD operations.
- `backend/src/modules/login/login.routes.js`: Empty placeholder file for an earlier login module design.
- `backend/src/modules/login/login.controller.js`: Empty placeholder controller.
- `backend/src/modules/login/login.service.js`: Empty placeholder service.
- `backend/src/modules/login/login.repository.js`: Empty placeholder repository.
- `backend/src/modules/login/login .model.js`: Empty placeholder model file with a naming typo in the filename.
- `backend/src/modules/logout/logout.routes.js`: Empty placeholder file for an earlier logout module design.
- `backend/src/modules/logout/logout.controller.js`: Empty placeholder controller.
- `backend/src/modules/logout/logout.service.js`: Empty placeholder service.
- `backend/src/modules/logout/logout.repository.js`: Empty placeholder repository.
- `backend/src/modules/logout/logout.model.js`: Empty placeholder model.

### 7.14 Backend Scripts
- `backend/scripts/check_batches.js`: Utility script for checking batch-related data.
- `backend/scripts/check_batches2.js`: Alternate batch checking utility.
- `backend/scripts/check_halls.js`: Utility script to inspect hall records.
- `backend/scripts/check_users.js`: Utility script to inspect user/admin data.
- `backend/scripts/check_tables.js`: Prints database table names from the current schema.
- `backend/scripts/check_tables2.js`: Alternate table inspection script.
- `backend/scripts/check_history.js`: Utility script for historical data inspection.
- `backend/scripts/check_years.js`: Utility script to inspect year-related data.
- `backend/scripts/dump_courses.js`: Utility script to dump course data for debugging or migration.
- `backend/scripts/fix_courses.js`: Utility script for course correction/cleanup.
- `backend/scripts/migrate_db.js`: Adds missing second-supervisor columns to allocation and schedule tables.
- `backend/scripts/reset_admin.js`: Resets the default admin password to `admin123`.

### 7.15 Frontend Root Files
- `client/package.json`: Frontend dependencies and Vite scripts.
- `client/package-lock.json`: Exact frontend dependency lock file.
- `client/README.md`: Default Vite React template README.
- `client/index.html`: HTML shell for the React application.
- `client/vite.config.js`: Vite bundler configuration.
- `client/eslint.config.js`: ESLint configuration for frontend code quality.
- `client/public/vite.svg`: Default Vite static icon asset.

### 7.16 Frontend Entry, Routing, Auth, and Shared Layout
- `client/src/main.jsx`: Mounts the React app into the DOM.
- `client/src/App.jsx`: Configures Material UI theme, date localization, and auth provider.
- `client/src/index.css`: Global styling for layout, responsive design, cards, tables, dialogs, seating print view, and page-specific styles.
- `client/src/routes/index.jsx`: Defines public/protected routes, lazy-loaded pages, and sidebar navigation items.
- `client/src/hooks/useAuth.js`: Manages login state, local storage session persistence, bootstrap profile fetch, and logout.
- `client/src/lib/api.js`: Shared Axios instance with base URL, auth header injection, and 401 interception.
- `client/src/layout/AppLayout.jsx`: Main authenticated layout with sidebar and navbar.
- `client/src/layout/AuthLayout.jsx`: Wrapper for unauthenticated routes.
- `client/src/components/shared/Sidebar.jsx`: Navigation sidebar with portal branding and user details.
- `client/src/components/shared/Navbar.jsx`: Mobile sidebar toggle button.
- `client/src/utils/confirmAction.js`: Wrapper around browser confirmation dialog.

### 7.17 Frontend Service Files
- `client/src/services/auth.service.js`: Frontend API wrapper for login and profile fetch.
- `client/src/services/dashboardService.js`: Fetches dashboard overview data.
- `client/src/services/facultyService.js`: Handles faculty CRUD, assignment, cancellation, hall fetches, and assignment history API calls.
- `client/src/services/studentService.js`: Handles student CRUD, summary, and bulk-generation API calls.
- `client/src/services/courseService.js`: Handles course list, filter, create, and update API calls.
- `client/src/services/allocationService.js`: Handles seating allocation generation and latest allocation fetch.
- `client/src/services/examScheduleService.js`: Handles exam schedule CRUD, filters, preview generation, generation, and delete-all actions.

### 7.18 Frontend Page Files
- `client/src/pages/Login.jsx`: Admin login screen with validation, error handling, and redirect logic.
- `client/src/pages/Logout.jsx`: Clears the session and redirects to login.
- `client/src/pages/Error.jsx`: 404 page for invalid routes.
- `client/src/pages/Dashboard.jsx`: Visual analytics dashboard with metric cards, charts, and recent schedule activity.
- `client/src/pages/Hall.jsx`: Hall management screen for regular and practical halls with stats, filters, CRUD, and status toggling.
- `client/src/pages/Faculty.jsx`: Faculty management screen with workload display, assignment dialogs, cancellation, history, and PDF export.
- `client/src/pages/Students.jsx`: Student management screen with search, filters, CRUD, pagination, and bulk generation.
- `client/src/pages/Course.jsx`: Course management screen with table display, filters, and create/edit dialogs.
- `client/src/pages/Seating.jsx`: Seating layout generation screen with year/date/session filters, visual hall layout display, and PDF export.
- `client/src/pages/ExamSchedule.jsx`: Exam schedule screen with manual CRUD, generator preview/save flow, filters, and PDF export.

## 8. Data Flow Summary
1. The admin logs in through the React frontend.
2. The backend validates credentials and returns a JWT token.
3. The frontend stores the token and uses it for protected API calls.
4. Master data such as halls, faculty, students, and courses are managed through CRUD screens.
5. Seating allocation uses active halls and selected year filters to build hall-wise row allocations.
6. Exam scheduling uses course data, student strength, hall capacity, and date/session rules to generate schedules.
7. Faculty assignment links hall schedules with eligible faculty workload availability.
8. Dashboard APIs aggregate data from multiple modules and present it visually.

## 9. Special Strengths of the Project
- Clear modular architecture with separated controller, service, repository, and model layers.
- Supports both manual operations and automated generation.
- Includes PDF export for real exam-cell use.
- Handles multiple exam types: semester, periodic test, and practical.
- Preserves latest seating allocation snapshots for reuse by scheduling.
- Includes utility scripts for maintenance and schema evolution.

## 10. Current Notes and Limitations
- Login/logout placeholder module files exist but are not part of the active route structure because authentication is handled through the `auth` module.
- Department catalog and course registration modules are available mainly as backend support and future extension points.
- Some script files are maintenance/debug utilities and not part of the normal runtime flow.
- The default frontend README and default Vite asset are still present from project scaffolding.

## 11. Conclusion
The COE Portal is a practical exam administration system that digitizes major Controller of Examinations operations. It supports hall setup, faculty workload management, student dataset preparation, course maintenance, seating generation, exam scheduling, and reporting. The project demonstrates full-stack development, layered backend design, database integration, algorithmic allocation logic, and real administrative use-case coverage in a single integrated platform.
