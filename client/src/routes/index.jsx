import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import CodeRoundedIcon from '@mui/icons-material/CodeRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import AppLayout from '../layout/AppLayout.jsx'
import AuthLayout from '../layout/AuthLayout.jsx'
import { useAuth } from '../hooks/useAuth.js'

const DashboardPage = lazy(() => import('../pages/Dashboard.jsx'))
const HallPage = lazy(() => import('../pages/Hall.jsx'))
const FacultyPage = lazy(() => import('../pages/Faculty.jsx'))
const StudentsPage = lazy(() => import('../pages/Students.jsx'))
const SeatingPage = lazy(() => import('../pages/Seating.jsx'))
const ExamSchedulePage = lazy(() => import('../pages/ExamSchedule.jsx'))
const CoursePage = lazy(() => import('../pages/Course.jsx'))
const LoginPage = lazy(() => import('../pages/Login.jsx'))
const LogoutPage = lazy(() => import('../pages/Logout.jsx'))
const ErrorPage = lazy(() => import('../pages/Error.jsx'))

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: <DashboardRoundedIcon fontSize="small" /> },
  { to: '/halls', label: 'Halls', icon: <ApartmentRoundedIcon fontSize="small" /> },
  { to: '/faculty', label: 'Faculty', icon: <BadgeRoundedIcon fontSize="small" /> },
  { to: '/students', label: 'Students', icon: <SchoolRoundedIcon fontSize="small" /> },
  { to: '/courses', label: 'Courses', icon: <MenuBookRoundedIcon fontSize="small" /> },
  { to: '/seating', label: 'Seating', icon: <CodeRoundedIcon fontSize="small" /> },
  { to: '/exam-schedule', label: 'Exam Schedule', icon: <EventNoteRoundedIcon fontSize="small" /> },
  { to: '/logout', label: 'Logout', icon: <LogoutRoundedIcon fontSize="small" /> }
]

function ProtectedRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return <div className="route-loading">Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

function PublicOnlyRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth()

  if (isBootstrapping) {
    return <div className="route-loading">Loading...</div>
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
        </Route>
        <Route path="/logout" element={<LogoutPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout navItems={NAV_ITEMS} />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/halls" element={<HallPage />} />
            <Route path="/faculty" element={<FacultyPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/courses" element={<CoursePage />} />
            <Route path="/seating" element={<SeatingPage />} />
            <Route path="/exam-schedule" element={<ExamSchedulePage />} />
          </Route>
        </Route>
        <Route
          path="*"
          element={
            <Suspense fallback={<div className="route-loading">Loading...</div>}>
              <ErrorPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
