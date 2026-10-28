
const { parseOasdiffOutput } = require('../../src/analyzer/reportParser');

describe('oasdiff report parser', () => {
  it('parses the summary and a breaking response property change', () => {
    const output = [
      '1 changes: 1 error, 0 warning, 0 info',
      'error   [response-property-type-changed] at new.yaml',
      '        in API GET /users/{user_id}',
      "                the 'id' response's property 'type' changed from 'integer' to 'string' for status '200'",
    ].join('\n');

    const report = parseOasdiffOutput(output);

    expect(report.summary).toEqual({
      totalChanges: 1,
      errors: 1,
      warnings: 0,
      infos: 0,
    });

    expect(report.changes).toHaveLength(1);
    expect(report.changes[0]).toEqual({
      ruleId: 'response-property-type-changed',
      severity: 'error',
      method: 'GET',
      path: '/users/{user_id}',
      response: 'id',
      property: 'type',
      oldValue: 'integer',
      newValue: 'string',
      statusCode: '200',
    });
  });

  it('returns an empty report for empty output', () => {
    expect(parseOasdiffOutput('')).toEqual({
      summary: {
        totalChanges: 0,
        errors: 0,
        warnings: 0,
        infos: 0,
      },
      changes: [],
    });
  });

  it('accepts the known safe oasdiff output', () => {
    const output =
      'No breaking changes to report, but the specs are different.\n' +
      "Run 'oasdiff diff' to see structural differences.";

    expect(parseOasdiffOutput(output)).toEqual({
      summary: {
        totalChanges: 0,
        errors: 0,
        warnings: 0,
        infos: 0,
      },
      changes: [],
    });
  });

  it('rejects non-empty output that does not match the expected format', () => {
    expect(() =>
      parseOasdiffOutput('Unexpected output from analyzer')
    ).toThrow('Unrecognized oasdiff output format.');
  });

  it('rejects non-string output', () => {
    expect(() => parseOasdiffOutput(null)).toThrow(
      'oasdiff output must be a string.'
    );
  });
});
