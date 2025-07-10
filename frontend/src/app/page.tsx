"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./dashboard.module.css";
import { apiClient } from "../config/api";
import { FaHome, FaClipboardList, FaHistory, FaUser, FaSync, FaSyncAlt, FaTools, FaChartBar, FaBoxes, FaPlus, FaBoxOpen, FaMapMarkerAlt } from "react-icons/fa";
import { FiRefreshCw } from 'react-icons/fi';
import React from "react";




interface Item {
  id: number;
  property_no: string;
  qr_code: string;
  article_type: string; // This is the actual name field in the database
  specifications?: string;
  date_acquired?: string;
  end_user?: string;
  price?: number;
  location?: string;
  supply_officer?: string;
  company_name: string;
  image_url?: string;
  next_maintenance_date?: string;
  pending_maintenance_count?: number;
  maintenance_status?: string;
  item_status?: string;
  category?: string;
  system_status?: string;
  created_at: string;
  updated_at?: string;
}




export default function DashboardPage() {
  const [totalItems, setTotalItems] = useState(0);
  const [neededMaintenance, setNeededMaintenance] = useState(0);
  const [totalMaintenance, setTotalMaintenance] = useState(0);
  const [recentlyAdded, setRecentlyAdded] = useState(0);
  const [totalArticles, setTotalArticles] = useState(0);
  const [recentItems, setRecentItems] = useState<Item[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);


  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [criticalItems, setCriticalItems] = useState(0);
  const [completedMaintenance, setCompletedMaintenance] = useState(0);
  const [pendingMaintenance, setPendingMaintenance] = useState(0);
  const [topCategory, setTopCategory] = useState('');
  const [topCategoryCount, setTopCategoryCount] = useState(0);
  const [secondCategory, setSecondCategory] = useState('');
  const [secondCategoryCount, setSecondCategoryCount] = useState(0);
  const [todayAdded, setTodayAdded] = useState(0);
  const [yesterdayAdded, setYesterdayAdded] = useState(0);
  const [goodStatusCount, setGoodStatusCount] = useState(0);
  const [belowGoodCount, setBelowGoodCount] = useState(0);
  const [othersAddedThisWeek, setOthersAddedThisWeek] = useState(0);
  const [mostRecentOtherArticle, setMostRecentOtherArticle] = useState('');
  const [goodConditionCount, setGoodConditionCount] = useState(0);
  const [badConditionCount, setBadConditionCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<{ [key: string]: number }>({});
  const router = useRouter();




  // Function to fetch dashboard data
  const fetchDashboardData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError("");
   
    try {
      const [itemsRes, neededMaintenanceRes, maintenanceLogsRes] = await Promise.all([
        apiClient.get("/items"),
        apiClient.get("/items/maintenance/needed"),
        apiClient.get("/logs"),
      ]);




      const items = itemsRes.data;
      const neededMaintenance = neededMaintenanceRes.data;
      const maintenanceLogs = maintenanceLogsRes.data;
     
      // Calculate statistics
      const totalItems = items.length;
      const criticalItemsCount = items.filter((item: Item) => item.system_status === 'Poor' || item.system_status === 'Critical' || item.system_status === 'Fair' || item.system_status === 'Needs Repair' || item.system_status === 'Out of Order').length;
      const completedMaintenanceCount = maintenanceLogs.filter((log: any) => log.status === 'completed').length;
      const pendingMaintenanceCount = maintenanceLogs.filter((log: any) => log.status === 'pending').length;
      const totalMaintenanceCount = maintenanceLogs.length;
     
      // Calculate items needing maintenance (system_status below 'Good')
      const itemsNeedingMaintenance = items.filter((item: Item) =>
        item.system_status &&
        ['Poor', 'Critical', 'Fair', 'Needs Repair', 'Out of Order'].includes(item.system_status)
      ).length;
     
      // Calculate items with Good status
      const itemsWithGoodStatus = items.filter((item: Item) =>
        item.system_status &&
        item.system_status === 'Good'
      ).length;
     
      // Calculate category statistics (using article_type instead of category)
      const categoryCounts: { [key: string]: number } = {};
      items.forEach((item: Item) => {
        const category = item.article_type || 'Uncategorized';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
     
      const sortedCategories = Object.entries(categoryCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 2);
     
      const topCategoryName = sortedCategories[0]?.[0] || 'None';
      const topCategoryCount = sortedCategories[0]?.[1] as number || 0;
      const secondCategoryName = sortedCategories[1]?.[0] || 'None';
      const secondCategoryCount = sortedCategories[1]?.[1] as number || 0;
     
      // Calculate today and yesterday added items
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);


      const todayAddedCount = items.filter((item: Item) => {
        if (!item || !item.created_at) return false;
        const itemDate = new Date(item.created_at);
        return itemDate.toDateString() === today.toDateString();
      }).length;


      const yesterdayAddedCount = items.filter((item: Item) => {
        if (!item || !item.created_at) return false;
        const itemDate = new Date(item.created_at);
        return itemDate.toDateString() === yesterday.toDateString();
      }).length;


      // Get recently added items (last 5 items)
      const recentItemsList = items
        .filter((item: Item) => item && item.created_at) // Filter out items without creation date
        .sort((a: Item, b: Item) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);


      // Calculate recently added count (items added in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentlyAddedCount = items.filter((item: Item) => {
        if (!item || !item.created_at) return false;
        const itemDate = new Date(item.created_at);
        return itemDate >= sevenDaysAgo;
      }).length;


      // Calculate recently added articles this week
      const recentlyAddedArticles = items.filter((item: Item) => {
        if (!item || !item.created_at) return false;
        const itemDate = new Date(item.created_at);
        return itemDate >= sevenDaysAgo;
      });
      const recentlyAddedArticlesCount = recentlyAddedArticles.length;


      // Calculate 'other' articles (not Desktop or Printer) added this week
      const recentlyAddedOthers = recentlyAddedArticles.filter((item: Item) => {
        const type = (item.article_type || '').toLowerCase();
        return type !== 'desktop' && type !== 'printer';
      });
      const recentlyAddedOthersCount = recentlyAddedOthers.length;


      // Find the most recently added article type this week (excluding Desktop and Printer)
      let mostRecentOtherArticle = '';
      if (recentlyAddedOthers.length > 0) {
        mostRecentOtherArticle = recentlyAddedOthers[0].article_type || '';
      }
      setMostRecentOtherArticle(mostRecentOtherArticle);


      // Calculate item_status counts
      const goodCondition = items.filter((item: Item) => item.item_status === 'Available').length;
      const badCondition = items.filter((item: Item) => item.item_status === 'Bad Condition').length;
      setGoodConditionCount(goodCondition);
      setBadConditionCount(badCondition);
      // Calculate category counts (Electronic, Utility, Tool, Supply)
      const catCounts: { [key: string]: number } = { Electronic: 0, Utility: 0, Tool: 0, Supply: 0 };
      items.forEach((item: Item) => {
        if (item.category && catCounts.hasOwnProperty(item.category)) {
          catCounts[item.category]++;
        }
      });
      setCategoryCounts(catCounts);
     
      // Set all state variables
      setTotalItems(totalItems);
      setNeededMaintenance(itemsNeedingMaintenance);
      setTotalMaintenance(totalMaintenanceCount);
      setTotalArticles(totalItems); // Total articles is the same as total items
      setRecentlyAdded(recentlyAddedCount);
      setRecentItems(recentItemsList);
      setCriticalItems(criticalItemsCount);
      setCompletedMaintenance(completedMaintenanceCount);
      setPendingMaintenance(pendingMaintenanceCount);
      setTopCategory(topCategoryName);
      setTopCategoryCount(topCategoryCount);
      setSecondCategory(secondCategoryName);
      setSecondCategoryCount(secondCategoryCount);
      setTodayAdded(todayAddedCount);
      setYesterdayAdded(yesterdayAddedCount);
      setGoodStatusCount(itemsWithGoodStatus);
      setBelowGoodCount(itemsNeedingMaintenance);
      setOthersAddedThisWeek(recentlyAddedOthersCount);
     
      setLastUpdated(new Date());
     
      // Log the fetched data for debugging
      console.log('Dashboard data updated:', {
        totalItems: totalItems,
        neededMaintenance: itemsNeedingMaintenance,
        goodStatusCount: itemsWithGoodStatus,
        belowGoodCount: itemsNeedingMaintenance,
        totalMaintenance: totalMaintenanceCount,
        recentlyAdded: recentlyAddedCount,
        totalArticles: totalItems,
        criticalItems: criticalItemsCount,
        completedMaintenance: completedMaintenanceCount,
        pendingMaintenance: pendingMaintenanceCount,
        recentItems: recentItemsList.length
      });
     
    } catch (err: any) {
      console.error("Error loading dashboard stats:", err);
      setError("Error loading dashboard stats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);




  // Manual refresh function
  const handleManualRefresh = () => {
    fetchDashboardData(false);
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
    setLoading(true);
    apiClient.get("/users/profile")
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [router, mounted]);




  useEffect(() => {
    if (!mounted) return;
   
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }




    // Initial data fetch
    fetchDashboardData();




    // Set up automatic refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchDashboardData(false);
    }, 30000); // 30 seconds




    // Set up focus refresh (refresh when user returns to tab)
    const handleFocus = () => {
      fetchDashboardData(false);
    };




    // Set up visibility change refresh (refresh when user returns to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDashboardData(false);
      }
    };




    // Set up route change refresh (refresh when user navigates back to dashboard)
    const handleRouteChange = () => {
      // Check if we're on the dashboard page
      if (window.location.pathname === '/') {
        fetchDashboardData(false);
      }
    };




    // Check for maintenance update triggers
    const checkMaintenanceUpdates = () => {
      const refreshTrigger = localStorage.getItem('dashboard_refresh_trigger');
      if (refreshTrigger) {
        const triggerTime = parseInt(refreshTrigger);
        const currentTime = Date.now();
        // If trigger is less than 5 seconds old, refresh dashboard
        if (currentTime - triggerTime < 5000) {
          fetchDashboardData(false);
          localStorage.removeItem('dashboard_refresh_trigger');
        }
      }
    };




    // Check for maintenance updates every 2 seconds
    const maintenanceCheckInterval = setInterval(checkMaintenanceUpdates, 2000);




    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('popstate', handleRouteChange);




    // Cleanup
    return () => {
      clearInterval(refreshInterval);
      clearInterval(maintenanceCheckInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [router, mounted, fetchDashboardData]);




  const handleDiagnostic = async (id: string) => {
    try {
      await apiClient.get(`/diagnostics/item/${id}`);
      // Handle diagnostic response
    } catch (err) {
      console.error("Error running diagnostic:", err);
    }
  };




  const handleCardClick = (cardType: string) => {
    switch (cardType) {
      case 'needed-maintenance':
        router.push('/inventory?needs_maintenance=true');
        break;
      case 'total-maintenance':
        router.push('/inventory?maintenance=pending');
        break;
      case 'total-articles':
        router.push('/inventory');
        break;
      case 'recently-added':
        router.push('/inventory');
        break;
      default:
        break;
    }
  };




  // Lightweight CountUp component
  function CountUp({ end, duration = 1, ...props }: { end: number, duration?: number }) {
    const [value, setValue] = React.useState(0);

    React.useEffect(() => {
      setValue(0); // Always start from 0
      let startTime: number | null = null;
      let rafId: number;

      function animate(now: number) {
        if (!startTime) startTime = now;
        const elapsed = (now - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.round(end * progress);
        setValue(current);
        if (progress < 1) {
          rafId = requestAnimationFrame(animate);
        }
      }

      rafId = requestAnimationFrame(animate);
      return () => rafId && cancelAnimationFrame(rafId);
    }, [end, duration]);

    return <span {...props}>{value}</span>;
  }




  // Animated progress bar for maintenance
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const progressPercent = totalMaintenance > 0 ? (completedMaintenance / totalMaintenance) * 100 : 0;
  useEffect(() => {
    let frame: number;
    let start: number | null = null;
    const initial = animatedWidth;
    const target = progressPercent;
    const duration = 800; // ms
    function animate(now: number) {
      if (start === null) start = now;
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setAnimatedWidth(initial + (target - initial) * progress);
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        setAnimatedWidth(target);
      }
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressPercent]);




  return (
    <div className={styles['main-container']}>
      {/* Blue box at the top */}
      <div className={styles.dashboardCard} style={{ background: 'var(--neutral-gray-200', color: 'var(--text-primary)', minHeight: 80, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          {/* Left: Dashboard title */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className={styles.dashboardTitle} style={{ color: 'var(--text-primary)', marginBottom: 0 }}>Dashboard</div>
          </div>
          {/* Right: Inventory System and time updated */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Inventory System</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', opacity: 0.85 }}>Updated: {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
              <button
                onClick={handleManualRefresh}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 4 }}
                title="Refresh"
                disabled={refreshing}
              >
                <FiRefreshCw
                  size={16}
                  style={{
                    color: 'var(--text-primary)',
                    verticalAlign: 'middle',
                    animation: refreshing ? 'spin 1s linear infinite' : undefined
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Main dashboard content */}
      {!mounted && (
        <></>
      )}
      {mounted && loading && (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          fontSize: '1.1rem',
          color: '#6b7280'
        }}>
          <div className={styles.dashboardLoadingSpinner}></div>
          <div style={{marginTop: '1rem'}}>Loading dashboard data...</div>
        </div>
      )}
      {mounted && error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#b91c1c'
        }}>
          {error}
        </div>
      )}
      {mounted && !loading && !error && (
        <>
          {/* Two-column layout for cards */}
          <div style={{ display: 'flex', gap: 24 }}>
            {/* Column 1: Needs Action + Total Maintenance */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className={styles.dashboardCardContainerNeedsAction}>
                <div
                  className={`${styles.infoCard} maintenanceCard`}
                  onClick={() => router.push('/inventory?item_status=Bad%20Condition')}
                  style={{ cursor: 'pointer', minHeight: 179 }}
                  title="Click to view all items with Bad Condition status"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '1.25rem', color: '#374151', marginBottom: 2 }}>
                    <span style={{ color: '#374151', fontWeight: 700, fontSize: '1.25rem' }}>Needs Action</span>
                  </div>
                  <div style={{ color: badConditionCount > 0 ? '#ef4444' : '#10b981', fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>
                    {badConditionCount > 0 ? 'item needs action' : 'All items in good condition'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 16 }}>
                    {/* Good Condition Stat */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ background: 'rgba(16,185,129,0.06)', borderRadius: 8, padding: 8, marginBottom: 4, display: 'inline-flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#10b981', fontWeight: 700, fontSize: '1.2rem', textAlign: 'center', width: '100%' }}><CountUp end={isNaN(goodConditionCount) ? 0 : goodConditionCount} /></span>
                      </span>
                      <span style={{ color: '#374151', fontSize: '12px', marginTop: 20 }}>Good Condition</span>
                </div>
                    {/* Divider */}
                    <div style={{ width: 1, background: 'var(--bg-gray-200)', height: 48, margin: '0 16px' }} />
                    {/* Need Action Stat */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 8, padding: 8, marginBottom: 4, display: 'inline-flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.2rem', textAlign: 'center', width: '100%' }}><CountUp end={isNaN(badConditionCount) ? 0 : badConditionCount} /></span>
                      </span>
                      <span style={{ color: '#374151', fontSize: '12px', marginTop: 20 }}>Need Action</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.dashboardCardContainerMaintenance}>
                <div
                  className={`${styles.infoCard} totalCard`}
                  onClick={() => handleCardClick('total-maintenance')}
                  style={{ cursor: 'pointer', minHeight: 260 }}
                  title="Click to view items with pending maintenance"
                >
                  <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#374151', marginBottom: 2 }}>Total Maintenance</div>
                  <div style={{ color: pendingMaintenance > 0 ? '#ef4444' : '#10b981', fontSize: '1rem', fontWeight: 500, marginBottom: 30 }}>
                    {pendingMaintenance > 0 ? `${pendingMaintenance} Pending` : `${completedMaintenance} Completed`}
                  </div>
                  {/* Progress Bar below card change */}
                  <div style={{ width: '100%', height: 10, background: 'var(--bg-gray-100)', borderRadius: 5, margin: '24px 0 45px 0', overflow: 'hidden', position: 'relative' }}>
                    <div
                      className={styles.dashboardProgressBarCompleted}
                      style={{ width: `${animatedWidth}%` }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    {/* Good Condition Stat */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ background: '#e6f9ed', borderRadius: 8, padding: 8, marginBottom: 4, display: 'inline-flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                        {/* Green checkmark icon */}
                        <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6,13 11,18 18,7" stroke="#10b981" strokeWidth="2" fill="none"/></svg>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', marginTop: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}><CountUp end={isNaN(completedMaintenance) ? 0 : completedMaintenance} /></span>
                        <span style={{ color: '#374151' }}>Completed</span>
            </div>
          </div>
                    {/* Divider */}
                    <div style={{ width: 1, background: 'var(--bg-gray-200)', height: 48, margin: '0 16px' }} />
                    {/* Need Action Stat */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 8, padding: 8, marginBottom: 4, display: 'inline-flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
                </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', marginTop: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}><CountUp end={isNaN(pendingMaintenance) ? 0 : pendingMaintenance} /></span>
                        <span style={{ color: '#374151' }}>Pending</span>
                      </div>
              </div>
                </div>
                </div>
              </div>
            </div>
            {/* Column 2: Total Articles + Recently Added */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className={styles.dashboardCardContainerArticles}>
            <div
                  className={`${styles.infoCard} articlesCard`}
              onClick={() => router.push('/inventory')}
                  style={{ cursor: 'pointer', minHeight: 260 }}
              title="Click to view all inventory items"
            >
                  <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#374151', marginBottom: 2 }}>Total Articles</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 0, marginTop: 24 }}>
                    {/* Electronics */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 8 }}>
                      <span style={{ background: 'rgba(16,185,129,0.06)', borderRadius: 8, padding: 8, marginBottom: 4, display: 'inline-flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                        {/* Device icon */}
                        <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="8" y1="19" x2="16" y2="19"/></svg>
                </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', marginTop: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}><CountUp end={isNaN(categoryCounts['Electronic']) ? 0 : categoryCounts['Electronic']} /></span>
                        <span style={{ color: '#374151' }}>Electronics</span>
              </div>
                </div>
               
                    {/* Utilities */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 8 }}>
                      <span style={{ background: '#ede9fe', borderRadius: 8, padding: 8, marginBottom: 4, display: 'inline-flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                        {/* Plug icon */}
                        <svg width="20" height="20" fill="none" stroke="#9333ea" strokeWidth="2" viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="8" rx="2"/><line x1="12" y1="10" x2="12" y2="22"/><line x1="9" y1="22" x2="15" y2="22"/></svg>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', marginTop: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}><CountUp end={isNaN(categoryCounts['Utility']) ? 0 : categoryCounts['Utility']} /></span>
                        <span style={{ color: '#374151' }}>Utilities</span>
                </div>
                </div>
                    {/* Tools */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 8 }}>
                      <span style={{ background: '#e0f2fe', borderRadius: 8, padding: 8, marginBottom: 4, display: 'inline-flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                        {/* Bag icon */}
                        <svg width="20" height="20" fill="none" stroke="#38bdf8" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/></svg>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', marginTop: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}><CountUp end={isNaN(categoryCounts['Tool']) ? 0 : categoryCounts['Tool']} /></span>
                        <span style={{ color: '#374151' }}>Tools</span>
                </div>
              </div>
                    {/* Supplies */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 8 }}>
                      <span style={{ background: '#fef9c3', borderRadius: 8, padding: 8, marginBottom: 4, display: 'inline-flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                        {/* Bar chart icon */}
                        <svg width="20" height="20" fill="none" stroke="#f59e42" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="13" width="4" height="7" rx="1"/><rect x="10" y="9" width="4" height="11" rx="1"/><rect x="16" y="5" width="4" height="15" rx="1"/></svg>
                </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', marginTop: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}><CountUp end={isNaN(categoryCounts['Supply']) ? 0 : categoryCounts['Supply']} /></span>
                        <span style={{ color: '#374151' }}>Supplies</span>
              </div>
              </div>
                </div>
                </div>
              </div>
              <div className={styles.dashboardCardContainerRecent}>
            <div
                  className={`${styles.infoCard} recentCard`}
              onClick={() => handleCardClick('recently-added')}
                  style={{ cursor: 'pointer', minHeight: 189.5 }}
              title="Click to view all inventory items"
            >
                  <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#374151', marginBottom: 2 }}>Recently Added</div>
                  <div style={{ color: '#10b981', fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>+{recentlyAdded} this week</div>
                  <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 }}>
                    {/* Today Stat */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ background: 'rgba(16,185,129,0.06)', borderRadius: 8, padding: 8, marginBottom: 4, display: 'inline-flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                        {/* Calendar icon */}
                        <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="4"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', marginTop: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}><CountUp end={isNaN(todayAdded) ? 0 : todayAdded} /></span>
                        <span style={{ color: '#374151' }}>Today</span>
                      </div>
                    </div>
                    {/* Divider */}
                    <div style={{ width: 1, background: 'var(--bg-gray-200)', height: 48, margin: '0 16px' }} />
                    {/* Yesterday Stat */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ background: '#dbeafe', borderRadius: 8, padding: 8, marginBottom: 4, display: 'inline-flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                        {/* Clock icon */}
                        <svg width="20" height="20" fill="none" stroke="#3b82f6" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15,15"/></svg>
                </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', marginTop: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}><CountUp end={isNaN(yesterdayAdded) ? 0 : yesterdayAdded} /></span>
                        <span style={{ color: '#374151' }}>Yesterday</span>
                      </div>
              </div>
                </div>
                </div>
              </div>
            </div>
          </div>
          {/* Recent Items Table/List */}
          <div className={styles.dashboardTable}>
            <div className={styles.dashboardTableHeader}>
              <div className={styles.dashboardTableTitle} style={{ color: 'var(--neutral-gray-700)' }}>Recently Added Items</div>
            </div>
            <div className={styles.dashboardTableContent}>
              {recentItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--neutral-gray-700)', fontSize: '0.9rem' }}>
                  {totalItems === 0 ? 'No items in inventory yet' : 'No recent items to display'}
                  {totalItems > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                      Total items: {totalItems}
                    </div>
                  )}
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th className={styles.recentItemHeader}>Type</th>
                      <th className={styles.recentItemHeader}>QR Code</th>
                      <th className={styles.recentItemHeader}>Date Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentItems.map((item) => (
                      <tr
                        key={item.id}
                        className={styles.recentItemRow}
                        style={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/inventory/${item.id}`)}
                      >
                        <td>{item.article_type || 'Unnamed Item'}</td>
                        <td>{item.qr_code}</td>
                        <td>{new Date(item.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
      {/* Add CSS for spinning animation */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </>
      )}
    </div>
  );
}





