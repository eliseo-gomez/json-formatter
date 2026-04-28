import { useEffect, useMemo, useState } from "react";
import "./App.css";

type LanguageItem = {
  id: number;
  documentId: string;
  language_code: string;
  description: string;
  translation: unknown;
  translation_web: unknown;
};

type LanguagesResponse = {
  data: LanguageItem[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
};

function App() {
  const env = import.meta.env as Record<string, string | undefined>;
  const strapiUrl = env.VITE_STRAPI_URL ?? env.STRAPI_URL ?? "";
  const strapiApiKey = env.VITE_STRAPI_API_KEY ?? env.STRAPI_API_KEY ?? "";

  const [languages, setLanguages] = useState<LanguageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (!strapiUrl || !strapiApiKey) {
      setError("Missing STRAPI_URL or STRAPI_API_KEY in .env.");
      return;
    }

    const controller = new AbortController();

    const fetchLanguages = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          "pagination[page]": String(page),
          "pagination[pageSize]": String(pageSize),
        });

        if (search) {
          params.append("filters[$or][0][language_code][$containsi]", search);
          params.append("filters[$or][1][description][$containsi]", search);
        }

        const url = `${strapiUrl.replace(/\/$/, "")}/api/languages?${params.toString()}`;
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${strapiApiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Failed to load languages (${res.status})`);
        }

        const payload = (await res.json()) as LanguagesResponse;
        setLanguages(payload.data ?? []);
        setPagination(
          payload.meta?.pagination ?? { page, pageSize, pageCount: 1, total: 0 },
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
          setLanguages([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLanguages();

    return () => controller.abort();
  }, [page, pageSize, search, strapiApiKey, strapiUrl]);

  const pageInfo = useMemo(() => {
    if (pagination.total === 0) return "No results";
    return `Showing page ${pagination.page} of ${pagination.pageCount} (${pagination.total} total)`;
  }, [pagination]);

  const canGoPrev = page > 1;
  const canGoNext = page < pagination.pageCount;

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Languages Home</h1>
        <p className="app-subtitle">Browse languages from your Strapi endpoint.</p>
      </header>

      <div className="app-card">
        <section className="controls" aria-label="Request controls">
          <label className="field">
            <span>Search</span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by language code or description"
            />
          </label>
          <label className="field field--small">
            <span>Page</span>
            <input
              type="number"
              min={1}
              value={page}
              onChange={(e) => setPage(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <label className="field field--small">
            <span>Page size</span>
            <input
              type="number"
              min={1}
              max={100}
              value={pageSize}
              onChange={(e) => {
                const value = Math.max(1, Number(e.target.value) || 1);
                setPage(1);
                setPageSize(value);
              }}
            />
          </label>
        </section>

        <div className="toolbar">
          <p className="page-info">{pageInfo}</p>
          <div className="toolbar-actions">
            <button type="button" onClick={() => setPage((prev) => prev - 1)} disabled={!canGoPrev}>
              Previous
            </button>
            <button type="button" onClick={() => setPage((prev) => prev + 1)} disabled={!canGoNext}>
              Next
            </button>
          </div>
        </div>

        {error && (
          <div className="app-banner app-banner--warning" role="alert">
            {error}
          </div>
        )}

        <div className="grid" aria-live="polite">
          {loading ? (
            <p className="app-message">Loading languages...</p>
          ) : languages.length === 0 ? (
            <p className="app-message">No languages found.</p>
          ) : (
            languages.map((language) => (
              <article key={language.id} className="language-card">
                <h2 className="language-code">{language.language_code}</h2>
                <p className="language-id">
                  <strong>id:</strong> {language.documentId}
                </p>
                <p className="language-description">{language.description}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
