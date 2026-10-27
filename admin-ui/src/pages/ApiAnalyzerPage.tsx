import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/authContext';
import { apiClient, type ApiAnalysisResult } from '../lib/api';

const exampleOldSpec = `{
  "openapi": "3.0.3",
  "info": {
    "title": "Users API",
    "version": "1.0.0"
  },
  "paths": {
    "/users/{user_id}": {
      "get": {
        "responses": {
          "200": {
            "description": "User response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "integer"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

const exampleNewSpec = `{
  "openapi": "3.0.3",
  "info": {
    "title": "Users API",
    "version": "1.1.0"
  },
  "paths": {
    "/users/{user_id}": {
      "get": {
        "responses": {
          "200": {
            "description": "User response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

const buttonBase =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 disabled:cursor-not-allowed disabled:opacity-60';

const editorBase =
  'min-h-72 w-full resize-y rounded-lg border border-gray-700 bg-gray-950 p-4 font-mono text-sm leading-6 text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:min-h-80';

export default function ApiAnalyzerPage() {
  const { apiKey } = useAuth();

  const [oldSpecText, setOldSpecText] = useState(exampleOldSpec);
  const [newSpecText, setNewSpecText] = useState(exampleNewSpec);
  const [result, setResult] = useState<ApiAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setError(null);
    setResult(null);

    let oldSpec: Record<string, unknown>;
    let newSpec: Record<string, unknown>;

    try {
      oldSpec = JSON.parse(oldSpecText);
      newSpec = JSON.parse(newSpecText);

      if (
        !oldSpec ||
        typeof oldSpec !== 'object' ||
        Array.isArray(oldSpec) ||
        !newSpec ||
        typeof newSpec !== 'object' ||
        Array.isArray(newSpec)
      ) {
        throw new Error('Both specifications must be JSON objects.');
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message === 'Both specifications must be JSON objects.'
            ? err.message
            : 'Invalid JSON. Check both OpenAPI specifications and try again.'
          : 'Invalid JSON. Check both OpenAPI specifications and try again.';

      setError(message);
      toast.error(message);
      return;
    }

    if (!apiKey) {
      const message = 'Your API key is missing. Please log in again.';
      setError(message);
      toast.error(message);
      return;
    }

    setIsAnalyzing(true);

    try {
      const analysis = await apiClient.analyzeApi(
        apiKey,
        oldSpec,
        newSpec,
      );

      setResult(analysis);

      if (analysis.releaseDecision === 'BLOCKED') {
        toast.error('Release blocked: breaking API changes detected.');
      } else {
        toast.success('Analysis complete: no breaking changes detected.');
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to analyze these specifications.';

      setError(message);
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadExamples = () => {
    setOldSpecText(exampleOldSpec);
    setNewSpecText(exampleNewSpec);
    setError(null);
    setResult(null);
    toast.success('Example specifications loaded.');
  };

  const metrics = result
    ? [
        {
          label: 'Total changes',
          value: result.report.summary.totalChanges,
          tone: 'text-gray-100',
        },
        {
          label: 'Breaking changes',
          value: result.report.summary.errors,
          tone: 'text-red-300',
        },
        {
          label: 'Warnings',
          value: result.report.summary.warnings,
          tone: 'text-amber-300',
        },
        {
          label: 'Informational',
          value: result.report.summary.infos,
          tone: 'text-sky-300',
        },
      ]
    : [];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 pb-10">
      {/* Page heading */}
      <header className="flex flex-col gap-5 border-b border-gray-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Release engineering
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-gray-100 sm:text-3xl">
            API Change Analyzer
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-400 sm:text-base">
            Compare API contracts, identify potentially breaking changes, and
            review release readiness before shipping.
          </p>
        </div>

        <button
          type="button"
          onClick={loadExamples}
          className={`${buttonBase} border border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800`}
        >
          Reset examples
        </button>
      </header>

      {/* Comparison workflow */}
      <section aria-labelledby="comparison-heading" className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="comparison-heading"
              className="text-lg font-semibold text-gray-100"
            >
              Specification comparison
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Provide the current contract and the proposed version.
            </p>
          </div>

          <span className="w-fit rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-400">
            OpenAPI · JSON
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {/* Old specification */}
          <section className="min-w-0 overflow-hidden rounded-xl border border-gray-700/80 bg-gray-900/70">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-800 px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-sm font-bold text-red-300"
                >
                  01
                </span>

                <div>
                  <h3 className="font-semibold text-gray-100">
                    Current specification
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-gray-400">
                    The existing API contract used as the baseline.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOldSpecText(exampleOldSpec);
                  setError(null);
                  setResult(null);
                }}
                className="rounded-md px-2 py-1.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-400/10 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Load example
              </button>
            </div>

            <div className="space-y-2 p-3 sm:p-4">
              <label
                htmlFor="old-spec"
                className="text-xs font-medium text-gray-400"
              >
                Old OpenAPI JSON
              </label>

              <textarea
                id="old-spec"
                value={oldSpecText}
                onChange={(event) => {
                  setOldSpecText(event.target.value);
                  setError(null);
                  setResult(null);
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="Old OpenAPI specification JSON"
                className={editorBase}
                placeholder="Paste your current OpenAPI JSON here..."
              />

              <p className="text-xs text-gray-500">
                The contract your existing consumers rely on.
              </p>
            </div>
          </section>

          {/* New specification */}
          <section className="min-w-0 overflow-hidden rounded-xl border border-gray-700/80 bg-gray-900/70">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-800 px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-sm font-bold text-emerald-300"
                >
                  02
                </span>

                <div>
                  <h3 className="font-semibold text-gray-100">
                    Proposed specification
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-gray-400">
                    The API changes you want to review before release.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewSpecText(exampleNewSpec);
                  setError(null);
                  setResult(null);
                }}
                className="rounded-md px-2 py-1.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-400/10 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Load example
              </button>
            </div>

            <div className="space-y-2 p-3 sm:p-4">
              <label
                htmlFor="new-spec"
                className="text-xs font-medium text-gray-400"
              >
                New OpenAPI JSON
              </label>

              <textarea
                id="new-spec"
                value={newSpecText}
                onChange={(event) => {
                  setNewSpecText(event.target.value);
                  setError(null);
                  setResult(null);
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="New OpenAPI specification JSON"
                className={editorBase}
                placeholder="Paste your proposed OpenAPI JSON here..."
              />

              <p className="text-xs text-gray-500">
                The contract you intend to ship.
              </p>
            </div>
          </section>
        </div>

        {/* Primary action */}
        <div className="flex flex-col gap-3 border-t border-gray-800 pt-5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className={`${buttonBase} min-h-11 bg-blue-600 text-white shadow-sm hover:bg-blue-500`}
          >
            {isAnalyzing ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
                />
                Analyzing specifications...
              </>
            ) : (
              'Analyze API changes'
            )}
          </button>

          <p className="text-xs leading-5 text-gray-500">
            Analysis compares the contracts and reports detected changes.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-800/80 bg-red-950/40 p-4"
          >
            <p className="text-sm font-semibold text-red-200">
              Analysis could not be completed
            </p>
            <p className="mt-1 text-sm leading-6 text-red-200/80">{error}</p>
            <p className="mt-2 text-xs text-red-200/70">
              Check that both specifications contain valid JSON and try again.
            </p>
          </div>
        )}
      </section>

      {/* Analysis results */}
      {result && (
        <section
          aria-labelledby="results-heading"
          aria-live="polite"
          className="space-y-5 border-t border-gray-800 pt-7"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Analysis report
              </div>

              <h2
                id="results-heading"
                className="text-xl font-semibold tracking-tight text-gray-100"
              >
                Release assessment
              </h2>

              <p className="mt-1 text-sm text-gray-400">
                {result.hasBreakingChanges
                  ? 'Breaking changes were detected in the proposed contract.'
                  : 'No breaking changes were detected by this analysis.'}
              </p>
            </div>

            <span
              className={`inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                result.releaseDecision === 'BLOCKED'
                  ? 'border-red-800 bg-red-950/50 text-red-200'
                  : 'border-emerald-800 bg-emerald-950/40 text-emerald-200'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  result.releaseDecision === 'BLOCKED'
                    ? 'bg-red-400'
                    : 'bg-emerald-400'
                }`}
              />
              RELEASE: {result.releaseDecision}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map((item) => (
              <article
                key={item.label}
                className="rounded-xl border border-gray-800 bg-gray-900/70 p-4"
              >
                <p className="text-xs font-medium text-gray-400">
                  {item.label}
                </p>
                <p
                  className={`mt-3 text-2xl font-semibold tracking-tight ${item.tone}`}
                >
                  {item.value}
                </p>
              </article>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50">
            <div className="border-b border-gray-800 px-4 py-4 sm:px-5">
              <h3 className="font-semibold text-gray-100">
                Detected changes
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                Review the affected endpoint, rule, and value differences.
              </p>
            </div>

            {result.report.changes.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
                  ✓
                </div>
                <h4 className="mt-3 font-medium text-gray-100">
                  No detailed changes reported
                </h4>
                <p className="mt-1 text-sm text-gray-400">
                  The analyzer returned no individual change entries.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {result.report.changes.map((change, index) => (
                  <article
                    key={`${change.ruleId}-${change.method}-${change.path}-${index}`}
                    className="p-4 transition-colors hover:bg-gray-800/30 sm:p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs font-bold text-gray-200">
                        {change.method}
                      </span>

                      <code className="min-w-0 break-all text-sm font-medium text-blue-300">
                        {change.path}
                      </code>

                      <span
                        className={`rounded-md border px-2 py-1 text-xs font-semibold uppercase ${
                          change.severity === 'error'
                            ? 'border-red-800 bg-red-950/50 text-red-200'
                            : change.severity === 'warning'
                              ? 'border-amber-800 bg-amber-950/40 text-amber-200'
                              : 'border-sky-800 bg-sky-950/40 text-sky-200'
                        }`}
                      >
                        {change.severity}
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-medium text-gray-500">
                          Change rule
                        </dt>
                        <dd className="mt-1 break-all font-mono text-gray-300">
                          {change.ruleId}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-medium text-gray-500">
                          Property · Response
                        </dt>
                        <dd className="mt-1 break-all text-gray-300">
                          <code>{change.property}</code>
                          <span className="text-gray-500"> · </span>
                          {change.statusCode}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="min-w-0 rounded-lg border border-red-900/60 bg-red-950/20 p-3">
                        <p className="text-xs font-semibold text-red-300">
                          Previous value
                        </p>
                        <code className="mt-2 block break-all text-sm text-gray-200">
                          {change.oldValue}
                        </code>
                      </div>

                      <div className="min-w-0 rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-3">
                        <p className="text-xs font-semibold text-emerald-300">
                          Proposed value
                        </p>
                        <code className="mt-2 block break-all text-sm text-gray-200">
                          {change.newValue}
                        </code>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <details className="group rounded-xl border border-gray-800 bg-gray-900/50">
            <summary className="cursor-pointer rounded-xl px-4 py-4 text-sm font-medium text-gray-300 hover:bg-gray-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:px-5">
              Technical details
              <span className="ml-2 text-xs font-normal text-gray-500">
                Raw oasdiff output
              </span>
            </summary>

            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words border-t border-gray-800 bg-gray-950 p-4 font-mono text-xs leading-6 text-gray-300 sm:p-5">
              {result.output || 'No raw output returned.'}
            </pre>
          </details>

          <p className="text-xs leading-5 text-gray-500">
            Release decisions reflect the analyzer&apos;s detected changes.
            Review the report and your project&apos;s release policy before
            deploying.
          </p>
        </section>
      )}
    </main>
  );
}