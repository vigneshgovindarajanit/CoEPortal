import { NavLink } from 'react-router-dom'

export default function Sidebar({ items, mobileOpen, onClose, user }) {
  return (
    <>
      <aside className={`sidebar${mobileOpen ? ' sidebar-mobile-open' : ''}`}>
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
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link-active' : ''}`}
              onClick={onClose}
            >
              <span className="sidebar-link-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="sidebar-link-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      {mobileOpen && (
        <button className="sidebar-backdrop" aria-label="Close sidebar" onClick={onClose} />
      )}
    </>
  )
}
