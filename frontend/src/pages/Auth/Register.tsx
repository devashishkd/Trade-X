import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../services/apiClient';
import { Eye, EyeOff, UserPlus } from 'lucide-react';

export const Register: React.FC = () => {
  const [username,  setUsername]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const login    = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post('/auth/register', { username, email, password });
      if (data.success && data.data) {
        login(data.data.user, data.data.token);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Registration failed. Try a different email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-card-header">
        <h2 className="auth-card-title">Create account</h2>
        <p className="auth-card-subtitle">Start trading on Trade-X today</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        {error && (
          <div className="auth-error" role="alert">{error}</div>
        )}

        {/* Username */}
        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-username">Username</label>
          <input
            id="reg-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="auth-input"
            placeholder="trader123"
            required
            minLength={3}
            autoComplete="username"
          />
        </div>

        {/* Email */}
        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        {/* Password */}
        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-password">
            Password
            <span className="auth-label-hint">min. 6 characters</span>
          </label>
          <div className="auth-input-wrapper">
            <input
              id="reg-password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input auth-input--password"
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="auth-eye-btn"
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Password strength indicator */}
          {password.length > 0 && (
            <div className="auth-strength-bar">
              <div
                className="auth-strength-fill"
                style={{
                  width: `${Math.min((password.length / 12) * 100, 100)}%`,
                  background: password.length < 6 ? '#ef4444' : password.length < 10 ? '#f59e0b' : '#10b981',
                }}
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          id="register-submit"
          disabled={isLoading}
          className="auth-submit-btn"
        >
          {isLoading ? (
            <span className="auth-btn-spinner" />
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              Create Account
            </>
          )}
        </button>
      </form>

      <p className="auth-switch-text">
        Already have an account?{' '}
        <Link to="/login" className="auth-switch-link">Sign in</Link>
      </p>
    </div>
  );
};
