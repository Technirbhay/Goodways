const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

export const API_BASE_URL = configuredApiBaseUrl ? configuredApiBaseUrl.replace(/\/$/, '') : '';

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
