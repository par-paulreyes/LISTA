"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiClient } from "../../config/api";
import './inventory.css';

interface Item {
  id: number;
  property_no: string;
  article_type: string;
  image_url?: string;
  location?: string;
  has_pending_maintenance?: boolean;
  pending_maintenance_count?: number;
  qr_code?: string;
  serial_no?: string;
  category?: string;
  item_status?: string;
  specifications?: string;
  remarks?: string;
}

function InventoryPageContent() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [articleType, setArticleType] = useState("");
  const [maintenanceFilter, setMaintenanceFilter] = useState("");
  const [category, setCategory] = useState("");
  const [itemStatus, setItemStatus] = useState("");
  const [mounted, setMounted] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [modalCategory, setModalCategory] = useState("");
  const [modalArticleType, setModalArticleType] = useState("");
  const [modalItemStatus, setModalItemStatus] = useState("");
  const [modalMaintenanceFilter, setModalMaintenanceFilter] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();

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

    // Check for URL parameters to set initial filters
    const maintenanceParam = searchParams.get('maintenance');
    if (maintenanceParam) {
      setMaintenanceFilter(maintenanceParam);
    }

    apiClient
      .get("/items")
      .then((res) => {
        // Add maintenance status to items
        const itemsWithMaintenance = res.data.map((item: any) => ({
          ...item,
          has_pending_maintenance: item.maintenance_status === 'pending' || item.pending_maintenance_count > 0,
          pending_maintenance_count: item.pending_maintenance_count || 0
        }));
        setItems(itemsWithMaintenance);
      })
      .catch((err) => setError("Error loading items"))
      .finally(() => setLoading(false));
  }, [router, searchParams, mounted]);

  // Filter logic
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      (item.property_no && item.property_no.toLowerCase().includes(search.toLowerCase())) ||
      (item.qr_code && item.qr_code.toLowerCase().includes(search.toLowerCase())) ||
      (item.serial_no && item.serial_no.toLowerCase().includes(search.toLowerCase())) ||
      (item.article_type && item.article_type.toLowerCase().includes(search.toLowerCase())) ||
      (item.specifications && item.specifications.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = category ? item.category === category : true;
    const matchesArticleType = articleType ? item.article_type === articleType : true;
    const matchesItemStatus = itemStatus ? item.item_status === itemStatus : true;
    
    // Maintenance filter logic
    let matchesMaintenance = true;
    if (maintenanceFilter === "pending") {
      matchesMaintenance = item.has_pending_maintenance === true;
    } else if (maintenanceFilter === "completed") {
      matchesMaintenance = item.has_pending_maintenance === false;
    }
    
    return matchesSearch && matchesCategory && matchesArticleType && matchesItemStatus && matchesMaintenance;
  });

  // Get unique values for filters
  const categories = ["Electronic", "Utility", "Tool", "Supply"];
  const articleTypes = Array.from(new Set(items.map((item) => item.article_type)));
  const itemStatuses = Array.from(new Set(items.map((item) => item.item_status).filter(Boolean)));

  // Handle clicking outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };
    if (showExportDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportDropdown]);

  // Export handler for inventory
  const handleExport = async (format: string) => {
    setExporting(true);
    try {
      const response = await apiClient.get(`/items/export?format=${format}`, {
        responseType: 'blob',
      });
      
      let mimeType = 'text/csv';
      let fileExtension = format;
      
      if (format === 'pdf') {
        mimeType = 'application/pdf';
      } else if (format === 'excel') {
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExtension = 'xlsx';
      }
      
      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // When opening modal, sync modal state with current filter state
  const openFilterModal = () => {
    setModalCategory(category);
    setModalArticleType(articleType);
    setModalItemStatus(itemStatus);
    setModalMaintenanceFilter(maintenanceFilter);
    setShowFilterModal(true);
  };
  // When applying filter, sync main state with modal state
  const applyModalFilters = () => {
    setCategory(modalCategory);
    setArticleType(modalArticleType);
    setItemStatus(modalItemStatus);
    setMaintenanceFilter(modalMaintenanceFilter);
    setShowFilterModal(false);
  };

  return (
    <div className="main-container">
      <div className="inventory-header-row">
        <h3 className="inventory-header-title">Inventory</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="filter-modal-btn"
            onClick={openFilterModal}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: '6px'}}>
              <path d="M4 4h16M6 8h12M8 12h8M10 16h4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Filter
          </button>
          <div className={`export-dropdown ${showExportDropdown ? 'open' : ''}`} ref={dropdownRef}>
            <button
              className="export-dropdown-btn"
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              disabled={exporting}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </button>
            {showExportDropdown && (
              <div className="export-dropdown-menu">
                <button
                  className="export-dropdown-item"
                  onClick={() => {
                    handleExport("excel");
                    setShowExportDropdown(false);
                  }}
                  disabled={exporting}
                >
                  {exporting ? "Exporting..." : "Export Excel"}
                </button>
                <button
                  className="export-dropdown-item"
                  onClick={() => {
                    handleExport("csv");
                    setShowExportDropdown(false);
                  }}
                  disabled={exporting}
                >
                  {exporting ? "Exporting..." : "Export CSV"}
                </button>
                <button
                  className="export-dropdown-item"
                  onClick={() => {
                    handleExport("pdf");
                    setShowExportDropdown(false);
                  }}
                  disabled={exporting}
                >
                  {exporting ? "Exporting..." : "Export PDF"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Filter Modal */}
      {showFilterModal && (
        <div className="filter-modal-overlay">
          <div className="filter-modal">
            <button
              className="filter-modal-close"
              onClick={() => setShowFilterModal(false)}
              aria-label="Close filter modal"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="5" x2="15" y2="15" strokeLinecap="round" />
                <line x1="15" y1="5" x2="5" y2="15" strokeLinecap="round" />
              </svg>
            </button>
            <div className="filter-modal-title">Filter</div>
            <div className="filter-modal-fields">
              <div className="filter-modal-field">
                <label>Category</label>
                <select
                  value={modalCategory}
                  onChange={e => setModalCategory(e.target.value)}
                  className="filter-modal-select"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="filter-modal-field">
                <label>Type</label>
                <select
                  value={modalArticleType}
                  onChange={e => setModalArticleType(e.target.value)}
                  className="filter-modal-select"
                >
                  <option value="">All Types</option>
                  {articleTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="filter-modal-field">
                <label>Status</label>
                <select
                  value={modalItemStatus}
                  onChange={e => setModalItemStatus(e.target.value)}
                  className="filter-modal-select"
                >
                  <option value="">All Status</option>
                  {itemStatuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="filter-modal-field">
                <label>Maintenance</label>
                <select
                  value={modalMaintenanceFilter}
                  onChange={e => setModalMaintenanceFilter(e.target.value)}
                  className="filter-modal-select"
                >
                  <option value="">All Maintenance Status</option>
                  <option value="pending">Pending Maintenance</option>
                  <option value="completed">Completed Maintenance</option>
                </select>
              </div>
            </div>
            <div className="filter-modal-actions">
              <button
                className="filter-modal-cancel"
                onClick={() => {
                  setModalCategory("");
                  setModalArticleType("");
                  setModalItemStatus("");
                  setModalMaintenanceFilter("");
                  setCategory("");
                  setArticleType("");
                  setItemStatus("");
                  setMaintenanceFilter("");
                  setShowFilterModal(false);
                }}
              >
                Clear
              </button>
              <button
                className="filter-modal-apply"
                onClick={applyModalFilters}
              >
                Filter
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Search Bar */}
      <div
        className="inventory-search-container"
        style={{
          background: '#fff',
          border: '1.5px solid #d1d5db',
          borderRadius: '12px',
          marginBottom: '18px',
          marginTop: '15px',
          padding: '0 10px',
          boxSizing: 'border-box',
          height: '48px',
          boxShadow: 'none',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          width: '100%'
        }}
      >
        <div className="search-icon">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <input
          type="text"
          className="search-input"
          placeholder="Search by QR Code, Description/Specs, Property No., Serial No."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {/* Filter Status Display */}
      {maintenanceFilter === "pending" && (
        <div style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '0.5rem',
          padding: '0.75rem',
          marginBottom: '1rem',
          color: '#92400e'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚠️</span>
            <span style={{ fontWeight: '600' }}>Showing items with pending maintenance</span>
          </div>
          <button 
            onClick={() => setMaintenanceFilter("")}
            style={{
              marginTop: '0.5rem',
              color: '#92400e',
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Clear filter
          </button>
        </div>
      )}
      {!mounted && <div className="text-center text-blue-600">Loading...</div>}
      {mounted && loading && <div className="text-center text-blue-600">Loading...</div>}
      {mounted && error && <div className="text-center text-red-500">{error}</div>}
      {mounted && !loading && !error && (
        <div>
          {filteredItems.length === 0 && (
            <div className="text-center text-gray-500 p-6">No items found.</div>
          )}
          {filteredItems.map((item) => {
            // Determine status class
            let statusClass = "";
            if (item.item_status === "Available") statusClass = "status-available";
            else if (item.item_status === "To be Borrowed") statusClass = "status-to-borrow";
            else if (item.item_status === "Borrowed") statusClass = "status-borrowed";
            else if (item.item_status === "Bad Condition") statusClass = "status-bad";
            else if (item.item_status === "Out of Stock") statusClass = "status-out-of-stock";
            // fallback: no extra class
            return (
              <div key={item.id} className="inventory-card">
                <Link href={`/inventory/${item.id}`} className="flex items-center w-full" style={{padding: 0, alignItems: 'stretch'}}>
                  <div className="inventory-icon">
                    {item.article_type.toLowerCase().includes('desktop') && (
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                        <line x1="8" y1="21" x2="16" y2="21"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                      </svg>
                    )}
                    {item.article_type.toLowerCase().includes('laptop') && (
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                        <line x1="2" y1="10" x2="22" y2="10"/>
                      </svg>
                    )}
                    {item.article_type.toLowerCase().includes('printer') && (
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <polyline points="6,9 6,2 18,2 18,9"/>
                        <path d="M6,18H4a2,2 0 0,1 -2,-2v-5a2,2 0 0,1 2,-2h16a2,2 0 0,1 2,2v5a2,2 0 0,1 -2,2h-2"/>
                        <rect x="6" y="14" width="12" height="8"/>
                      </svg>
                    )}
                    {item.article_type.toLowerCase().includes('monitor') && (
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                        <line x1="8" y1="21" x2="16" y2="21"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                      </svg>
                    )}
                    {item.article_type.toLowerCase().includes('scanner') && (
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                        <line x1="8" y1="21" x2="16" y2="21"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                        <line x1="6" y1="8" x2="18" y2="8"/>
                        <line x1="6" y1="12" x2="18" y2="12"/>
                      </svg>
                    )}
                    {item.article_type.toLowerCase().includes('server') && (
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                        <line x1="6" y1="6" x2="6" y2="6"/>
                        <line x1="6" y1="18" x2="6" y2="18"/>
                      </svg>
                    )}
                    {item.article_type.toLowerCase().includes('network') && (
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 1v6m0 6v6"/>
                        <path d="M21 12h-6m-6 0H3"/>
                        <path d="M19.78 4.22l-4.24 4.24m-6.36 6.36l-4.24 4.24"/>
                        <path d="M4.22 4.22l4.24 4.24m6.36 6.36l4.24 4.24"/>
                      </svg>
                    )}
                    {!item.article_type.toLowerCase().includes('desktop') && 
                    !item.article_type.toLowerCase().includes('laptop') && 
                    !item.article_type.toLowerCase().includes('printer') && 
                    !item.article_type.toLowerCase().includes('monitor') && 
                    !item.article_type.toLowerCase().includes('scanner') && 
                    !item.article_type.toLowerCase().includes('server') && 
                    !item.article_type.toLowerCase().includes('network') && (
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21,15 16,10 5,21"/>
                      </svg>
                    )}
                  </div>
                  <div className="inventory-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <div className="inventory-propno">
                        {item.qr_code ? (
                          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1f2937' }}>
                            {item.qr_code}
                          </span>
                        ) : (
                          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1f2937' }}>
                            {item.property_no}
                          </span>
                        )}
                      </div>
                      <div className={`inventory-borrowing-status ${statusClass}`}>
                        {item.item_status || 'Available'}
                      </div>
                    </div>
                    <div className="inventory-type">{item.article_type}</div>
                    {item.has_pending_maintenance && (
                      <div className="maintenance-warning">
                        <span>⚠️</span>
                        <span>
                          Pending Maintenance Task ({item.pending_maintenance_count ?? 1} task{(item.pending_maintenance_count ?? 1) > 1 ? 's' : ''})
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InventoryPageContent />
    </Suspense>
  );
} 