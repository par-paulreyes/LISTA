"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { apiClient } from "../../config/api";
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
  const [isFilterHovered, setIsFilterHovered] = useState(false);
  const [isExportHovered, setIsExportHovered] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 10;
  
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
    const tagPattern = /(?:-|^)(PC|PR|MON|TP|MS|KEY|UPS|TAB|PWB|UTLY|TOOL|SPLY)(?:-|\d|$)/i;
    const match = qrCode.match(tagPattern);
    if (match) {
      const tag = match[1].toUpperCase();
      if (["PC","PR","MON","TP","MS","KEY","UPS","TAB","PWB"].includes(tag)) return "Electronic";
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

  const totalPages = Math.ceil(filteredAndSortedLogs.length / logsPerPage);
  const startIndex = (currentPage - 1) * logsPerPage;
  const paginatedLogs = filteredAndSortedLogs.slice(
    startIndex,
    startIndex + logsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, sortOrder]);

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
      <div className="inventory-controls-bar logs-controls-bar">
        <div className="inventory-search-container">
          <div className="search-icon">
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            className="search-input"
            placeholder="Search by QR code, property no., or serial no."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="inventory-action-buttons">
          <button
            className="filter-modal-btn"
            onClick={openFilterModal}
            onMouseEnter={() => setIsFilterHovered(true)}
            onMouseLeave={() => setIsFilterHovered(false)}
          >
            <Image
              src={
                isFilterHovered
                  ? "/assets/icons/filter_active.svg"
                  : "/assets/icons/filter_inactive.svg"
              }
              alt="Filter"
              width={16}
              height={16}
            />
            Filters
          </button>
          <div
            className={`export-dropdown ${showExportDropdown ? "open" : ""}`}
            ref={dropdownRef}
          >
            <button
              className="export-dropdown-btn"
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              disabled={exporting}
              onMouseEnter={() => setIsExportHovered(true)}
              onMouseLeave={() => setIsExportHovered(false)}
            >
              <Image
                src={
                  isExportHovered
                    ? "/assets/icons/export_active.svg"
                    : "/assets/icons/export_inactive.svg"
                }
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

      {(categoryFilter || sortOrder === "oldest") && (
        <div className="logs-filter-chip-row">
          {categoryFilter && (
            <button
              className="logs-filter-chip"
              onClick={() => setCategoryFilter("")}
            >
              Category: {categoryFilter}
              <span aria-hidden="true">x</span>
            </button>
          )}
          {sortOrder === "oldest" && (
            <button
              className="logs-filter-chip"
              onClick={() => setSortOrder("recent")}
            >
              Oldest first
              <span aria-hidden="true">x</span>
            </button>
          )}
        </div>
      )}
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

      {!mounted && <div className="loading">Loading...</div>}
      {mounted && loading && <div className="loading">Loading...</div>}
      {mounted && error && <div className="error">{error}</div>}

      {mounted && !loading && !error && (
        <div className="inventory-table-wrapper">
          <table className="inventory-table logs-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Task Performed</th>
                <th>Maintained By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="inventory-table-empty">
                    No logs found.
                  </td>
                </tr>
              )}
              {filteredAndSortedLogs.length > 0 &&
                paginatedLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="inventory-table-row logs-table-row"
                  >
                    <td className="inventory-table-item-name">
                      {log.qr_code || log.property_no || "N/A"}
                    </td>
                    <td className="inventory-table-category">
                      {getItemCategory(log)}
                    </td>
                    <td className="inventory-table-type">
                      {log.task_performed || "—"}
                    </td>
                    <td>{log.maintained_by || "—"}</td>
                    <td className="logs-table-date">
                      {new Date(log.maintenance_date).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {filteredAndSortedLogs.length > 0 && totalPages > 1 && (
            <div className="inventory-pagination">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <polyline points="15,18 9,12 15,6" />
                </svg>
                Previous
              </button>
              <div className="pagination-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          className={`pagination-number ${
                            currentPage === page ? "active" : ""
                          }`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      );
                    } else if (
                      page === currentPage - 2 ||
                      page === currentPage + 2
                    ) {
                      return (
                        <span key={`ellipsis-${page}`} className="pagination-ellipsis">
                          ...
                        </span>
                      );
                    }
                    return null;
                  }
                )}
              </div>
              <button
                className="pagination-btn"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
