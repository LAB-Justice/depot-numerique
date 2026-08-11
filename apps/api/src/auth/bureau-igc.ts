const DIRECTORY_SUFFIX = ['ou=sites', 'dc=justice', 'dc=fr'] as const;
const REGIONAL_STRUCTURE_INDEX = 2;
const SSO_CODE_PATTERN = /^\d{1,100}$/;

export interface BureauIgcPath {
  hierarchyCodes: string[];
  regionalCode: string;
  workCode: string;
  workIsRegional: boolean;
}

export class BureauIgcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BureauIgcError';
  }
}

export function pendingStructureDisplayName(ssoCode: string): string {
  return `Libellé indisponible — SRJ ${ssoCode}`;
}

export function parseBureauIgc(value: string): BureauIgcPath {
  const components = value.split(',').map((component) => component.trim());

  if (components.some((component) => component.length === 0)) {
    throw new BureauIgcError(`Le DN bureauIGC contient un composant vide.`);
  }

  const suffix = components
    .slice(-DIRECTORY_SUFFIX.length)
    .map((component) => component.toLowerCase());

  if (
    suffix.length !== DIRECTORY_SUFFIX.length ||
    suffix.some((component, index) => component !== DIRECTORY_SUFFIX[index])
  ) {
    throw new BureauIgcError(
      `Le DN bureauIGC doit appartenir à la branche ou=sites,dc=justice,dc=fr.`,
    );
  }

  const leafToRootCodes = components.slice(0, -DIRECTORY_SUFFIX.length).map((component) => {
    const match = /^ou=(.+)$/i.exec(component);
    const code = match?.[1]?.trim();

    if (!code || !SSO_CODE_PATTERN.test(code)) {
      throw new BureauIgcError(`Le DN bureauIGC contient un identifiant SRJ invalide.`);
    }

    return code;
  });

  const hierarchyCodes = leafToRootCodes.reverse();
  const regionalCode = hierarchyCodes[REGIONAL_STRUCTURE_INDEX];
  const workCode = hierarchyCodes.at(-1);

  if (!regionalCode || !workCode) {
    throw new BureauIgcError(
      `Le DN bureauIGC ne contient pas les niveaux MJUS, DSJ et cour d'appel attendus.`,
    );
  }

  return {
    hierarchyCodes,
    regionalCode,
    workCode,
    workIsRegional: regionalCode === workCode,
  };
}
