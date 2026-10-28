
const parseOasdiffOutput = (output = '') => {
  if (typeof output !== 'string') {
    throw new TypeError('oasdiff output must be a string.');
  }

  const text = output.trim();

  if (!text) {
    return {
      summary: {
        totalChanges: 0,
        errors: 0,
        warnings: 0,
        infos: 0,
      },
      changes: [],
    };
  }

  const summaryMatch = text.match(
    /(\d+)\s+changes:\s+(\d+)\s+error,\s+(\d+)\s+warning,\s+(\d+)\s+info/i
  );

  const changes = [];

  const changePattern =
    /error\s+\[([^\]]+)\][^\n]*\n\s*in API\s+([A-Z]+)\s+(.+)\n\s*the\s+[`']([^`']+)[`']\s+response's property\s+[`']([^`']+)[`']\s+changed from\s+[`']([^`']+)[`']\s+to\s+[`']([^`']+)[`']\s+for status\s+[`']([^`']+)[`']/g;

  let match;

  while ((match = changePattern.exec(text)) !== null) {
    changes.push({
      ruleId: match[1],
      severity: 'error',
      method: match[2],
      path: match[3].trim(),
      response: match[4],
      property: match[5],
      oldValue: match[6],
      newValue: match[7],
      statusCode: match[8],
    });
  }

  const isSafeOutput =
  /^No breaking changes to report(?:[,.]|$)/i.test(text);

if (!summaryMatch && changes.length === 0 && !isSafeOutput) {
  throw new Error('Unrecognized oasdiff output format.');
}

  return {
    summary: summaryMatch
      ? {
          totalChanges: Number(summaryMatch[1]),
          errors: Number(summaryMatch[2]),
          warnings: Number(summaryMatch[3]),
          infos: Number(summaryMatch[4]),
        }
      : {
          totalChanges: changes.length,
          errors: changes.filter(
            (change) => change.severity === 'error'
          ).length,
          warnings: 0,
          infos: 0,
        },
    changes,
  };
};

module.exports = { parseOasdiffOutput };
