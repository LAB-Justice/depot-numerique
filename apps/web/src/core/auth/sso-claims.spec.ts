import { mapSsoClaimsToAgentProfile } from './sso-claims';

describe('mapSsoClaimsToAgentProfile', () => {
  it('maps an agent profile with a service code', () => {
    const profile = mapSsoClaimsToAgentProfile({
      sub: '432c4df5-9f48-4c9a-94c1-a287ef725dbf',
      name: 'Olivier Agent',
      roles: ['agent'],
      jurisdiction_code: 'TJ-LILLE',
      service_code: 'BAJ',
    });

    expect(profile).toEqual({
      displayName: 'Olivier Agent',
      agentRef: '432c4df5-9f48-4c9a-94c1-a287ef725dbf',
      roles: ['agent'],
      jurisdictionCode: 'TJ-LILLE',
      jurisdictionName: 'Tribunal judiciaire de Lille',
      serviceCode: 'BAJ',
      serviceName: 'BAJ',
    });
  });

  it('maps a director profile without a service code', () => {
    const profile = mapSsoClaimsToAgentProfile({
      sub: '11b4529d-eb6a-4271-b5f0-881cc4eeeedc',
      given_name: 'Hervé',
      family_name: 'Directeur de greffe',
      roles: ['directeur_greffe'],
      jurisdiction_code: 'TJ-LILLE',
    });

    expect(profile).toEqual({
      displayName: 'Hervé Directeur de greffe',
      agentRef: '11b4529d-eb6a-4271-b5f0-881cc4eeeedc',
      roles: ['directeur_greffe'],
      jurisdictionCode: 'TJ-LILLE',
      jurisdictionName: 'Tribunal judiciaire de Lille',
      serviceCode: undefined,
      serviceName: undefined,
    });
  });

  it('returns null when mandatory SSO claims are missing', () => {
    expect(mapSsoClaimsToAgentProfile({ sub: 'agent-ref' })).toBeNull();
    expect(mapSsoClaimsToAgentProfile({ jurisdiction_code: 'TJ-LILLE' })).toBeNull();
  });
});
