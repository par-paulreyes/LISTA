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
          <div className={styles.headerRow}>
            <div className={styles.scannerContentHeader}>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 0 }}>Scanner Interface</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', opacity: 0.85, marginTop: 2 }}>Scan QR Code to view or add an item</div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.qrScannerBox}>
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
          </div>
        </>
      );
    }


    if (cameraAvailable === null) {
      return (
        <div className={styles.spinnerContainer}>
          <div className={styles.spinner}></div>
          <span>Checking camera availability...</span>
        </div>
      );
    }


    if (showManualInput) {
      // Match the wireframe for manual input
      return (
        <>
          <div className={styles.headerRow}>
            <div className={styles.scannerContentHeader}>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 0 }}>Manual Input</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', opacity: 0.85, marginTop: 2 }}>Enter QR Codes to view or add an item</div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.qrScannerBox}>
            <div className={styles.manualInputBox}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 18 }}>
                <svg width="70" height="70" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.27112 19.1912C2.27112 17.7036 2.27112 16.961 2.60611 16.4148C2.79332 16.1093 3.05013 15.8525 3.35557 15.6653C3.90063 15.3303 4.64555 15.3303 6.13199 15.3303H7.38109C9.52274 15.3303 10.5924 15.3303 11.2579 15.9957C11.9233 16.6612 11.9233 17.7309 11.9233 19.8725V21.1216C11.9233 22.6092 11.9233 23.3518 11.5883 23.898C11.4011 24.2035 11.1443 24.4603 10.8388 24.6475C10.2938 24.9825 9.54886 24.9825 8.06242 24.9825C5.8322 24.9825 4.71709 24.9825 3.89836 24.4806C3.44021 24.1998 3.05499 23.8145 2.77417 23.3564M24.9821 8.06279C24.9821 9.55036 24.9821 10.293 24.6471 10.8392C24.4599 11.1446 24.2031 11.4015 23.8977 11.5887C23.3526 11.9237 22.6077 11.9237 21.1212 11.9237H19.8721C17.7305 11.9237 16.6608 11.9237 15.9954 11.2582C15.3299 10.5928 15.3299 9.52311 15.3299 7.38146V6.13235C15.3299 4.64478 15.3299 3.90213 15.6649 3.35593C15.8521 3.0505 16.109 2.79369 16.4144 2.60647C16.9595 2.27148 17.7044 2.27148 19.1908 2.27148C21.421 2.27148 22.5361 2.27148 23.356 2.7734C23.8142 3.05422 24.1994 3.43944 24.4802 3.89759" stroke="#820000" stroke-width="1.5" stroke-linecap="round"/>
                  <path d="M21.0759 24.6309V25.334H19.8044V24.6309H21.0759ZM23.2273 25.2666C23.1801 25.2744 23.1323 25.2841 23.0828 25.29L22.8406 25.3125C22.6228 25.3264 22.3709 25.3293 22.0759 25.3311V24.6279C22.3629 24.6264 22.596 24.6239 22.7937 24.6104H22.7947C22.8494 24.6065 22.9008 24.5998 22.949 24.5947L23.2273 25.2666ZM24.8982 24.1572C24.8014 24.3035 24.6899 24.4408 24.5652 24.5654C24.4404 24.6901 24.3031 24.8006 24.157 24.8975L23.8806 24.2295C23.9459 24.1792 24.0096 24.1268 24.0681 24.0684C24.1267 24.0098 24.1799 23.9462 24.2302 23.8809L24.8982 24.1572ZM15.6814 22.0752V24.4824H14.9783V22.0752H15.6814ZM25.3318 22.0752C25.33 22.3713 25.326 22.624 25.3113 22.8418V22.8428C25.3022 22.9794 25.2863 23.1066 25.2664 23.2275L24.5945 22.9492C24.5996 22.901 24.6062 22.8498 24.6101 22.7949V22.7939C24.6237 22.596 24.6271 22.3626 24.6287 22.0752H25.3318ZM25.3337 15.8301V18.8047H24.6306V15.8301H25.3337ZM15.8074 17.0039C15.7734 17.1379 15.7458 17.2917 15.7273 17.4736C15.6911 17.8234 15.6859 18.2522 15.6843 18.8047H14.9812C14.983 18.2467 14.989 17.7867 15.0281 17.4033V17.4023C15.0584 17.1033 15.1091 16.8368 15.196 16.5947L15.8074 17.0039ZM18.8044 15.6836C18.252 15.6854 17.8233 15.6924 17.4744 15.7275C17.292 15.746 17.1379 15.7736 17.0037 15.8076L16.5945 15.1953C16.8362 15.1086 17.1026 15.0577 17.4021 15.0273C17.786 14.989 18.2468 14.9825 18.8044 14.9805V15.6836ZM15.7869 15.7871L15.738 15.7549C15.7435 15.7493 15.7491 15.7438 15.7546 15.7383L15.7869 15.7871ZM21.0759 14.9785V15.6816H19.8044V14.9785H21.0759ZM20.156 6.17773C20.4594 6.17773 20.6475 6.17842 20.7869 6.19336C20.9169 6.20731 20.9453 6.22907 20.95 6.23242L20.9519 6.23438C20.9654 6.24388 20.9783 6.25405 20.99 6.26562L21.0222 6.30371C21.028 6.31237 21.0476 6.3464 21.0603 6.46582C21.0751 6.60542 21.0759 6.79435 21.0759 7.09766C21.0759 7.40046 21.0752 7.5883 21.0603 7.72754C21.0467 7.8546 21.0253 7.88491 21.0212 7.89062L21.0193 7.89355C21.0006 7.92007 20.9772 7.94288 20.9509 7.96191C20.9457 7.96565 20.9163 7.98721 20.7869 8.00098C20.6473 8.01579 20.4591 8.0166 20.156 8.0166C19.8526 8.0166 19.6645 8.01591 19.5251 8.00098C19.3951 7.98703 19.3667 7.96526 19.3621 7.96191L19.3601 7.95996L19.322 7.92871C19.3103 7.91706 19.2994 7.90413 19.2898 7.89062C19.284 7.88193 19.2644 7.84785 19.2517 7.72852C19.2369 7.58899 19.2371 7.40068 19.2371 7.09766C19.2371 6.79457 19.2368 6.60611 19.2517 6.4668C19.2653 6.33982 19.2867 6.30945 19.2908 6.30371L19.2927 6.30078C19.3115 6.27426 19.3348 6.25145 19.3611 6.23242C19.3663 6.22872 19.3956 6.20714 19.5251 6.19336C19.6647 6.17854 19.8529 6.17773 20.156 6.17773Z" stroke="#820000"/>
                  <path d="M2.27112 8.06279C2.27112 5.83257 2.27112 4.71746 2.77303 3.89873C3.05385 3.44058 3.43907 3.05535 3.89723 2.77453C4.71823 2.27148 5.83334 2.27148 8.06242 2.27148C9.54999 2.27148 10.2926 2.27148 10.8388 2.60647C11.1443 2.79369 11.4011 3.0505 11.5883 3.35593C11.9233 3.901 11.9233 4.64592 11.9233 6.13235V7.38146C11.9233 9.52311 11.9233 10.5928 11.2579 11.2582C10.5924 11.9237 9.52274 11.9237 7.38109 11.9237H6.13199C4.64442 11.9237 3.90177 11.9237 3.35557 11.5887C3.05013 11.4015 2.79332 11.1446 2.60611 10.8392C2.27112 10.2941 2.27112 9.54922 2.27112 8.06279Z" stroke="#820000" stroke-width="1.5"/>
                  <path d="M20.1562 18.6689C20.5651 18.6689 20.8342 18.6696 21.0381 18.6904C21.1847 18.7054 21.2665 18.7278 21.3184 18.752L21.3613 18.7764C21.4303 18.8226 21.489 18.8822 21.5352 18.9512C21.5672 18.9992 21.6022 19.0792 21.6221 19.2744C21.6428 19.4783 21.6436 19.7475 21.6436 20.1562C21.6436 20.5651 21.6429 20.8342 21.6221 21.0381C21.6071 21.1849 21.5837 21.2665 21.5596 21.3184L21.5352 21.3613C21.4891 21.4301 21.4301 21.4891 21.3613 21.5352C21.3133 21.5672 21.2335 21.6021 21.0381 21.6221C20.8342 21.6429 20.5651 21.6436 20.1562 21.6436C19.7475 21.6436 19.4783 21.6428 19.2744 21.6221C19.079 21.6021 18.9982 21.5672 18.9502 21.5352C18.916 21.5122 18.8844 21.486 18.8555 21.457L18.7764 21.3613C18.7443 21.3133 18.7104 21.2334 18.6904 21.0381C18.6696 20.8342 18.6689 20.5651 18.6689 20.1562C18.6689 19.7475 18.6697 19.4783 18.6904 19.2744C18.7054 19.1281 18.7279 19.046 18.752 18.9941L18.7764 18.9512C18.7995 18.9166 18.8262 18.8847 18.8555 18.8555L18.9512 18.7764C18.9992 18.7444 19.0795 18.7103 19.2744 18.6904C19.4783 18.6697 19.7475 18.6689 20.1562 18.6689ZM7.09766 19.2363C7.40048 19.2363 7.5883 19.2371 7.72754 19.252C7.85545 19.2657 7.8852 19.2871 7.89062 19.291L7.89355 19.293C7.907 19.3025 7.92 19.3126 7.93164 19.3242L7.96289 19.3623C7.96835 19.3703 7.98807 19.4034 8.00098 19.5244C8.01582 19.664 8.0166 19.8529 8.0166 20.1562C8.0166 20.4595 8.01591 20.6478 8.00098 20.7871C7.98703 20.917 7.96526 20.9455 7.96191 20.9502L7.95996 20.9521C7.94093 20.9791 7.91744 21.0023 7.89062 21.0215C7.88252 21.027 7.84943 21.0467 7.72852 21.0596C7.58899 21.0744 7.40068 21.0752 7.09766 21.0752C6.79451 21.0752 6.60612 21.0745 6.4668 21.0596C6.33697 21.0457 6.30851 21.0239 6.30371 21.0205L6.30078 21.0195L6.2627 20.9873C6.25156 20.9762 6.24167 20.9639 6.23242 20.9512C6.22898 20.9463 6.20725 20.9177 6.19336 20.7871C6.17852 20.6476 6.17773 20.4594 6.17773 20.1562C6.17773 19.853 6.17844 19.6647 6.19336 19.5254C6.20731 19.3952 6.22907 19.367 6.23242 19.3623L6.23438 19.3594C6.24376 19.3461 6.25423 19.3338 6.26562 19.3223L6.30371 19.29C6.31219 19.2843 6.34591 19.2647 6.46582 19.252C6.60542 19.2371 6.79435 19.2363 7.09766 19.2363ZM7.09766 6.17773C7.4005 6.17774 7.5883 6.17847 7.72754 6.19336C7.85634 6.20716 7.88549 6.22873 7.89062 6.23242L7.89355 6.23438C7.907 6.24389 7.92 6.25404 7.93164 6.26562L7.96289 6.30371C7.9685 6.312 7.98815 6.3454 8.00098 6.46582C8.01582 6.60542 8.0166 6.79435 8.0166 7.09766C8.0166 7.4005 8.01586 7.5883 8.00098 7.72754C7.98717 7.85637 7.9656 7.8855 7.96191 7.89062L7.95996 7.89355C7.94103 7.9203 7.91725 7.94281 7.89062 7.96191C7.88316 7.96708 7.8513 7.9879 7.72852 8.00098C7.58899 8.01581 7.40068 8.0166 7.09766 8.0166C6.79453 8.0166 6.60611 8.01587 6.4668 8.00098C6.33793 7.98717 6.30882 7.96558 6.30371 7.96191L6.30078 7.95996C6.28733 7.95044 6.27433 7.94029 6.2627 7.92871L6.23145 7.89062C6.22583 7.88232 6.20618 7.8489 6.19336 7.72852C6.17852 7.58899 6.17774 7.40068 6.17773 7.09766C6.17773 6.79453 6.17846 6.60611 6.19336 6.4668C6.20717 6.33796 6.22874 6.30883 6.23242 6.30371L6.23438 6.30078C6.24389 6.28733 6.25404 6.27433 6.26562 6.2627L6.30371 6.23145C6.312 6.22583 6.34542 6.20618 6.46582 6.19336C6.60542 6.17851 6.79435 6.17773 7.09766 6.17773Z" stroke="#820000"/>
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
            </div>
            <div className={styles.buttonGroup}>
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
        </>
      );
    }


    // Unified dashed box for file upload state
    if ((!cameraAvailable || showFileUpload) && !showManualInput) {
      return (
        <>
          <div className={styles.headerRow}>
            <div className={styles.scannerContentHeader}>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 0 }}>Upload Image</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', opacity: 0.85, marginTop: 2 }}>Upload image of QR Code to view or add an item</div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.qrScannerBox}>
            <div className={styles.fileUploadBox}>
              <div className={styles.fileUploadIcon}>
                <svg width="70" height="70" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8.16642 4.8999H29.399C30.6985 4.8999 31.9448 5.41613 32.8637 6.33503C33.7826 7.25392 34.2988 8.50021 34.2988 9.79972V31.0323C34.2988 32.3318 33.7826 33.5781 32.8637 34.497C31.9448 35.4159 30.6985 35.9321 29.399 35.9321H8.16642C6.86691 35.9321 5.62062 35.4159 4.70173 34.497C3.78283 33.5781 3.2666 32.3318 3.2666 31.0323V9.79972C3.2666 8.50021 3.78283 7.25392 4.70173 6.33503C5.62062 5.41613 6.86691 4.8999 8.16642 4.8999ZM8.16642 6.53318C7.30008 6.53318 6.46922 6.87733 5.85662 7.48992C5.24403 8.10252 4.89987 8.93338 4.89987 9.79972V28.7294L11.9066 21.7063L15.9898 25.7895L24.1562 17.6231L32.6655 26.1325V9.79972C32.6655 8.93338 32.3214 8.10252 31.7088 7.48992C31.0962 6.87733 30.2653 6.53318 29.399 6.53318H8.16642ZM15.9898 28.1087L11.9066 24.0255L4.89987 31.0323C4.89987 31.8986 5.24403 32.7295 5.85662 33.3421C6.46922 33.9547 7.30008 34.2988 8.16642 34.2988H29.399C30.2653 34.2988 31.0962 33.9547 31.7088 33.3421C32.3214 32.7295 32.6655 31.8986 32.6655 31.0323V28.4354L24.1562 19.9423L15.9898 28.1087ZM12.2496 9.79972C13.3325 9.79972 14.3711 10.2299 15.1369 10.9957C15.9026 11.7614 16.3328 12.8 16.3328 13.8829C16.3328 14.9658 15.9026 16.0044 15.1369 16.7702C14.3711 17.5359 13.3325 17.9661 12.2496 17.9661C11.1667 17.9661 10.1281 17.5359 9.36236 16.7702C8.59661 16.0044 8.16642 14.9658 8.16642 13.8829C8.16642 12.8 8.59661 11.7614 9.36236 10.9957C10.1281 10.2299 11.1667 9.79972 12.2496 9.79972ZM12.2496 11.433C11.5998 11.433 10.9767 11.6911 10.5173 12.1506C10.0578 12.61 9.79969 13.2331 9.79969 13.8829C9.79969 14.5327 10.0578 15.1558 10.5173 15.6153C10.9767 16.0747 11.5998 16.3328 12.2496 16.3328C12.8994 16.3328 13.5225 16.0747 13.982 15.6153C14.4414 15.1558 14.6995 14.5327 14.6995 13.8829C14.6995 13.2331 14.4414 12.61 13.982 12.1506C13.5225 11.6911 12.8994 11.433 12.2496 11.433Z" fill="#820000"/>
                </svg>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
            <div className={styles.buttonGroup}>
              <button
                onClick={() => fileInputRef.current?.click()}
                className={styles.qrButtonPrimary}
              >
                Choose File
              </button>
              <button
                onClick={() => setShowFileUpload(false)}
                className={styles.qrButtonCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
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

