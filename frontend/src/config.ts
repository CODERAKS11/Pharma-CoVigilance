const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // Robust check for local development based on browser's actual address bar URL
  const isLocalHost = 
    typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' || 
      window.location.hostname.startsWith('192.168.')
    );

  if (envUrl && envUrl.trim() !== '') {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    // If running in a deployed environment (not localhost), ignore localhost-based API URLs
    if (!isLocalHost && (trimmed.includes('localhost') || trimmed.includes('127.0.0.1'))) {
      return '';
    }
    return trimmed;
  }

  // Fallback: If on localhost, hit port 4000. Otherwise, use relative URLs (same host).
  return isLocalHost ? 'http://localhost:4000' : '';
};

export const API_BASE_URL = getApiBaseUrl();