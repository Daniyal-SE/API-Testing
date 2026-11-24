import { mockAdapter } from '@/src/lib/mock-adapter';

/**
 * Centralized frontend API client boundary.
 * In this frontend-only repository, no FastAPI backend is mounted; all requests route
 * through the isolated Demo Mode adapter when VITE_API_BASE_URL is absent.
 * Browser JS never dispatches scanning or assessment traffic directly to target URLs.
 */
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const isDemoMode = !configuredBaseUrl;
export const apiBaseUrl = configuredBaseUrl ?? 'demo://isolated-local-adapter';

export const apiClient = mockAdapter;
