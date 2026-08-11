import { describe, expect, it } from '@jest/globals';
import { BureauIgcError, parseBureauIgc, pendingStructureDisplayName } from './bureau-igc';

describe('parseBureauIgc', () => {
  it('should normalize the ministry DN from the root to the work assignment', () => {
    expect(
      parseBureauIgc('ou=100094,ou=100009,ou=935161,ou=905907,ou=sites,dc=justice,dc=fr'),
    ).toEqual({
      hierarchyCodes: ['905907', '935161', '100009', '100094'],
      regionalCode: '100009',
      workCode: '100094',
      workIsRegional: false,
    });
  });

  it('should detect a work assignment directly at the regional court', () => {
    expect(parseBureauIgc('ou=100009,ou=935161,ou=905907,ou=sites,dc=justice,dc=fr')).toEqual({
      hierarchyCodes: ['905907', '935161', '100009'],
      regionalCode: '100009',
      workCode: '100009',
      workIsRegional: true,
    });
  });

  it('should preserve the deepest assignment below a jurisdiction', () => {
    expect(
      parseBureauIgc('ou=100095,ou=100094,ou=100009,ou=935161,ou=905907,ou=sites,dc=justice,dc=fr')
        .workCode,
    ).toBe('100095');
  });

  it.each([
    '',
    'ou=100094,ou=100009,ou=sites,dc=justice,dc=fr',
    'ou=ABC,ou=100009,ou=935161,ou=905907,ou=sites,dc=justice,dc=fr',
    'ou=100094,ou=100009,ou=935161,ou=905907,ou=people,dc=justice,dc=fr',
    'ou=100094,,ou=100009,ou=935161,ou=905907,ou=sites,dc=justice,dc=fr',
  ])('should reject an invalid DN: %s', (value) => {
    expect(() => parseBureauIgc(value)).toThrow(BureauIgcError);
  });
});

describe('pendingStructureDisplayName', () => {
  it('should make the placeholder nature of the display name explicit', () => {
    expect(pendingStructureDisplayName('100009')).toBe('Libellé indisponible — SRJ 100009');
  });
});
