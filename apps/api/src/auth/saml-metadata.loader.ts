const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_SIZE_BYTES = 100 * 1024;

export interface LoadSamlMetadataOptions {
  environment: string;
  fetchImplementation?: typeof fetch;
  maxSizeBytes?: number;
  timeoutMs?: number;
  url: string;
}

function validateMetadataUrl(url: string, environment: string): URL {
  const metadataUrl = new URL(url);

  if (!['http:', 'https:'].includes(metadataUrl.protocol)) {
    throw new Error(`L’URL de métadonnées SAML ${url} doit utiliser le protocole HTTP ou HTTPS.`);
  }

  if (environment === 'production' && metadataUrl.protocol !== 'https:') {
    throw new Error(
      `L’URL de métadonnées SAML ${url} doit utiliser le protocole HTTPS en production.`,
    );
  }

  return metadataUrl;
}

async function readLimitedBody(response: Response, maxSizeBytes: number): Promise<string> {
  const declaredLength = response.headers.get('content-length');

  if (declaredLength && Number.parseInt(declaredLength, 10) > maxSizeBytes) {
    throw new Error(
      `Le corps de la réponse dépasse la taille maximale autorisée (${declaredLength} octets > ${maxSizeBytes} octets).`,
    );
  }

  if (!response.body) {
    throw new Error('La réponse SAML ne contient pas de corps.');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalSize += value.byteLength;

    if (totalSize > maxSizeBytes) {
      await reader.cancel();
      throw new Error(
        `Le corps de la réponse dépasse la taille maximale autorisée (${totalSize} octets > ${maxSizeBytes} octets).`,
      );
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(totalSize);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
  } catch (error) {
    throw new Error(
      `Le corps de la réponse n’est pas un texte UTF-8 valide : ${(error as Error).message}`,
    );
  }
}

function validateMetadataDocument(metadata: string): void {
  if (!metadata.includes('EntityDescriptor') || !metadata.includes('IDPSSODescriptor')) {
    throw new Error('Le document de métadonnées SAML ne contient pas les éléments attendus.');
  }
}

export async function loadSamlMetadata(options: LoadSamlMetadataOptions): Promise<string> {
  const metadataUrl = validateMetadataUrl(options.url, options.environment);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetchImplementation(metadataUrl, {
      headers: {
        accept: 'application/samlmetadata+xml, application/xml, text/xml',
      },
      redirect: 'error',
      signal: abortController.signal,
    });
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error(
        `Le téléchargement des métadonnées SAML a dépassé le délai de ${timeoutMs} ms.`,
        { cause: error },
      );
    }

    throw new Error(`Erreur lors du téléchargement des métadonnées SAML.`, { cause: error });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `Le téléchargement des métadonnées SAML a échoué avec le code HTTP ${response.status}.`,
    );
  }

  const metadata = await readLimitedBody(response, maxSizeBytes);
  validateMetadataDocument(metadata);

  return metadata;
}
