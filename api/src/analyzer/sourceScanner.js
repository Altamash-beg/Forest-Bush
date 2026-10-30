
const path = require('node:path');
const AdmZip = require('adm-zip');

const SUPPORTED_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
]);

const MAX_FILES = 1000;
const MAX_UNCOMPRESSED_SIZE = 50 * 1024 * 1024;

// Read supported source files from an uploaded ZIP.
const readSourceFilesFromZip = (zipBuffer) => {
  if (!Buffer.isBuffer(zipBuffer)) {
    throw new TypeError('ZIP input must be a Buffer.');
  }

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  if (entries.length > MAX_FILES) {
    throw new Error('ZIP contains too many files.');
  }

  const sourceFiles = [];
  let totalSize = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const extension = path.extname(entry.entryName).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.has(extension)) continue;

    // Ignore unsafe paths.
    const normalizedPath = path.posix.normalize(
      entry.entryName.replace(/\\/g, '/')
    );

    if (
      normalizedPath.startsWith('../') ||
      path.posix.isAbsolute(normalizedPath)
    ) {
      throw new Error('ZIP contains an unsafe file path.');
    }

    totalSize += entry.header.size;

    if (totalSize > MAX_UNCOMPRESSED_SIZE) {
      throw new Error('ZIP source files exceed the 50 MB limit.');
    }

    sourceFiles.push({
      filePath: normalizedPath,
      content: entry.getData().toString('utf8'),
    });
  }

  return sourceFiles;
};

// Detect fetch() and Axios API calls.
const detectApiCalls = (sourceFiles) => {
  const apiCalls = [];

  for (const file of sourceFiles) {
    const content = file.content;

    // Detect fetch("URL") and fetch('URL').
    const fetchPattern =
      /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g;

    // Detect axios.get(), axios.post(), etc.
    const axiosPattern =
      /axios\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

    let match;

    while ((match = fetchPattern.exec(content)) !== null) {
      apiCalls.push({
        filePath: file.filePath,
        method: 'UNKNOWN',
        endpoint: match[1],
        library: 'fetch',
      });
    }

    while ((match = axiosPattern.exec(content)) !== null) {
      apiCalls.push({
        filePath: file.filePath,
        method: match[1].toUpperCase(),
        endpoint: match[2],
        library: 'axios',
      });
    }
  }

  return apiCalls;
};

// Normalize URLs while preserving OpenAPI path parameters.
const normalizeEndpoint = (endpoint) => {
  try {
    const url = new URL(endpoint, 'http://localhost');

    return decodeURIComponent(url.pathname)
      .replace(/\/+$/, '') || '/';
  } catch {
    return endpoint.split(/[?#]/)[0]
      .replace(/\/+$/, '') || '/';
  }
};

// Match source API endpoints against changed OpenAPI endpoints.
const endpointsMatch = (sourceEndpoint, changedEndpoint) => {
  const sourcePath = normalizeEndpoint(sourceEndpoint);
  const changedPath = normalizeEndpoint(changedEndpoint);

  const sourceParts = sourcePath.split('/');
  const changedParts = changedPath.split('/');

  if (sourceParts.length !== changedParts.length) {
    return false;
  }

  return changedParts.every((part, index) => {
    const isParameter =
      part.startsWith('{') && part.endsWith('}');

    return isParameter || part === sourceParts[index];
  });
};

// Identify source files that call endpoints with breaking changes.
const findAffectedFiles = (apiCalls, breakingChanges) => {
  const affectedFiles = [];

  for (const change of breakingChanges) {
    for (const call of apiCalls) {
      const methodMatches =
        call.method === 'UNKNOWN' ||
        call.method === change.method;

      const pathMatches = endpointsMatch(
        call.endpoint,
        change.path
      );

      if (methodMatches && pathMatches) {
        const changedProperty =
          change.response || change.property;

        affectedFiles.push({
          filePath: call.filePath,
          endpoint: call.endpoint,
          method: call.method,
          library: call.library,
          changedEndpoint: change.path,
          changedProperty,
          oldValue: change.oldValue,
          newValue: change.newValue,
          severity: change.severity,
          reason: `This file calls ${change.method} ${change.path}, where response property "${changedProperty}" changed type from "${change.oldValue}" to "${change.newValue}".`,
        });
      }
    }
  }

  return affectedFiles;
};

module.exports = {
  readSourceFilesFromZip,
  detectApiCalls,
  findAffectedFiles,
};
