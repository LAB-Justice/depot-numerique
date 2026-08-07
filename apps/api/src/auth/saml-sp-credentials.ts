import { createPrivateKey, createPublicKey, type KeyObject, X509Certificate } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const MAX_PEM_SIZE_BYTES = 64 * 1024;
const MIN_RSA_MODULUS_LENGTH = 2048;

export interface SamlSpCredentialPaths {
  encryptionCertificatePath: string;
  encryptionPrivateKeyPath: string;
  signingCertificatePath: string;
  signingPrivateKeyPath: string;
}

export interface SamlSpCredentials {
  encryptionCertificateBase64: string;
  encryptionPrivateKey: string;
  signingCertificateBase64: string;
  signingPrivateKey: string;
}

async function readPem(path: string, privateKey: boolean, environment: string): Promise<string> {
  const file = await stat(path);

  if (!file.isFile()) {
    throw new Error(`Le fichier PEM ${path} n’existe pas ou n’est pas un fichier.`);
  }

  if (file.size === 0 || file.size > MAX_PEM_SIZE_BYTES) {
    throw new Error(
      `Le fichier PEM ${path} est vide ou trop volumineux (max ${MAX_PEM_SIZE_BYTES} octets).`,
    );
  }

  if (privateKey && environment === 'production' && (file.mode & 0o077) !== 0) {
    throw new Error(
      `Le fichier PEM ${path} est un fichier privé et doit être lisible uniquement par l’utilisateur de l’API (chmod 600).`,
    );
  }

  return (await readFile(path, 'utf8')).trim();
}

function assertRsaKey(key: KeyObject, label: string): void {
  if (key.asymmetricKeyType !== 'rsa') {
    throw new Error(`La clé ${label} n’est pas une clé RSA.`);
  }

  const modulusLength = key.asymmetricKeyDetails?.modulusLength ?? 0;

  if (modulusLength < MIN_RSA_MODULUS_LENGTH) {
    throw new Error(
      `La clé ${label} est trop courte (modulusLength=${modulusLength}, minimum ${MIN_RSA_MODULUS_LENGTH}).`,
    );
  }
}

function validateKeyPair(privateKeyPem: string, certificatePem: string, label: string): string {
  let privateKey: KeyObject;
  let certificate: X509Certificate;

  try {
    privateKey = createPrivateKey(privateKeyPem);
    certificate = new X509Certificate(certificatePem);
  } catch (error) {
    throw new Error(`La clé privée ${label} n’est pas un PEM valide : ${(error as Error).message}`);
  }

  assertRsaKey(privateKey, `SAML clé privée ${label}`);
  assertRsaKey(certificate.publicKey, `SAML clé publique ${label}`);

  const privatePublicKey = createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
  const certificatePublicKey = certificate.publicKey.export({ format: 'der', type: 'spki' });

  if (!privatePublicKey.equals(certificatePublicKey)) {
    throw new Error(`La clé privée ${label} ne correspond pas au certificat public.`);
  }

  const now = Date.now();

  if (Date.parse(certificate.validFrom) > now || Date.parse(certificate.validTo) <= now) {
    throw new Error(`Le certificat ${label} n’est pas valide à la date actuelle.`);
  }

  return certificate.raw.toString('base64');
}

export async function loadSamlSpCredentials(
  paths: SamlSpCredentialPaths,
  environment: string,
): Promise<SamlSpCredentials> {
  const [signingPrivateKey, signingCertificate, encryptionPrivateKey, encryptionCertificate] =
    await Promise.all([
      readPem(paths.signingPrivateKeyPath, true, environment),
      readPem(paths.signingCertificatePath, false, environment),
      readPem(paths.encryptionPrivateKeyPath, true, environment),
      readPem(paths.encryptionCertificatePath, false, environment),
    ]);

  return {
    encryptionCertificateBase64: validateKeyPair(
      encryptionPrivateKey,
      encryptionCertificate,
      'chiffrement',
    ),
    encryptionPrivateKey,
    signingCertificateBase64: validateKeyPair(signingPrivateKey, signingCertificate, 'signature'),
    signingPrivateKey,
  };
}
