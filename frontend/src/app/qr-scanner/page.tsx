"use client";
import React, { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import jsQR from "jsqr";
import { useRouter } from "next/navigation";
import { apiClient } from "../../config/api";
import { useToast } from "../../contexts/ToastContext";
import styles from "../dashboard.module.css";
import { CaseUpper, Camera, Upload, QrCode } from "lucide-react";


export default function QRScannerPage() {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualQrCode, setManualQrCode] = useState("");
  const [mounted, setMounted] = useState(false);
  const [parsedQR, setParsedQR] = useState<{ company: string; tag: string; id: string } | null>(null);
  const router = useRouter();
  const { showSuccess, showError, showInfo } = useToast();


  useEffect(() => {
    setMounted(true);
  }, []);


  // Check authentication on page load
  useEffect(() => {
    if (!mounted) return;
   
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, [router, mounted]);


  // Check camera availability
  useEffect(() => {
    const checkCameraAvailability = async () => {
      try {
        // Check if we're on HTTPS or localhost (required for camera access)
        const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
       
        if (!isSecure) {
          setCameraAvailable(false);
          setShowFileUpload(true);
          setError("Camera access requires HTTPS. Please use file upload or access via localhost.");
          return;
        }


        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        stream.getTracks().forEach(track => track.stop());
        setCameraAvailable(true);
        setError(""); // Clear any previous errors
      } catch (err) {
        console.log("Camera not available:", err);
        setCameraAvailable(false);
        setShowFileUpload(true);
       
        // Provide specific error messages based on the error type
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            setError("Camera access denied. Please allow camera permissions or use file upload.");
          } else if (err.name === 'NotFoundError') {
            setError("No camera found. Please use file upload instead.");
          } else if (err.name === 'NotSupportedError') {
            setError("Camera not supported. Please use file upload instead.");
          } else {
            setError("Camera not available. Please use file upload instead.");
          }
        } else {
          setError("Camera not available. Please use file upload instead.");
        }
      }
    };
   
    checkCameraAvailability();
  }, []);


  const capture = useCallback(() => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    try {
      const base64 = imageSrc.split(",")[1];
      const binary = atob(base64);
      const len = binary.length;
      const buffer = new Uint8ClampedArray(len);
      for (let i = 0; i < len; i++) buffer[i] = binary.charCodeAt(i);
      // Create ImageData
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const img = new window.Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, img.width, img.height);
        if (code) setScanned(code.data);
      };
      img.src = imageSrc;
    } catch (e) {
      setError("Camera or decoding error");
    }
  }, []);


  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;


    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
       
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, img.width, img.height);
       
        if (code) {
          setScanned(code.data);
        } else {
          setError("No QR code found in the uploaded image");
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };


  const handleManualInput = () => {
    setShowManualInput(true);
    setShowFileUpload(false);
  };


  const handleManualSubmit = () => {
    if (manualQrCode && manualQrCode.trim()) {
      setScanned(manualQrCode.trim());
      setShowManualInput(false);
      setManualQrCode("");
    }
  };


  const handleManualCancel = () => {
    setShowManualInput(false);
    setManualQrCode("");
  };


  useEffect(() => {
    if (scanned) return;
    if (!cameraAvailable) return;
   
    const interval = setInterval(capture, 1000);
    return () => clearInterval(interval);
  }, [capture, scanned, cameraAvailable]);


  useEffect(() => {
    if (!scanned) return;
    // Parse QR code format: COMPANY-TAG-ID (e.g., ICTCE-PC-00123)
    const qrPattern = /^([A-Z]+)-([A-Z]+)-(\d+)$/i;
    let match = scanned.match(qrPattern);
    if (!match) {
      // Try to parse without dashes (e.g., ICTCEPC00123)
      const altPattern = /^([A-Z]+)(PC|PR|MON|TP|MS|KEY|UPS|UTLY|TOOL|SPLY)(\d+)$/i;
      match = scanned.match(altPattern);
      if (match) {
        setParsedQR({ company: match[1], tag: match[2], id: match[3] });
      } else {
        setParsedQR(null);
      }
    } else {
      setParsedQR({ company: match[1], tag: match[2], id: match[3] });
    }
  }, [scanned]);


  useEffect(() => {
    if (!scanned) return;
    setLoading(true);
    setError("");
    setSuccess(false);
    const token = localStorage.getItem("token");
   
    if (!token) {
      setError("Please log in to scan QR codes");
      setLoading(false);
      router.push("/login");
      return;
    }
   
    apiClient
      .get(`/items/qr/${encodeURIComponent(scanned)}`)
      .then((res) => {
        // Show success message briefly before redirecting
        setLoading(false);
        setError("");
        setSuccess(true);
        showSuccess("Item Found", "Redirecting to item details...");
        setTimeout(() => {
          router.push(`/inventory/${res.data.id}`);
        }, 1000);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          // Automatically redirect to add item page with QR code
          showInfo("Item Not Found", "Redirecting to add new item...");
          router.push(`/inventory/add?qr=${encodeURIComponent(scanned)}`);
        } else if (err.response?.status === 401) {
          const errorMessage = "Authentication failed. Please log in again.";
          setError(errorMessage);
          showError("Authentication Failed", errorMessage);
          localStorage.removeItem("token");
          router.push("/login");
        } else {
          const errorMessage = "Error fetching item: " + (err.response?.data?.message || err.message);
          setError(errorMessage);
          showError("Fetch Error", errorMessage);
        }
      })
      .finally(() => setLoading(false));
  }, [scanned, router]);


  const renderScannerContent = () => {
    if (cameraAvailable && !showFileUpload && !showManualInput) {
      // Webcam in its own box, buttons below, no dashed container at all
      return (
        <>
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              width: 400,
              height: 400,
              borderRadius: 16,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '32px 0 0 0',
              overflow: 'hidden',
              position: 'relative',
              border: '2px dashed rgb(183, 184, 185)', // solid border only
              boxShadow: 'none',
            }}>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/png"
                videoConstraints={{ facingMode: "environment" }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 16,
                  background: '#fff',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: 32 }}>
              <button
                onClick={handleManualInput}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '1rem 1.2rem 1rem',
                  backgroundColor: '#c9184a',
                  color: '#fff',
                  borderRadius: 12,
                  border: 'none',
                  fontFamily: 'Host Grotesk, sans-serif',
                  fontWeight: 500,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  minWidth: 120,
                  boxShadow: 'none',
                  transition: 'background 0.2s',
                }}
              >
                <QrCode size={20} style={{ marginRight: 8 }} />
                Enter Manually
              </button>
              <button
                onClick={() => setShowFileUpload(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0.5rem 1.2rem',
                  backgroundColor: '#c9184a',
                  color: '#fff',
                  borderRadius: 12,
                  border: 'none',
                  fontFamily: 'Host Grotesk, sans-serif',
                  fontWeight: 500,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  minWidth: 120,
                  boxShadow: 'none',
                  transition: 'background 0.2s',
                }}
              >
                <Upload size={20} style={{ marginRight: 8 }} />
                Upload Image
              </button>
            </div>
          </div>
        </>
      );
    }


    if (cameraAvailable === null) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          color: '#666',
          width: '100%',
          height: '320px',
        }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            border: '2px solid #b91c1c',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ marginLeft: '0.5rem' }}>Checking camera availability...</span>
        </div>
      );
    }


    if (showManualInput) {
      // Match the wireframe for manual input
      return (
        <div style={{
          width: 360,
          height:360,
          margin: '60px auto 0 auto',
          border: '1.5px dashed #b7b8b9',
          borderRadius: 12,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px 28px 24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 18 }}>
            <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#b7b8b9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="8" y="8" width="2" height="2" rx="0.5"/>
              <rect x="14" y="8" width="2" height="2" rx="0.5"/>
              <rect x="8" y="14" width="2" height="2" rx="0.5"/>
              <rect x="14" y="14" width="2" height="2" rx="0.5"/>
            </svg>
          </div>
          <input
            type="text"
            value={manualQrCode}
            onChange={(e) => setManualQrCode(e.target.value)}
            placeholder="Enter QR code manually..."
            style={{
              width: '100%',
              padding: '10px 16px',
              border: '1.5px solid #cbd5e1',
              borderRadius: 8,
              fontSize: '15px',
              fontFamily: 'Host Grotesk, sans-serif',
              fontWeight: 400,
              color: '#222',
              backgroundColor: '#fff',
              outline: 'none',
              marginBottom: 18,
              marginTop: 0,
              boxSizing: 'border-box',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={e => {
              e.target.style.borderColor = '#2563eb';
              e.target.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.10)';
            }}
            onBlur={e => {
              e.target.style.borderColor = '#cbd5e1';
              e.target.style.boxShadow = 'none';
            }}
            onKeyPress={e => e.key === 'Enter' && handleManualSubmit()}
          />
          <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 0 }}>
            <button
              onClick={handleManualSubmit}
              disabled={!manualQrCode.trim()}
              style={{
                flex: 1,
                padding: '9px 0',
                backgroundColor: manualQrCode.trim() ? '#c9184a' : '#9ca3af',
                color: '#fff',
                borderRadius: 6,
                border: 'none',
                cursor: manualQrCode.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'Host Grotesk, sans-serif',
                fontWeight: 500,
                fontSize: '0.97rem',
                transition: 'all 0.2s',
              }}
            >
              Submit
            </button>
            <button
              onClick={handleManualCancel}
              style={{
                flex: 1,
                padding: '9px 0',
                backgroundColor: '#f3f4f6',
                color: 'var(--neutral-gray-800)',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                cursor: 'pointer',
                fontFamily: 'Host Grotesk, sans-serif',
                fontWeight: 500,
                fontSize: '0.97rem',
                transition: 'all 0.2s',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }


    // Unified dashed box for file upload state
    if ((!cameraAvailable || showFileUpload) && !showManualInput) {
      return (
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 360,
            height: 320,
            border: '1.5px dashed #b7b8b9',
            borderRadius: 12,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '32px 0 0 0',
          }}>
            <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#b7b8b9" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2"/>
              <circle cx="8.5" cy="12" r="2.5"/>
              <path d="M21 15l-5-5L5 19"/>
            </svg>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24, width: 360 }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 1,
                padding: '9px 0',
                backgroundColor: '#c9184a',
                color: '#fff',
                borderRadius: 6,
                border: 'none',
                fontFamily: 'Host Grotesk, sans-serif',
                fontWeight: 500,
                fontSize: '0.97rem',
                cursor: 'pointer',
                transition: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              Choose File
            </button>
            {cameraAvailable && (
              <button
                onClick={() => setShowFileUpload(false)}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  backgroundColor: '#f3f4f6',
                  color: 'var(--neutral-gray-800)',
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  fontFamily: 'Host Grotesk, sans-serif',
                  fontWeight: 500,
                  fontSize: '0.97rem',
                  cursor: 'pointer',
                  transition: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                Use Camera
              </button>
            )}
            <button
              onClick={() => setShowFileUpload(false)}
              style={{
                flex: 1,
                padding: '9px 0',
                backgroundColor: '#f3f4f6',
                color: 'var(--neutral-gray-800)',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                fontFamily: 'Host Grotesk, sans-serif',
                fontWeight: 500,
                fontSize: '0.97rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Cancel
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
      );
    }
  };


  if (!mounted) {
    return (
      <div style={{
        maxWidth: 700,
        margin: '40px auto 0 auto',
        background: '#fff',
        borderRadius: 24,
        boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
        padding: '32px 32px 40px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
        minHeight: 'calc(100vh - 120px)',
        fontFamily: 'Host Grotesk, sans-serif'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            border: '2px solid #b91c1c',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ marginLeft: '0.5rem', color: '#666' }}>Loading...</span>
        </div>
      </div>
    );
  }


  return (
    <div className={styles['main-container']}>
      {/* Header Card - match dashboard top card */}
      <div className={styles.dashboardCard} style={{ background: 'var(--neutral-gray-200)', color: 'var(--text-primary)', minHeight: 80, marginBottom: 24, transition: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          {/* Left: QR Scanner title */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className={styles.dashboardTitle} style={{ color: 'var(--text-primary)', marginBottom: 0 }}>QR Scanner</div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', opacity: 0.85, marginTop: 2 }}>Scan QR Codes to view or add an item</div>
          </div>
          {/* Right: Cancel button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <button
              onClick={() => router.back()}
              style={{
                background: 'var(--neutral-gray-50)',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '9px 28px',
                fontSize: '0.95rem',
                color: '#444',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'background 0.2s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = '#e5e7eb')}
              onMouseOut={e => (e.currentTarget.style.background = '#f3f4f6')}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>


      {/* Scanner Content Card */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 0 32px 0',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 400,
          margin: '0 auto',
          background: '#fff',
         
          borderRadius: 16,
          minHeight: 320,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}>
          {renderScannerContent()}
        </div>
      </div>


      {/* Error, scanned, loading, success messages (unchanged) */}
      <div style={{ width: '100%', maxWidth: 400, margin: '0 auto', marginBottom: 24 }}>
        {error && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
          }}>
            <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {error}
          </div>
        )}
        {scanned && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '10px',
            color: '#0369a1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '0.5rem',
            width: '100%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span style={{ fontWeight: '600' }}>Scanned QR:</span> {scanned}
            </div>
            {parsedQR ? (
              <div style={{ marginTop: '0.5rem', fontSize: '0.98rem', color: '#0e7490' }}>
                <div><b>Company:</b> {parsedQR.company}</div>
                <div><b>Tag:</b> {parsedQR.tag}</div>
                <div><b>ID:</b> {parsedQR.id}</div>
              </div>
            ) : (
              <div style={{ marginTop: '0.5rem', color: '#b91c1c' }}>
                <b>Unrecognized QR format.</b>
              </div>
            )}
          </div>
        )}
        {loading && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '10px',
            color: '#0369a1',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
          }}>
            <div style={{
              width: '1rem',
              height: '1rem',
              border: '2px solid #0369a1',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            Loading...
          </div>
        )}
        {success && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
          }}>
            <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span style={{ fontWeight: '600' }}>Item found! Redirecting to details...</span>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (max-width: 700px) {
          .container {
            max-width: 98vw !important;
            padding-left: 2vw !important;
            padding-right: 2vw !important;
          }
        }
      `}</style>
    </div>
  );
}

