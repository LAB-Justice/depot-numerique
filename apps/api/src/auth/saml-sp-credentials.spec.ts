import { execFileSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { loadSamlSpCredentials, type SamlSpCredentialPaths } from './saml-sp-credentials';

jest.setTimeout(15_000);

let secretDirectory: string;

function credentialPaths(): SamlSpCredentialPaths {
  return {
    encryptionCertificatePath: join(secretDirectory, 'sp-encryption-certificate.pem'),
    encryptionPrivateKeyPath: join(secretDirectory, 'sp-encryption-private-key.pem'),
    signingCertificatePath: join(secretDirectory, 'sp-signing-certificate.pem'),
    signingPrivateKeyPath: join(secretDirectory, 'sp-signing-private-key.pem'),
  };
}

function certificateBase64(pem: string): string {
  return pem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replaceAll(/\s/g, '');
}

function generateCertificate(name: string, keyOptions: string[]): SamlSpCredentialPaths {
  const privateKeyPath = join(secretDirectory, `${name}-private-key.pem`);
  const certificatePath = join(secretDirectory, `${name}-certificate.pem`);

  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      ...keyOptions,
      '-sha256',
      '-nodes',
      '-days',
      '2',
      '-subj',
      `/CN=${name}`,
      '-keyout',
      privateKeyPath,
      '-out',
      certificatePath,
    ],
    { stdio: 'ignore' },
  );

  return {
    encryptionCertificatePath: certificatePath,
    encryptionPrivateKeyPath: privateKeyPath,
    signingCertificatePath: certificatePath,
    signingPrivateKeyPath: privateKeyPath,
  };
}

describe('loadSamlSpCredentials', () => {
  beforeAll(async () => {
    secretDirectory = await mkdtemp(join(tmpdir(), 'depot-numerique-saml-'));

    execFileSync(
      'bash',
      [resolve(process.cwd(), '../../scripts/sso/generate-sp-certificates.sh')],
      {
        env: {
          ...process.env,
          SSO_SECRET_DIR: secretDirectory,
        },
        stdio: 'ignore',
      },
    );
  });

  afterAll(async () => {
    await rm(secretDirectory, { force: true, recursive: true });
  });

  it('should load two valid RSA key pairs and extract the Base64 certificates', async () => {
    const paths = credentialPaths();
    const credentials = await loadSamlSpCredentials(paths, 'production');
    const [signingCertificate, encryptionCertificate] = await Promise.all([
      readFile(paths.signingCertificatePath, 'utf8'),
      readFile(paths.encryptionCertificatePath, 'utf8'),
    ]);

    expect(credentials.signingPrivateKey).toContain('-----BEGIN PRIVATE KEY-----');
    expect(credentials.encryptionPrivateKey).toContain('-----BEGIN PRIVATE KEY-----');
    expect(credentials.signingCertificateBase64).toBe(certificateBase64(signingCertificate));
    expect(credentials.encryptionCertificateBase64).toBe(certificateBase64(encryptionCertificate));
  });

  it('should reject group-readable or world-readable private keys in production', async () => {
    const paths = credentialPaths();
    await chmod(paths.signingPrivateKeyPath, 0o640);

    try {
      await expect(loadSamlSpCredentials(paths, 'production')).rejects.toThrow(/chmod 600/);
    } finally {
      await chmod(paths.signingPrivateKeyPath, 0o600);
    }
  });

  it('should reject a private key that does not match its certificate', async () => {
    const paths = credentialPaths();

    await expect(
      loadSamlSpCredentials(
        {
          ...paths,
          signingCertificatePath: paths.encryptionCertificatePath,
        },
        'development',
      ),
    ).rejects.toThrow(/ne correspond pas au certificat public/);
  });

  it('should reject content that is not a valid PEM private key', async () => {
    const paths = credentialPaths();
    const invalidPrivateKeyPath = join(secretDirectory, 'invalid-private-key.pem');
    await writeFile(invalidPrivateKeyPath, 'not a private key', { mode: 0o600 });

    await expect(
      loadSamlSpCredentials(
        {
          ...paths,
          signingPrivateKeyPath: invalidPrivateKeyPath,
        },
        'development',
      ),
    ).rejects.toThrow(/n’est pas un PEM valide/);
  });

  it('should reject an empty PEM file', async () => {
    const paths = credentialPaths();
    const emptyPrivateKeyPath = join(secretDirectory, 'empty-private-key.pem');
    await writeFile(emptyPrivateKeyPath, '', { mode: 0o600 });

    await expect(
      loadSamlSpCredentials(
        {
          ...paths,
          signingPrivateKeyPath: emptyPrivateKeyPath,
        },
        'development',
      ),
    ).rejects.toThrow(/vide ou trop volumineux/);
  });

  it('should reject a PEM file that exceeds the size limit', async () => {
    const paths = credentialPaths();
    const oversizedPrivateKeyPath = join(secretDirectory, 'oversized-private-key.pem');
    await writeFile(oversizedPrivateKeyPath, 'x'.repeat(64 * 1024 + 1), { mode: 0o600 });

    await expect(
      loadSamlSpCredentials(
        {
          ...paths,
          signingPrivateKeyPath: oversizedPrivateKeyPath,
        },
        'development',
      ),
    ).rejects.toThrow(/vide ou trop volumineux/);
  });

  it('should reject a path that does not reference a file', async () => {
    const paths = credentialPaths();

    await expect(
      loadSamlSpCredentials(
        {
          ...paths,
          signingPrivateKeyPath: secretDirectory,
        },
        'development',
      ),
    ).rejects.toThrow(/n’existe pas ou n’est pas un fichier/);
  });

  it('should reject a key pair that does not use RSA', async () => {
    const ecPaths = generateCertificate('ec-saml', ['ec', '-pkeyopt', 'ec_paramgen_curve:P-256']);

    await expect(loadSamlSpCredentials(ecPaths, 'development')).rejects.toThrow(
      /n’est pas une clé RSA/,
    );
  });

  it('should reject an RSA key shorter than 2048 bits', async () => {
    const shortRsaPaths = generateCertificate('short-rsa-saml', ['rsa:1024']);

    await expect(loadSamlSpCredentials(shortRsaPaths, 'development')).rejects.toThrow(
      /minimum 2048/,
    );
  });

  it('should reject an expired certificate', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2100-01-01T00:00:00.000Z'));

    try {
      await expect(loadSamlSpCredentials(credentialPaths(), 'development')).rejects.toThrow(
        /n’est pas valide à la date actuelle/,
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
