
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/authContext';
import CreateFlagModal from '../components/CreateFlagModal';
import FlagList from '../components/FlagList';
import FlagDetailPage from './FlagDetailPage';
import ApiAnalyzerPage from './ApiAnalyzerPage';
import {
  apiClient,
  DEFAULT_ENVIRONMENT,
  ENVIRONMENTS,
  type Environment,
  type FeatureFlag,
} from '../lib/api';

type DashboardView = 'flags' | 'analyzer';

export default function DashboardPage() {
  const { apiKey, logout } = useAuth();

  const [activeView, setActiveView] = useState<DashboardView>('flags');
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [environment, setEnvironment] =
    useState<Environment>(DEFAULT_ENVIRONMENT);

  const fetchFlags = async (
    key: string,
    selectedEnvironment: Environment
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const fetchedFlags = await apiClient.getFlags(
        key,
        selectedEnvironment
      );

      setFlags(fetchedFlags);
    } catch (err) {
      console.error('Failed to fetch flags:', err);
      setError(
        'Failed to fetch flags. Please check your API key and network connection.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (apiKey) {
      fetchFlags(apiKey, environment);
    } else {
      setError('API key is missing.');
      setIsLoading(false);
    }
  }, [apiKey, environment]);

  const handleViewChange = (view: DashboardView) => {
    setActiveView(view);
    setSelectedFlag(null);
    setIsCreateModalOpen(false);
  };

  const handleUpdateFlag = (updatedFlag: FeatureFlag) => {
    setFlags((currentFlags) =>
      currentFlags.map((flag) =>
        flag.key === updatedFlag.key &&
        flag.environment === updatedFlag.environment
          ? updatedFlag
          : flag
      )
    );

    setSelectedFlag((currentFlag) => {
      if (!currentFlag) {
        return currentFlag;
      }

      return currentFlag.key === updatedFlag.key &&
        currentFlag.environment === updatedFlag.environment
        ? updatedFlag
        : currentFlag;
    });
  };

  const handleDeleteFlag = (
    key: string,
    deletedEnvironment: Environment
  ) => {
    setFlags((currentFlags) =>
      currentFlags.filter(
        (flag) =>
          flag.key !== key || flag.environment !== deletedEnvironment
      )
    );

    setSelectedFlag((currentFlag) => {
      if (!currentFlag) {
        return currentFlag;
      }

      return currentFlag.key === key &&
        currentFlag.environment === deletedEnvironment
        ? null
        : currentFlag;
    });
  };

  const handleCreateFlag = (newFlag: FeatureFlag) => {
    setFlags((currentFlags) => [newFlag, ...currentFlags]);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Forest Bush</h1>
            <p className="mt-1 text-sm text-gray-400">
              Feature Management & API Release Safety
            </p>
          </div>

          <nav
            aria-label="Main navigation"
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              onClick={() => handleViewChange('flags')}
              aria-current={activeView === 'flags' ? 'page' : undefined}
              className={`rounded-md px-4 py-2 font-medium transition-colors ${
                activeView === 'flags'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              Feature Flags
            </button>

            <button
              type="button"
              onClick={() => handleViewChange('analyzer')}
              aria-current={activeView === 'analyzer' ? 'page' : undefined}
              className={`rounded-md px-4 py-2 font-medium transition-colors ${
                activeView === 'analyzer'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              API Analyzer
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-md bg-red-600 px-4 py-2 font-bold text-white transition-colors hover:bg-red-700"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-8">
        {activeView === 'analyzer' ? (
          <ApiAnalyzerPage />
        ) : (
          <>
            {isLoading && (
              <p className="text-center text-gray-300">
                Loading flags...
              </p>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-md border border-red-800 bg-red-950 p-4 text-center text-red-300"
              >
                {error}
              </div>
            )}

            {!isLoading && !error && selectedFlag && (
              <FlagDetailPage
                apiKey={apiKey || ''}
                flag={selectedFlag}
                onBack={() => setSelectedFlag(null)}
                onUpdate={handleUpdateFlag}
              />
            )}

            {!isLoading && !error && !selectedFlag && (
              <div>
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-semibold">
                      All Feature Flags
                    </h2>

                    <label className="mt-3 block text-sm text-gray-400">
                      Environment
                      <select
                        value={environment}
                        onChange={(event) => {
                          setSelectedFlag(null);
                          setEnvironment(
                            event.target.value as Environment
                          );
                        }}
                        className="ml-3 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                      >
                        {ENVIRONMENTS.map((env) => (
                          <option key={env} value={env}>
                            {env}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="rounded-md bg-green-600 px-4 py-2 font-bold text-white transition-colors hover:bg-green-700"
                  >
                    + Add New Flag
                  </button>
                </div>

                <FlagList
                  flags={flags}
                  onUpdate={handleUpdateFlag}
                  onDelete={handleDeleteFlag}
                  onEdit={(flag) => setSelectedFlag(flag)}
                />
              </div>
            )}
          </>
        )}
      </main>

      {apiKey && activeView === 'flags' && (
        <CreateFlagModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateFlag}
          environment={environment}
          apiCall={(data) =>
            apiClient.createFlag(apiKey, {
              ...data,
              environment,
            })
          }
        />
      )}
    </div>
  );
}