"use client";
import React, { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import jsQR from "jsqr";
import { useRouter } from "next/navigation";
import { apiClient } from "../../config/api";

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
        setTimeout(() => {
          router.push(`/inventory/${res.data.id}`);
        }, 1000);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          // Automatically redirect to add item page with QR code
          router.push(`/inventory/add?qr=${encodeURIComponent(scanned)}`);
        } else if (err.response?.status === 401) {
          setError("Authentication failed. Please log in again.");
          localStorage.removeItem("token");
          router.push("/login");
        } else {
          setError("Error fetching item: " + (err.response?.data?.message || err.message));
        }
      })
      .finally(() => setLoading(false));
  }, [scanned, router]);

  const renderScannerContent = () => {
    if (cameraAvailable === null) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          color: '#666'
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
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '500px' }}>
          <div style={{
            width: '100%',
            padding: '2rem',
            borderRadius: '16px',
            border: '2px dashed #d1d5db',
            backgroundColor: '#f8f9fb',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem'
          }}>
            <div style={{ 
              textAlign: 'center', 
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <svg style={{ width: '3rem', height: '3rem', color: '#6b7280' }} stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ width: '100%', maxWidth: '400px' }}>
                <input
                  type="text"
                  value={manualQrCode}
                  onChange={(e) => setManualQrCode(e.target.value)}
                  placeholder="Enter QR code manually..."
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: '400',
                    color: '#222',
                    backgroundColor: '#fff',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#182848';
                    e.target.style.boxShadow = '0 0 0 3px rgba(24, 40, 72, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
                />
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '400px' }}>
            <button
              onClick={handleManualSubmit}
              disabled={!manualQrCode.trim()}
              style={{
                flex: 1,
                padding: '12px 24px',
                backgroundColor: manualQrCode.trim() ? '#182848' : '#9ca3af',
                color: '#fff',
                borderRadius: '12px',
                border: 'none',
                cursor: manualQrCode.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: '600',
                fontSize: '15px',
                transition: 'all 0.2s',
                boxShadow: manualQrCode.trim() ? '0 2px 8px rgba(24, 40, 72, 0.2)' : 'none'
              }}
              onMouseOver={(e) => {
                if (manualQrCode.trim()) {
                  e.currentTarget.style.filter = 'brightness(0.9)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.filter = 'brightness(1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Submit
            </button>
            <button
              onClick={handleManualCancel}
              style={{
                flex: 1,
                padding: '12px 24px',
                backgroundColor: '#b91c1c',
                color: '#fff',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: '600',
                fontSize: '15px',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(185, 28, 28, 0.2)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.filter = 'brightness(0.9)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.filter = 'brightness(1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    if (cameraAvailable && !showFileUpload) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: '400px',
            height: '400px',
            borderRadius: '20px',
            border: '5px solid #182848',
            boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fff',
            marginTop: '3rem',
            marginBottom: '1rem',
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
                borderRadius: '16px',
              }}
            />
          </div>
          <div style={{ marginTop: '0', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowFileUpload(true)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#182848',
                color: '#fff',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: '500',
                transition: 'filter 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(0.75)'}
              onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
            >
              Upload Image Instead
            </button>
            <button
              onClick={handleManualInput}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#b91c1c',
                color: '#fff',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: '500',
                transition: 'filter 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(0.75)'}
              onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
            >
              Enter Manually
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: '320px',
          height: '320px',
          borderRadius: '15px',
          border: '4px dashed #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6'
        }}>
          <div style={{ textAlign: 'center' }}>
            <svg style={{ margin: '0 auto', width: '3rem', height: '3rem', color: '#666' }} stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>Upload QR Code Image</p>
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#182848',
              color: '#fff',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '500',
              transition: 'filter 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(0.75)'}
            onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
          >
            Choose File
          </button>
          {cameraAvailable && (
            <button
              onClick={() => setShowFileUpload(false)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#182848',
                color: '#fff',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: '500',
                transition: 'filter 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(0.75)'}
              onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
            >
              Use Camera
            </button>
          )}
          <button
            onClick={handleManualInput}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#b91c1c',
              color: '#fff',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '500',
              transition: 'filter 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(0.75)'}
            onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
          >
            Enter Manually
          </button>
        </div>
      </div>
    );
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
        fontFamily: 'Poppins, sans-serif'
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
      fontFamily: 'Poppins, sans-serif'
    }}>
      {/* Header Card */}
      <div style={{
        background: 'linear-gradient(90deg, #b91c1c 60%, #ef4444 100%)',
        borderRadius: '15px 15px 0 0',
        padding: '25px 0 10px 15px',
        height: '120px',
        marginBottom: '15px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff'
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>QR Scanner</h1>
        <p style={{ margin: '8px 0 0 0', opacity: 0.9, textAlign: 'center' }}>
          {cameraAvailable === false 
            ? "Camera not available - Upload QR code image" 
            : "Scan QR codes to view or add items"}
        </p>
      </div>

      {/* Scanner Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {renderScannerContent()}
        
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
            maxWidth: '500px'
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
            maxWidth: '500px'
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
            maxWidth: '500px'
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
            maxWidth: '500px'
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
          div[style] {
            max-width: 98vw !important;
            padding-left: 4vw !important;
            padding-right: 4vw !important;
          }
        }
      `}</style>
    </div>
  );
} 