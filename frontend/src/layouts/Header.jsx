import { Link } from 'react-router-dom'

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 shadow-sm z-20">
      <div className="h-full flex items-center justify-between px-6">
        <Link to="/dashboard" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">SCF</span>
          </div>
          <span className="text-xl font-semibold text-gray-800">
            Supply Chain Finance
          </span>
        </Link>
      </div>
    </header>
  )
}

export default Header

