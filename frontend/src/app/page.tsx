"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./dashboard.module.css";
import { apiClient } from "../config/api";
import { FaHome, FaClipboardList, FaHistory, FaUser, FaSync, FaSyncAlt, FaTools, FaChartBar, FaBoxes, FaPlus, FaBoxOpen, FaMapMarkerAlt } from "react-icons/fa";
import { FiRefreshCw } from 'react-icons/fi';
import React from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { 
	addMessage as addMessageAction,
	setOpen,
	setInput,
	setBusy,
	setTyping,
	setError,
	setPendingPlan,
} from "../features/chatbot/chatbotSlice";




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
  const [connectionError, setConnectionError] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);
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
      
      // Clear connection error state on successful fetch
      setConnectionError(false);
      localStorage.removeItem('dashboard_connection_error');
      
      // Cache the successful data
      const cacheData = {
        totalItems,
        neededMaintenance: itemsNeedingMaintenance,
        totalMaintenance: totalMaintenanceCount,
        recentlyAdded: recentlyAddedCount,
        totalArticles: totalItems,
        criticalItems: criticalItemsCount,
        completedMaintenance: completedMaintenanceCount,
        pendingMaintenance: pendingMaintenanceCount,
        goodConditionCount: goodCondition,
        badConditionCount: badCondition,
        categoryCounts: catCounts,
        timestamp: Date.now()
      };
      localStorage.setItem('dashboard_cached_data', JSON.stringify(cacheData));
     
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
      
      // Check for cached data first
      const hasCached = checkCachedData();
      
      // Load cached data if available
      if (hasCached) {
        loadCachedData();
      }
      
      // Determine the type of error and set appropriate message
      let errorMessage = "Error loading dashboard stats";
      let isConnectionError = false;
      
      if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK' || err.code === 'ERR_INTERNET_DISCONNECTED') {
        errorMessage = hasCached 
          ? "Cannot connect to server. Showing cached data from last successful connection."
          : "Cannot connect to server. Please check your internet connection and try again.";
        isConnectionError = true;
      } else if (err.response?.status === 0) {
        errorMessage = hasCached
          ? "Network error. Showing cached data from last successful connection."
          : "Network error. Please check your connection and try again.";
        isConnectionError = true;
      } else if (err.response?.status === 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (err.response?.status === 401) {
        errorMessage = "Session expired. Please log in again.";
        localStorage.removeItem("token");
        router.push("/login");
        return;
      } else if (err.message?.includes('timeout')) {
        errorMessage = hasCached
          ? "Request timed out. Showing cached data from last successful connection."
          : "Request timed out. Please check your connection and try again.";
        isConnectionError = true;
      } else if (err.message?.includes('Network Error')) {
        errorMessage = hasCached
          ? "Network error. Showing cached data from last successful connection."
          : "Network error. Please check your connection and try again.";
        isConnectionError = true;
      }
      
      setError(errorMessage);
      setConnectionError(isConnectionError);
      
      // Store connection error state for UI
      if (isConnectionError) {
        localStorage.setItem('dashboard_connection_error', 'true');
      } else {
        localStorage.removeItem('dashboard_connection_error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);




  // Manual refresh function
  const handleManualRefresh = () => {
    fetchDashboardData(false);
  };

  // Check if we have cached dashboard data
  const checkCachedData = () => {
    const cachedData = localStorage.getItem('dashboard_cached_data');
    if (cachedData) {
      try {
        const data = JSON.parse(cachedData);
        const cacheTime = data.timestamp || 0;
        const now = Date.now();
        // Consider cache valid for 5 minutes
        if (now - cacheTime < 5 * 60 * 1000) {
          setHasCachedData(true);
          return true;
        }
      } catch (e) {
        // Invalid cache data
      }
    }
    setHasCachedData(false);
    return false;
  };

  // Load cached dashboard data
  const loadCachedData = () => {
    const cachedData = localStorage.getItem('dashboard_cached_data');
    if (cachedData) {
      try {
        const data = JSON.parse(cachedData);
        setTotalItems(data.totalItems || 0);
        setNeededMaintenance(data.neededMaintenance || 0);
        setTotalMaintenance(data.totalMaintenance || 0);
        setRecentlyAdded(data.recentlyAdded || 0);
        setTotalArticles(data.totalArticles || 0);
        setCriticalItems(data.criticalItems || 0);
        setCompletedMaintenance(data.completedMaintenance || 0);
        setPendingMaintenance(data.pendingMaintenance || 0);
        setGoodConditionCount(data.goodConditionCount || 0);
        setBadConditionCount(data.badConditionCount || 0);
        setCategoryCounts(data.categoryCounts || {});
        setLastUpdated(new Date(data.timestamp || Date.now()));
        return true;
      } catch (e) {
        console.error('Error loading cached data:', e);
      }
    }
    return false;
  };




  useEffect(() => {
    setMounted(true);
    // Clear any previous connection error state
    setConnectionError(false);
    localStorage.removeItem('dashboard_connection_error');
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
      .then(res => {
        setUser(res.data);
        try {
          const userId = res.data?.id ? String(res.data.id) : null;
          if (userId) {
            localStorage.setItem('user_id', userId);
            // Dispatch event to notify Redux provider of user change
            window.dispatchEvent(new CustomEvent('chatbot-user-changed', {
              detail: { userId }
            }));
          }
          if (res.data?.email) localStorage.setItem('email', String(res.data.email));
        } catch (err) {
          console.warn('Failed to cache user identity for chatbot', err);
        }
      })
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




    // Listen for chatbot-triggered refresh requests
    const handleChatbotRefresh = () => {
      fetchDashboardData(false);
    };
    window.addEventListener('dashboard-refresh-requested', handleChatbotRefresh as EventListener);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('popstate', handleRouteChange);




    // Cleanup
    return () => {
      clearInterval(refreshInterval);
      clearInterval(maintenanceCheckInterval);
      window.removeEventListener('dashboard-refresh-requested', handleChatbotRefresh as EventListener);
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
      let rafId: number | undefined;

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
      return () => {
        if (rafId !== undefined) cancelAnimationFrame(rafId);
      };
    }, [end, duration]);

    return <span {...props}>{value}</span>;
  }




  // Animated progress bar for maintenance
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const [animatedPendingWidth, setAnimatedPendingWidth] = useState(0);
  const progressPercent = totalMaintenance > 0 ? (completedMaintenance / totalMaintenance) * 100 : 0;
  const pendingPercent = totalMaintenance > 0 ? (pendingMaintenance / totalMaintenance) * 100 : 0;
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

  // Animate pending maintenance width
  useEffect(() => {
    let frame: number;
    let start: number | null = null;
    const initial = animatedPendingWidth;
    const target = pendingPercent;
    const duration = 800; // ms
    function animate(now: number) {
      if (start === null) start = now;
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setAnimatedPendingWidth(initial + (target - initial) * progress);
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        setAnimatedPendingWidth(target);
      }
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPercent]);




  // Small Calendar component
  function CalendarCard() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const startDay = start.getDay(); // 0-6
    const daysInMonth = end.getDate();
    const weeks: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) weeks.push(null);
    for (let d = 1; d <= daysInMonth; d++) weeks.push(d);
    while (weeks.length % 7 !== 0) weeks.push(null);
    const monthName = today.toLocaleString('default', { month: 'long' });

    return (
      <div className={styles.calendarCardSoft} style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className={styles.calendarHeader} style={{ marginBottom: '10px' }}>
          <div className={styles.cardTitleSm}>Calendar</div>
          <div className={styles.calendarMonth}>{monthName} {year}</div>
        </div>
        <div className={styles.calendarWeekdays}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className={styles.calendarWeekday}>{d}</div>
          ))}
        </div>
        <div className={styles.calendarGrid} style={{ flex: 1 }}>
          {weeks.map((d, i) => {
            const isToday = d === today.getDate();
            return (
              <div key={i} className={`${styles.calendarDay} ${isToday ? styles.calendarDayToday : ''}`}>{d ?? ''}</div>
            );
          })}
        </div>
      </div>
    );
  }

  // Embedded IVY Chat component
  function EmbeddedIVYChat() {
    const dispatch = useAppDispatch();
    const chatbotState = useAppSelector((state) => state.chatbot);
    
    // Ensure we have valid state with defaults
    const messages = chatbotState?.messages || [];
    const chatOpen = chatbotState?.isOpen || false;
    const input = (chatbotState?.input ?? '') || '';
    const busy = chatbotState?.busy || false;
    const typing = chatbotState?.typing || false;
    const pendingPlan = chatbotState?.pendingPlan || null;
    
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const send = React.useCallback(async () => {
      const text = (input || '').trim();
      if (!text || busy) return;
      dispatch(setInput(""));
      dispatch(addMessageAction({ role: 'user', text, timestamp: Date.now() }));
      dispatch(setBusy(true));
      dispatch(setTyping(true));
      dispatch(setPendingPlan(null));
      try {
        const res = await apiClient.post('/chat', { 
          message: text,
          history: (messages || []).slice(-10).map(m => ({ role: m.role, text: m.text || '' }))
        });
        const payload = res.data || {};
        if (payload.type === 'answer' && payload.message) {
          dispatch(addMessageAction({ role: 'assistant', text: payload.message, data: payload.data, timestamp: Date.now() }));
        } else if (payload.type === 'action' && payload.message) {
          dispatch(addMessageAction({ role: 'assistant', text: `${payload.message}\n\nExample: ${JSON.stringify(payload.example_request)}`, data: payload.data, timestamp: Date.now() }));
        } else if (payload.type === 'clarify' && payload.message) {
          dispatch(addMessageAction({ role: 'assistant', text: payload.message, data: payload.data, timestamp: Date.now() }));
        } else if (payload.type === 'plan' && payload.message) {
          dispatch(addMessageAction({ role: 'assistant', text: payload.message, data: payload.plan, timestamp: Date.now() }));
          if (payload.plan) dispatch(setPendingPlan({ originalMessage: text, plan: payload.plan }));
        } else if (payload.type === 'error') {
          dispatch(addMessageAction({ role: 'assistant', text: `❌ ${payload.message || 'Request failed. Please try again.'}`, timestamp: Date.now() }));
        } else {
          dispatch(addMessageAction({ role: 'assistant', text: 'Unable to process that right now. Please try again.', timestamp: Date.now() }));
        }
      } catch (err: any) {
        let errorMsg = 'Unable to process that right now. Please try again.';
        if (err?.response?.status === 401) {
          errorMsg = 'Session expired. Please refresh the page and log in again.';
        } else if (err?.response?.status === 429) {
          errorMsg = 'Too many requests. Please wait a moment and try again.';
        } else if (err?.response?.status >= 500) {
          errorMsg = 'Server error. Please try again in a moment.';
        } else if (err?.response?.data?.message) {
          errorMsg = err.response.data.message;
        } else if (err?.message) {
          errorMsg = err.message;
        }
        dispatch(addMessageAction({ role: 'assistant', text: `❌ ${errorMsg}`, timestamp: Date.now() }));
      } finally {
        dispatch(setBusy(false));
        dispatch(setTyping(false));
      }
    }, [input, busy, messages, dispatch]);

    const confirmPlan = React.useCallback(async () => {
      if (!pendingPlan || busy) return;
      dispatch(setBusy(true));
      dispatch(setTyping(true));
      dispatch(setError(null));
      try {
        const res = await apiClient.post('/chat', { 
          message: pendingPlan.originalMessage, 
          confirm: true,
          history: (messages || []).slice(-10).map(m => ({ role: m.role, text: m.text || '' }))
        });
        const payload = res.data || {};
        let reply = '';
        if (payload.type === 'answer' && payload.message) reply = payload.message;
        else if (payload.type === 'error') reply = `❌ ${payload.message || 'Request failed.'}`;
        else if (payload.message) reply = payload.message;
        else reply = '✅ Completed.';
        dispatch(addMessageAction({ role: 'assistant', text: reply, data: payload.data, timestamp: Date.now() }));
        dispatch(setPendingPlan(null));
      } catch (err: any) {
        const errorMsg = err?.response?.data?.message || err?.message || 'Action failed. Please try again.';
        dispatch(addMessageAction({ role: 'assistant', text: `❌ ${errorMsg}`, timestamp: Date.now() }));
      } finally {
        dispatch(setBusy(false));
        dispatch(setTyping(false));
      }
    }, [pendingPlan, busy, messages, dispatch]);

    const cancelPlan = React.useCallback(() => {
      dispatch(setPendingPlan(null));
      dispatch(addMessageAction({ role: 'assistant', text: 'Okay. I won\'t proceed. What would you like to do next?', timestamp: Date.now() }));
    }, [dispatch]);

    React.useEffect(() => {
      if (scrollRef.current) {
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 50);
      }
    }, [messages, chatOpen, typing]);

    const quickTips = React.useMemo(() => [
      'Summarize inventory status',
      'Show inventory insights',
      'How many laptops are available?',
      'Items due for maintenance',
      'Find item by QR ABC123',
      'Add new item',
      'Update item 123 status to In Use',
      'Update item 123 location to HQ-3F',
      'Export inventory to Excel',
      'Show latest maintenance logs'
    ], []);

    return (
      <div className={styles.assistantCardInner}>
        <div className={styles.assistantBackdrop}></div>
        {/* Ripple effects around orb */}
        <div 
          className={styles.assistantRipple1}
          style={{ opacity: chatOpen ? 0.2 : 0.4 }}
        ></div>
        <div 
          className={styles.assistantRipple2}
          style={{ opacity: chatOpen ? 0.15 : 0.3 }}
        ></div>
        <div 
          className={styles.assistantCenterOrb} 
          onClick={() => dispatch(setOpen(!chatOpen))}
          style={{ 
            cursor: 'pointer', 
            zIndex: chatOpen ? 1 : 10,
            width: chatOpen ? '76px' : '100px',
            height: chatOpen ? '76px' : '100px',
            top: chatOpen ? '15%' : '50%',
            opacity: chatOpen ? 0.4 : 1
          }}
        >
          {/* Stylized human head icon (IVY) */}
          <svg 
            className={styles.assistantCenterIcon} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5"
            style={{ width: chatOpen ? '32px' : '42px', height: chatOpen ? '32px' : '42px' }}
          >
            {/* Head shape */}
            <circle cx="12" cy="9" r="4.5" fill="#ffffff" stroke="none"/>
            {/* Body/shoulder */}
            <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" fill="#ffffff" stroke="none"/>
            {/* Single eye dot */}
            <circle cx="12" cy="9" r="1.2" fill="rgba(255, 90, 90, 0.75)" stroke="none"/>
            {/* Curved mouth */}
            <path d="M9 12.5c0.5 0.5 1.5 0.5 2 0" stroke="rgba(255, 110, 110, 0.7)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          </svg>
        </div>
        
        {/* Chat Interface - only show when chatOpen is true */}
        {chatOpen && (
        <div className={styles.embeddedChatContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}>
          <div className={styles.embeddedChatHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="25" height="25" viewBox="0 0 24 24" fill="#820000" style={{ flexShrink: 0 }}>
                <rect x="4" y="6" width="16" height="12" rx="2" fill="#820000"/>
                <circle cx="9" cy="11" r="1.5" fill="#ffffff"/>
                <circle cx="15" cy="11" r="1.5" fill="#ffffff"/>
                <path d="M9 14h6" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M18 4l-1.5-1.5M18 4l-1.5 1.5" stroke="#820000" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div className={styles.embeddedChatTitle}>IVY</div>
            </div>
            <button 
              onClick={() => dispatch(setOpen(false))} 
              className={styles.embeddedChatCloseBtn}
              aria-label="Close chat"
              title="Close"
            >
              ×
            </button>
          </div>
          <div ref={scrollRef} className={styles.embeddedChatMessages} style={{ flex: 1, overflowY: 'auto' }}>
            {(messages || []).map((m, idx) => (
              <div key={idx} className={styles.embeddedChatMessage} style={{ justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div className={`${styles.embeddedChatBubble} ${m.role === 'user' ? styles.embeddedChatBubbleUser : styles.embeddedChatBubbleAssistant}`}>
                  <div className={styles.embeddedChatText}>{m.text || ''}</div>
                  {m.role === 'assistant' && Array.isArray(m.data) && m.data.length > 0 && (
                    <div className={styles.embeddedChatData}>
                      {(() => {
                        const first = m.data[0] || {};
                        const columns: string[] = Object.keys(first).slice(0, 6);
                        const header = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                        return (
                          <table className={styles.embeddedChatTable}>
                            <thead>
                              <tr>
                                {columns.map((col) => (
                                  <th key={col}>{header(col)}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {m.data.map((row: any, i: number) => (
                                <tr key={i}>
                                  {columns.map((col) => (
                                    <td key={col}>{String(row[col] ?? '-')}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  )}
                  {m.role === 'assistant' && pendingPlan && m.text && m.text.includes('I can perform this action') && (
                    <div className={styles.embeddedChatActions}>
                      <button onClick={confirmPlan} disabled={busy} className={styles.embeddedChatConfirmBtn}>{busy ? '...' : 'Confirm'}</button>
                      <button onClick={cancelPlan} disabled={busy} className={styles.embeddedChatCancelBtn}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {(messages || []).length <= 2 && !busy && (
              <div className={styles.embeddedChatQuickTips}>
                {quickTips.map(t => (
                  <button key={t} onClick={() => { dispatch(setInput(t)); inputRef.current?.focus(); }} className={styles.embeddedChatQuickTipBtn}>{t}</button>
                ))}
              </div>
            )}
            {typing && (
              <div className={styles.embeddedChatMessage} style={{ justifyContent: 'flex-start' }}>
                <div className={`${styles.embeddedChatBubble} ${styles.embeddedChatBubbleAssistant}`}>
                  <div className={styles.embeddedChatText} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', marginRight: 4, animation: 'pulse 1.4s ease-in-out infinite' }} />
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', marginRight: 4, animation: 'pulse 1.4s ease-in-out 0.2s infinite' }} />
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', animation: 'pulse 1.4s ease-in-out 0.4s infinite' }} />
                    <style>{`
                      @keyframes pulse {
                        0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
                        30% { opacity: 1; transform: scale(1); }
                      }
                    `}</style>
                  </div>
                </div>
              </div>
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className={styles.embeddedChatForm} style={{ display: 'flex', gap: '10px', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)' }}>
            <input
              value={input || ''}
              onChange={(e) => dispatch(setInput(e.target.value || ''))}
              placeholder={busy ? 'Working...' : 'Ask about inventory or maintenance'}
              disabled={busy}
              ref={inputRef}
              onKeyDown={(e) => { 
                if (e.key === 'Enter' && !e.shiftKey) { 
                  e.preventDefault(); 
                  if (!busy && (input || '').trim()) send(); 
                }
                if (e.key === 'Escape') {
                  dispatch(setOpen(false));
                }
              }}
              className={styles.embeddedChatInput}
              style={{ flex: 1, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '10px', background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', color: '#ffffff', fontSize: '0.9rem', fontWeight: 500, outline: 'none' }}
            />
            <button type="submit" disabled={busy || !(input || '').trim()} className={styles.embeddedChatSendBtn} style={{ padding: '10px 20px', border: 'none', borderRadius: '10px', background: 'linear-gradient(135deg, #8B5CF6 0%, #6B46C1 100%)', color: '#ffffff', fontSize: '0.9rem', fontWeight: 600, cursor: busy || !(input || '').trim() ? 'not-allowed' : 'pointer', minWidth: '80px', boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4)', opacity: busy || !(input || '').trim() ? 0.5 : 1 }}>
              {busy ? '...' : 'Send'}
            </button>
          </form>
        </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles['main-container']}>

      {/* Welcome banner */}
      <div className={`${styles.dashboardCard} ${styles.welcomeCard}`}>
        <div className={styles.welcomeInner}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className={styles.welcomeTitle}>Welcome back, <span style={{ color: '#820000' }}>Admin!</span></div>
            <div className={styles.welcomeSub}>Have a quick view on the inventory this month</div>
          </div>
          <div className={styles.welcomeMeta}>
            <div className={styles.welcomeSub}>Updated: {mounted ? lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
            <button
              onClick={handleManualRefresh}
              className={styles.refreshBtn}
              title="Refresh"
              disabled={refreshing}
            >
              <span style={{ color: '#111827', animation: refreshing ? 'spin 1s linear infinite' : undefined }}>
                <FiRefreshCw size={16} />
              </span>
            </button>
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
          <div style={{marginTop: '1rem'}}>
            {connectionError ? 'Reconnecting to server...' : 'Loading dashboard data...'}
          </div>
          {connectionError && (
            <div style={{
              fontSize: '0.9rem',
              color: '#9ca3af',
              marginTop: '0.5rem'
            }}>
              This may take a moment if the server is starting up
            </div>
          )}
        </div>
      )}
      {mounted && error && (
        <div style={{
          backgroundColor: hasCachedData ? '#fef3cd' : '#fef2f2',
          border: hasCachedData ? '1px solid #fde68a' : '1px solid #fecaca',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          marginBottom: '1rem',
          color: hasCachedData ? '#92400e' : '#b91c1c',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            {hasCachedData ? (
              <svg width="48" height="48" fill="none" stroke="#92400e" strokeWidth="2" viewBox="0 0 24 24" style={{ marginBottom: '0.5rem' }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            ) : (
              <svg width="48" height="48" fill="none" stroke="#b91c1c" strokeWidth="2" viewBox="0 0 24 24" style={{ marginBottom: '0.5rem' }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            )}
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              {hasCachedData ? 'Showing Cached Data' : 'Connection Error'}
        </div>
            <div style={{ fontSize: '0.95rem', opacity: 0.9 }}>{error}</div>
          </div>
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={loading}
            style={{
              backgroundColor: hasCachedData ? '#92400e' : '#b91c1c',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.75rem 1.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? (
              <>
                <div className={styles.dashboardLoadingSpinner} style={{ width: '16px', height: '16px', border: '2px solid #ffffff', borderTop: '2px solid transparent' }}></div>
                Retrying...
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M1 4v6h6"/>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                Retry Connection
              </>
            )}
          </button>
        </div>
      )}
      {mounted && !loading && (!error || hasCachedData) && (
        <>
          {/* Grid layout matching the provided design - unified grid for alignment */}
          <div className={styles.gridThree} style={{ gridTemplateRows: 'auto auto auto' }}>
            {/* Items' Conditions (formerly Needs Action) */}
            <div style={{ gridColumn: '1 / 2' }}>
              <div className={`${styles.dashboardCard} ${styles.gradientBlackRed} ${styles.conditionsCard}`} style={{ minHeight: 190 }} onClick={() => router.push('/inventory?item_status=Bad%20Condition')} title="Click to view all items with Bad Condition status">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div className={styles.itemsCardTitle}>Items Conditions</div>
                  <span style={{ color: 'rgba(255,255,255,0.8)' }}>⋯</span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem', fontWeight: 500, marginBottom: 8 }}>
                  {badConditionCount > 0 ? 'Some items needs action' : 'All items in good condition'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 10 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 8, marginBottom: 4, display: 'inline-flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '1.1rem', textAlign: 'center', width: '100%' }}><CountUp end={isNaN(goodConditionCount) ? 0 : goodConditionCount} /></span>
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', marginTop: 12 }}>Good Condition</span>
                  </div>
                  <div style={{ width: 1, background: 'rgba(255,255,255,0.25)', height: 48, margin: '0 16px' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 8, marginBottom: 4, display: 'inline-flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '1.1rem', textAlign: 'center', width: '100%' }}><CountUp end={isNaN(badConditionCount) ? 0 : badConditionCount} /></span>
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', marginTop: 12 }}>Need Action</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recently Added (small) */}
            <div style={{ gridColumn: '2 / 3' }}>
              <div className={`${styles.dashboardCard} ${styles.minH190} ${styles.recentGlassCard} ${styles.clickable}`} onClick={() => handleCardClick('recently-added')} title="Click to view all inventory items">
                <div className={styles.recentlyAddedHeader}>
                  <div className={styles.cardTitleSm}>Recently Added</div>
                  <span className={styles.ellipsis}>⋯</span>
                </div>
                <div className={styles.cardSubtext} style={{ fontSize: '0.95rem', fontWeight: 500 }}>+{recentlyAdded} this week</div>
                <div className={styles.twoColStats}>
                  <div className={styles.statBlock}>
                    <span className={`${styles.iconPill} ${styles.iconUniform}`}>
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="4"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </span>
                    <div className={styles.statRow}>
                      <span className={styles.statNumber}><CountUp end={isNaN(todayAdded) ? 0 : todayAdded} /></span>
                      <span className={styles.smallLabel}>Today</span>
                    </div>
                  </div>
                  <div className={styles.divider} />
                  <div className={styles.statBlock}>
                    <span className={`${styles.iconPill} ${styles.iconUniform}`}>
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15,15"/></svg>
                    </span>
                    <div className={styles.statRow}>
                      <span className={styles.statNumber}><CountUp end={isNaN(yesterdayAdded) ? 0 : yesterdayAdded} /></span>
                      <span className={styles.smallLabel}>Yesterday</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Maintenance moved to right column (same height as calendar) */}
            <div style={{ gridColumn: '3 / 4', gridRow: '1 / 2' }}>
              <div className={`${styles.dashboardCard} ${styles.minH190} ${styles.softBlueCard}`} style={{ position: 'relative', overflow: 'hidden' }} onClick={() => handleCardClick('total-maintenance')} title="Click to view items with pending maintenance">
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitleSm}>Total Maintenance</div>
                  <span className={styles.ellipsis}>⋯</span>
                </div>
                <div className={`${styles.maintenanceMeta} ${pendingMaintenance > 0 ? styles.maintenanceMetaPending : styles.maintenanceMetaOk}`}>
                  {pendingMaintenance > 0 ? `${pendingMaintenance} Pending` : `${completedMaintenance} Completed`}
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.dashboardProgressBarCompleted} style={{ width: `${animatedWidth}%`, zIndex: 2 }} />
                  {pendingMaintenance > 0 && animatedWidth > 0 && (
                    <div style={{ position: 'absolute', left: `${animatedWidth}%`, top: 0, height: '100%', width: '2px', background: 'rgba(255, 255, 255, 0.8)', zIndex: 3, boxShadow: '0 0 4px rgba(255, 255, 255, 0.5)' }} />
                  )}
                  {pendingMaintenance > 0 && (
                    <div style={{ position: 'absolute', left: `${animatedWidth}%`, top: 0, height: '100%', width: `${animatedPendingWidth}%`, background: 'linear-gradient(90deg, #C4B5FD 0%, #8B5CF6 100%)', borderRadius: '5px', zIndex: 1, animation: 'pending-pulse 2s ease-in-out infinite', boxShadow: '0 0 8px rgba(139, 92, 246, 0.3)' }} />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span className={`${styles.iconPill} ${styles.iconUniform}`}>
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6,13 11,18 18,7"/></svg>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', marginTop: 2 }}>
                      <span className={styles.statNumber}><CountUp end={isNaN(completedMaintenance) ? 0 : completedMaintenance} /></span>
                      <span style={{ color: '#222428' }}>Completed</span>
                    </div>
                  </div>
                  <div style={{ width: 1, background: 'var(--bg-gray-200)', height: 48, margin: '0 16px' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span className={`${styles.iconPill} ${styles.iconUniform}`}>
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', marginTop: 2 }}>
                      <span className={styles.statNumber}><CountUp end={isNaN(pendingMaintenance) ? 0 : pendingMaintenance} /></span>
                      <span style={{ color: '#222428' }}>Pending</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2 left: Calendar */}
            <div style={{ gridColumn: '1 / 2', gridRow: '2 / 3' }}>
              <div className={`${styles.dashboardCard} ${styles.softBlueCard}`} style={{ padding: 0 }}>
                <CalendarCard />
              </div>
            </div>

            {/* Row 2 middle: Total Articles */}
            <div style={{ gridColumn: '2 / 3', gridRow: '2 / 3' }}>
              <div className={`${styles.dashboardCard} ${styles.minH284} ${styles.softBlueCard} ${styles.clickable}`} onClick={() => router.push('/inventory')} title="Click to view all inventory items">
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitleSm}>Total Articles</div>
                  <span className={styles.ellipsis}>⋯</span>
                </div>
                <div className={styles.cardSubtext} style={{ fontSize: '0.95rem', fontWeight: 500 }}>Items for each category</div>
                <div className={styles.articlesGrid}>
                  <div className={styles.articleCell}>
                    <span className={`${styles.articlePill} ${styles.iconUniform}`}>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="8" y1="19" x2="16" y2="19"/></svg>
                    </span>
                    <div className={styles.statRow}>
                      <span className={styles.statNumber}><CountUp end={isNaN(categoryCounts['Electronic']) ? 0 : categoryCounts['Electronic']} /></span>
                      <span className={styles.smallLabel}>Electronics</span>
                    </div>
                  </div>
                  <div className={styles.articleCell}>
                    <span className={`${styles.articlePill} ${styles.iconUniform}`}>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="8" rx="2"/><line x1="12" y1="10" x2="12" y2="22"/><line x1="9" y1="22" x2="15" y2="22"/></svg>
                    </span>
                    <div className={styles.statRow}>
                      <span className={styles.statNumber}><CountUp end={isNaN(categoryCounts['Utility']) ? 0 : categoryCounts['Utility']} /></span>
                      <span className={styles.smallLabel}>Utilities</span>
                    </div>
                  </div>
                  <div className={styles.articleCell}>
                    <span className={`${styles.articlePill} ${styles.iconUniform}`}>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/></svg>
                    </span>
                    <div className={styles.statRow}>
                      <span className={styles.statNumber}><CountUp end={isNaN(categoryCounts['Tool']) ? 0 : categoryCounts['Tool']} /></span>
                      <span className={styles.smallLabel}>Tools</span>
                    </div>
                  </div>
                  <div className={styles.articleCell}>
                    <span className={`${styles.articlePill} ${styles.iconUniform}`}>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="13" width="4" height="7" rx="1"/><rect x="10" y="9" width="4" height="11" rx="1"/><rect x="16" y="5" width="4" height="15" rx="1"/></svg>
                    </span>
                    <div className={styles.statRow}>
                      <span className={styles.statNumber}><CountUp end={isNaN(categoryCounts['Supply']) ? 0 : categoryCounts['Supply']} /></span>
                      <span className={styles.smallLabel}>Supplies</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Assistant - spans from Total Articles (row 2) to bottom of table (row 3) */}
            <div style={{ gridColumn: '3 / 4', gridRow: '2 / 4' }}>
              <div className={`${styles.dashboardCard} ${styles.gradientDarkBlue} ${styles.aiAssistantCard}`} style={{ height: '100%' }}>
                <EmbeddedIVYChat />
              </div>
            </div>

            {/* Row 3: Recently Added Items Table */}
            <div style={{ gridColumn: '1 / 3', gridRow: '3 / 4' }}>
              <div className={styles.dashboardTable}>
            <div className={styles.dashboardTableHeader}>
              <div className={styles.dashboardTableTitle} style={{ color: 'var(--neutral-gray-700)' }}>New Items List</div>
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
                      <th className={`${styles.recentItemHeader} ${styles.typeCol}`}>Type</th>
                      <th className={`${styles.recentItemHeader} ${styles.qrCol}`}>QR Code</th>
                      <th className={`${styles.recentItemHeader} ${styles.dateCol}`}>Date Added</th>
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
                        <td className={styles.typeCol}>{item.article_type || 'Unnamed Item'}</td>
                        <td className={styles.qrCol}>{item.qr_code}</td>
                        <td className={styles.dateCol}>{new Date(item.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
            </div>
            {/* Row 3: Empty cell in column 3 to maintain grid alignment */}
            <div style={{ gridColumn: '3 / 4', gridRow: '3 / 4' }}>
              {/* Empty space - AI Assistant above spans into this visual space */}
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






