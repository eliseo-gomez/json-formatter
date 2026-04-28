import { useCallback, useEffect, useMemo, useState } from "react";
import JsonTreeEditor from "./components/JsonTreeEditor";
import type { TranslationNode } from "./types/translation";
import { setByPath, validateTranslationJson } from "./utils/jsonHelpers";
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

type LanguageDetailResponse = {
  data: LanguageItem | { id: number; documentId: string; attributes: LanguageItem };
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTranslationNodeEmpty(value: unknown): boolean {
  return !isPlainObject(value) || Object.keys(value).length === 0;
}

function normalizeLanguage(raw: LanguageItem | { id: number; documentId: string; attributes: LanguageItem }): LanguageItem {
  if ("attributes" in raw) {
    return {
      ...raw.attributes,
      id: raw.id,
      documentId: raw.documentId ?? raw.attributes.documentId,
    };
  }
  return raw;
}

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
  const [selectedLanguageDocumentId, setSelectedLanguageDocumentId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageItem | null>(null);
  const [translationData, setTranslationData] = useState<TranslationNode | null>(null);

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
        const normalized = (payload.data ?? []).map((item) => normalizeLanguage(item));
        setLanguages(normalized);
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

  useEffect(() => {
    if (selectedLanguageDocumentId === null) return;
    if (!strapiUrl || !strapiApiKey) {
      setDetailsError("Missing STRAPI_URL or STRAPI_API_KEY in .env.");
      return;
    }

    const controller = new AbortController();

    const fetchLanguageDetails = async () => {
      setDetailsLoading(true);
      setDetailsError(null);
      setSaveMessage(null);

      try {
        const url = `${strapiUrl.replace(/\/$/, "")}/api/languages/${selectedLanguageDocumentId}`;
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${strapiApiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Failed to load language details (${res.status})`);
        }

        const payload = (await res.json()) as LanguageDetailResponse;
        const normalized = normalizeLanguage(payload.data);
        setSelectedLanguage(normalized);

        const rawTranslation = normalized.translation;
        if (!isTranslationNodeEmpty(rawTranslation)) {
          const validation = validateTranslationJson(rawTranslation);
          if (validation !== true) {
            throw new Error(validation.error);
          }
          setTranslationData(rawTranslation as TranslationNode);
          return;
        }

        const templateRes = await fetch("/translation_template.json", { signal: controller.signal });
        if (!templateRes.ok) {
          throw new Error(`Failed to load translation template (${templateRes.status})`);
        }
        const templateJson = (await templateRes.json()) as unknown;
        const templateValidation = validateTranslationJson(templateJson);
        if (templateValidation !== true) {
          throw new Error(templateValidation.error);
        }
        setTranslationData(templateJson as TranslationNode);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setDetailsError((err as Error).message);
          setSelectedLanguage(null);
          setTranslationData(null);
        }
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchLanguageDetails();

    return () => controller.abort();
  }, [selectedLanguageDocumentId, strapiApiKey, strapiUrl]);

  const onDetailUpdate = useCallback((path: string[], value: string) => {
    setTranslationData((prev) => {
      if (!prev) return prev;
      return setByPath(prev, path, value);
    });
  }, []);

  const onBack = useCallback(() => {
    setSelectedLanguageDocumentId(null);
    setSelectedLanguage(null);
    setTranslationData(null);
    setDetailsError(null);
    setSaveMessage(null);
  }, []);

  const onSave = useCallback(async () => {
    if (!selectedLanguage || !translationData) return;

    setSaving(true);
    setSaveMessage(null);
    setDetailsError(null);

    try {
      const url = `${strapiUrl.replace(/\/$/, "")}/api/languages/${selectedLanguage.documentId}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${strapiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            translation: translationData,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save translation (${res.status})`);
      }

      setSaveMessage("Translation updated successfully.");
    } catch (err) {
      setDetailsError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [selectedLanguage, strapiApiKey, strapiUrl, translationData]);

  const pageInfo = useMemo(() => {
    if (pagination.total === 0) return "No results";
    return `Showing page ${pagination.page} of ${pagination.pageCount} (${pagination.total} total)`;
  }, [pagination]);

  const canGoPrev = page > 1;
  const canGoNext = page < pagination.pageCount;

  if (selectedLanguageDocumentId !== null) {
    return (
      <div className="app">
        <header className="app-header">
          <button type="button" className="back-btn" onClick={onBack}>
            Back
          </button>
          <h1 className="app-title">{selectedLanguage?.description ?? "Language details"}</h1>
          {selectedLanguage && (
            <p className="app-subtitle">
              {selectedLanguage.language_code} - {selectedLanguage.documentId}
            </p>
          )}
        </header>

        <div className="app-card">
          {detailsLoading ? (
            <p className="app-message">Loading details...</p>
          ) : detailsError ? (
            <div className="app-banner app-banner--warning" role="alert">
              {detailsError}
            </div>
          ) : translationData ? (
            <>
              <div className="app-tree-wrap">
                <JsonTreeEditor data={translationData} onUpdate={onDetailUpdate} />
              </div>
              <div className="details-actions">
                <button type="button" onClick={onSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
                {saveMessage && <p className="save-message">{saveMessage}</p>}
              </div>
            </>
          ) : (
            <p className="app-message">No translation data available.</p>
          )}
        </div>
      </div>
    );
  }

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
              <article
                key={language.id}
                className="language-card"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedLanguageDocumentId(language.documentId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedLanguageDocumentId(language.documentId);
                  }
                }}
              >
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
