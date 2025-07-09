"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient, getImageUrl } from "../../../config/api";
import imageCompression from 'browser-image-compression';
import styles from "./page.module.css";
import { FaEdit, FaSave, FaTrash, FaTimes, FaClipboardList, FaStethoscope, FaInfoCircle, FaCog, FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaHeartbeat, FaClock, FaRegSquare, FaRegCheckSquare, FaPlus } from "react-icons/fa";
import { useToast } from "../../../contexts/ToastContext";

// Helper to format date for <input type="date">
function formatDateForInput(dateString: string) {
  if (!dateString) return '';
  return dateString.split('T')[0];
}

function formatDisplayDate(dateString: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatSpecifications(specs: string) {
  if (!specs) return [];
  // Split by common delimiters and clean up
  return specs
    .split(/[,;\n\r]+/)
    .map(spec => spec.trim())
    .filter(spec => spec.length > 0);
}

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

export default function ItemDetailPage() {
  const [midNavTab, setMidNavTab] = useState<'general' | 'specs' | 'logs'>('general');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { showSuccess, showError } = useToast();
  const [logsError, setLogsError] = useState("");
  const [editingLogs, setEditingLogs] = useState<any[]>([]);
  const [newLogs, setNewLogs] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs'>('logs');
  const [itemImageUrl, setItemImageUrl] = useState<string>('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string>('');

  // Category detection logic
  const detectCategoryFromQR = (qrCode: string) => {
    if (!qrCode) return null;
    
    const tagPattern = /(?:-|^)(PC|PR|MON|TP|MS|KEY|UPS|UTLY|TOOL|SPLY)(?:-|\d|$)/i;
    const match = qrCode.match(tagPattern);
    
    if (match) {
      const tag = match[1].toUpperCase();
      if (["PC","PR","MON","TP","MS","KEY","UPS"].includes(tag)) return "Electronic";
      else if (tag === "UTLY") return "Utility";
      else if (tag === "TOOL") return "Tool";
      else if (tag === "SPLY") return "Supply";
    }
    return null;
  };

  // Determine item type for display logic
  const getItemType = () => {
    if (!item?.qr_code) return null;
    return detectCategoryFromQR(item.qr_code);
  };

  const itemType = getItemType();
  const isElectronic = itemType === "Electronic";
  const isUtility = itemType === "Utility";
  const isToolOrSupply = itemType === "Tool" || itemType === "Supply";

  useEffect(() => {
    setMounted(true);
    
    // No cleanup needed for uploaded images since we use upsert
    // and consistent filenames - images are replaced, not duplicated
  }, []);

  // Cleanup function to revoke object URLs when selected image changes
  useEffect(() => {
    return () => {
      if (selectedImagePreview) {
        URL.revokeObjectURL(selectedImagePreview);
      }
    };
  }, [selectedImagePreview]);






  useEffect(() => {
    if (!mounted || !id) return;
   
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
   
    setLoading(true);
    setLoadingLogs(true);
    setError("");
    setLogsError("");
   
    // Fetch current user profile
    const fetchUserProfile = async () => {
      try {
        const response = await apiClient.get('/users/profile');
        setCurrentUser(response.data);
      } catch (err: any) {
        console.error('Error fetching user profile:', err);
      }
    };

    // Fetch item details
    const fetchItem = async () => {
      try {
        const response = await apiClient.get(`/items/${id}`);
        setItem(response.data);
        setEditingItem(response.data);
        console.log('Item data loaded:', response.data);
        
        // Load signed URL for item image with localStorage caching
        if (response.data.image_url) {
          const cacheKey = `item-image-${id}`;
          const cachedBase64 = localStorage.getItem(cacheKey);
          if (cachedBase64) {
            setItemImageUrl(cachedBase64);
          } else {
            const imageUrl = await getImageUrl(response.data.image_url);
            if (imageUrl) {
              const base64 = await fetchAndCacheImageBase64(imageUrl, cacheKey);
              setItemImageUrl(base64);
            }
          }
        } else {
          setItemImageUrl('');
        }
      } catch (err: any) {
        console.error('Error fetching item:', err);
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
        } else if (err.response?.status === 404) {
          setError("Item not found");
        } else {
          setError("Error loading item details: " + (err.response?.data?.message || err.message));
        }
      } finally {
        setLoading(false);
      }
    };

    // Fetch maintenance logs
    const fetchLogs = async () => {
      try {
        const response = await apiClient.get(`/logs/item/${id}`);
        setLogs(response.data);
        console.log('Maintenance logs loaded:', response.data);
      } catch (err: any) {
        console.error('Error fetching maintenance logs:', err);
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
        } else {
          setLogsError("Error loading maintenance logs: " + (err.response?.data?.message || err.message));
        }
      } finally {
        setLoadingLogs(false);
      }
    };

    fetchUserProfile();
    fetchItem();
    fetchLogs();
  }, [id, router, mounted]);




  const handleEdit = () => {
    setIsEditing(true);
    setEditingItem({ ...item });
    setEditingLogs(logs.map(l => ({ ...l })));
    setNewLogs([]);
    setError(""); // Clear any previous errors
    setSuccess(""); // Clear any previous success messages
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingItem(item);
    setNewLogs([]);
    setError("");
    setSuccess(""); // Clear any success messages
    setUploadingImage(false); // Clear uploading state
    
    // Clear selected image states
    setSelectedImageFile(null);
    setSelectedImagePreview('');
    
    // Reset the image URL to the original item's image
    if (item?.image_url) {
      getImageUrl(item.image_url).then(url => setItemImageUrl(url));
    }
    // No need to delete uploaded images when canceling since we use upsert
    // and consistent filenames - the original image remains unchanged
  };

  const handleSave = async () => {
    if (!editingItem || !item || loading) return;
    setSaving(true);
    setError("");
   
    try {
      // Recalculate maintenance_status and pending_maintenance_count
      const allLogs = [...editingLogs, ...newLogs];
      const pendingCount = allLogs.filter(log => log.status === 'pending').length;
      const newStatus = pendingCount > 0 ? 'pending' : 'completed';
      
      let finalImageUrl = editingItem.image_url;
      let imageChanged = false;
      
      // Upload image to Supabase if a new image was selected
      if (selectedImageFile) {
        const { supabase } = await import('../../../config/supabase');
        const fileExtension = selectedImageFile.name.split('.').pop() || 'jpg';
        // Use consistent filename for each item to prevent duplicates
        const fileName = `item-pictures/${id}.${fileExtension}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('dtc-ims')
          .upload(fileName, selectedImageFile, {
            cacheControl: '3600',
            upsert: true // Enable upsert to replace existing file
          });

        if (uploadError) throw uploadError;
        
        finalImageUrl = fileName;
        imageChanged = true;
      }
      
      // Only send the fields that the backend expects (excluding maintenance fields that are filtered out)
      const itemUpdateData = {
        property_no: editingItem.property_no || '',
        qr_code: editingItem.qr_code || '',
        article_type: editingItem.article_type || '',
        specifications: editingItem.specifications || '',
        location: editingItem.location || '',
        end_user: editingItem.end_user || '',
        date_acquired: editingItem.date_acquired ? editingItem.date_acquired.split('T')[0] : null,
        price: editingItem.price ? parseFloat(editingItem.price) : null,
        supply_officer: editingItem.supply_officer || '',
        company_name: editingItem.company_name || '',
        image_url: finalImageUrl,
        item_status: editingItem.item_status || 'Available',
        remarks: editingItem.remarks || '',
        serial_no: editingItem.serial_no || '',
        brand: editingItem.brand || '',
        category: editingItem.category || '',
      };
     
      // Debug: Log what we're about to send
      console.log('Sending item update with data:', itemUpdateData);
     
      // Update item
      await apiClient.put(`/items/${id}`, itemUpdateData);
     
      // Create new maintenance logs
      for (const newLog of newLogs) {
        await apiClient.post(`/logs`, {
          item_id: id,
          task_performed: newLog.task_performed,
          notes: newLog.notes,
          status: newLog.status,
          maintained_by: newLog.maintained_by,
          maintenance_date: newLog.maintenance_date ? newLog.maintenance_date.split('T')[0] : (() => new Date().toISOString().split('T')[0])()
        });
      }
     
      // Update existing maintenance logs
      for (const log of editingLogs) {
        if (log.id && typeof log.id === 'number') {
          await apiClient.put(`/logs/${log.id}`, {
            task_performed: log.task_performed,
            notes: log.notes,
            status: log.status,
            maintenance_date: log.maintenance_date ? log.maintenance_date.split('T')[0] : (() => new Date().toISOString().split('T')[0])()
          });
        }
      }
     
      // Update the item state with the new data
      const updatedItem = { ...item, ...itemUpdateData };
      setItem(updatedItem);
      setEditingItem(updatedItem);
      setLogs([...editingLogs, ...newLogs]);
      setIsEditing(false);
      setNewLogs([]);
      
      // Clear selected image states
      setSelectedImageFile(null);
      setSelectedImagePreview('');
      
      // Update the image URL for display
      if (finalImageUrl) {
        const newImageUrl = await getImageUrl(finalImageUrl);
        // If image was changed, clear cache so it reloads
        if (imageChanged) {
          localStorage.removeItem(`item-image-${id}`);
        }
        // Always reload and cache the new image
        if (newImageUrl) {
          const base64 = await fetchAndCacheImageBase64(newImageUrl, `item-image-${id}`);
          setItemImageUrl(base64);
        }
      }
     
      // Trigger dashboard refresh by setting a timestamp
      localStorage.setItem('dashboard_refresh_trigger', Date.now().toString());

      // Show success message
      setError(""); // Clear any previous errors
      showSuccess("Item Updated", "Item has been updated successfully!");

    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
      } else {
        const errorMessage = "Error updating item: " + (err.response?.data?.message || err.message);
        setError(errorMessage);
        showError("Update Failed", errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };




  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this item? This action cannot be undone.")) {
      return;
    }
    setDeleting(true);
    const token = localStorage.getItem("token");
   
    try {
      await apiClient.delete(`/items/${id}`);
     
      // Trigger dashboard refresh by setting a timestamp
      localStorage.setItem('dashboard_refresh_trigger', Date.now().toString());
     
      router.push("/inventory");
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
      } else {
        const errorMessage = "Error deleting item: " + (err.response?.data?.message || err.message);
        setError(errorMessage);
        showError("Delete Failed", errorMessage);
      }
    } finally {
      setDeleting(false);
    }
  };




  const handleInputChange = (field: string, value: string) => {
    setEditingItem({ ...editingItem, [field]: value });
  };




  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Good': return <FaCheckCircle className={styles.statusIcon} style={{color:'#22c55e'}} title="Good"/>;
      case 'Fair': return <FaExclamationTriangle className={styles.statusIcon} style={{color:'#f59e42'}} title="Fair"/>;
      case 'Poor': return <FaTimesCircle className={styles.statusIcon} style={{color:'#ef4444'}} title="Poor"/>;
      case 'Critical': return <FaHeartbeat className={styles.statusIcon} style={{color:'#c1121f'}} title="Critical"/>;
      default: return <FaClock className={styles.statusIcon} style={{color:'#888'}} title="Unknown"/>;
    }
  };




  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <FaCheckCircle className={styles.taskIcon} style={{color:'#22c55e'}} title="Completed"/>;
      case 'pending': return <FaClock className={styles.taskIcon} style={{color:'#f59e42'}} title="Pending"/>;
      default: return <FaClock className={styles.taskIcon} style={{color:'#888'}} title="Unknown"/>;
    }
  };




  const getTaskStatusClass = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };









  const handleLogChange = (index: number, field: string, value: any) => {
    setEditingLogs((prev: any[]) => prev.map((l, i) => i === index ? { ...l, [field]: value, maintenance_date: new Date().toISOString().split('T')[0] } : l));
  };

  const handleNewLogChange = (index: number, field: string, value: any) => {
    setNewLogs((prev: any[]) => prev.map((l, i) => i === index ? { ...l, [field]: value, maintenance_date: new Date().toISOString().split('T')[0] } : l));
  };

  const addNewLog = () => {
    const newLog = {
      id: `new-${Date.now()}`,
      task_performed: '',
      notes: '',
      status: 'pending',
      maintained_by: currentUser?.username || '',
      maintenance_date: new Date().toISOString().split('T')[0],
      completed: false
    };
    setNewLogs((prev: any[]) => [...prev, newLog]);
  };

  const removeNewLog = (index: number) => {
    setNewLogs((prev: any[]) => prev.filter((_, i) => i !== index));
  };

  // Handle image selection for inventory item (preview only, upload on save)
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image file size must be less than 5MB');
      return;
    }
    
    setUploadingImage(true);
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      };
      
      const compressedFile = await imageCompression(file, options);
      
      // Store the compressed file for later upload
      setSelectedImageFile(compressedFile);
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(compressedFile);
      setSelectedImagePreview(previewUrl);
      
      // Clear any previously uploaded images from tracking
      
    } catch (err) {
      console.error('Image processing error:', err);
      alert('Failed to process image.');
    } finally {
      setUploadingImage(false);
    }
  };




  // Remove imgSrc since we're using itemImageUrl state for async loading




  // Use editingLogs in edit mode, logs in view mode
  const logsToShow = isEditing ? [...editingLogs, ...newLogs] : logs;




  // Checklist for logs
  const checklist = logsToShow.map((log, i) => ({
    ...log,
    completed: log.status === 'completed',
  }));




  const handleImageButtonClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };




  // Checklist toggle logic (checkbox only)
  const handleChecklistToggle = (i: number) => {
    if (!isEditing) return;
    setEditingLogs((prev: any[]) => prev.map((log, idx) => idx === i ? { ...log, status: log.status === 'completed' ? 'pending' : 'completed' } : log));
  };




  if (!mounted) return (
    <div className="min-h-screen flex items-center justify-center">Loading...</div>
  );


  if (mounted && loading) return (
    <div className="min-h-screen flex items-center justify-center">Loading...</div>
  );
 
  if (mounted && error) return (
    <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>
  );
 
  if (mounted && !item) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">Item not found.</div>
  );

  // Determine status class
  let statusClass = "";
  if (item.item_status === "Available") statusClass = "status-available";
  else if (item.item_status === "To be Borrowed") statusClass = "status-to-borrow";
  else if (item.item_status === "Borrowed") statusClass = "status-borrowed";
  else if (item.item_status === "Bad Condition") statusClass = "status-bad";

  return (
    <div className={styles.detailContainer}>
      {/* Top Section */}
      <div className={styles.headerRow}>
        <div>
          <h3 className={styles.itemDetailTitle}>Item Detail</h3>
        </div>
        <div className={styles.topButtonRow}>
          {!isEditing ? (
            <>
              <button className={styles.editBtn} onClick={handleEdit} disabled={loading}><FaEdit style={{marginRight: 8}}/>Edit</button>
              <button className={styles.deleteBtn} onClick={handleDelete} disabled={deleting || loading}><FaTrash style={{marginRight: 8}}/>{deleting ? 'Deleting...' : 'Delete'}</button>            </>
          ) : (
            <>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving || loading}><FaSave style={{marginRight: 8}}/>{saving ? 'Saving...' : 'Save'}</button>
              <button className={styles.cancelBtn} onClick={handleCancel} disabled={saving}><FaTimes style={{marginRight: 8}}/>Cancel</button>            </>
          )}
        </div>
      </div>
      <div className={styles.topImageBox} style={{position:'relative'}}>
        {isEditing && selectedImagePreview ? (
          <img src={selectedImagePreview} alt="item preview" className={styles.topImage} />
        ) : itemImageUrl ? (
          <img src={itemImageUrl} alt="item" className={styles.topImage} />
        ) : (
          <span>image</span>
        )}
        {isEditing && (
          <>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleImageChange}
            />
            <button className={styles.changeImageBtn} onClick={handleImageButtonClick} disabled={uploadingImage} style={{position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',zIndex:2}}>
              {uploadingImage ? 'Processing...' : 'Select Image'}
            </button>
          </>
        )}
      </div> 
      <div>
        <div className={styles.articleTitle}>
          {(isEditing ? editingItem.qr_code : item.qr_code) || (isEditing ? editingItem.property_no : item.property_no)?.toUpperCase()}
        </div>
        <div className={styles.centeredSubtitle}>{isEditing ? editingItem.article_type : item.article_type}</div>
      </div>
      <div className={styles.midNav}>
        <button
          className={`${styles.tabBtn} ${midNavTab === 'general' ? styles.tabBtnActive : ''}`}
          onClick={() => setMidNavTab('general')}
        >
          General Info
        </button>
        <button
          className={`${styles.tabBtn} ${midNavTab === 'logs' ? styles.tabBtnActive : ''}`}
          onClick={() => setMidNavTab('logs')}
        >
          Maintenance
        </button>
      </div>
      {/* Middle Section: General Info & Specifications */}
      <div className={styles.middleSection}>
        {midNavTab === 'general' && (
          <>
            <div className={styles.infoCard}>
              <h4>General Information</h4>
              {isEditing ? (
                <>
                  <div className={styles.grayRect}><span className={styles.label}>QR Code</span><input value={editingItem.qr_code || ''} onChange={e => handleInputChange('qr_code', e.target.value)} /></div>
                  <div className={styles.grayRect}><span className={styles.label}>Property No</span><input value={editingItem.property_no || ''} onChange={e => handleInputChange('property_no', e.target.value)} /></div>
                  <div className={styles.grayRect}><span className={styles.label}>Serial No</span><input value={editingItem.serial_no || ''} onChange={e => handleInputChange('serial_no', e.target.value)} /></div>
                  <div className={styles.grayRect}><span className={styles.label}>Location</span><input value={editingItem.location || ''} onChange={e => handleInputChange('location', e.target.value)} /></div>
                  <div className={styles.grayRect}><span className={styles.label}>End User</span><input value={editingItem.end_user || ''} onChange={e => handleInputChange('end_user', e.target.value)} /></div>
                  <div className={styles.grayRect}><span className={styles.label}>Date Acquired</span><input type="date" value={formatDateForInput(editingItem.date_acquired)} onChange={e => handleInputChange('date_acquired', e.target.value)} /></div>
                  <div className={styles.grayRect}><span className={styles.label}>Status</span>
                    <select className={styles.statusDropdown} value={editingItem.item_status || 'Available'} onChange={e => handleInputChange('item_status', e.target.value)}>
                      {isToolOrSupply ? (
                        <>
                          <option value="Available">Available</option>
                          <option value="Out of Stock">Out of Stock</option>
                        </>
                      ) : (
                        <>
                          <option value="Available">Available</option>
                          <option value="Bad Condition">Bad Condition</option>
                          <option value="To be Borrowed">To be Borrowed</option>
                          <option value="Borrowed">Borrowed</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className={styles.grayRect}><span className={styles.label}>Remarks</span><input value={editingItem.remarks || ''} onChange={e => handleInputChange('remarks', e.target.value)} /></div>
                  
                  {/* Electronics-specific fields */}
                  {isElectronic && (
                    <>
                      <div className={styles.grayRect}><span className={styles.label}>Article Type</span><input value={editingItem.article_type || ''} onChange={e => handleInputChange('article_type', e.target.value)} /></div>
                      <div className={styles.grayRect}><span className={styles.label}>Brand</span><input value={editingItem.brand || ''} onChange={e => handleInputChange('brand', e.target.value)} /></div>
                      <div className={styles.grayRect}><span className={styles.label}>Price</span><input type="number" value={editingItem.price || ''} onChange={e => handleInputChange('price', e.target.value)} /></div>
                      <div className={styles.grayRect}><span className={styles.label}>Supply Officer</span><input value={editingItem.supply_officer || ''} onChange={e => handleInputChange('supply_officer', e.target.value)} /></div>
                      <div className={styles.grayRect}><span className={styles.label}>Company</span><input value={editingItem.company_name || ''} onChange={e => handleInputChange('company_name', e.target.value)} /></div>
                    </>
                  )}
                </>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'20px',alignItems:'flex-start'}}>
                  <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>QR Code</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.qr_code || 'N/A'}</b></div>
                  <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Property No</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.property_no}</b></div>
                  <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Serial No</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.serial_no || 'N/A'}</b></div>
                  <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Location</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.location || 'N/A'}</b></div>
                  <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>End User</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.end_user || 'N/A'}</b></div>
                  <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Date Acquired</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{formatDisplayDate(item.date_acquired) || 'N/A'}</b></div>
                  <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Status</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.item_status || 'N/A'}</b></div>
                  <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Remarks</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.remarks || 'N/A'}</b></div>
                  
                  {/* Electronics-specific fields */}
                  {isElectronic && (
                    <>
                      <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Article Type</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.article_type}</b></div>
                      <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Brand</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.brand || 'N/A'}</b></div>
                      <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Price</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>₱{item.price || 'N/A'}</b></div>
                      <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Supply Officer</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.supply_officer || 'N/A'}</b></div>
                      <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Company</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.company_name || 'N/A'}</b></div>
                    </>
                  )}
                </div>
              )}
              <h4>Specifications</h4>
              {isEditing ? (
                <div className={styles.grayRect}><textarea value={editingItem.specifications || ''} onChange={e => handleInputChange('specifications', e.target.value)} className={styles.specInput} /></div>
              ) : (
                <div>
                  {item.specifications ? (
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                      {formatSpecifications(item.specifications).map((spec, index) => (
                        <span key={index} className={styles.specs}>{spec}</span>
                      ))}
                    </div>
                  ) : (
                    <span style={{color: '#888'}}>No {isElectronic ? 'specifications' : 'description'} available</span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        {midNavTab === 'logs' && (
          <div className={styles.logsSection}>
            {/* Logs content (already uses isEditing logic) */}
            {(isElectronic || isUtility) ? (
              <>
                {/* WAIT LANG DITO
                  {isEditing ? (
                    <div className={styles.statusCard}>
                      <div className={styles.grayRect}><span className={styles.label}>Maintenance Status:</span><input value={editingItem.maintenance_status || ''} onChange={e => handleInputChange('maintenance_status', e.target.value)} /></div>
                      <div className={styles.grayRect}><span className={styles.label}>Pending Tasks:</span><input value={editingItem.pending_maintenance_count || ''} onChange={e => handleInputChange('pending_maintenance_count', e.target.value)} /></div>
                    </div>
                  ) : (
                    <div className={styles.statusCard}>
                      <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Maintenance Status:</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.maintenance_status === 'pending' ? <span style={{color:'#f59e42',marginLeft:4}}>&#9888; Pending</span> : <span style={{color:'#22c55e',marginLeft:4}}>&#10003; Up to Date</span>}</b></div>
                      <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Pending Tasks:</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.pending_maintenance_count > 0 ? <span style={{color:'#f59e42',marginLeft:4}}>&#9888; {item.pending_maintenance_count} task{item.pending_maintenance_count > 1 ? 's' : ''}</span> : <span style={{color:'#22c55e',marginLeft:4}}>&#10003; None</span>}</b></div>
                    </div>
                  )}
                */}
                <div className={styles.statusCard}>
                  <h4>Status</h4>
                  <div className={styles.statusTxt} style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Maintenance Status</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.maintenance_status === 'pending' ? <span style={{color:'#f59e42',marginLeft:4}}>&#9888; Pending</span> : <span style={{color:'#22c55e',marginLeft:4}}>&#10003; Up to Date</span>}</b></div>
                  <div className={styles.statusTxt} style={{display:'flex',justifyContent:'space-between',width:'100%'}}><span>Pending Tasks</span> <b style={{fontWeight:700,textAlign:'right',minWidth:120,display:'inline-block'}}>{item.pending_maintenance_count > 0 ? <span style={{color:'#f59e42',marginLeft:4}}>&#9888; {item.pending_maintenance_count} task{item.pending_maintenance_count > 1 ? 's' : ''}</span> : <span style={{color:'#22c55e',marginLeft:4}}>&#10003; None</span>}</b></div>
                </div>
                <div className={styles.checklist}>
                  <h4>Logs and Activities</h4>
                  {logsToShow.length > 0 ? logsToShow.map((log, i) => (
                    <div key={log.id} className={styles.checklistItem + ' ' + (log.completed ? 'completed' : 'pending') + (isEditing ? ' ' + styles.editable : '')} style={{flexDirection:'column',alignItems:'flex-start'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={log.completed}
                            onChange={() => handleChecklistToggle(i)}
                            style={{width:18,height:18,cursor:'pointer'}}
                          />
                        ) : (
                          log.completed ? <FaRegCheckSquare style={{color:'#22c55e'}}/> : <FaRegSquare style={{color:'#f59e42'}}/>
                        )}
                        <span style={{fontWeight:600,textDecoration:log.completed?'line-through':'none'}}>
                          {isEditing && String(log.id)?.startsWith('new-') ? (
                            <input 
                              value={log.task_performed || ''} 
                              onChange={e => handleNewLogChange(i - editingLogs.length, 'task_performed', e.target.value)}
                              placeholder="Enter task performed"
                              className={styles.editHighlight}
                              style={{width: '200px'}}
                            />
                          ) : (
                            log.task_performed
                          )}
                        </span>
                        {getTaskStatusIcon(log.status)}
                        <span style={{fontSize:12, color:'#888'}}>{log.status === 'completed' ? 'Completed' : 'Pending'}</span>
                        {isEditing && String(log.id)?.startsWith('new-') && (
                          <button 
                            onClick={() => removeNewLog(i - editingLogs.length)}
                            style={{marginLeft: 'auto', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer'}}
                          >
                            <FaTrash size={14} />
                          </button>
                        )}
                      </div>
                      <div style={{marginLeft:28}}>
                        <div>
                          Maintained By: {isEditing && String(log.id)?.startsWith('new-') ? (
                            <span style={{fontWeight: 500}}>{log.maintained_by}</span>
                          ) : (
                            log.maintained_by
                          )}
                        </div>
                        <div>Status: {log.status.charAt(0).toUpperCase() + log.status.slice(1)}</div>
                        <div>Date: {formatDisplayDate(log.maintenance_date)}</div>
                        <div>
                          Notes: {isEditing ? (
                            <input 
                              value={log.notes || ''} 
                              onChange={e => String(log.id)?.startsWith('new-') ? handleNewLogChange(i - editingLogs.length, 'notes', e.target.value) : handleLogChange(i, 'notes', e.target.value)} 
                              className={styles.editHighlight} 
                            />
                          ) : (
                            <span>{log.notes}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )) : <div style={{color: '#888'}}>No logs found.</div>}
                  {isEditing && (
                    <>
                      <button 
                        type="button"
                        onClick={addNewLog}
                        className={styles.addNewMaintBtn}
                      >
                        <FaPlus size={14} />
                        Add New Maintenance Log
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.tabsContent}>
                <div style={{textAlign: 'center', padding: '40px 20px', color: '#666'}}>
                  <FaClipboardList style={{fontSize: '48px', marginBottom: '16px', opacity: 0.5}} />
                  <p>No additional tabs available for this item type.</p>
                  <p style={{fontSize: '14px', marginTop: '8px'}}>Tools and Supplies items show all relevant information in previous tabs.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
