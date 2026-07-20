const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    const trimmed = envUrl.trim();
    // If in production and VITE_API_URL accidentally points to localhost/127.0.0.1, fall back to relative URL
    if (import.meta.env.PROD && (trimmed.includes('localhost') || trimmed.includes('127.0.0.1'))) {
      return '';
    }
    return trimmed;
  }
  return import.meta.env.PROD ? '' : 'http://localhost:4000';
};

export const API_BASE_URL = getApiBaseUrl();