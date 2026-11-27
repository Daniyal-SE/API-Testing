import { httpAdapter } from '@/src/lib/http-adapter';
import { mockAdapter } from '@/src/lib/mock-adapter';

/**
 * Centralized frontend API client boundary.
 * Routes through the isolated Demo Mode adapter when VITE_API_BASE_URL is absent,
 * or through httpAdapter (FastAPI + PostgreSQL + Redis/RQ) when VITE_API_BASE_URL is configured.
 * Browser JS never dispatches scanning or assessment traffic directly to target URLs.
 */
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const isDemoMode = !configuredBaseUrl;
export const apiBaseUrl = configuredBaseUrl ?? 'demo://isolated-local-adapter';

export const apiClient = isDemoMode ? mockAdapter : httpAdapter;
