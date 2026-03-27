import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/shared/Sidebar'
import Navbar from '../components/shared/Navbar'
import { useAuth } from '../hooks/useAuth'

export default function AppLayout({ navItems }) {
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
      <Sidebar items={navItems} mobileOpen={mobileSidebarOpen} onClose={closeMobileSidebar} user={user} />
      <main className="layout-content">
        <Navbar mobileOpen={mobileSidebarOpen} onToggle={toggleMobileSidebar} />
        <Suspense fallback={<div className="route-loading">Loading...</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
