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
  const [mounted, setMounted] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Filter logs by search and category
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.qr_code && log.qr_code.toLowerCase().includes(search.toLowerCase())) ||
      (log.specifications && log.specifications.toLowerCase().includes(search.toLowerCase())) ||
      (log.property_no && log.property_no.toLowerCase().includes(search.toLowerCase())) ||
      (log.serial_no && log.serial_no.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = categoryFilter ? log.category === categoryFilter : true;
    
    return matchesSearch && matchesCategory;
  });

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

  return (
    <div className="main-container">
      <div className="logs-header">
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>Maintenance Logs</h1>
        <p style={{ margin: '8px 0 0 0', opacity: 0.9, textAlign: 'center' }}>
          Track and review equipment maintenance activities
        </p>
      </div>
      <div className="body-container">
        <div className="export-dropdown-row">
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, textAlign: 'center' }}>
            Download maintenance records as PDF or CSV files
          </p>
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
        {/* Search Bar */}
        <div
          className="logs-search-container"
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
            placeholder="Search by QR Code, Item Description/Specs, Property No./Serial No."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Category Filter */}
        <div className="filterbar-row" style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '18px',
          flexWrap: 'wrap'
        }}>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
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
            <option value="Electronic">Electronics</option>
            <option value="Utility">Utility</option>
            <option value="Tool">Tool</option>
            <option value="Supply">Supply</option>
          </select>
        </div>

        {!mounted && <div className="loading">Loading...</div>}
        {mounted && loading && <div className="loading">Loading...</div>}
        {mounted && error && <div className="error">{error}</div>}
       
        {mounted && !loading && !error && (
          <div className="logs-container">
            {filteredLogs.length === 0 && (
              <div className="no-logs">No logs found.</div>
            )}
            {filteredLogs.map((log) => {
              const itemCategory = getItemCategory(log);
              const isElectronic = itemCategory === "Electronic";
              const isUtility = itemCategory === "Utility";
              const isToolOrSupply = itemCategory === "Tool" || itemCategory === "Supply";

              return (
                <div key={log.id} className="log-card">
                  <div className="log-card-header">
                    <div className="log-icon">
                      {log.article_type.toLowerCase().includes('desktop') && (
                        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                          <line x1="8" y1="21" x2="16" y2="21"/>
                          <line x1="12" y1="17" x2="12" y2="21"/>
                        </svg>
                      )}
                      {log.article_type.toLowerCase().includes('laptop') && (
                        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                          <line x1="2" y1="10" x2="22" y2="10"/>
                        </svg>
                      )}
                      {log.article_type.toLowerCase().includes('printer') && (
                        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <polyline points="6,9 6,2 18,2 18,9"/>
                          <path d="M6,18H4a2,2 0 0,1 -2,-2v-5a2,2 0 0,1 2,-2h16a2,2 0 0,1 2,2v5a2,2 0 0,1 -2,2h-2"/>
                          <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                      )}
                      {log.article_type.toLowerCase().includes('keyboard') && (
                        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
                          <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h.01M10 16h.01M14 16h.01M18 16h.01"/>
                        </svg>
                      )}
                      {log.article_type.toLowerCase().includes('pc') && (
                        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                          <line x1="8" y1="21" x2="16" y2="21"/>
                          <line x1="12" y1="17" x2="12" y2="21"/>
                          <circle cx="12" cy="8" r="1"/>
                        </svg>
                      )}
                      {!log.article_type.toLowerCase().includes('desktop') &&
                       !log.article_type.toLowerCase().includes('laptop') &&
                       !log.article_type.toLowerCase().includes('printer') &&
                       !log.article_type.toLowerCase().includes('keyboard') &&
                       !log.article_type.toLowerCase().includes('pc') && (
                        <span className="text-xl">📷</span>
                      )}
                    </div>
                    <div className="log-main-info">
                      <h3 className="property-no">
                        {log.qr_code || log.property_no}
                        {log.serial_no && ` / ${log.serial_no}`}
                      </h3>
                      <p className="article-type">{log.article_type}</p>
                    </div>
                    <div className="log-date">
                      <span className="date-badge">
                        {new Date(log.maintenance_date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="log-card-body">
                    <div className="detail-section">
                      {/* Electronics: Show QR Code / Property No. / Serial No., Article Type, Tasks Performed, Date, Maintained by */}
                      {isElectronic && (
                        <>
                          <div className="detail-item">
                            <span className="detail-icon">🔧</span>
                            <div className="detail-content">
                              <span className="detail-label">Task Performed</span>
                              <p className="detail-value">{log.task_performed}</p>
                            </div>
                          </div>
                          <div className="detail-item">
                            <span className="detail-icon">👤</span>
                            <div className="detail-content">
                              <span className="detail-label">Maintained By</span>
                              <p className="detail-value">{log.maintained_by}</p>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Utilities: Show QR Code / Property No. / Serial No., Item Description/Specs, Tasks Performed, Date, Maintained by */}
                      {isUtility && (
                        <>
                          <div className="detail-item">
                            <span className="detail-icon">📝</span>
                            <div className="detail-content">
                              <span className="detail-label">Item Description/Specs</span>
                              <p className="detail-value">{log.specifications || 'No description available'}</p>
                            </div>
                          </div>
                          <div className="detail-item">
                            <span className="detail-icon">🔧</span>
                            <div className="detail-content">
                              <span className="detail-label">Task Performed</span>
                              <p className="detail-value">{log.task_performed}</p>
                            </div>
                          </div>
                          <div className="detail-item">
                            <span className="detail-icon">👤</span>
                            <div className="detail-content">
                              <span className="detail-label">Maintained By</span>
                              <p className="detail-value">{log.maintained_by}</p>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Tools & Supplies: Show QR Code / Property No. / Serial No., Item Description/Specs, Quantity change, Date, Updated by */}
                      {isToolOrSupply && (
                        <>
                          <div className="detail-item">
                            <span className="detail-icon">📝</span>
                            <div className="detail-content">
                              <span className="detail-label">Item Description/Specs</span>
                              <p className="detail-value">{log.specifications || 'No description available'}</p>
                            </div>
                          </div>
                          <div className="detail-item">
                            <span className="detail-icon">📊</span>
                            <div className="detail-content">
                              <span className="detail-label">Quantity</span>
                              <p className="detail-value">{log.quantity || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="detail-item">
                            <span className="detail-icon">👤</span>
                            <div className="detail-content">
                              <span className="detail-label">Updated By</span>
                              <p className="detail-value">{log.maintained_by}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
