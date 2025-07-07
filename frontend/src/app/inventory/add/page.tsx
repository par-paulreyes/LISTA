"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Webcam from "react-webcam";
import { apiClient, getImageUrl } from "../../../config/api";
import { Camera, Upload, X, Check, Plus, Trash2, ArrowRight, ArrowLeft, Info, Settings, CheckCircle, AlertTriangle, XCircle, AlertOctagon } from "lucide-react";
import styles from './page.module.css';
import { supabase } from '../../../config/supabase';
// No compression - upload raw files as-is


interface MaintenanceTask {
  id: string;
  task: string;
  completed: boolean;
  notes: string;
}


interface Diagnostic {
  system_status: string;
  findings: string;
  recommendations: string;
}


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
  });
 
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [capturedImage, setCapturedImage] = useState<string>("");
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string>("");
  const [cameraLoading, setCameraLoading] = useState(false);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([
    { id: '1', task: 'Antivirus Check', completed: false, notes: '' },
    { id: '2', task: 'Uninstalled Programs', completed: false, notes: '' },
    { id: '3', task: 'Software Updates', completed: false, notes: '' },
    { id: '4', task: 'Hardware Failures', completed: false, notes: '' },
  ]);
  const [customTask, setCustomTask] = useState("");
  const [diagnostic, setDiagnostic] = useState<Diagnostic>({
    system_status: 'Good',
    findings: '',
    recommendations: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<'details' | 'maintenance' | 'diagnostics'>('details');
  const [diagnosticsDropdownOpen, setDiagnosticsDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [detectedCategory, setDetectedCategory] = useState<string>("");
 
  const router = useRouter();
  const searchParams = useSearchParams();
  const webcamRef = useRef<Webcam>(null);


  const diagnosticsOptions = [
    { value: 'Good', label: 'Good', icon: <CheckCircle color="#22c55e" size={20} /> },
    { value: 'Fair', label: 'Fair', icon: <AlertTriangle color="#eab308" size={20} /> },
    { value: 'Poor', label: 'Poor', icon: <XCircle color="#f97316" size={20} /> },
    { value: 'Critical', label: 'Critical', icon: <AlertOctagon color="#dc2626" size={20} /> },
  ];


  const selectedDiagnosticsOption = diagnosticsOptions.find(opt => opt.value === diagnostic.system_status) || diagnosticsOptions[0];


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
    if (!form.qr_code) return;
    // Parse QR code for TAG
    const tagPattern = /(?:-|^)(PC|PR|MON|TP|MS|KEY|UPS|UTLY|TOOL|SPLY)(?:-|\d|$)/i;
    const match = form.qr_code.match(tagPattern);
    if (match) {
      const tag = match[1].toUpperCase();
      if (["PC","PR","MON","TP","MS","KEY","UPS"].includes(tag)) setDetectedCategory("Electronic");
      else if (tag === "UTLY") setDetectedCategory("Utility");
      else if (tag === "TOOL") setDetectedCategory("Tool");
      else if (tag === "SPLY") setDetectedCategory("Supply");
      else setDetectedCategory("");
    } else {
      setDetectedCategory("");
    }
  }, [form.qr_code]);


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
  };


  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    setCapturedImage("");
    setCameraError("");
  };


  const handleCameraError = (error: string) => {
    setCameraError(error);
    setCameraLoading(false);
    console.error('Camera error:', error);
  };


  const handleCameraStart = () => {
    setCameraError("");
    setCameraLoading(true);
    setShowCamera(true);
  };


  const handleCameraReady = () => {
    setCameraLoading(false);
  };


  const handleMaintenanceTaskChange = (id: string, field: keyof MaintenanceTask, value: string | boolean) => {
    setMaintenanceTasks(prev =>
      prev.map(task =>
        task.id === id ? { ...task, [field]: value } : task
      )
    );
  };


  const addCustomTask = () => {
    if (customTask.trim()) {
      const newTask: MaintenanceTask = {
        id: Date.now().toString(),
        task: customTask.trim(),
        completed: false,
        notes: ''
      };
      setMaintenanceTasks(prev => [...prev, newTask]);
      setCustomTask("");
    }
  };


  const removeTask = (id: string) => {
    setMaintenanceTasks(prev => prev.filter(task => task.id !== id));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Validate required fields
      if (!form.property_no.trim()) {
        setError("Property No. is required");
        setLoading(false);
        return;
      }
      if (!form.article_type) {
        setError("Article Type is required");
        setLoading(false);
        return;
      }
      if (maintenanceTasks.length === 0) {
        setError("Please add at least one maintenance task");
        setLoading(false);
        return;
      }
      const invalidTasks = maintenanceTasks.filter(task => !task.task.trim());
      if (invalidTasks.length > 0) {
        setError("All maintenance tasks must have a task description");
        setLoading(false);
        return;
      }
      if (!diagnostic.system_status) {
        setError("System status is required");
        setLoading(false);
        return;
      }

      // Create FormData for other fields (without image initially)
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          // Handle date formatting for MySQL
          if (key === 'date_acquired' && typeof value === 'string') {
            const formattedDate = value.split('T')[0]; // Convert ISO date to YYYY-MM-DD
            formData.append(key, formattedDate);
          } else if (key === 'price' && typeof value === 'string') {
            // Convert price to number
            formData.append(key, parseFloat(value).toString());
          } else if (key === 'quantity') {
            formData.append(key, value.toString());
          } else {
            formData.append(key, value as string);
          }
        }
      });

      // Add maintenance and diagnostic data
      const maintenanceDate = new Date().toISOString().split('T')[0];
      formData.append('maintenance_date', maintenanceDate);
      formData.append('maintenance_tasks', JSON.stringify(maintenanceTasks));
      formData.append('diagnostic', JSON.stringify(diagnostic));

      // First, create the item without image
      const response = await apiClient.post("/items", formData, {
        headers: {
          Authorization: token,
          'Content-Type': 'multipart/form-data'
        },
      });

      const itemId = response.data.id;

      // Now handle image upload to Supabase with item ID as filename
      if (imageFile || capturedImage) {
        let fileToUpload: File;
        if (capturedImage) {
          // capturedImage is a base64 PNG - convert directly without quality loss
          const response = await fetch(capturedImage);
          const blob = await response.blob();
          // Use PNG extension and type for best quality, preserve original quality
          fileToUpload = new File([blob], `captured-${Date.now()}.png`, { 
            type: 'image/png',
            lastModified: Date.now()
          });
        } else {
          // Upload raw file exactly as-is, no compression or conversion
          fileToUpload = imageFile!;
        }

        // Use item ID as filename
        const fileExtension = fileToUpload.name.split('.').pop() || 'png';
        const filePath = `item-pictures/${itemId}.${fileExtension}`;
        
        const { error: uploadError } = await supabase.storage
          .from('dtc-ims')
          .upload(filePath, fileToUpload, {
            upsert: true,
            contentType: fileToUpload.type || 'image/png',
          });
        
        if (uploadError) throw uploadError;
        
        // Update the item with the image URL
        await apiClient.put(`/items/${itemId}`, {
          image_url: filePath
        }, {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json'
          },
        });
      }

      // Success
      const successMessage = `Item created successfully!\n  - Item ID: ${itemId}\n  - Maintenance logs: ${response.data.maintenance_logs_created || 0}\n  - Diagnostic: ${response.data.diagnostic_created ? 'Yes' : 'No'}`;
      localStorage.setItem('dashboard_refresh_trigger', Date.now().toString());
      alert(successMessage);
      router.push(`/inventory/${itemId}`);
    } catch (err: any) {
      console.error('Error creating item:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || "Error adding item";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
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


  const TabButton = ({ tab, label, icon: Icon, isActive, className }: { tab: string; label: string; icon: any; isActive: boolean; className: string }) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab as any)}
      className={`${className}`}
    >
      <Icon size={18} />
      {label}
    </button>
  );


  const completedTasks = maintenanceTasks.filter(task => task.completed).length;
  const completionPercentage = maintenanceTasks.length > 0 ? Math.round((completedTasks / maintenanceTasks.length) * 100) : 0;


  const previewSrc = imageUrl || imagePreview || capturedImage;


  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    );
  }


  return (
    <div className={styles.container}>
      {/* Header Card */}
      <div className={styles.headerCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div>
            <h1 className={styles.headerTitle}>Add New Item</h1>
            <p className={styles.headerSubtitle}>Register a new item in the inventory system</p>
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


      {/* Main Content Card */}
      <form onSubmit={handleSubmit} className={styles.mainCard} encType="multipart/form-data">
        {/* Tab Navigation */}
        <div className={styles.tabNav}>
          <TabButton
            tab="details"
            label="Item Details"
            icon={Info}
            isActive={activeTab === 'details'}
            className={activeTab === 'details' ? styles.tabBtnActive : styles.tabBtn}
          />
          <TabButton
            tab="maintenance"
            label="Maintenance Tasks"
            icon={Settings}
            isActive={activeTab === 'maintenance'}
            className={activeTab === 'maintenance' ? styles.tabBtnActive : styles.tabBtn}
          />
          <TabButton
            tab="diagnostics"
            label="System Diagnostics"
            icon={CheckCircle}
            isActive={activeTab === 'diagnostics'}
            className={activeTab === 'diagnostics' ? styles.tabBtnActive : styles.tabBtn}
          />
        </div>


        {/* Main Form Content */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <div className="flex items-center">
                <X className="text-red-500 mr-3" size={20} />
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            </div>
          )}


          {/* Item Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-8">
              <div className={styles.formGrid}>
                <div>
                  <label className={styles.label}>Property No. *</label>
                  <input
                    type="text"
                    name="property_no"
                    className={styles.input}
                    value={form.property_no}
                    onChange={handleChange}
                    required
                  />
                </div>
               
                <div>
                  <label className={styles.label}>QR Code</label>
                  <input
                    type="text"
                    name="qr_code"
                    className={styles.input}
                    value={form.qr_code}
                    onChange={handleChange}
                    placeholder="Enter QR code or scan to auto-fill"
                  />
                  {detectedCategory && (
                    <div style={{ color: '#166534', fontWeight: 500, marginTop: 4 }}>
                      Detected Category: {detectedCategory}
                    </div>
                  )}
                </div>
               
                <div>
                  <label className={styles.label}>Serial No.</label>
                  <input
                    type="text"
                    name="serial_no"
                    className={styles.input}
                    value={form.serial_no || ''}
                    onChange={handleChange}
                  />
                </div>
               
                <div>
                  <label className={styles.label}>Article Type *</label>
                  <select
                    name="article_type"
                    className={styles.select}
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


                <div>
                  <label className={styles.label}>Category</label>
                  <input
                    type="text"
                    name="category"
                    className={styles.input}
                    value={detectedCategory}
                    readOnly
                  />
                </div>


                <div>
                  <label className={styles.label}>Brand</label>
                  <input
                    type="text"
                    name="brand"
                    className={styles.input}
                    value={form.brand || ''}
                    onChange={handleChange}
                  />
                </div>


                <div>
                  <label className={styles.label}>Date Acquired</label>
                  <input
                    type="date"
                    name="date_acquired"
                    className={styles.input}
                    value={form.date_acquired}
                    onChange={handleChange}
                  />
                </div>


                <div>
                  <label className={styles.label}>Price (₱)</label>
                  <input
                    type="number"
                    name="price"
                    step="0.01"
                    className={styles.input}
                    value={form.price}
                    onChange={handleChange}
                  />
                </div>


                <div>
                  <label className={styles.label}>End User</label>
                  <input
                    type="text"
                    name="end_user"
                    className={styles.input}
                    value={form.end_user}
                    onChange={handleChange}
                  />
                </div>


                <div>
                  <label className={styles.label}>Location</label>
                  <input
                    type="text"
                    name="location"
                    className={styles.input}
                    value={form.location}
                    onChange={handleChange}
                  />
                </div>


                <div>
                  <label className={styles.label}>Supply Officer</label>
                  <input
                    type="text"
                    name="supply_officer"
                    className={styles.input}
                    value={form.supply_officer}
                    onChange={handleChange}
                  />
                </div>


                <div>
                  <label className={styles.label}>Company</label>
                  <input
                    type="text"
                    name="company_name"
                    className={styles.input}
                    value={form.company_name || ''}
                    onChange={handleChange}
                  />
                </div>


                <div>
                  <label className={styles.specsLabel}>Specifications</label>
                  <textarea
                    name="specifications"
                    rows={4}
                    placeholder="Enter specifications separated by commas (e.g., Intel i7-10700K, 16GB RAM, 512GB SSD, Windows 11)"
                    className={styles.textarea}
                    value={form.specifications}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div>
                <label className={styles.itemPictureLabel}>Item Picture</label>
                <div className={styles.imageUpload}>
                  {/* Show camera if active */}
                  {showCamera ? (
                    <div className="flex flex-col items-center w-full">
                      <div className={styles.imagePreviewBox}>
                        <Webcam
                          ref={webcamRef}
                          audio={false}
                          screenshotFormat="image/png"
                          screenshotQuality={1}
                          videoConstraints={{
                            width: { ideal: 3840, min: 1920 },
                            height: { ideal: 2160, min: 1080 },
                            facingMode: "environment",
                            aspectRatio: { ideal: 16/9 },
                            frameRate: { ideal: 30, min: 24 }
                          }}
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
            </div>
          )}


          {/* Maintenance Tasks Tab */}
          {activeTab === 'maintenance' && (
            <div className="space-y-8">
              {/* Info Card */}
              <div className={styles.maintenanceInfoCard}>
                <Info size={24} style={{ color: '#264072', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>Maintenance Information</div>
                  <div style={{ fontWeight: 400, fontSize: 15, color: '#264072', marginTop: 2 }}>
                    Maintenance date and maintainer will be automatically set to today's date and your user account.
                  </div>
                </div>
              </div>


              {/* Progress Card */}
              <div className={styles.maintenanceProgressCard}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 20, color: '#166534' }}>Progress Overview</div>
                  <div style={{ fontWeight: 400, fontSize: 15, color: '#166534', marginTop: 2 }}>{completedTasks} of {maintenanceTasks.length} tasks completed</div>
                  <div style={{ marginTop: 16, width: 320, maxWidth: '100%' }}>
                    <div style={{ background: '#fff', borderRadius: 8, height: 10, width: '100%', overflow: 'hidden', boxShadow: '0 1px 2px rgba(16,185,129,0.06)' }}>
                      <div style={{ background: '#22c55e', height: '100%', width: `${completionPercentage}%`, borderRadius: 8, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 32, color: '#22c55e', minWidth: 80, textAlign: 'right' }}>{completionPercentage}%</div>
              </div>


              {/* Checklist Title */}
              <div className={styles.maintenanceChecklistTitle}>
                <Settings size={22} style={{ color: '#222b3a' }} />
                Maintenance Tasks Checklist
              </div>


              {/* Checklist Items */}
              <div className={styles.maintenanceChecklist}>
                {maintenanceTasks.map((task, idx) => (
                  <div key={task.id} style={{ background: task.completed ? '#e6fbe8' : '#fff', border: `1.5px solid ${task.completed ? '#a7f3d0' : '#e5e7eb'}`, borderRadius: 16, boxShadow: '0 1px 4px rgba(16,185,129,0.04)', padding: 18, marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f3f4f6', color: '#222b3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>{idx + 1}</div>
                        <span style={{ fontWeight: 700, fontSize: 18, color: task.completed ? '#166534' : '#222b3a', textDecoration: task.completed ? 'line-through' : 'none' }}>{task.task}</span>
                        {task.completed && (
                          <span style={{ display: 'flex', alignItems: 'center', background: '#bbf7d0', color: '#16a34a', borderRadius: 12, fontWeight: 600, fontSize: 13, padding: '2px 10px', marginLeft: 6 }}>
                            <Check size={16} style={{ marginRight: 4 }} /> Completed
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={e => handleMaintenanceTaskChange(task.id, 'completed', e.target.checked)}
                          style={{ width: 22, height: 22, accentColor: '#22c55e', borderRadius: 6, border: '2px solid #a7f3d0', background: '#fff' }}
                        />
                        <button type="button" onClick={() => removeTask(task.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0 }}>
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                    <textarea
                      placeholder="Add notes for this task..."
                      value={task.notes}
                      onChange={e => handleMaintenanceTaskChange(task.id, 'notes', e.target.value)}
                      className={styles.notesInput}
                      rows={2}
                    />
                  </div>
                ))}
              </div>


              {/* Add Custom Task */}
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <input
                  type="text"
                  placeholder="Add custom task..."
                  value={customTask}
                  onChange={e => setCustomTask(e.target.value)}
                  className={styles.customTaskInput}
                />
                <button
                  type="button"
                  onClick={addCustomTask}
                  className={styles.addTaskBtn}
                >
                  <Plus size={18} /> Add Task
                </button>
              </div>
            </div>
          )}


          {/* System Diagnostics Tab */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-8">
              <div>
                <label className={styles.diagnosticsLabel}>System Status</label>
                <div className={styles.diagnosticsDropdownWrapper}>
                  <div
                    className={styles.customDropdown + (diagnosticsDropdownOpen ? ' open' : '')}
                    tabIndex={0}
                    onClick={() => setDiagnosticsDropdownOpen(open => !open)}
                    onBlur={() => setDiagnosticsDropdownOpen(false)}
                  >
                    <div className={styles.customDropdownSelected}>
                      {selectedDiagnosticsOption.icon}
                      <span className={styles.diagnosticsOptionLabel}>{selectedDiagnosticsOption.label}</span>
                      <svg style={{marginLeft: 'auto'}} width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M6 8L10 12L14 8" stroke="#222b3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    {diagnosticsDropdownOpen && (
                      <div className={styles.customDropdownList}>
                        {diagnosticsOptions.map(opt => (
                          <div
                            key={opt.value}
                            className={styles.customDropdownOption}
                            onMouseDown={e => { e.preventDefault(); setDiagnostic(prev => ({ ...prev, system_status: opt.value })); setDiagnosticsDropdownOpen(false); }}
                          >
                            {opt.icon}
                            <span className={styles.diagnosticsOptionLabel}>{opt.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className={styles.diagnosticsLabel}>Findings</label>
                <textarea
                  rows={4}
                  placeholder="Describe any issues or observations..."
                  className={styles.textareaFindings}
                  value={diagnostic.findings}
                  onChange={(e) => setDiagnostic(prev => ({ ...prev, findings: e.target.value }))}
                />
              </div>


              <div>
                <label className={styles.diagnosticsLabel}>Recommendations</label>
                <textarea
                  rows={4}
                  placeholder="Suggest actions or improvements..."
                  className={styles.textareaRecommendations}
                  value={diagnostic.recommendations}
                  onChange={(e) => setDiagnostic(prev => ({ ...prev, recommendations: e.target.value }))}
                />
              </div>
            </div>
          )}


          {/* Navigation Footer */}
          <div className={styles.footerNav}>
            <div className="flex gap-3">
              {activeTab === 'maintenance' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className={styles.backBtn}
                >
                  <ArrowLeft size={18} />
                  Back to Details
                </button>
              )}
              {activeTab === 'diagnostics' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('maintenance')}
                  className={styles.backBtn}
                >
                  <ArrowLeft size={18} />
                  Back to Maintenance
                </button>
              )}
            </div>


            <div className="flex gap-3">
              {activeTab === 'details' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('maintenance')}
                  className={styles.nextBtn}
                >
                  Next: Maintenance
                  <ArrowRight size={18} />
                </button>
              )}
              {activeTab === 'maintenance' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('diagnostics')}
                  className={styles.nextBtn}
                >
                  Next: Diagnostics
                  <ArrowRight size={18} />
                </button>
              )}
              {activeTab === 'diagnostics' && (
                <button
                  type="submit"
                  disabled={loading}
                  className={styles.submitBtn}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Save Item
                    </>
                  )}
                </button>
              )}
            </div>
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