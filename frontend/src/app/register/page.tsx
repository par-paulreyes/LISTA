"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../config/api";
import styles from "./page.module.css";
import { X, UserPlus, Eye, EyeOff } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";

interface FormData {
  username: string;
  full_name: string;
  email: string;
  company_name: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const [formData, setFormData] = useState<FormData>({
    username: "",
    full_name: "",
    email: "",
    company_name: "",
    password: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValid, setPasswordValid] = useState(true);
  const [confirmPasswordValid, setConfirmPasswordValid] = useState(true);
  const [fieldValidation, setFieldValidation] = useState({
    username: true,
    full_name: true,
    email: true,
    company_name: true,
    password: true,
    confirmPassword: true
  });
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  // Password strength calculation
  const calculatePasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: "", color: "" };
    
    let score = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    score += checks.length ? 1 : 0;
    score += checks.lowercase ? 1 : 0;
    score += checks.uppercase ? 1 : 0;
    score += checks.numbers ? 1 : 0;
    score += checks.special ? 1 : 0;
    
    if (score <= 1) return { strength: score, label: "Very Weak", color: "#dc2626" };
    if (score <= 2) return { strength: score, label: "Weak", color: "#ea580c" };
    if (score <= 3) return { strength: score, label: "Fair", color: "#d97706" };
    if (score <= 4) return { strength: score, label: "Good", color: "#059669" };
    return { strength: score, label: "Very Strong", color: "#16a34a" };
  };

  const passwordStrength = calculatePasswordStrength(formData.password);

  // Password validation
  const validatePassword = (password: string) => {
    const isValid = password.length >= 6;
    setPasswordValid(isValid);
    return isValid;
  };

  const validateConfirmPassword = (confirmPassword: string) => {
    const isValid = confirmPassword === formData.password;
    setConfirmPasswordValid(isValid);
    return isValid;
  };

  // Get input style for other fields
  const getInputStyle = (fieldName: string) => {
    if (!fieldValidation[fieldName as keyof typeof fieldValidation]) {
      return { borderColor: '#ef4444', borderWidth: '2px' };
    }
    return {};
  };

  // Validate all fields
  const validateAllFields = () => {
    const newValidation = {
      username: formData.username.trim() !== '',
      full_name: formData.full_name.trim() !== '',
      email: formData.email.trim() !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email),
      company_name: formData.company_name.trim() !== '',
      password: formData.password.length >= 6,
      confirmPassword: formData.confirmPassword === formData.password && formData.confirmPassword !== ''
    };
    
    setFieldValidation(newValidation);
    return Object.values(newValidation).every(Boolean);
  };

  // Get input border color based on strength and validation
  const getPasswordInputStyle = () => {
    if (!formData.password) return {};
    if (!passwordValid) return { borderColor: '#ef4444', borderWidth: '2px' };
    if (passwordStrength.strength <= 1) return { borderColor: '#dc2626' };
    if (passwordStrength.strength <= 2) return { borderColor: '#ea580c' };
    if (passwordStrength.strength <= 3) return { borderColor: '#d97706' };
    if (passwordStrength.strength <= 4) return { borderColor: '#059669' };
    return { borderColor: '#16a34a' };
  };

  const getConfirmPasswordInputStyle = () => {
    if (!formData.confirmPassword) return {};
    if (!confirmPasswordValid) return { borderColor: '#ef4444', borderWidth: '2px' };
    return { borderColor: '#16a34a' };
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    checkAuth();
  }, [mounted]);

  const checkAuth = async () => {
    try {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

      const response = await apiClient.get("/users/profile");

      if (response.data) {
        const userData = response.data;
        setUser(userData);
        if (userData.role !== "admin") {
          setTimeout(() => router.push("/"), 2000);
        }
      } else {
        router.push("/login");
      }
    } catch (error) {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields first
    if (!validateAllFields()) {
      setError("Please fill in all required fields correctly");
      showError("Validation Error", "Please fill in all required fields correctly");
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      showError("Validation Error", "Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      showError("Validation Error", "Password must be at least 6 characters long");
      return;
    }

    setSubmitting(true);
    setError("");
    
    try {
      const response = await apiClient.post("/auth/register", {
        username: formData.username,
        full_name: formData.full_name,
        email: formData.email,
        company_name: formData.company_name,
        password: formData.password
      });

      if (response.data) {
        showSuccess("User Created", "User has been created successfully!");
        setFormData({
          username: "",
          full_name: "",
          email: "",
          company_name: "",
          password: "",
          confirmPassword: ""
        });
        // Reset validation state
        setFieldValidation({
          username: true,
          full_name: true,
          email: true,
          company_name: true,
          password: true,
          confirmPassword: true
        });
        router.push("/login"); // Redirect to login after successful registration
      } else {
        setError("Failed to create user");
        showError("Creation Failed", "Failed to create user");
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Network error. Please try again.";
      setError(errorMessage);
      showError("Registration Failed", errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingCard}>
          <div className={styles.loadingIcon}>
            <svg className={styles.spinner} fill="none" viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className={styles.loadingTitle}>Loading...</h2>
          <p className={styles.loadingText}>Please wait...</p>
        </div>
      </div>
    );
  }

  if (mounted && loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingCard}>
          <div className={styles.loadingIcon}>
            <svg className={styles.spinner} fill="none" viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className={styles.loadingTitle}>Verifying Permissions</h2>
          <p className={styles.loadingText}>Please wait while we check your access...</p>
        </div>
      </div>
    );
  }

  // Show access denied message if not admin
  if (mounted && user?.role !== 'admin') {
    return (
      <div className={styles.accessDeniedContainer}>
        <div className={styles.accessDeniedCard}>
          <div className={styles.accessDeniedIcon}>
            <svg className={styles.accessDeniedIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className={styles.accessDeniedTitle}>Access Denied</h2>
          <p className={styles.accessDeniedText}>Admin privileges required to access this page.</p>
          <p className={styles.accessDeniedSubtext}>Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel? All entered data will be lost.")) {
      router.push("/profile");
    }
  };

  return (
    <div className={styles.container}>
      {/* Blue box at the top */}
      <div className={styles.dashboardCard} style={{ background: 'var(--bg-navbar-card)', color: 'var(--text-primary)', minHeight: 80, marginBottom: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          {/* Left: Register New User title */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className={styles.dashboardTitle} style={{ color: 'var(--text-primary)', marginBottom: 0 }}>Register New User</div>
          </div>
          {/* Right: Inventory System */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          </div>
        </div>
      </div>
      <div className={styles.formContainer}>
        {/* Registration Form */}
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
          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Username</label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  name="username"
                  className={`${styles.input} ${styles.inputNarrow}`}
                  placeholder="Enter username"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  required
                  style={getInputStyle('username')}
                />
                {!fieldValidation.username && (
                  <span className={styles.validationError}>Username is required</span>
                )}
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Full Name</label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  name="full_name"
                  className={`${styles.input} ${styles.inputNarrow}`}
                  placeholder="Enter full name"
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  style={getInputStyle('full_name')}
                />
                {!fieldValidation.full_name && (
                  <span className={styles.validationError}>Full name is required</span>
                )}
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Email</label>
              <div className={styles.inputWrapper}>
                <input
                  type="email"
                  name="email"
                  className={`${styles.input} ${styles.inputNarrow}`}
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required
                  style={getInputStyle('email')}
                />
                {!fieldValidation.email && (
                  <span className={styles.validationError}>Please enter a valid email address</span>
                )}
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Company Name</label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  name="company_name"
                  className={`${styles.input} ${styles.inputNarrow}`}
                  placeholder="e.g., DTC"
                  value={formData.company_name}
                  onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                  required
                  style={getInputStyle('company_name')}
                />
                {!fieldValidation.company_name && (
                  <span className={styles.validationError}>Company name is required</span>
                )}
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Password 
                <span className={styles.passwordStrengthLabel} style={{ color: passwordStrength.color, marginLeft: '8px' }}>
                  {passwordStrength.label}
                </span>
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className={`${styles.input} ${styles.inputNarrow}`}
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={e => {
                    const newPassword = e.target.value;
                    setFormData({ ...formData, password: newPassword });
                    validatePassword(newPassword);
                  }}
                  required
                  style={getPasswordInputStyle()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.passwordToggleBtn}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Confirm Password</label>
              <div className={styles.inputWrapper}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  className={`${styles.input} ${styles.inputNarrow}`}
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={e => {
                    const newConfirmPassword = e.target.value;
                    setFormData({ ...formData, confirmPassword: newConfirmPassword });
                    validateConfirmPassword(newConfirmPassword);
                  }}
                  required
                  style={getConfirmPasswordInputStyle()}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={styles.passwordToggleBtn}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>
          {/* Submit/Cancel Button Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32, marginRight: 0, paddingBottom: 16 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                fontWeight: 600,
                fontSize: 15,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? (
                <>
                  <svg className={styles.submitButtonSpinner} fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <UserPlus size={18} style={{ marginLeft: 8, marginRight: 8 }} />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus size={18} style={{ marginRight: 8 }} />
                  Create
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      {/* Footer */}
      <div className={styles.footer}>
        <p className={styles.footerText}>
          Only administrators can create new user accounts
        </p>
        <p className={styles.footerCopyright}>
          © 2025 DTC-IMS. All rights reserved.
        </p>
      </div>
    </div>
  );
} 