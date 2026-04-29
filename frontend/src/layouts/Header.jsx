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

        {/* User Navigation Section */}
        {user && (
          <div className="flex items-center gap-4 lg:gap-6">
            {/* User Greeting & Info */}
            <div className="hidden md:flex flex-col items-end border-r border-gray-200 pr-4">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">
                Current User
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {user.name}
              </span>
            </div>

            {/* Profile Avatar & Actions */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 group"
              >
                <span className="text-xs font-bold uppercase tracking-wider">Logout</span>
                <svg 
                  className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header

