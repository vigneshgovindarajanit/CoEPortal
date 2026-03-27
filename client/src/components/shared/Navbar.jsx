export default function Navbar({ mobileOpen, onToggle }) {
  return (
    <button
      className="menu-toggle-btn"
      aria-label="Toggle sidebar"
      aria-expanded={mobileOpen}
      onClick={onToggle}
    >
      {'\u2630'}
    </button>
  )
}
