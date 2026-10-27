const path = require('node:path');
const {
  compareOpenApiSpecs,
  validateSpecPaths,
} = require('../../src/analyzer/openapiDiff');

const practiceDir = path.resolve(__dirname, '../../oasdiff-practice');
const oldSpec = path.join(practiceDir, 'old.yaml');
const newSpec = path.join(practiceDir, 'new.yaml');

describe('OpenAPI analyzer', () => {
  it('validates paths to both specification files', () => {
    expect(validateSpecPaths(oldSpec, newSpec)).toBe(true);
  });

  it('rejects a missing specification file', () => {
    expect(() =>
      validateSpecPaths(
        oldSpec,
        path.join(practiceDir, 'missing.yaml')
      )
    ).toThrow('New OpenAPI specification file was not found.');
  });

  it('detects a breaking response property type change', () => {
    const result = compareOpenApiSpecs(oldSpec, newSpec);

    expect(result.hasBreakingChanges).toBe(true);
    expect(result.output).toContain('response-property-type-changed');
    expect(result.output).toContain('integer');
    expect(result.output).toContain('string');
  });

  it('throws when oasdiff cannot load invalid specifications', () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'analyzer-test-')
    );

    const invalidOldSpec = path.join(tempDir, 'old.yaml');
    const invalidNewSpec = path.join(tempDir, 'new.yaml');

    try {
      fs.writeFileSync(invalidOldSpec, 'not: [valid: yaml', 'utf8');
      fs.writeFileSync(invalidNewSpec, 'not: [valid: yaml', 'utf8');

      expect(() =>
        compareOpenApiSpecs(invalidOldSpec, invalidNewSpec)
      ).toThrow();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
