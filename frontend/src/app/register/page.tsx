"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../config/api";
import styles from "./page.module.css";
import { Eye, EyeOff, ArrowLeft, UserPlus, User } from "lucide-react";
import { FaTimes, FaSave } from "react-icons/fa";
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
    <div className={styles.registerPageWrapper}>
      <div className={styles.detailContainer}>
        {/* Header Row - Matching Item Detail */}
        <div className={styles.headerRow}>
          <div>
            <h3 className={styles.itemDetailTitle}>Register New User</h3>
            <div className={styles.itemDetailTitle2}>
              Create a new user account
            </div>
          </div>
          <div className={styles.topButtonRow}>
            <button
              onClick={() => router.push("/profile")}
              className={styles.backButtonHeader}
            >
              <ArrowLeft size={16} style={{ marginRight: 6 }} />
              Back
            </button>
          </div>
        </div>

        {/* Two Column Layout - Matching Item Detail */}
        <div className={styles.row}>
          {/* Left Column - Placeholder */}
          <div className={styles.column1}>
            <div className={styles.column1_1}>
              <div className={styles.frame}>
                <div className={styles.topImageBox}>
                  <User size={72} strokeWidth={1.2} color="#820000" />
                </div>
              </div>
              <div>
                <div className={styles.articleTitle}>New User</div>
                <div className={styles.centeredSubtitle}>Registration</div>
              </div>
            </div>
            <div className={styles.registerActionButtonsLeft}>
              <button
                type="submit"
                form="register-form"
                disabled={submitting}
                className={styles.registerSaveBtn}
              >
                {submitting ? (
                  <>
                    <svg className={styles.submitButtonSpinner} fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <FaSave style={{ marginLeft: 8, marginRight: 8 }} />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} style={{ marginRight: 6 }} />
                    Register User
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className={styles.registerCancelBtn}
              >
                <FaTimes style={{ marginRight: 6 }} />
                Cancel
              </button>
            </div>
          </div>
          {/* Right Column - Form Fields */}
          <div className={styles.column2}>
            <div className={styles.midNav}>
              <button className={`${styles.tabBtn} ${styles.tab1BtnActive}`}>
                User Information
              </button>
            </div>
            <div className={styles.middleSection}>
              <div className={styles.infoCard}>
                <div className={styles.infoCardContent}>
                  <form id="register-form" onSubmit={handleSubmit}>
                    {error && (
                      <div className={styles.errorContainer} style={{marginBottom: '16px', padding: '0 14px'}}>
                        <div className={styles.errorContent}>
                          <svg className={styles.errorIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className={styles.errorText}>{error}</span>
                        </div>
                      </div>
                    )}
                    <div className={styles.recContainer}>
                      <div className={styles.grayRect}>
                        <span className={styles.label}>Username</span>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={e => setFormData({ ...formData, username: e.target.value })}
                          placeholder="Enter username"
                          required
                          style={getInputStyle('username')}
                        />
                      </div>
                      {!fieldValidation.username && (
                        <div style={{padding: '0 14px', color: '#ef4444', fontSize: '0.875rem'}}>Username is required</div>
                      )}
                      <div className={styles.grayRect}>
                        <span className={styles.label}>Full Name</span>
                        <input
                          type="text"
                          value={formData.full_name}
                          onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                          placeholder="Enter full name"
                          required
                          style={getInputStyle('full_name')}
                        />
                      </div>
                      {!fieldValidation.full_name && (
                        <div style={{padding: '0 14px', color: '#ef4444', fontSize: '0.875rem'}}>Full name is required</div>
                      )}
                      <div className={styles.grayRect}>
                        <span className={styles.label}>Email</span>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                          placeholder="Enter email address"
                          required
                          style={getInputStyle('email')}
                        />
                      </div>
                      {!fieldValidation.email && (
                        <div style={{padding: '0 14px', color: '#ef4444', fontSize: '0.875rem'}}>Please enter a valid email address</div>
                      )}
                      <div className={styles.grayRect}>
                        <span className={styles.label}>Company Name</span>
                        <input
                          type="text"
                          value={formData.company_name}
                          onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                          placeholder="e.g., DTC"
                          required
                          style={getInputStyle('company_name')}
                        />
                      </div>
                      {!fieldValidation.company_name && (
                        <div style={{padding: '0 14px', color: '#ef4444', fontSize: '0.875rem'}}>Company name is required</div>
                      )}
                      <div className={styles.grayRect}>
                        <span className={styles.label}>
                          Password 
                          <span style={{ color: passwordStrength.color, marginLeft: '8px', fontSize: '0.875rem' }}>
                            {passwordStrength.label}
                          </span>
                        </span>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', width: '100%'}}>
                          <input
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={e => {
                              const newPassword = e.target.value;
                              setFormData({ ...formData, password: newPassword });
                              validatePassword(newPassword);
                            }}
                            placeholder="Enter password"
                            required
                            style={{...getPasswordInputStyle(), flex: 1}}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{background: 'none', border: 'none', cursor: 'pointer', padding: '4px'}}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div className={styles.grayRect}>
                        <span className={styles.label}>Confirm Password</span>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', width: '100%'}}>
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={formData.confirmPassword}
                            onChange={e => {
                              const newConfirmPassword = e.target.value;
                              setFormData({ ...formData, confirmPassword: newConfirmPassword });
                              validateConfirmPassword(newConfirmPassword);
                            }}
                            placeholder="Confirm password"
                            required
                            style={{...getConfirmPasswordInputStyle(), flex: 1}}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            style={{background: 'none', border: 'none', cursor: 'pointer', padding: '4px'}}
                          >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
