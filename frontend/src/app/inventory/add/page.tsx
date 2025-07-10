"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Webcam from "react-webcam";
import { apiClient, getImageUrl } from "../../../config/api";
import { Camera, Upload, X, Check, Plus, Trash2, ArrowRight, ArrowLeft, Info, Settings, CheckCircle, AlertTriangle, XCircle, AlertOctagon } from "lucide-react";
import styles from './page.module.css';
import { supabase } from '../../../config/supabase';
import { useToast } from '../../../contexts/ToastContext';
import dashboardStyles from '../../dashboard.module.css';
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
  const electronicCategories = ["PC", "PR", "MON", "TP", "MS", "KEY", "UPS"];
  const utilityCategories = ["UTLY", "TOOL", "SPLY"];






  useEffect(() => {
    setMounted(true);
   
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
    const tagPattern = /(?:-|^)(PC|PR|MON|TP|MS|KEY|UPS|UTLY|TOOL|SPLY)(?:-|\d|$)/i;
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
      // 5. Show success message and redirect
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
      <div className={styles.dashboardCardAddStatic} style={{ color: 'var(--text-primary)', minHeight: 80, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          {/* Left: Add Item title */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className={dashboardStyles.dashboardTitle} style={{ color: 'var(--text-primary)', marginBottom: 0 }}>Add Item</div>
          </div>
          {/* Right: Inventory System label */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Inventory System</div>
          </div>
        </div>
      </div>
      {/* Only show the title, no header card */}
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
                      className={styles.takePhotoBtn}
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
                    <label className={styles.uploadLabel}>
                      <Upload size={18} style={{marginRight: 6}} />
                      Upload New Image
                      <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
                    </label>
                    <button type="button" className={styles.takePhotoBtn} onClick={() => { setShowCamera(true); setCameraError(""); setCameraLoading(true); }}>
                      <Camera size={18} style={{marginRight: 6}} />
                      Take New Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center w-full">
                  <div className={styles.imageUploadIcon}>
                    <Camera size={40} />
                  </div>
                  <div className={styles.imageUploadTitle}>Add Item Picture</div>
                  <div className={styles.imageUploadDesc}>Capture or upload an image to help identify this item</div>
                  <div className={styles.imageUploadActions}>
                    <label className={styles.uploadLabel}>
                      <Upload size={18} style={{marginRight: 6}} />
                      Upload Image
                      <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
                    </label>
                    <button type="button" className={styles.takePhotoBtn} onClick={() => { setShowCamera(true); setCameraError(""); setCameraLoading(true); }}>
                      <Camera size={18} style={{marginRight: 6}} />
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
                      <option value="Printer">Printer</option>
                      <option value="Scanner">Scanner</option>
                      <option value="Network Equipment">Network Equipment</option>
                      <option value="Server">Server</option>
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
                      value={form.company_name || ''}
                      onChange={handleChange}
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
                      No category detected from QR code. Please enter a QR code with a valid tag (PC, PR, MON, TP, MS, KEY, UPS, UTLY, TOOL, SPLY).
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
              style={{
                background: '#9ca3af',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                fontWeight: 500,
                fontSize: 15,
                cursor: 'pointer',
                boxShadow: 'none',
                marginRight: 8
              }}
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={loading || !detectedCategory}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                fontWeight: 600,
                fontSize: 15,
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
                <>Save Item</>
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

