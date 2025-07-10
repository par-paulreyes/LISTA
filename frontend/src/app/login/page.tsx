"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from '../../config/api';
import Image from "next/image";
import styles from './page.module.css';
import { useToast } from '../../contexts/ToastContext';

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password
      });

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        showSuccess("Login Successful", "Welcome back! Redirecting to dashboard...");
        router.push('/');
      } else {
        setError('Login failed - no token received');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Network error. Please try again.';
      setError(errorMessage);
      showError("Login Failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  useEffect(() => {
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

  return (
    <div className={styles.container}>
      {/* Unified Login Box with Top Design and Form */}
      <div className={styles.loginBox}>
        {/* Top with background, logo, and text */}
        <div className={styles.topSection}>
          <img src="/dtc-bg.png" alt="DTC Background" className={styles.backgroundImage} />
          <div className={styles.logoContainer}>
            <Image 
              src="/dtc-logo.png" 
              alt="DTC Logo" 
              fill
              sizes="160px"
              className={styles.logoImage}
              priority 
            />
          </div>
          <div className={styles.title}>
            DIGITAL TRANSFORMATION CENTER
          </div>
        </div>
        {/* Login Form Section (with semi-transparent overlay for readability) */}
        <div className={styles.formSection}>
          <div className={styles.formContainer}>
            <div className={styles.header}>
              <h2 className={styles.welcomeText}>Welcome back!</h2>
              <div className={styles.subtitle}>
                Login to your account to get started.
              </div>
            </div>
            <form onSubmit={handleSubmit} className={styles.form}>
              {error && (
                <div className={styles.errorContainer}>
                  <div className={styles.errorContent}>
                    <svg className={styles.errorIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className={styles.errorText}>{error}</span>
                  </div>
                </div>
              )}
              <div className={styles.inputGroup}>
                <label className={styles.label}>Username</label>
                <div className={styles.inputContainer}>
                  <span className={styles.icon}>
                    {/* User Icon */}
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Enter your username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Password</label>
                <div className={styles.inputContainer}>
                  <span className={styles.icon}>
                    {/* Lock Icon */}
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    className={styles.input}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={togglePasswordVisibility}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className={styles.submitButton}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
            <div className={styles.forgotPassword}>
              <span className={styles.forgotText}>Forgot password? </span>
              <a href="#" className={styles.forgotLink}>Click here</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}