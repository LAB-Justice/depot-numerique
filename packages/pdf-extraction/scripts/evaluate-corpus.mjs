#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { buildEvaluationReports } from '../dist/evaluation-report.js';
import { extractPdfDocument } from '../dist/index.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const DEFAULT_INPUT_DIR = resolve(PACKAGE_DIR, '.local-fixtures');
const EVALUATION_DIR = resolve(PACKAGE_DIR, '.evaluation');
const REVIEW_LIMIT_DEFAULT = 50;
const REPORT_FILES = [
  'summary.md',
  'documents.csv',
  'issues.csv',
  'failures.csv',
  'by-document-type.csv',
  'by-source-folder.csv',
  'samples-to-review.csv',
  'raw-results.jsonl',
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const inputDirectory = resolve(args.inputDirectory ?? DEFAULT_INPUT_DIR);
  const inputStats = await stat(inputDirectory).catch(() => undefined);
  if (!inputStats?.isDirectory()) {
    throw new Error(`Le dossier PDF est introuvable: ${inputDirectory}`);
  }

  const pdfPaths = await findPdfFiles(inputDirectory);
  const runId = timestampForRun(new Date());
  const runDirectory = resolve(EVALUATION_DIR, 'runs', runId);
  const latestDirectory = resolve(EVALUATION_DIR, 'latest');
  const records = [];
  const totalStart = performance.now();

  await mkdir(runDirectory, { recursive: true });

  for (const pdfPath of pdfPaths) {
    records.push(await evaluatePdf(pdfPath, inputDirectory, args.verbose));
  }

  const totalProcessingTimeMs = performance.now() - totalStart;
  const reports = buildEvaluationReports(records, {
    includeValues: args.includeValues,
    reviewLimit: args.reviewLimit,
    totalProcessingTimeMs,
    inputDirectory,
    runId,
  });

  await writeReports(runDirectory, reports);
  await rm(latestDirectory, { recursive: true, force: true });
  await mkdir(latestDirectory, { recursive: true });
  for (const fileName of REPORT_FILES) {
    await copyFile(join(runDirectory, fileName), join(latestDirectory, fileName));
  }

  const failures = records.filter((record) => !record.ok).length;
  const successes = records.length - failures;

  // biome-ignore lint/suspicious/noConsole: CLI summary only, never PDF contents.
  console.log(`PDF trouves: ${records.length}`);
  // biome-ignore lint/suspicious/noConsole: CLI summary only, never PDF contents.
  console.log(`Succes extraction: ${successes}`);
  // biome-ignore lint/suspicious/noConsole: CLI summary only, never PDF contents.
  console.log(`Erreurs techniques: ${failures}`);
  // biome-ignore lint/suspicious/noConsole: CLI summary only, never PDF contents.
  console.log(`Run: ${runDirectory}`);
  // biome-ignore lint/suspicious/noConsole: CLI summary only, never PDF contents.
  console.log(`Latest: ${latestDirectory}`);
}

function parseArgs(argv) {
  const args = {
    help: false,
    includeValues: false,
    inputDirectory: undefined,
    reviewLimit: REVIEW_LIMIT_DEFAULT,
    verbose: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--include-values') {
      args.includeValues = true;
      continue;
    }
    if (arg === '--verbose') {
      args.verbose = true;
      continue;
    }
    if (arg === '--review-limit') {
      const value = argv[index + 1];
      if (!value) throw new Error('--review-limit attend un entier positif.');
      args.reviewLimit = parsePositiveInteger(value, '--review-limit');
      index += 1;
      continue;
    }
    if (arg?.startsWith('--review-limit=')) {
      args.reviewLimit = parsePositiveInteger(
        arg.slice('--review-limit='.length),
        '--review-limit',
      );
      continue;
    }
    if (arg?.startsWith('-')) {
      throw new Error(`Option inconnue: ${arg}`);
    }
    if (args.inputDirectory) {
      throw new Error(`Un seul dossier PDF peut etre fourni. Recu en trop: ${arg}`);
    }
    args.inputDirectory = arg;
  }

  return args;
}

