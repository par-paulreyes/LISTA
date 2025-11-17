"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Webcam from "react-webcam";
import { apiClient, getImageUrl } from "../../config/api";
import imageCompression from 'browser-image-compression';
import { Camera, Upload, LogOut, ArrowLeft, UserPlus } from "lucide-react";
import { FaEdit, FaSave, FaTimes, FaUserPlus } from "react-icons/fa";
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
  const { showSuccess, showError, showInfo } = useToast();
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
        if (!supabase) {
          setError('Storage is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
          setUploading(false);
          setSaving(false);
          return;
        }
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
      if (!supabase) return '';
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

  useEffect(() => {
    if (capturedImage || selectedImageFile) {
      let message = 'New profile photo will be uploaded when you save changes';
      if (imageCompressionInfo) {
        message += ` (Compressed: ${imageCompressionInfo.originalSize} → ${imageCompressionInfo.compressedSize}, ${imageCompressionInfo.ratio} smaller)`;
      }
      showInfo('Profile Photo', message);
    }
    // Only run when these change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturedImage, selectedImageFile, imageCompressionInfo]);

  if (!mounted) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (mounted && loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (mounted && error) return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>;
  if (mounted && !profile) return <div className="min-h-screen flex items-center justify-center text-gray-500">Profile not found.</div>;

  return (
    <>
      <div className="profile-page-background"></div>
      <div className="profile-page-wrapper">
        <div className="detail-container">
      {/* Header Row - Matching Item Detail */}
      <div className="header-row">
        <div>
          <h3 className="item-detail-title">Profile</h3>
          <div className="item-detail-title2">
            {profile?.username || profile?.full_name || 'User Profile'}
          </div>
        </div>
        <div className="top-button-row">
          {isEditing ? (
            <button
              onClick={() => router.back()}
              className="back-button-header"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEdit}
              className="edit-btn"
            >
              <FaEdit style={{ marginRight: 8 }} />
              Edit
            </button>
          )}
        </div>
      </div>
      {/* Two Column Layout - Matching Item Detail */}
      <div className="row">
        {/* Left Column - Profile Picture and Info */}
        <div className="column1">
          <div className="column1_1">
            <div className="frame">
              <div className="top-image-box" style={{position:'relative'}}>
                {/* Show camera if active */}
                {showCamera ? (
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/png"
                    videoConstraints={{
                      width: { ideal: 200 },
                      height: { ideal: 200 },
                      facingMode: "environment"
                    }}
                    onUserMedia={() => handleCameraReady()}
                    onUserMediaError={(err) => handleCameraError(err instanceof Error ? err.name : 'Camera access denied')}
                    className="top-image"
                  />
                ) : capturedImage || selectedImageFile ? (
                  <img
                    src={previewUrl!}
                    alt="Profile Preview"
                    className="top-image"
                  />
                ) : imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Profile"
                    className="top-image"
                  />
                ) : (
                  <FaUserPlus size={96} color="#9ca3af" />
                )}
                {isEditing && (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      onChange={handleProfilePicChange}
                    />
                    {showCamera ? (
                      <>
                        <button className="change-image-btn" onClick={() => {
                          capturePhoto();
                          setShowCamera(false);
                        }} disabled={uploading} style={{position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',zIndex:2}}>
                          Capture Photo
                        </button>
                        <button className="change-image-btn" onClick={() => setShowCamera(false)} style={{position:'absolute',bottom:12,right:12,zIndex:2}}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button className="change-image-btn" onClick={() => {
                        if (capturedImage) {
                          retakePhoto();
                        } else if (selectedImageFile) {
                          setCapturedImage("");
                          setSelectedImageFile(null);
                          setImageCompressionInfo(null);
                        } else {
                          fileInputRef.current?.click();
                        }
                      }} disabled={uploading} style={{position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',zIndex:2}}>
                        {uploading ? 'Processing...' : (capturedImage || selectedImageFile ? 'Change Image' : 'Select Image')}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="article-title">
                {profile?.full_name || profile?.username || 'User'}
              </div>
              <div className="centered-subtitle">{profile?.role || 'User'}</div>
            </div>
          </div>
          {isEditing ? (
            <div className="profile-action-buttons-left">
              <button
                type="button"
                className="profile-save-btn"
                disabled={saving}
                onClick={() => formRef.current?.requestSubmit()}
              >
                <FaSave style={{ marginRight: 6 }} />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="profile-cancel-btn"
                disabled={saving}
              >
                <FaTimes style={{ marginRight: 6 }} />
                Cancel
              </button>
            </div>
          ) : (
            <div className="profile-action-buttons-left">
              {profile?.role === 'admin' && (
                <button
                  onClick={() => router.push("/register")}
                  className="action-btn register-btn"
                >
                  <UserPlus size={16} style={{ marginRight: 6 }} />
                  Register New User
                </button>
              )}
              <button
                onClick={handleLogout}
                className="action-btn logout-btn-new"
              >
                <LogOut size={16} style={{ marginRight: 6 }} />
                Logout
              </button>
            </div>
          )}
        </div>
        {/* Right Column - Form Fields */}
        <div className="column2">
          <div className="mid-nav">
            <button className="tab-btn tab1-btn-active">
              General Information
            </button>
          </div>
          <div className="middle-section">
            <div className="info-card">
              <div className="info-card-content">
                <form
                  ref={formRef}
                  onSubmit={handleSubmit}
                >
                  <div className="rec-container">
                    <div className="gray-rect">
                      <span className="label">Username</span>
                      <input 
                        value={form.username || ''} 
                        onChange={handleChange}
                        name="username"
                        disabled
                      />
                    </div>
                    <div className="gray-rect">
                      <span className="label">Full Name</span>
                      <input 
                        value={form.full_name || ''} 
                        onChange={handleChange}
                        name="full_name"
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="gray-rect">
                      <span className="label">Email</span>
                      <input 
                        value={form.email || ''} 
                        onChange={handleChange}
                        name="email"
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="gray-rect">
                      <span className="label">Role</span>
                      <input 
                        value={form.role || ''} 
                        disabled
                      />
                    </div>
                    <div className="gray-rect">
                      <span className="label">Company</span>
                      <input 
                        value={form.company_name || ''} 
                        disabled
                      />
                    </div>
                    {isEditing && (
                      <>
                        <div className="gray-rect">
                          <span className="label">New Password</span>
                          <input 
                            type="password"
                            value={form.password || ''} 
                            onChange={handleChange}
                            name="password"
                            placeholder="Leave blank to keep current password"
                          />
                        </div>
                        <div className="gray-rect">
                          <span className="label">Confirm Password</span>
                          <input 
                            type="password"
                            value={form.confirmPassword || ''} 
                            onChange={handleChange}
                            name="confirmPassword"
                            placeholder="Leave blank to keep current password"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </>
  );
}
