"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiClient } from "../../config/api";
import './inventory.css';
import { FiRefreshCw } from 'react-icons/fi';


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
  created_at?: string; // Added for recently added calculation
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
  const [isFilterHovered, setIsFilterHovered] = useState(false);
  const [isExportHovered, setIsExportHovered] = useState(false);


  // Dashboard statistics state
  const [goodConditionCount, setGoodConditionCount] = useState(0);
  const [badConditionCount, setBadConditionCount] = useState(0);
  const [pendingMaintenance, setPendingMaintenance] = useState(0);
  const [completedMaintenance, setCompletedMaintenance] = useState(0);
  const [totalMaintenance, setTotalMaintenance] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<{ [key: string]: number }>({});
  const [recentlyAdded, setRecentlyAdded] = useState(0);
  const [todayAdded, setTodayAdded] = useState(0);
  const [yesterdayAdded, setYesterdayAdded] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;


  const router = useRouter();
  const searchParams = useSearchParams();


  const fetchItems = async (showLoading = true) => {
    if (showLoading) setLoading(true); else setRefreshing(true);
    setError("");
    try {
      const res = await apiClient.get("/items");
      const itemsWithMaintenance = res.data.map((item: any) => ({
        ...item,
        has_pending_maintenance: item.maintenance_status === 'pending' || item.pending_maintenance_count > 0,
        pending_maintenance_count: item.pending_maintenance_count || 0
      }));
      setItems(itemsWithMaintenance);
      setLastUpdated(new Date());
    } catch (err) {
      setError("Error loading items");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


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
    const itemStatusParam = searchParams.get('item_status');
   
    if (maintenanceParam) {
      setMaintenanceFilter(maintenanceParam);
    }
   
    if (itemStatusParam) {
      setItemStatus(itemStatusParam);
    }
   
    fetchItems();
  }, [router, searchParams, mounted]);


  const handleManualRefresh = () => {
    fetchItems(false);
  };


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


  // Pagination logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);


  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, category, articleType, itemStatus, maintenanceFilter]);


  // Handle delete item
  const handleDelete = async (itemId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this item?')) return;
   
    try {
      await apiClient.delete(`/items/${itemId}`);
      fetchItems(false);
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Failed to delete item. Please try again.');
    }
  };


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
      {/* Top Control Bar */}
      <div className="inventory-controls-bar">
        {/* Search Bar */}
        <div className="inventory-search-container">
          <div className="search-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <input
            type="text"
            className="search-input"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>


        {/* Action Buttons */}
        <div className="inventory-action-buttons">
          <button
            className="filter-modal-btn"
            onClick={openFilterModal}
            onMouseEnter={() => setIsFilterHovered(true)}
            onMouseLeave={() => setIsFilterHovered(false)}
          >
            <Image
              src={isFilterHovered ? "/assets/icons/filter_active.svg" : "/assets/icons/filter_inactive.svg"}
              alt="Filter"
              width={16}
              height={16}
            />
            Filters
          </button>
          <div className={`export-dropdown ${showExportDropdown ? 'open' : ''}`} ref={dropdownRef}>
              <button
                className="export-dropdown-btn"
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={exporting}
                onMouseEnter={() => setIsExportHovered(true)}
                onMouseLeave={() => setIsExportHovered(false)}
              >
                <Image
                  src={isExportHovered ? "/assets/icons/export_active.svg" : "/assets/icons/export_inactive.svg"}
                  alt="Export"
                  width={16}
                  height={16}
                />
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
          <button
            className="add-item-btn"
            onClick={() => router.push('/inventory/add')}
          >
            <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: '6px'}}>
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add New Item
          </button>
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
     
      {/* Bad Condition Filter Display */}
      {itemStatus === "Bad Condition" && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.5rem',
          padding: '0.75rem',
          marginBottom: '1rem',
          color: '#b91c1c'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🚨</span>
            <span style={{ fontWeight: '600' }}>Showing items that need action (Bad Condition)</span>
          </div>
          <div style={{ fontSize: '0.875rem', marginTop: '0.25rem', opacity: 0.8 }}>
            These items require immediate attention and maintenance.
          </div>
          <button
            onClick={() => {
              setItemStatus("");
              router.push('/inventory');
            }}
            style={{
              marginTop: '0.5rem',
              color: '#b91c1c',
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
      {!mounted && <div className="text-center" style={{ color: '#222428', padding: '2rem' }}>Loading...</div>}
      {mounted && loading && <div className="text-center" style={{ color: '#222428', padding: '2rem' }}>Loading...</div>}
      {mounted && error && <div className="text-center" style={{ color: '#820000', padding: '2rem' }}>{error}</div>}
      {mounted && !loading && !error && (
        <div className="inventory-table-wrapper">
          {/* Table */}
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Type</th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="inventory-table-empty">
                    No items found.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  // Determine status class
                  let statusClass = "";
                  if (item.item_status === "Available") statusClass = "status-available";
                  else if (item.item_status === "To be Borrowed") statusClass = "status-to-borrow";
                  else if (item.item_status === "Borrowed") statusClass = "status-borrowed";
                  else if (item.item_status === "Bad Condition") statusClass = "status-bad";
                  else if (item.item_status === "Out of Stock") statusClass = "status-out-of-stock";
                 
                  const itemName = item.qr_code || item.property_no || 'Unnamed Item';
                  const itemType = item.article_type || 'N/A';
                  const itemCategory = item.category || 'N/A';
                 
                  return (
                    <tr key={item.id} className="inventory-table-row" onClick={() => router.push(`/inventory/${item.id}`)}>
                      <td className="inventory-table-item-name">{itemName}</td>
                      <td className="inventory-table-type">{itemType}</td>
                      <td className="inventory-table-category">{itemCategory}</td>
                      <td>
                        <span className={`inventory-status-pill ${statusClass}`}>
                          {item.item_status || 'Available'}
                        </span>
                      </td>
                      <td className="inventory-table-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="action-btn action-btn-edit"
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(`/inventory/${item.id}`);
                          }}
                          title="Edit"
                        >
                          <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={(e) => handleDelete(item.id, e)}
                          title="Delete"
                        >
                          <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19,6v14a2,2 0,0,1 -2,2H7a2,2 0,0,1 -2,-2V6m3,0V4a2,2 0,0,1 2,-2h4a2,2 0,0,1 2,2v2"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>


          {/* Pagination */}
          {filteredItems.length > 0 && totalPages > 1 && (
            <div className="inventory-pagination">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="15,18 9,12 15,6"/>
                </svg>
                Previous
              </button>
              <div className="pagination-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                    return (
                      <button
                        key={page}
                        className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="pagination-ellipsis">...</span>;
                  }
                  return null;
                })}
              </div>
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="9,18 15,12 9,6"/>
                </svg>
              </button>
            </div>
          )}
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

