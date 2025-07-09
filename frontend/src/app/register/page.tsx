"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../config/api";
import styles from "./page.module.css";
import { X, UserPlus } from "lucide-react";
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
  const router = useRouter();
  const { showSuccess, showError } = useToast();

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
      {/* Header Card */}
      <div className={styles.headerCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div>
            <h1 className={styles.headerTitle}>Register New User</h1>
            <p className={styles.headerSubtitle}>Create a new user account for your organization</p>
          </div>
          <button
            onClick={handleCancel}
            className={styles.cancelBtnHeader}
          >
            <X size={18} />
            Cancel
          </button>
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
            <div className={styles.formField}>
              <label className={styles.label}>
                Username
              </label>
              <div className={styles.inputContainer}>
                <div className={styles.inputIcon}>
                  <svg className={styles.inputIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="username"
                  className={styles.input}
                  placeholder="Enter username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>
                Full Name
              </label>
              <div className={styles.inputContainer}>
                <div className={styles.inputIcon}>
                  <svg className={styles.inputIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="full_name"
                  className={styles.input}
                  placeholder="Enter full name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.label}>
                Email
              </label>
              <div className={styles.inputContainer}>
                <div className={styles.inputIcon}>
                  <svg className={styles.inputIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="email"
                  name="email"
                  className={styles.input}
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>
                Company Name
              </label>
              <div className={styles.inputContainer}>
                <div className={styles.inputIcon}>
                  <svg className={styles.inputIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="company_name"
                  className={styles.input}
                  placeholder="e.g., DTC"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.label}>
                Password
              </label>
              <div className={styles.inputContainer}>
                <div className={styles.inputIcon}>
                  <svg className={styles.inputIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  name="password"
                  className={styles.input}
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>
                Confirm Password
              </label>
              <div className={styles.inputContainer}>
                <div className={styles.inputIcon}>
                  <svg className={styles.inputIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  name="confirmPassword"
                  className={styles.input}
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

        <button
          type="submit"
          disabled={submitting}
          className={styles.submitButton}
        >
          {submitting ? (
            <>
              <svg className={styles.submitButtonSpinner} fill="none" viewBox="0 0 24 24">
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <UserPlus size={18} style={{ marginLeft: 8, marginRight: 8 }} />
              Creating User...
            </>
          ) : (
            <>
              <UserPlus size={18} style={{ marginRight: 8 }} />
              Create User Account
            </>
          )}
        </button>
        </form>
      </div>
    {/* Footer */}
    <div className={styles.footer}>
      <p className={styles.footerText}>
        Only administrators can create new user accounts
      </p>
      <p className={styles.footerCopyright}>
        © 2024 DTC-IMS. All rights reserved.
      </p>
    </div>
  </div>
);
} 