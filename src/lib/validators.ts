import { z } from 'zod';
import type { HttpMethodOption, ScopeBudgets } from '@/src/types/domain';

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid academic or workspace email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

export const projectSchema = z.object({
  name: z.string().trim().min(3, 'Project name must be at least 3 characters.').max(80, 'Maximum 80 characters.'),
  description: z.string().trim().min(10, 'Provide a concise description (at least 10 characters).').max(400),
  workspaceId: z.string().trim().min(1, 'Select an authorized workspace.'),
});

export const targetSchema = z.object({
  displayName: z.string().trim().min(3, 'Target display name is required.').max(80),
  baseUrl: z
    .string()
    .trim()
    .url('Enter a valid http:// or https:// base URL.')
    .refine((val) => val.startsWith('http://') || val.startsWith('https://'), {
      message: 'Base URL must begin with http:// or https://.',
    }),
  environment: z.enum(['local_lab', 'staging']),
  projectId: z.string().trim().min(1, 'Select a parent project.'),
  description: z.string().trim().min(5, 'Provide a short target description.').max(300),
  ownershipDeclaration: z
    .string()
    .trim()
    .min(10, 'Provide an explicit ownership or lab authorization declaration.'),
  permissionReference: z
    .string()
    .trim()
    .min(4, 'Provide a written permission or lab ticket reference (e.g., FYP-AUTH-001).'),
});

export function previewNormalizeUrl(input: string): { valid: boolean; normalized: string; host: string; port: number | null; reason?: string } {
  try {
    const parsed = new URL(input.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, normalized: '', host: '', port: null, reason: 'Only http and https schemes are supported.' };
    }
    const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
    const explicitPort = parsed.port ? Number(parsed.port) : defaultPort;
    const cleanPath = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    const normalized = `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.port ? `:${parsed.port}` : ''}${cleanPath}`;
    return {
      valid: true,
      normalized,
      host: parsed.hostname.toLowerCase(),
      port: explicitPort,
    };
  } catch {
    return { valid: false, normalized: '', host: '', port: null, reason: 'Malformed URL format.' };
  }
}

export function validateScopeBudgets(budgets: ScopeBudgets): string[] {
  const errors: string[] = [];
  if (budgets.maxCrawlDepth < 1 || budgets.maxCrawlDepth > 8) {
    errors.push('Crawl depth must be between 1 and 8.');
  }
  if (budgets.maxRequests < 10 || budgets.maxRequests > 5000) {
    errors.push('Maximum request count must be between 10 and 5,000.');
  }
  if (budgets.perHostRateRps < 0.5 || budgets.perHostRateRps > 20) {
    errors.push('Per-host rate must be between 0.5 and 20 req/s.');
  }
  if (budgets.concurrency < 1 || budgets.concurrency > 10) {
    errors.push('Concurrency must be between 1 and 10 workers.');
  }
  if (budgets.maxWallClockSeconds < 30 || budgets.maxWallClockSeconds > 3600) {
    errors.push('Wall-clock duration must be between 30s and 3,600s.');
  }
  return errors;
}

export function buildNormalizedScopePreview(params: {
  allowedHosts: string[];
  allowedPorts: number[];
  allowedPathPrefixes: string[];
  excludedPaths: string[];
  allowedMethods: HttpMethodOption[];
  blockPrivateAndLinkLocal: boolean;
  localLabExceptionActive: boolean;
  budgets: ScopeBudgets;
}): string {
  const lines = [
    `HOSTS: ${params.allowedHosts.length ? params.allowedHosts.join(', ') : '(none)'}`,
    `PORTS: ${params.allowedPorts.length ? params.allowedPorts.join(', ') : '(default)'}`,
    `INCLUDE_PREFIXES: ${params.allowedPathPrefixes.length ? params.allowedPathPrefixes.join(', ') : '/'}`,
    `EXCLUDE_PATTERNS: ${params.excludedPaths.length ? params.excludedPaths.join(', ') : '(none)'}`,
    `METHODS: ${params.allowedMethods.join(', ')}`,
    `NET_POLICY: ${params.blockPrivateAndLinkLocal ? 'Block private/link-local' : 'Unrestricted'}${params.localLabExceptionActive ? ' + Local Lab exception active' : ''}`,
    `BUDGETS: depth=${params.budgets.maxCrawlDepth}, reqs=${params.budgets.maxRequests}, rate=${params.budgets.perHostRateRps}rps, conc=${params.budgets.concurrency}, ttl=${params.budgets.maxWallClockSeconds}s`,
  ];
  return lines.join('\n');
}

export const OPENAPI_ALLOWED_EXTENSIONS = ['.json', '.yaml', '.yml'];

export function validateOpenApiFileCandidate(file: { name: string; size: number }, maxBytes = 5 * 1024 * 1024): string | null {
  const lower = file.name.toLowerCase();
  const hasValidExt = OPENAPI_ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!hasValidExt) {
    return `Unsupported file type for "${file.name}". Only OpenAPI .json, .yaml, or .yml files are permitted.`;
  }
  if (file.size <= 0) {
    return `File "${file.name}" is empty.`;
  }
  if (file.size > maxBytes) {
    return `File "${file.name}" exceeds the configured ${(maxBytes / (1024 * 1024)).toFixed(1)} MB limit.`;
  }
  return null;
}
