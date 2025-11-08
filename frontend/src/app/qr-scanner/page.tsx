"use client";
import React, { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import jsQR from "jsqr";
import { useRouter } from "next/navigation";
import { apiClient } from "../../config/api";
import { useToast } from "../../contexts/ToastContext";
import styles from "../qr-scanner/qr-scanner.module.css";
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

    // Check for valid tag before proceeding
    const tagPattern = /(?:-|^)(PC|PR|MON|TP|MS|KEY|UPS|TAB|PWB|UTLY|TOOL|SPLY)(?:-|\d|$)/i;
    const tagMatch = scanned.match(tagPattern);
    if (!tagMatch) {
      setError("No valid tag detected in QR code. Please scan or enter a QR code with a valid tag (PC, PR, MON, TP, MS, KEY, UPS, TAB, PWB, UTLY, TOOL, SPLY).");
      setLoading(false);
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


  useEffect(() => {
    if (error) {
      showError("Error", error);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      showSuccess("Success", "Item found! Redirecting to details...");
    }
  }, [success]);


  const renderScannerContent = () => {
    if (cameraAvailable && !showFileUpload && !showManualInput) {
      // Webcam in its own box, buttons below, no dashed container at all
      return (
        <>
          <div className={styles.scannerContentHeader}>
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 0 }}>Scanner Interface</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', opacity: 0.85, marginTop: 2 }}>Scan QR Codes to view or add an item</div>
              </div>
            </div>
          </div>
          <div className={styles.cameraBox}>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/png"
              videoConstraints={{ facingMode: "environment" }}
              className={styles.webcam}
            />
          </div>
          <div className={styles.buttonGroup}>
            <button
              onClick={handleManualInput}
              className={styles.qrButtonPrimary}
            >
              <QrCode size={20} style={{ marginRight: 8 }} />
              Enter Manually
            </button>
            <button
              onClick={() => setShowFileUpload(true)}
              className={styles.qrButtonPrimary}
            >
              <Upload size={20} style={{ marginRight: 8 }} />
              Upload Image
            </button>
          </div>
        </>
      );
    }


    if (cameraAvailable === null) {
      return (
        <div className={styles.spinnerContainer}>
          <div className={styles.spinner}></div>
          <span style={{ marginLeft: '0.5rem' }}>Checking camera availability...</span>
        </div>
      );
    }


    if (showManualInput) {
      // Match the wireframe for manual input
      return (
        <div className={styles.manualInputBox}>
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
            placeholder="Enter QR code (COMPANY-TAG-ID)"
            className={styles.manualInput}
            onKeyPress={e => e.key === 'Enter' && handleManualSubmit()}
          />
          
          <div className={styles.buttonGroup} style={{ display: 'flex', gap: 10, width: '100%', marginTop: 0 }}>
            <button
              onClick={handleManualSubmit}
              disabled={!manualQrCode.trim()}
              className={styles.manualSubmitButton}
            >
              Submit
            </button>
            <button
              onClick={handleManualCancel}
              className={styles.manualCancelButton}
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
        <div className={styles.fileUploadBox}>
          <div className={styles.fileUploadIcon}>
            <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#b7b8b9" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2"/>
              <circle cx="8.5" cy="12" r="2.5"/>
              <path d="M21 15l-5-5L5 19"/>
            </svg>
          </div>
          <div className={styles.buttonGroup}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={styles.qrButtonPrimary}
            >
              Choose File
            </button>
            {cameraAvailable && (
              <button
                onClick={() => setShowFileUpload(false)}
                className={styles.qrButtonSecondary}
              >
                Use Camera
              </button>
            )}
            <button
              onClick={() => setShowFileUpload(false)}
              className={styles.qrButtonCancel}
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
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <span style={{ marginLeft: '0.5rem', color: '#666' }}>Loading...</span>
      </div>
    );
  }


  return (
    <div className={styles['main-container']}>
      
      {/* Scanner Content Card */}
      <div className={styles.scannerContentCard}>
        <div className={styles.scannerContentBox}>
          {renderScannerContent()}
        </div>
      </div>


      {/* Error, scanned, loading, success messages (unchanged) */}
      <div className={styles.messageContainer}>
        {loading && (
          <div className={styles.loadingMessage}>
            <div className={styles.spinner}></div>
            Loading...
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

