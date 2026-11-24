import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapFindingStatus,
  mapRunState,
  mapScopeApprovalState,
  mapSeverity,
  mapTargetAuthStatus,
} from './status-mappers';
import {
  buildNormalizedScopePreview,
  previewNormalizeUrl,
  validateOpenApiFileCandidate,
  validateScopeBudgets,
} from './validators';
import { canDeleteAssessmentRun, getRoleUiCapabilities } from './permissions';
import { boundUntrustedText, formatDurationSeconds } from './formatters';

test('mapRunState maps canonical states and safely falls back to unknown', () => {
  assert.equal(mapRunState('running').tone, 'info');
  assert.equal(mapRunState('cancellation_requested').label, 'Cancellation Requested');
  assert.equal(mapRunState('cancelled').tone, 'warning');
  assert.equal(mapRunState('completed').tone, 'success');
  assert.equal(mapRunState('partial').tone, 'warning');

  const unknown = mapRunState('weird_backend_state');
  assert.equal(unknown.isUnknown, true);
  assert.equal(unknown.tone, 'unknown');
  assert.notEqual(unknown.tone, 'success');
});

test('mapTargetAuthStatus prevents launch unless explicitly authorized', () => {
  assert.equal(mapTargetAuthStatus('authorized').canLaunch, true);
  assert.equal(mapTargetAuthStatus('registered').canLaunch, false);
  assert.equal(mapTargetAuthStatus('pending_review').canLaunch, false);
  assert.equal(mapTargetAuthStatus('expired').canLaunch, false);
  assert.equal(mapTargetAuthStatus('revoked').canLaunch, false);
  assert.equal(mapTargetAuthStatus('needs_revalidation').canLaunch, false);
  assert.equal(mapTargetAuthStatus('mystery').canLaunch, false);
});

test('mapScopeApprovalState and mapFindingStatus preserve unknown values safely', () => {
  assert.equal(mapScopeApprovalState('approved').isApproved, true);
  assert.equal(mapScopeApprovalState('draft').isApproved, false);
  assert.equal(mapFindingStatus('validated_finding').tone, 'error');
  assert.equal(mapFindingStatus('raw_alert').tone, 'neutral');
  assert.equal(mapSeverity('critical').rank, 5);
  assert.equal(mapSeverity('unlisted').isUnknown, true);
});

test('previewNormalizeUrl normalizes valid http/https URLs and rejects invalid schemes', () => {
  const ok = previewNormalizeUrl('HTTPS://Staging.Example.local:8443/api/');
  assert.equal(ok.valid, true);
  assert.equal(ok.normalized, 'https://staging.example.local:8443/api');
  assert.equal(ok.host, 'staging.example.local');
  assert.equal(ok.port, 8443);

  const badScheme = previewNormalizeUrl('ftp://example.com');
  assert.equal(badScheme.valid, false);
});

test('validateScopeBudgets enforces provisional SRS bounds', () => {
  const validErrors = validateScopeBudgets({
    maxCrawlDepth: 3,
    maxRequests: 400,
    perHostRateRps: 2,
    concurrency: 2,
    maxWallClockSeconds: 300,
  });
  assert.equal(validErrors.length, 0);

  const badErrors = validateScopeBudgets({
    maxCrawlDepth: 20,
    maxRequests: 5,
    perHostRateRps: 50,
    concurrency: 0,
    maxWallClockSeconds: 10,
  });
  assert.equal(badErrors.length, 5);
});

test('buildNormalizedScopePreview summarizes policy cleanly', () => {
  const preview = buildNormalizedScopePreview({
    allowedHosts: ['localhost'],
    allowedPorts: [8080],
    allowedPathPrefixes: ['/api', '/rest'],
    excludedPaths: ['/logout'],
    allowedMethods: ['GET', 'HEAD'],
    blockPrivateAndLinkLocal: true,
    localLabExceptionActive: true,
    budgets: {
      maxCrawlDepth: 3,
      maxRequests: 300,
      perHostRateRps: 2,
      concurrency: 2,
      maxWallClockSeconds: 180,
    },
  });
  assert.match(preview, /HOSTS: localhost/);
  assert.match(preview, /Local Lab exception active/);
});

test('validateOpenApiFileCandidate permits json/yaml within size limits', () => {
  assert.equal(validateOpenApiFileCandidate({ name: 'shop.yaml', size: 2048 }), null);
  assert.equal(validateOpenApiFileCandidate({ name: 'spec.json', size: 1024 }), null);
  assert.ok(validateOpenApiFileCandidate({ name: 'payload.exe', size: 512 }));
  assert.ok(validateOpenApiFileCandidate({ name: 'huge.json', size: 20 * 1024 * 1024 }));
});

test('getRoleUiCapabilities and canDeleteAssessmentRun enforce SRS least-privilege separation', () => {
  const owner = getRoleUiCapabilities('project_owner');
  const tester = getRoleUiCapabilities('security_tester');
  const evaluator = getRoleUiCapabilities('supervisor_evaluator');
  const admin = getRoleUiCapabilities('system_admin');

  assert.equal(owner.canApproveTargetAuthorization, true);
  assert.equal(owner.canApproveScope, true);
  assert.equal(owner.canDeleteRecords, true);
  assert.equal(tester.canApproveScope, false);
  assert.equal(tester.canApproveTargetAuthorization, false);
  assert.equal(tester.canDeleteRecords, true);
  assert.equal(evaluator.canLaunchAssessment, false);
  assert.equal(evaluator.canDeleteRecords, false);
  assert.equal(admin.canApproveTargetAuthorization, false);
  assert.equal(admin.canDeleteRecords, false);
  assert.equal(admin.canViewAdminHealth, true);

  assert.equal(canDeleteAssessmentRun('running'), false);
  assert.equal(canDeleteAssessmentRun('queued'), false);
  assert.equal(canDeleteAssessmentRun('cancellation_requested'), false);
  assert.equal(canDeleteAssessmentRun('completed'), true);
  assert.equal(canDeleteAssessmentRun('partial'), true);
  assert.equal(canDeleteAssessmentRun('cancelled'), true);
  assert.equal(canDeleteAssessmentRun('failed'), true);
});

test('boundUntrustedText and formatDurationSeconds safely format bounded text', () => {
  const bounded = boundUntrustedText('a'.repeat(50), 20);
  assert.equal(bounded.truncated, true);
  assert.equal(bounded.text.length, 20);
  assert.equal(bounded.originalLength, 50);
  assert.equal(formatDurationSeconds(125), '2m 05s');
});
