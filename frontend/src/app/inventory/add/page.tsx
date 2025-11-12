"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Webcam from "react-webcam";
import { apiClient, getImageUrl } from "../../../config/api";
import { Camera, Upload, X, Check, Plus, Trash2, ArrowRight, ArrowLeft, Info, Settings, CheckCircle, AlertTriangle, XCircle, AlertOctagon } from "lucide-react";
import styles from './addItem.module.css';
import { supabase } from '../../../config/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { triggerDatabaseUpdate } from '../../../services/databaseUpdateService';
// No compression - upload raw files as-is


function AddItemPageContent() {
  const [form, setForm] = useState({
    property_no: "",
    qr_code: "",
    article_type: "",
    location: "",
    end_user: "",
    date_acquired: "",
    price: "",
    supply_officer: "",
    specifications: "",
    serial_no: "",
    category: "",
    brand: "",
    company_name: "",
    quantity: 1,
    remarks: "",
    item_description: "",
  });
  const [userCompany, setUserCompany] = useState("");
 
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [capturedImage, setCapturedImage] = useState<string>("");
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string>("");
  const [cameraLoading, setCameraLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const { showSuccess, showError } = useToast();
  const [detectedCategory, setDetectedCategory] = useState<string>("");
 
  const router = useRouter();
  const searchParams = useSearchParams();
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const [cameraConstraints, setCameraConstraints] = useState<any>({
    width: { ideal: 1280, min: 640 },
    height: { ideal: 720, min: 480 },
    facingMode: "environment",
    aspectRatio: { ideal: 16/9 },
    frameRate: { ideal: 30, min: 15 }
  });
  const [cameraSupportChecked, setCameraSupportChecked] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);


  // Define category groups
  const electronicCategories = ["PC", "PR", "MON", "TP", "MS", "KEY", "UPS", "TAB", "PWB"];
  const utilityCategories = ["UTLY", "TOOL", "SPLY"];

  // Add this mapping near the top, after category arrays
  const tagToArticleType: Record<string, string> = {
    PC: "Desktop Computer",
    PR: "Printer",
    MON: "Monitor",
    TP: "Laptop",
    MS: "Mouse",
    KEY: "Keyboard",
    UPS: "UPS",
    TAB: "Tablet",
    PWB: "Power Bank"
  };


  useEffect(() => {
    setMounted(true);
    // Fetch user profile to get company name
    apiClient.get("/users/profile").then(res => {
      if (res.data && res.data.company_name) {
        setUserCompany(res.data.company_name);
        setForm(prev => ({ ...prev, company_name: res.data.company_name }));
      }
    });
   
    // Cleanup function to delete uploaded image if component unmounts
    return () => {
      if (imageUrl && imageUrl.includes('/')) {
        // Only delete if it's a Supabase path (contains '/')
        (async () => {
          try {
            const { supabase } = await import('../../../config/supabase');
            await supabase.storage.from('dtc-ims').remove([imageUrl]);
          } catch (err) {
            console.error('Error deleting uploaded image on unmount:', err);
          }
        })();
      }
    };
  }, [imageUrl]);


  // Check for QR code parameter and auto-fill qr_code field
  useEffect(() => {
    if (!mounted) return;
   
    const qrCode = searchParams.get('qr');
    if (qrCode) {
      setForm(prev => ({ ...prev, qr_code: qrCode }));
    }
  }, [searchParams, mounted]);


  // Auto-detect category by TAG from QR code
  useEffect(() => {
    if (!form.qr_code) {
      setDetectedCategory("");
      return;
    }
   
    // Parse QR code for TAG - look for patterns like -PC-, -PR-, etc.
    const tagPattern = /(?:-|^)(PC|PR|MON|TP|MS|KEY|UPS|TAB|PWB|UTLY|TOOL|SPLY)(?:-|\d|$)/i;
    const match = form.qr_code.match(tagPattern);
   
    if (match) {
      const tag = match[1].toUpperCase();
      if (electronicCategories.includes(tag)) {
        setDetectedCategory("Electronic");
      } else if (tag === "UTLY") {
        setDetectedCategory("Utility");
      } else if (tag === "TOOL") {
        setDetectedCategory("Tool");
      } else if (tag === "SPLY") {
        setDetectedCategory("Supply");
      } else {
        setDetectedCategory("");
      }
    } else {
      setDetectedCategory("");
    }
  }, [form.qr_code]);

  // Auto-detect and set the article_type field based on the QR code tag whenever the QR code changes. Only set it if the detected tag matches a known article type and the user hasn't manually changed it.
  useEffect(() => {
    if (!form.qr_code) return;
    // Parse tag from QR code
    const tagPattern = /(?:-|^)(PC|PR|MON|TP|MS|KEY|UPS|TAB|PWB)(?:-|\d|$)/i;
    const match = form.qr_code.match(tagPattern);
    if (match) {
      const tag = match[1].toUpperCase();
      const detectedArticle = tagToArticleType[tag];
      if (detectedArticle && form.article_type !== detectedArticle) {
        setForm(prev => ({ ...prev, article_type: detectedArticle }));
      }
    }
  }, [form.qr_code]);


  // Check HTTPS and camera support on mount
  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraSupported(false);
    }
    setCameraSupportChecked(true);
  }, []);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };


  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError("Please select a valid image file");
        return;
      }
     
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image file size must be less than 5MB");
        return;
      }
     
      setImageFile(file);
      setCapturedImage(""); // Clear captured image when uploading
      setError(""); // Clear any previous errors
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };


  const capturePhoto = () => {
    if (webcamRef.current) {
      // Get the video element from webcam
      const video = webcamRef.current.video;
      if (video) {
        // Create a canvas with the video's actual dimensions
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
       
        // Set canvas to video's actual dimensions for maximum quality
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
       
        if (ctx) {
          // Draw the video frame to canvas at full resolution
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
         
          // Convert to high-quality PNG
          const imageSrc = canvas.toDataURL('image/png', 1.0);
          setCapturedImage(imageSrc);
          setImageFile(null); // Clear uploaded file when capturing
          setImagePreview(""); // Clear uploaded preview
          setShowCamera(false);
        }
      } else {
        // Fallback to webcam screenshot method
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          setCapturedImage(imageSrc);
          setImageFile(null);
          setImagePreview("");
          setShowCamera(false);
        }
      }
    }
  };


  const retakePhoto = () => {
    setCapturedImage("");
    setShowCamera(true);
    setCameraError("");
    setCameraLoading(true);
  };


  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    setCapturedImage("");
    setImageUrl("");
  };


  const handleCameraError = (error: string) => {
    // Fallback to basic constraints if not already tried
    if (cameraConstraints.width.ideal !== 320) {
      setCameraConstraints({
        width: { ideal: 320, min: 160 },
        height: { ideal: 240, min: 120 },
        facingMode: "environment",
        frameRate: { ideal: 10, min: 5 }
      });
      return;
    }
    let userFriendlyError = 'Camera access denied or not supported.';
    switch (error) {
      case 'NotAllowedError':
        userFriendlyError = 'Camera access denied. Please allow camera permissions in your browser settings.';
        break;
      case 'NotFoundError':
        userFriendlyError = 'No camera found on this device. Please use file upload instead.';
        break;
      case 'NotSupportedError':
        userFriendlyError = 'Camera not supported on this device. Please use file upload instead.';
        break;
      case 'NotReadableError':
        userFriendlyError = 'Camera is in use by another application. Please close other camera apps and try again.';
        break;
      case 'OverconstrainedError':
        userFriendlyError = 'Camera constraints not supported. Please use file upload instead.';
        break;
      default:
        userFriendlyError = `Camera error: ${error}. Please use file upload instead.`;
    }
    setCameraError(userFriendlyError);
    setCameraLoading(false);
    setShowCamera(false);
  };


  const handleCameraStart = () => {
    setCameraLoading(false);
  };


  const handleCameraReady = () => {
    setCameraLoading(false);
    setCameraError("");
  };






  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");


    try {
      // 1. Prepare item data (without image_url)
      const itemData = {
        ...form,
        category: detectedCategory
      };
      // Remove empty fields
      Object.keys(itemData).forEach(key => {
        if (itemData[key as keyof typeof itemData] === "" || itemData[key as keyof typeof itemData] === null) {
          delete itemData[key as keyof typeof itemData];
        }
      });
      // 2. Create the item first
      const response = await apiClient.post('/items', itemData);
      if (!response.data || !response.data.id) throw new Error('Failed to get new item ID');
      const newId = response.data.id;
      let finalImageUrl = "";
      // 3. Upload image if present
      if (imageFile || capturedImage) {
        const imageToUpload = imageFile || (capturedImage ? dataURLtoFile(capturedImage, `item-${newId}.png`) : null);
        if (imageToUpload) {
          const ext = imageToUpload.name.split('.').pop() || 'png';
          const fileName = `item-pictures/${newId}.${ext}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('dtc-ims')
            .upload(fileName, imageToUpload, {
              cacheControl: '3600',
              upsert: true
            });
          if (uploadError) {
            throw new Error(`Image upload failed: ${uploadError.message}`);
          }
          finalImageUrl = fileName;
          // 4. Update the item with the image_url
          await apiClient.put(`/items/${newId}`, { image_url: finalImageUrl });
        }
      }
      // 5. Trigger database update notification
      triggerDatabaseUpdate();
      
      // 6. Show success message and redirect
      showSuccess("Item Created", "Item has been created successfully!");
      router.push('/inventory');
    } catch (err: any) {
      console.error('Error creating item:', err);
      const errorMessage = err.message || 'Failed to create item. Please try again.';
      setError(errorMessage);
      showError("Creation Failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };


  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };


  const handleCancel = async () => {
    if (confirm("Are you sure you want to cancel? All entered data will be lost.")) {
      // Delete uploaded image if it exists
      if (imageUrl && imageUrl.includes('/')) {
        try {
          const { supabase } = await import('../../../config/supabase');
          await supabase.storage.from('dtc-ims').remove([imageUrl]);
        } catch (err) {
          console.error('Error deleting uploaded image:', err);
        }
      }
     
      // Clear all image preview states
      setImageFile(null);
      setImagePreview("");
      setCapturedImage("");
      setImageUrl("");
      setShowCamera(false);
      setCameraError("");
      setCameraLoading(false);
     
      router.push("/inventory");
    }
  };






  const previewSrc = imageUrl || imagePreview || capturedImage;


  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    );
  }


  // Determine which fields to show based on category
  const isElectronic = detectedCategory === "Electronic";
  const isUtilityToolSupply = ["Utility", "Tool", "Supply"].includes(detectedCategory);


  return (
    <div className={styles["main-container"]}>
      {/* Top card exactly like dashboard */}
      {/* Main Content Card */}
      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 16, boxShadow: 'none', padding: 0 }} encType="multipart/form-data">
        <div style={{ padding: 0 }}>
          {/* Image Upload/Capture at the top, centered */}
          <div className={styles.imageBoxMargin} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>


            <div className={styles.imageUpload} style={{ margin: '0 auto' }}>
              {/* Show camera if active */}
              {showCamera ? (
                <div className="flex flex-col items-center w-full">
                  <div className={styles.imagePreviewBox}>
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      screenshotFormat="image/png"
                      screenshotQuality={1}
                      videoConstraints={cameraConstraints}
                      onUserMedia={() => handleCameraReady()}
                      onUserMediaError={(err) => handleCameraError(err instanceof Error ? err.name : 'Camera access denied')}
                      className={styles.webcam}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        background: '#fff'
                      }}
                    />
                  </div>
                  <div className={styles.imageUploadActions}>
                    <button
                      type="button"
                      onClick={() => {
                        capturePhoto();
                        setShowCamera(false);
                      }}
                      className={styles.capturePhotoBtn}
                    >
                      <Camera size={18} />
                      Capture Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCamera(false)}
                      className={styles.cancelBtn}
                    >
                      <X size={18} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : imagePreview || capturedImage ? (
                <div className="flex flex-col items-center w-full">
                  <div className={styles.imagePreviewBox}>
                    <img
                      src={imagePreview || capturedImage}
                      alt="Selected Image"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        background: '#fff',
                        imageRendering: '-webkit-optimize-contrast'
                      }}
                    />
                  </div>
                  <div className={styles.imageUploadActions}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      className={styles.uploadLabel}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={18} />
                      Upload New Image
                    </button>
                    <button type="button" className={styles.takePhotoBtn} onClick={() => { setShowCamera(true); setCameraError(""); setCameraLoading(true); }}>
                      <Camera size={18} />
                      Take New Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center w-full">
                  <div className={styles.imageUploadIcon}>
                    <Camera size={40} color="#820000" />
                  </div>
                  <div className={styles.imageUploadTitle}>Add Item Picture</div>
                  <div className={styles.imageUploadDesc}>Capture or upload an image to help identify this item</div>
                  <div className={styles.imageUploadActions}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      className={styles.uploadLabel}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={18} />
                      Upload Image
                    </button>
                    <button type="button" className={styles.takePhotoBtn} onClick={() => { setShowCamera(true); setCameraError(""); setCameraLoading(true); }}>
                      <Camera size={18} />
                      Capture Photo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Item Details - horizontal label/input pairs */}
          <div className={styles.formGrid}>
            {/* QR Code - Always shown */}
            <div className={styles.formRow}>
              <label className={styles.formLabel}>QR Code</label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  name="qr_code"
                  className={`${styles.input} ${styles.inputNarrow}`}
                  value={form.qr_code}
                  onChange={handleChange}
                  placeholder="Enter QR code or scan to auto-fill"
                />
              </div>
            </div>
            {/* Category - Always shown but read-only */}
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Detected Category</label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  name="category"
                  className={`${styles.input} ${styles.inputNarrow}`}
                  value={detectedCategory}
                  readOnly
                />
              </div>
            </div>
            {/* Property No. - Always shown */}
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Property No. *</label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  name="property_no"
                  className={`${styles.input} ${styles.inputNarrow}`}
                  value={form.property_no}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            {/* Serial No. - Always shown */}
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Serial No.</label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  name="serial_no"
                  className={`${styles.input} ${styles.inputNarrow}`}
                  value={form.serial_no || ''}
                  onChange={handleChange}
                />
              </div>
            </div>
            {/* Electronics-specific fields */}
            {isElectronic && (
              <>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Article Type *</label>
                  <div className={styles.inputWrapper}>
                    <select
                      name="article_type"
                      className={`${styles.select} ${styles.inputNarrow}`}
                      value={form.article_type}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Article Type</option>
                      <option value="Desktop Computer">Desktop Computer</option>
                      <option value="Laptop">Laptop</option>
                      <option value="Monitor">Monitor</option>
                      <option value="Keyboard">Keyboard</option>
                      <option value="Mouse">Mouse</option>
                      <option value="UPS">UPS</option>
                      <option value="Printer">Printer</option>
                      <option value="Scanner">Scanner</option>
                      <option value="Network Equipment">Network Equipment</option>
                      <option value="Server">Server</option>
                      <option value="Tablet">Tablet</option>
                      <option value="Power Bank">Power Bank</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Brand</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="text"
                      name="brand"
                      className={`${styles.input} ${styles.inputNarrow}`}
                      value={form.brand || ''}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>End User</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="text"
                      name="end_user"
                      className={`${styles.input} ${styles.inputNarrow}`}
                      value={form.end_user}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Location</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="text"
                      name="location"
                      className={`${styles.input} ${styles.inputNarrow}`}
                      value={form.location}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Date Acquired</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="date"
                      name="date_acquired"
                      className={`${styles.input} ${styles.inputNarrow}`}
                      value={form.date_acquired}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Price (₱)</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      name="price"
                      step="0.01"
                      className={`${styles.input} ${styles.inputNarrow}`}
                      value={form.price}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Supply Officer</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="text"
                      name="supply_officer"
                      className={`${styles.input} ${styles.inputNarrow}`}
                      value={form.supply_officer}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Company</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="text"
                      name="company_name"
                      className={`${styles.input} ${styles.inputNarrow}`}
                      value={form.company_name || userCompany}
                      readOnly
                    />
                  </div>
                </div>
                <div className={styles.formRow} style={{ alignItems: 'flex-start' }}>
                  <label className={styles.formLabel} style={{ marginTop: 10 }}>Specifications</label>
                  <div className={styles.inputWrapper}>
                    <textarea
                      name="specifications"
                      rows={4}
                      placeholder="Enter specifications separated by commas (e.g., Intel i7-10700K, 16GB RAM, 512GB SSD, Windows 11)"
                      className={`${styles.textarea} ${styles.inputNarrow}`}
                      value={form.specifications}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </>
            )}
            {/* Utility/Tool/Supply specific fields */}
            {isUtilityToolSupply && (
              <>
                <div className={styles.formRow} style={{ alignItems: 'flex-start' }}>
                  <label className={styles.formLabel} style={{ marginTop: 10 }}>Item Description</label>
                  <div className={styles.inputWrapper}>
                    <textarea
                      name="item_description"
                      rows={4}
                      placeholder="Enter item description and specifications..."
                      className={`${styles.textarea} ${styles.inputNarrow}`}
                      value={form.item_description}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>End User</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="text"
                      name="end_user"
                      className={`${styles.input} ${styles.inputNarrow}`}
                      value={form.end_user}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Location</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="text"
                      name="location"
                      className={`${styles.input} ${styles.inputNarrow}`}
                      value={form.location}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Date Acquired</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="date"
                      name="date_acquired"
                      className={`${styles.input} ${styles.inputNarrow}`}
                      value={form.date_acquired}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Quantity</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      name="quantity"
                      min="1"
                      className={`${styles.input} ${styles.inputNarrow}`}
                      value={form.quantity}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className={styles.formRow} style={{ alignItems: 'flex-start' }}>
                  <label className={styles.formLabel} style={{ marginTop: 10 }}>Remarks/Note</label>
                  <div className={styles.inputWrapper}>
                    <textarea
                      name="remarks"
                      rows={3}
                      placeholder="Enter any additional remarks or notes..."
                      className={`${styles.textarea} ${styles.inputNarrow}`}
                      value={form.remarks}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </>
            )}
            {/* Show message when no category is detected */}
            {!detectedCategory && form.qr_code && (
              <div style={{ gridColumn: '1 / -1', marginBottom: 18 }}>
                <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg">
                  <div className="flex items-center">
                    <AlertTriangle className="text-yellow-500 mr-3" size={20} />
                    <p className="text-yellow-700 font-medium">
                      No category detected from QR code. Please enter a QR code with a valid tag (PC, PR, MON, TP, MS, KEY, UPS, TAB, PWB, UTLY, TOOL, SPLY).
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Submit Button Row - Discard (gray) left, Save Item (blue) right */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32, marginRight: 32, paddingBottom: 16 }}>
            <button
              type="button"
              onClick={handleCancel}
              className={styles.discardBtn}
            >
              <svg width="20" height="20" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8 }}>
                <path d="M5.83325 22.1666L13.9999 13.9999M13.9999 13.9999L22.1666 5.83325M13.9999 13.9999L5.83325 5.83325M13.9999 13.9999L22.1666 22.1666" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Discard
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || !detectedCategory}
              style={{
                cursor: loading || !detectedCategory ? 'not-allowed' : 'pointer',
                opacity: loading || !detectedCategory ? 0.7 : 1
              }}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }}></div>
                  Saving...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8 }}>
                    <path d="M21.75 28.75V21.3378C21.7496 21.0127 21.6813 20.6909 21.5491 20.3908C21.4169 20.0907 21.2233 19.8181 20.9795 19.5887C20.7356 19.3592 20.4463 19.1775 20.128 19.0537C19.8098 18.93 19.4688 18.8667 19.1246 18.8676H10.3754C10.0312 18.8667 9.69025 18.93 9.37197 19.0537C9.05369 19.1775 8.76436 19.3592 8.52053 19.5887C8.27669 19.8181 8.08313 20.0907 7.95092 20.3908C7.81871 20.6909 7.75043 21.0127 7.75 21.3378V28.75M21.75 1.19335V4.86757C21.7496 5.19263 21.6813 5.51443 21.5491 5.81455C21.4169 6.11468 21.2233 6.38724 20.9795 6.61667C20.7356 6.84609 20.4463 7.02786 20.128 7.1516C19.8098 7.27534 19.4688 7.3386 19.1246 7.33779H10.3754C10.0312 7.3386 9.69025 7.27534 9.37197 7.1516C9.05369 7.02786 8.76436 6.84609 8.52053 6.61667C8.27669 6.38724 8.08313 6.11468 7.95092 5.81455C7.81871 5.51443 7.75043 5.19263 7.75 4.86757V0.750016M21.75 1.19335C21.0669 0.90119 20.3257 0.750047 19.5759 0.750016H7.75M21.75 1.19335C22.3166 1.43602 22.8387 1.77513 23.2884 2.19668L27.2116 5.89112C27.6988 6.34895 28.0855 6.89311 28.3495 7.49239C28.6134 8.09167 28.7496 8.73427 28.75 9.38334V23.8064C28.7496 24.4567 28.6134 25.1005 28.3493 25.701C28.0851 26.3015 27.6982 26.8469 27.2107 27.3061C26.7232 27.7652 26.1445 28.1291 25.508 28.3769C24.8714 28.6246 24.1893 28.7514 23.5008 28.75H6.00082C5.31231 28.7516 4.63022 28.625 3.99356 28.3775C3.3569 28.1299 2.77817 27.7662 2.29048 27.3072C1.80278 26.8482 1.4157 26.3029 1.15137 25.7024C0.887038 25.102 0.750647 24.4583 0.75 23.808V5.69045C0.750864 5.04033 0.887414 4.39673 1.15184 3.79648C1.41627 3.19623 1.80339 2.6511 2.29106 2.19225C2.77873 1.73341 3.35739 1.36986 3.99394 1.12239C4.63049 0.874915 5.31245 0.74838 6.00082 0.750016H7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Save Item
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}


// Loading component for Suspense fallback
function AddItemPageLoading() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Add New Item</h1>
          <p className={styles.subtitle}>Enter item details and upload image</p>
        </div>
      </div>
      <div className={styles.content}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-6"></div>
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}


// Main component with Suspense wrapper
export default function AddItemPage() {
  return (
    <Suspense fallback={<AddItemPageLoading />}>
      <AddItemPageContent />
    </Suspense>
  );
}

