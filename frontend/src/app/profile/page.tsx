"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Webcam from "react-webcam";
import { apiClient, getImageUrl } from "../../config/api";
import imageCompression from 'browser-image-compression';
import { Camera, Upload, X, Edit, Check, UserPlus, LogOut } from "lucide-react";
import './profile.css';
import { supabase } from '../../config/supabase';
import { useToast } from '../../contexts/ToastContext';

// Utility to fetch image as base64 and cache in localStorage
async function fetchAndCacheImageBase64(imageUrl: string, cacheKey: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const reader = new FileReader();
    return await new Promise((resolve, reject) => {
      reader.onloadend = () => {
        const base64data = reader.result as string;
        try {
          localStorage.setItem(cacheKey, base64data);
        } catch (e) {
          // If storage quota exceeded, ignore
        }
        resolve(base64data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return '';
  }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const { showSuccess, showError } = useToast();
  const [uploading, setUploading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imageCompressionInfo, setImageCompressionInfo] = useState<{originalSize: string, compressedSize: string, ratio: string} | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [cameraLoading, setCameraLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webcamRef = useRef<Webcam>(null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    apiClient.get("/users/profile")
      .then(async (response) => {
        setProfile(response.data);
        setForm({ ...response.data, password: "", confirmPassword: "" });
        // Load signed URL for profile picture with localStorage caching
        if (response.data.profile_picture) {
          const cacheKey = `profile-image-${response.data.username || response.data.id}`;
          const cachedBase64 = localStorage.getItem(cacheKey);
          if (cachedBase64) {
            setImageUrl(cachedBase64);
          } else {
            const url = await getImageUrl(response.data.profile_picture);
            if (url) {
              const base64 = await fetchAndCacheImageBase64(url, cacheKey);
              setImageUrl(base64);
            }
          }
        }
      })
      .catch((err) => setError("Error loading profile"))
      .finally(() => setLoading(false));
  }, [router, mounted]);

  // Cleanup object URLs when component unmounts or selectedImageFile changes
  useEffect(() => {
    return () => {
      if (selectedImageFile) {
        URL.revokeObjectURL(URL.createObjectURL(selectedImageFile));
      }
    };
  }, [selectedImageFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError("");
    setSuccess("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setForm({ ...profile, password: "", confirmPassword: "" });
    setError("");
    setSuccess("");
    // Clear any stored images and camera states
    setCapturedImage("");
    setSelectedImageFile(null);
    setImageCompressionInfo(null);
    setShowCamera(false);
    setCameraError("");
    setCameraLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (form.password && form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      let profilePictureUrl = form.profile_picture;
      let imageChanged = false;
      // Handle image upload if there's a captured image or selected file
      if (capturedImage || selectedImageFile) {
        setUploading(true);
        let fileToUpload: File;
        if (capturedImage) {
          const response = await fetch(capturedImage);
          const blob = await response.blob();
          fileToUpload = new File([blob], 'captured-profile.jpg', { type: 'image/jpeg' });
        } else {
          fileToUpload = selectedImageFile!;
        }
        // Use username or fallback to user id for file name
        const fileName = `${form.username || form.id || 'user'}.jpg`;
        const filePath = `profile-pictures/${fileName}`;
        // Debug logging
        console.log('Uploading to Supabase:', { fileToUpload, filePath });
        // Upload with correct contentType
        const { error: uploadError } = await supabase.storage
          .from('dtc-ims')
          .upload(filePath, fileToUpload, {
            upsert: true,
            contentType: fileToUpload.type || 'image/jpeg',
          });
        if (uploadError) {
          console.error('Supabase upload error:', uploadError);
          setError(`Supabase upload error: ${uploadError.message || 'Unknown error'}`);
          setUploading(false);
          setSaving(false);
          return;
        }
        // Store the file path instead of public URL for security
        profilePictureUrl = filePath;
        imageChanged = true;
        setUploading(false);
      }
      // Prepare the data to send - only include password if user wants to change it
      const dataToSend = { ...form };
      delete dataToSend.confirmPassword;
      
      // Only include password if user actually wants to change it
      if (!form.password || form.password.trim() === '') {
        delete dataToSend.password;
      }
      
      if (profilePictureUrl !== form.profile_picture) {
        dataToSend.profile_picture = profilePictureUrl;
      }
      
      const response = await apiClient.put("/users/profile", dataToSend);
      showSuccess("Profile Updated", "Profile has been updated successfully!");
      
      // Update the profile state with the new data
      const updatedProfile = { ...profile, ...dataToSend };
      setProfile(updatedProfile);
      setForm({ ...updatedProfile, password: "", confirmPassword: "" });
      setIsEditing(false);
      setCapturedImage("");
      setSelectedImageFile(null);
      setImageCompressionInfo(null);
      // Update signed URL for new profile picture
      if (updatedProfile.profile_picture) {
        const cacheKey = `profile-image-${updatedProfile.username || updatedProfile.id}`;
        // If image was changed, clear cache so it reloads
        if (imageChanged) {
          localStorage.removeItem(cacheKey);
        }
        const url = await getImageUrl(updatedProfile.profile_picture);
        if (url) {
          const base64 = await fetchAndCacheImageBase64(url, cacheKey);
          setImageUrl(base64);
        }
      }
    } catch (err: any) {
      // Show error from Supabase or backend
      const errorMessage = err.response?.data?.message || err.message || "Error updating profile";
      setError(errorMessage);
      showError("Update Failed", errorMessage);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  // Handle profile picture selection (not upload)
  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("Please select a valid image file");
      return;
    }
    
    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image file size must be less than 10MB");
      return;
    }

    try {
      // Compress the image for preview and storage
      const compressionOptions = getCompressionOptions();
      
      console.log('📸 Compressing image...', {
        originalSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        originalType: file.type
      });
      
      const compressedFile = await imageCompression(file, compressionOptions);
      
      console.log('✅ Image compressed successfully', {
        compressedSize: `${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`,
        compressionRatio: `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`,
        compressedType: compressedFile.type
      });
      
      // Store compression info for UI display
      setImageCompressionInfo({
        originalSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        compressedSize: `${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`,
        ratio: `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`
      });
      
      setSelectedImageFile(compressedFile);
      setCapturedImage(""); // Clear captured image when uploading
      setError(""); // Clear any previous errors
    } catch (err) {
      console.error('Image compression failed:', err);
      setError("Failed to process image. Please try again.");
    }
  };

  // Camera-related functions
  const capturePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImage(imageSrc);
        setShowCamera(false);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage("");
    setShowCamera(true);
    setCameraError("");
  };

  const handleCameraError = (error: string) => {
    setCameraError(error);
    setCameraLoading(false);
    console.error('Camera error:', error);
  };

  const handleCameraReady = () => {
    setCameraLoading(false);
  };

  // Helper function for consistent image compression options
  const getCompressionOptions = () => ({
    maxSizeMB: 1, // Target max size in MB
    maxWidthOrHeight: 800, // Resize to max 800px width or height
    useWebWorker: true,
    fileType: 'image/jpeg', // Convert to JPEG for better compression
    quality: 0.8, // 80% quality for good balance
  });

  // For image display, use signed URL if it's a file path
  const getImageUrl = async (filePath: string) => {
    if (!filePath || filePath.startsWith('http')) {
      return filePath; // Already a URL
    }
    try {
      const { data, error } = await supabase.storage
        .from('dtc-ims')
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      if (error) {
        console.error('Error creating signed URL:', error);
        return '';
      }
      return data?.signedUrl || '';
    } catch (err) {
      console.error('Error getting signed URL:', err);
      return '';
    }
  };

  const [imageUrl, setImageUrl] = useState<string>('');

  // Helper to get preview URL for selected or captured images
  const getPreviewUrl = () => {
    if (capturedImage) return capturedImage;
    if (selectedImageFile) return URL.createObjectURL(selectedImageFile);
    return null;
  };

  const previewUrl = getPreviewUrl();

  if (!mounted) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (mounted && loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (mounted && error) return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>;
  if (mounted && !profile) return <div className="min-h-screen flex items-center justify-center text-gray-500">Profile not found.</div>;

  return (
    <div className="main-container">
      {/* Profile Picture Section */}
      <div className="top-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Show camera if active */}
          {showCamera ? (
            <div className="flex flex-col items-center w-full">
              <div className="profile-image-preview-box">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/png"
                  videoConstraints={{
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "environment"
                  }}
                  onUserMedia={() => handleCameraReady()}
                  onUserMediaError={(err) => handleCameraError(err instanceof Error ? err.name : 'Camera access denied')}
                  className="profile-webcam"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#fff' }}
                />
              </div>
              <div className="profile-image-upload-actions">
                <button
                  type="button"
                  onClick={() => {
                    capturePhoto();
                    setShowCamera(false);
                  }}
                  className="profile-capture-photo-btn"
                >
                  <Camera size={18} />
                  Capture Photo
                </button>
                <button
                  type="button"
                  onClick={() => setShowCamera(false)}
                  className="profile-cancel-btn"
                >
                  <X size={18} />
                  Cancel
                </button>
              </div>
            </div>
          ) : capturedImage || selectedImageFile ? (
            <div className="flex flex-col items-center w-full">
              <div className="profile-image-preview-box">
                <img
                  src={previewUrl!}
                  alt="Profile Preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    background: '#fff'
                  }}
                />
              </div>
              <div className="profile-image-upload-actions">
                <button
                  type="button"
                  onClick={retakePhoto}
                  className="profile-retake-btn"
                >
                  <Camera size={18} />
                  Retake
                </button>
                <button
                  type="button"
                  onClick={() => { setCapturedImage(""); setSelectedImageFile(null); setImageCompressionInfo(null); }}
                  className="profile-cancel-btn"
                >
                  <X size={18} />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Profile"
                  className="w-24 h-24 object-cover border-4 border-white shadow-lg"
                  style={{ marginBottom: 12, width: 144, height: 144, borderRadius: 16 }}
                />
              ) : (
                <div 
                  className="w-24 h-24 border-4 border-white shadow-lg flex items-center justify-center"
                  style={{ 
                    marginBottom: 12, 
                    width: 144, 
                    height: 144, 
                    backgroundColor: '#b91c1c',
                    border: '4px solid white',
                    borderRadius: 16
                  }}
                >
                  <svg width="64" height="64" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
              )}
              {isEditing && !success && (
                <div className="profile-photo-options">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleProfilePicChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="profile-upload-option-btn"
                    disabled={uploading}
                  >
                    <Upload size={16} />
                    Upload Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCamera(true); setCameraError(""); setCameraLoading(true); }}
                    className="profile-camera-option-btn"
                    disabled={uploading}
                  >
                    <Camera size={16} />
                    Take Photo
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {/* Blue notification for new profile photo upload */}
      {(capturedImage || selectedImageFile) && (
        <div className="profile-notification">
          <div className="flex items-center gap-2 text-blue-700 text-sm">
            <svg className="icon" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
            <span className="notification-title">New profile photo will be uploaded when you save changes</span>
            {imageCompressionInfo && (
              <span className="notification-detail">
                (Compressed: {imageCompressionInfo.originalSize} → {imageCompressionInfo.compressedSize}, {imageCompressionInfo.ratio} smaller)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Button row above the profile-header-card */}
      <div className={`profile-header-btn-row ${isEditing ? 'editing' : ''}`}>
        {isEditing ? (
          <>
            <button
              type="button"
              className="save-changes-btn"
              disabled={saving}
              onClick={() => formRef.current?.requestSubmit()}
            >
              <Check size={18} style={{ marginRight: 8 }} />
              Save Changes
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="cancel-btn"
              disabled={saving}
            >
              <X size={18} style={{ marginRight: 8 }} />
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleEdit}
            className="edit-btn"
          >
            <Edit size={18} style={{ marginRight: 8 }} />
            Edit Profile
          </button>
        )}
      </div>
      <div className="profile-header-card">
        <h3 className="text-2xl font-bold mb-4 flex items-center">
          <svg width="16" height="16" fill="#fff" viewBox="0 0 24 24" style={{ marginRight: 7, display: 'inline-block', verticalAlign: 'middle' }}>
            <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
          </svg>
          Profile
        </h3>
      </div>
      <div className="profile-info-card">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="max-w-md bg-white rounded shadow p-6"
          style={{ marginLeft: 0 }}
        >
          <div className="mb-4">
            <label className="block mb-1 font-medium">Username</label>
            <input
              type="text"
              name="username"
              className="w-full border rounded px-3 py-2 bg-gray-100"
              value={form.username || ""}
              disabled
            />
          </div>
          <div className="mb-4">
            <label className="block mb-1 font-x medium">Full Name</label>
            <input
              type="text"
              name="full_name"
              className="w-full border rounded px-3 py-2"
              value={form.full_name || ""}
              onChange={handleChange}
              disabled={!isEditing}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block mb-1 font-medium">Email</label>
            <input
              type="email"
              name="email"
              className="w-full border rounded px-3 py-2"
              value={form.email || ""}
              onChange={handleChange}
              disabled={!isEditing}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block mb-1 font-medium">Role</label>
            <input
              type="text"
              name="role"
              className="w-full border rounded px-3 py-2 bg-gray-100"
              value={form.role || ""}
              disabled
            />
          </div>
          <div className="mb-4">
            <label className="block mb-1 font-medium">Company</label>
            <input
              type="text"
              name="company_name"
              className="w-full border rounded px-3 py-2 bg-gray-100"
              value={form.company_name || ""}
              disabled
            />
          </div>
          {/* Password fields only visible when editing */}
          {isEditing && (
            <>
              <div className="mb-4">
                <label className="block mb-1 font-medium">New Password</label>
                <input
                  type="password"
                  name="password"
                  className="w-full border rounded px-3 py-2"
                  value={form.password || ""}
                  onChange={handleChange}
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <div className="mb-6">
                <label className="block mb-1 font-medium">Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  className="w-full border rounded px-3 py-2"
                  value={form.confirmPassword || ""}
                  onChange={handleChange}
                  placeholder="Leave blank to keep current password"
                />
              </div>
            </>
          )}
        </form>
      </div>
      <div className="profile-btn-row">
        {/* Admin-only section */}
        {profile?.role === 'admin' && (
          <button
            onClick={() => router.push("/register")}
            className="admin-register-btn"
          >
            <UserPlus size={18} style={{ marginRight: 8 }} />
            Register New User
          </button>
        )}
        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="logout-btn"
        >
          <LogOut size={18} style={{ marginRight: 8 }} />
          Logout
        </button>
      </div>
    </div>
  );
} 