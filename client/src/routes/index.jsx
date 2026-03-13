import { Suspense, lazy, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import CodeRoundedIcon from '@mui/icons-material/CodeRounded'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import { useAuth } from '../context/AuthContext'

const DashboardPage = lazy(() => import('../pages/dashboard'))
const HallPage = lazy(() => import('../pages/hall'))
const FacultyPage = lazy(() => import('../pages/faculty'))
const StudentsPage = lazy(() => import('../pages/students'))
const SeatingPage = lazy(() => import('../pages/seating'))
const ExamSchedulePage = lazy(() => import('../pages/examSchedule'))
const CoursePage = lazy(() => import('../pages/course'))
const LoginPage = lazy(() => import('../pages/login'))
const LogoutPage = lazy(() => import('../pages/logout'))

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

function SidebarLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { user } = useAuth()

  function toggleMobileSidebar() {
    setMobileSidebarOpen((prev) => !prev)
  }

  function closeMobileSidebar() {
    setMobileSidebarOpen(false)
  }

  return (
    <div className="layout-root">
      <aside className={`sidebar${mobileSidebarOpen ? ' sidebar-mobile-open' : ''}`}>
        <h2 className="sidebar-title">
          <img
            src="https://ps.bitsathy.ac.in/static/media/logo.e99a8edb9e376c3ed2e5.png"
            alt="COE logo"
            className="sidebar-logo"
          />
          <span>COE Portal</span>
        </h2>
        <div className="sidebar-user-card">
          <span className="sidebar-user-role">{user?.role || 'Admin'}</span>
          <strong className="sidebar-user-name">{user?.username || 'admin'}</strong>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' sidebar-link-active' : ''}`
              }
              onClick={closeMobileSidebar}
            >
              <span className="sidebar-link-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="sidebar-link-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      {mobileSidebarOpen && (
        <button className="sidebar-backdrop" aria-label="Close sidebar" onClick={closeMobileSidebar} />
      )}
      <main className="layout-content">
        <button
          className="menu-toggle-btn"
          aria-label="Toggle sidebar"
          aria-expanded={mobileSidebarOpen}
          onClick={toggleMobileSidebar}
        >
          {'\u2630'}
        </button>
        <Suspense fallback={<div className="route-loading">Loading...</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route path="/logout" element={<LogoutPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<SidebarLayout />}>
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
      </Routes>
    </BrowserRouter>
  )
}

