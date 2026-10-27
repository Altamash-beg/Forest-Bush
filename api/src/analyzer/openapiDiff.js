const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const validateSpecPaths = (oldSpecPath, newSpecPath) => {
  for (const [label, specPath] of [
    ['Old', oldSpecPath],
    ['New', newSpecPath],
  ]) {
    if (typeof specPath !== 'string' || specPath.trim() === '') {
      throw new Error(`${label} OpenAPI specification path is required.`);
    }

    if (!fs.existsSync(path.resolve(specPath))) {
      throw new Error(`${label} OpenAPI specification file was not found.`);
    }
  }

  return true;
};

const compareOpenApiSpecs = (
  oldSpecPath,
  newSpecPath,
    oasdiffPath = process.env.OASDIFF_PATH || path.join(
    process.env.USERPROFILE || process.env.HOME,
    'Downloads',
    'oasdiff',
    'oasdiff.exe'
  )
) => {
  validateSpecPaths(oldSpecPath, newSpecPath);

  if (!fs.existsSync(oasdiffPath)) {
    throw new Error('oasdiff executable was not found. Check its path.');
  }

  let output = '';

  try {
    output = execFileSync(
      oasdiffPath,
      ['breaking', path.resolve(oldSpecPath), path.resolve(newSpecPath)],
      {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
  } catch (error) {
    output = [
      error.stdout?.toString(),
      error.stderr?.toString(),
    ]
      .filter(Boolean)
      .join('\n')
      .trim();

    if (error.status === 102) {
      throw new Error(
        `oasdiff could not load an OpenAPI specification: ${output}`
      );
    }

    const hasBreakingChanges =
      /^\s*error\s+\[[^\]]+\]/m.test(output);

    if (typeof error.status !== 'number' || !hasBreakingChanges) {
      throw new Error(
        `Failed to run oasdiff: ${output || error.message}`
      );
    }
  }

  const hasBreakingChanges =
    /^\s*error\s+\[/m.test(output || '');

  return {
    hasBreakingChanges,
    output: (output || '').trim(),
  };
};

module.exports = {
  validateSpecPaths,
  compareOpenApiSpecs,
};
