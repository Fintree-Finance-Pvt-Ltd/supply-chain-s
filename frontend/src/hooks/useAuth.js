import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { login, logout, checkAuth } from '../store/slices/authSlice'

export const useAuth = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading, error } = useSelector((state) => state.auth)

  const handleLogin = async (email, password) => {
    try {
      await dispatch(login({ email, password })).unwrap()
      navigate('/dashboard')
    } catch (err) {
      throw err
    }
  }

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const checkAuthStatus = () => {
    dispatch(checkAuth())
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: handleLogin,
    logout: handleLogout,
    checkAuth: checkAuthStatus,
  }
}

