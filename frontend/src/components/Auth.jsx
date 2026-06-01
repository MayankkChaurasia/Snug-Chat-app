import { useState } from 'react'
import { API_URL } from '../config'
import './Auth.css'

const Auth = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const endpoint = isLogin ? '/api/login' : '/api/register'
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await response.json()
      if (response.ok) {
        onLogin({ userId: data.userId, username: data.username, avatar: data.avatar || '' })
      } else {
        setError(data.error)
      }
    } catch {
      setError('Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getStrength = (pwd) => {
    if (pwd.length > 8 && /\d/.test(pwd) && /[A-Z]/.test(pwd)) return 'Strong'
    if (pwd.length > 5) return 'Medium'
    return 'Weak'
  }

  return (
    <div className="auth-container">
      <div className="auth-card glass">
        <div className="auth-header">
          <h1>Snug</h1>
          <p>Real-time chat application</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="auth-input"
            />
          </div>
          <div className="input-group password-group">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
              required
              className="auth-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="toggle-password"
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
          {capsLock && <p className="caps-warning">Caps Lock is ON</p>}
          {password && <p className={`password-strength ${getStrength(password).toLowerCase()}`}>{getStrength(password)}</p>}
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading} className="auth-button">
            {loading ? <span className="loader"></span> : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>
        <div className="auth-toggle">
          <span>{isLogin ? "Don't have an account?" : "Already have an account?"}</span>
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="toggle-button">
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Auth
