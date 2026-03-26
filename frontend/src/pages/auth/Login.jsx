// import { useState } from 'react'
// import { useAuth } from '../../hooks/useAuth'
// import LoadingSpinner from '../../components/LoadingSpinner'
// import { toast  } from 'react-toastify'
// const Login = () => {
//   const [email, setEmail] = useState('')
//   const [password, setPassword] = useState('')
//   const [error, setError] = useState('')
//   const { login, isLoading } = useAuth()

//   const handleSubmit = async (e) => {
//     e.preventDefault()
//     setError('')
    
//     try {
//       await login(email, password)
//     } catch (err) {
//       toast.error(err || 'Login failed. Please check your credentials.')
//       setError(err || 'Login failed. Please check your credentials.')
//     }
//   }

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
//       <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
//         <div className="text-center mb-8">
//           <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-xl mb-4">
//             <span className="text-white font-bold text-2xl">SCF</span>
//           </div>
//           <h1 className="text-2xl font-bold text-gray-900">Supply Chain Finance</h1>
//           <p className="text-gray-600 mt-2">Sign in to your account</p>
//         </div>

//         <form onSubmit={handleSubmit} className="space-y-6">
//           {error && (
//             <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
//               {error}
//             </div>
//           )}

//           <div>
//             <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
//               Email Address
//             </label>
//             <input
//               id="email"
//               type="email"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               required
//               className="input-field"
//               placeholder="Enter your email"
//             />
//           </div>

//           <div>
//             <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
//               Password
//             </label>
//             <input
//               id="password"
//               type="password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               required
//               className="input-field"
//               placeholder="Enter your password"
//             />
//           </div>

//           <button
//             type="submit"
//             disabled={isLoading}
//             className="w-full btn-primary py-3"
//           >
//             {isLoading ? <LoadingSpinner size="sm" /> : 'Sign In'}
//           </button>
//         </form>

//         <div className="mt-6 text-center text-sm text-gray-600">
//           <p>Demo Credentials:</p>
//           <p className="mt-2 space-y-1">
//             <span className="block">admin@scf.com / password</span>
//             <span className="block">rm@scf.com / password</span>
//             <span className="block">credit@scf.com / password</span>
//           </p>
//         </div>
//       </div>
//     </div>
//   )
// }
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import LoadingSpinner from '../../components/LoadingSpinner'
import { toast } from 'react-toastify'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import 'react-toastify/dist/ReactToastify.css'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { login, isLoading } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await login(email, password)
      toast.success('Welcome back!')
    } catch (err) {
      toast.error(err || 'Login failed. Please check your credentials.')
    }
  }

  return (
    <>


      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          
          {/* Logo */}
          <div className="flex items-center gap-2 mb-10 justify-center">
<img src="/logos/FinTree-Logo.jpg" alt="SCF Logo" className="w-8 h-8 rounded-lg object-contain" />
            <span className="text-gray-900 font-semibold text-sm">
              Supply Chain Finance
            </span>
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Sign in
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Enter your credentials to access your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full px-3.5 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-900 transition"
                >
                  Forgot password?
                </button>
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition"
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 mt-1"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : 'Sign in'}
            </button>

          </form>
        </div>
      </div>
    </>
  )
}

export default Login