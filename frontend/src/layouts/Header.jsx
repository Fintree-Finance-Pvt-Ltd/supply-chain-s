import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useAuth } from '../hooks/useAuth'

const Header = () => {
  const { user } = useSelector((state) => state.auth)
  const { logout } = useAuth()

  const handleLogout = () => {
    logout()
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 shadow-sm z-20">
      <div className="h-full flex items-center justify-between px-6">
        <Link to="/dashboard" className="flex items-center space-x-2">
          <img src="/logos/FinTree-Logo.jpg" alt="SCF Logo" className="w-8 h-8 rounded-lg object-contain" />
          <span className="text-xl font-semibold text-gray-800">
            Supply Chain Finance
          </span>
        </Link>

        {user && (
          <div className="flex items-center gap-4">
            <span className="text-base text-gray-600">
              Welcome, <span className="font-medium text-gray-900">{user.name}</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 transition"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header

