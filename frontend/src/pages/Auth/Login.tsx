import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../services/apiClient';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export const Login: React.FC = () => {
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const login    = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      if (data.success && data.data) {
        login(data.data.user, data.data.token);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-card-header">
        <h2 className="auth-card-title">Welcome back</h2>
        <p className="auth-card-subtitle">Sign in to your trading account</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        {error && (
          <div className="auth-error" role="alert">{error}</div>
        )}

        {/* Email */}
        <div className="auth-field">
          <label className="auth-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            placeholder="trader@example.com"
            required
            autoComplete="email"
          />
        </div>

        {/* Password */}
        <div className="auth-field">
          <label className="auth-label" htmlFor="login-password">Password</label>
          <div className="auth-input-wrapper">
            <input
              id="login-password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input auth-input--password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
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
        </div>

        <button
          type="submit"
          id="login-submit"
          disabled={isLoading}
          className="auth-submit-btn"
        >
          {isLoading ? (
            <span className="auth-btn-spinner" />
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              Sign In
            </>
          )}
        </button>
      </form>

      <p className="auth-switch-text">
        Don't have an account?{' '}
        <Link to="/register" className="auth-switch-link">Create one</Link>
      </p>
    </div>
  );
};