function parsePositiveInteger(value, optionName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} attend un entier positif.`);
  }
  return parsed;
}

function printHelp() {
  // biome-ignore lint/suspicious/noConsole: CLI help.
  console.log(`Usage:
  pnpm pdf-extraction:evaluate [dossier-pdf] [--review-limit 50] [--include-values]

Par defaut, le dossier lu est:
  packages/pdf-extraction/.local-fixtures/

Le script parcourt recursivement tous les .pdf et ecrit:
  packages/pdf-extraction/.evaluation/runs/YYYY-MM-DD-HHMMSS/
  packages/pdf-extraction/.evaluation/latest/

Confidentialite:
  Les CSV et summary.md n'incluent pas de valeurs extraites par defaut.
  raw-results.jsonl contient le resultat complet local de extractPdfDocument.
  --include-values ajoute des colonnes sensibles dans documents.csv pour diagnostic local.

Diagnostic:
  Les warnings PDF.js sont masques par defaut pour garder la sortie exploitable.
  --verbose les affiche.`);
}

async function findPdfFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findPdfFiles(entryPath)));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      files.push(entryPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function evaluatePdf(pdfPath, inputDirectory, verbose) {
  const start = performance.now();
  const relativePath = normalizePath(relative(inputDirectory, pdfPath));
  const metadata = {
    fileName: basename(pdfPath),
    relativePath,
    sourceFolder: sourceFolderFor(relativePath),
    fileSizeBytes: 0,
    fileHash: '',
  };

  try {
    const buffer = await readFile(pdfPath);
    metadata.fileSizeBytes = buffer.byteLength;
    metadata.fileHash = sha256(buffer);
    const result = await withPdfWarningsPolicy(() => extractPdfDocument(buffer), verbose);
    return {
      ...metadata,
      ok: true,
      processingTimeMs: performance.now() - start,
      result,
    };
  } catch (error) {
    const fileStats = await stat(pdfPath).catch(() => undefined);
    if (fileStats) metadata.fileSizeBytes = fileStats.size;
    return {
      ...metadata,
      ok: false,
      processingTimeMs: performance.now() - start,
      errorMessage: errorMessage(error),
    };
  }
}

async function withPdfWarningsPolicy(callback, verbose) {
  if (verbose) return callback();

  // biome-ignore lint/suspicious/noConsole: Temporarily intercept PDF.js warnings during local evaluation.
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = args.map((arg) => String(arg)).join(' ');
    if (!message.startsWith('Warning:')) originalWarn(...args);
  };
  try {
    return await callback();
  } finally {
    console.warn = originalWarn;
  }
}

async function writeReports(runDirectory, reports) {
  await writeFile(join(runDirectory, 'summary.md'), reports.summaryMd, 'utf8');
  await writeFile(join(runDirectory, 'documents.csv'), reports.documentsCsv, 'utf8');
  await writeFile(join(runDirectory, 'issues.csv'), reports.issuesCsv, 'utf8');
  await writeFile(join(runDirectory, 'failures.csv'), reports.failuresCsv, 'utf8');
  await writeFile(join(runDirectory, 'by-document-type.csv'), reports.byDocumentTypeCsv, 'utf8');
  await writeFile(join(runDirectory, 'by-source-folder.csv'), reports.bySourceFolderCsv, 'utf8');
  await writeFile(join(runDirectory, 'samples-to-review.csv'), reports.samplesToReviewCsv, 'utf8');
  await writeFile(join(runDirectory, 'raw-results.jsonl'), reports.rawResultsJsonl, 'utf8');
}

function timestampForRun(date) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function normalizePath(path) {
  return path.split(sep).join('/');
}

function sourceFolderFor(relativePath) {
  const parts = relativePath.split('/');
  return parts.length > 1 ? parts[0] : '.';
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function errorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: CLI errors are operational metadata only.
  console.error(errorMessage(error));
  process.exitCode = 1;
});
