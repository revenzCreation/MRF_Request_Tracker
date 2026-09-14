export const API_URL = typeof window !== 'undefined'
  ? (window.HR_PORTAL_SHEETS?.getApiUrl?.() ?? window.HR_PORTAL_API_URL ?? '')
  : '';
