import type { AgentProfile } from '../models/document.model';

export type SsoRole = 'agent' | 'chef_service' | 'directeur_greffe';

export interface SsoClaims {
  sub?: unknown;
  name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  preferred_username?: unknown;
  roles?: unknown;
  jurisdiction_code?: unknown;
  service_code?: unknown;
}

const JURISDICTION_LABELS: Record<string, string> = {
  'TJ-LILLE': 'Tribunal judiciaire de Lille',
};

const SERVICE_LABELS: Record<string, string> = {
  BAJ: 'BAJ',
};

export function mapSsoClaimsToAgentProfile(claims: SsoClaims): AgentProfile | null {
  const agentRef = stringClaim(claims.sub);
  const jurisdictionCode = stringClaim(claims.jurisdiction_code);

  if (!agentRef || !jurisdictionCode) {
    return null;
  }

  const serviceCode = stringClaim(claims.service_code);

  return {
    displayName: displayNameFromClaims(claims),
    agentRef,
    roles: roleClaims(claims.roles),
    jurisdictionCode,
    jurisdictionName: JURISDICTION_LABELS[jurisdictionCode] ?? jurisdictionCode,
    serviceCode,
    serviceName: serviceCode ? (SERVICE_LABELS[serviceCode] ?? serviceCode) : undefined,
  };
}

function displayNameFromClaims(claims: SsoClaims): string {
  const explicitName = stringClaim(claims.name);
  if (explicitName) return explicitName;

  const givenName = stringClaim(claims.given_name);
  const familyName = stringClaim(claims.family_name);
  const fullName = [givenName, familyName].filter(Boolean).join(' ');
  if (fullName) return fullName;

  return stringClaim(claims.preferred_username) ?? stringClaim(claims.sub) ?? 'Agent';
}

function roleClaims(value: unknown): SsoRole[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return values.filter(isSsoRole);
}

function isSsoRole(value: unknown): value is SsoRole {
  return value === 'agent' || value === 'chef_service' || value === 'directeur_greffe';
}

function stringClaim(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
