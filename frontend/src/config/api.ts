import axios from 'axios';

// API base URL: use env when provided; otherwise use relative base (works with Next rewrites)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// Create Axios instance with configuration for self-signed certificates
export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to handle authentication
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle specific error cases
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      localStorage.removeItem('token');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Helper function to get full API URL
export const getApiUrl = (endpoint: string) => {
  return `${API_BASE_URL}/api${endpoint}`;
};

// Helper function to get image URL (without /api prefix)
export const getImageUrl = async (imagePath: string) => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath;
  
  // If it's a Supabase file path (contains slashes but not http), generate signed URL
  if (imagePath.includes('/') && !imagePath.startsWith('http')) {
    try {
      const { supabase } = await import('./supabase');
      const { data, error } = await supabase.storage
        .from('dtc-ims')
        .createSignedUrl(imagePath, 3600); // 1 hour expiry
      if (error) {
        console.error('Error creating signed URL:', error);
        return '';
      }
      return data?.signedUrl || '';
    } catch (err) {
      console.error('Error getting signed URL:', err);
      return '';
    }
  }
  
  // Fallback to backend server path (relative when API_BASE_URL is empty)
  return `${API_BASE_URL}${imagePath}`;
}; 