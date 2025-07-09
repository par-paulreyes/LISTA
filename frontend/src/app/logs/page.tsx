"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiClient, getApiUrl } from "../../config/api";
import "./logs.css";
import "../inventory/inventory.css";

interface Log {
  id: number;
  property_no: string;
  article_type: string;
  maintenance_date: string;
  task_performed: string;
  maintained_by: string;
  qr_code?: string;
  serial_no?: string;
  specifications?: string;
  category?: string;
  quantity?: number;
  notes?: string;
  status?: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");
  const [mounted, setMounted] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Modal state variables
  const [modalCategory, setModalCategory] = useState("");
  const [modalSortOrder, setModalSortOrder] = useState<"recent" | "oldest">("recent");
  
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle clicking outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)) {
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

  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    apiClient
      .get("/logs")
      .then((res) => setLogs(res.data))
      .catch((err) => setError("Error loading logs"))
      .finally(() => setLoading(false));
  }, [router, mounted]);

  const handleExport = async (format: string) => {
    setExporting(true);
    try {
      const response = await apiClient.get(`/logs/export?format=${format}`, {
        responseType: 'blob', // Important for file downloads
      });
      // Create a blob URL and trigger download
      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' : 'text/csv'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `maintenance_logs.${format}`;
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

  // Helper function to detect category from QR code
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

  // Helper function to get item category
  const getItemCategory = (log: Log) => {
    return log.category || detectCategoryFromQR(log.qr_code || '') || 'Unknown';
  };

  // Filter and sort logs
  const filteredAndSortedLogs = logs
    .filter((log) => {
      const matchesSearch =
        (log.qr_code &&
          log.qr_code.toLowerCase().includes(search.toLowerCase())) ||
        (log.specifications &&
          log.specifications.toLowerCase().includes(search.toLowerCase())) ||
        (log.property_no &&
          log.property_no.toLowerCase().includes(search.toLowerCase())) ||
        (log.serial_no &&
          log.serial_no.toLowerCase().includes(search.toLowerCase()));

      const matchesCategory = categoryFilter ? getItemCategory(log) === categoryFilter : true;
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const dateA = new Date(a.maintenance_date).getTime();
      const dateB = new Date(b.maintenance_date).getTime();
      
      if (sortOrder === "recent") {
        return dateB - dateA; // Most recent first
      } else {
        return dateA - dateB; // Oldest first
      }
    });

  // When opening modal, sync modal state with current filter state
  const openFilterModal = () => {
    setModalCategory(categoryFilter);
    setModalSortOrder(sortOrder);
    setShowFilterModal(true);
  };

  // When applying filter, sync main state with modal state
  const applyModalFilters = () => {
    setCategoryFilter(modalCategory);
    setSortOrder(modalSortOrder);
    setShowFilterModal(false);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setModalCategory("");
    setModalSortOrder("recent");
    setCategoryFilter("");
    setSortOrder("recent");
    setShowFilterModal(false);
  };

  return (
    <div className="main-container">
      <div className="logs-header-row">
        <h3 className="logs-header-title">Logs</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="filter-modal-btn"
            onClick={openFilterModal}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor"
              strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: '6px'}}>
              <path d="M4 4h16M6 8h12M8 12h8M10 16h4"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Filter
          </button>
          <div className={`export-dropdown ${showExportDropdown ? 'open' : ''}`} ref={dropdownRef}>
            <button
              className="export-dropdown-btn"
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              disabled={exporting}
            >
              <svg width="16" height="16" fill="none"
                stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
                stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="5" x2="15" y2="15" strokeLinecap="round" />
                <line x1="15" y1="5" x2="5" y2="15" strokeLinecap="round" />
              </svg>
            </button>
            <div className="filter-modal-title">Filter & Sort</div>

            <div className="filter-modal-fields">
              <div className="filter-modal-field">
                <label>Category</label>
                <select
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value)}
                  className="filterbar-select"
                  style={{
                    padding: '8px 12px',
                    border: '1.5px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: '#fff',
                    fontSize: '14px',
                    minWidth: '120px'
                  }}
                >
                  <option value="">All Categories</option>
                  <option value="Electronic">Electronic</option>
                  <option value="Utility">Utility</option>
                  <option value="Tool">Tool</option>
                  <option value="Supply">Supply</option>
                </select>
              </div>

              <div className="filter-modal-field">
                <label>Sort by Date</label>
                <select
                  value={modalSortOrder}
                  onChange={(e) => setModalSortOrder(e.target.value as "recent" | "oldest")}
                  className="filterbar-select"
                  style={{
                    padding: '8px 12px',
                    border: '1.5px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: '#fff',
                    fontSize: '14px',
                    minWidth: '120px'
                  }}
                >
                  <option value="recent">Recent to Oldest</option>
                  <option value="oldest">Oldest to Recent</option>
                </select>
              </div>
            </div>

            <div className="filter-modal-actions">
              <button
                className="filter-modal-cancel"
                onClick={clearAllFilters}
              >
                Clear
              </button>
              <button
                className="filter-modal-apply"
                onClick={applyModalFilters}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="logs-search-container">
        <div className="search-icon">
          <svg width="20" height="20" fill="none" stroke="currentColor"
            strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <input
          type="text"
          className="search-input"
          placeholder="Search by QR Code, Type"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {!mounted && <div className="loading">Loading...</div>}
      {mounted && loading && <div className="loading">Loading...</div>}
      {mounted && error && <div className="error">{error}</div>}

      {mounted && !loading && !error && (
        <div className="logs-container">
          {filteredAndSortedLogs.length === 0 && (
            <div className="no-logs">No logs found.</div>
          )}
          {filteredAndSortedLogs.length > 0 && (
            <div className="table-container">
              <table className="table-proper">
                <thead>
                  <tr className="table-row">
                    <th className="th">TYPE</th>
                    <th className="th">QR CODE</th>
                    <th className="th">TASK PERFORMED</th>
                    <th className="th">MAINTAINED BY</th>
                    <th className="th">DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedLogs.map((log, index) => (
                    <tr key={log.id} style={{
                      borderBottom: index < filteredAndSortedLogs.length - 1 ? '1px solid #e9ecef' : 'none'
                    }}>
                      <td>{log.article_type}</td>
                      <td>{log.qr_code || log.property_no}</td>
                      <td>{log.task_performed}</td>
                      <td>{log.maintained_by}</td>
                      <td>
                        {new Date(log.maintenance_date).toLocaleDateString('en-US', {
                          month: 'numeric',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}