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

type DetailsTab = "mobile" | "web";
type AlertTone = "error" | "success" | "info";

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
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageItem | null>(null);
  const [translationData, setTranslationData] = useState<TranslationNode | null>(null);
  const [translationWebData, setTranslationWebData] = useState<TranslationNode | null>(null);
  const [activeTab, setActiveTab] = useState<DetailsTab>("mobile");
  const [alertModal, setAlertModal] = useState<{ message: string; tone: AlertTone } | null>(null);

  const showAlert = useCallback((message: string, tone: AlertTone) => {
    setAlertModal({ message, tone });
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (!strapiUrl || !strapiApiKey) {
      const message = "Missing STRAPI_URL or STRAPI_API_KEY in .env.";
      showAlert(message, "error");
      return;
    }

    const controller = new AbortController();

    const fetchLanguages = async () => {
      setLoading(true);

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
          const message = (err as Error).message;
          showAlert(message, "error");
          setLanguages([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLanguages();

    return () => controller.abort();
  }, [page, pageSize, search, showAlert, strapiApiKey, strapiUrl]);

  useEffect(() => {
    if (selectedLanguageDocumentId === null) return;
    if (!strapiUrl || !strapiApiKey) {
      const message = "Missing STRAPI_URL or STRAPI_API_KEY in .env.";
      setDetailsError(message);
      showAlert(message, "error");
      return;
    }

    const controller = new AbortController();

    const fetchLanguageDetails = async () => {
      setDetailsLoading(true);
      setDetailsError(null);
      setActiveTab("mobile");

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

        const loadNodeWithFallback = async (
          value: unknown,
          templatePath: string,
          templateLabel: string,
        ) => {
          if (!isTranslationNodeEmpty(value)) {
            const validation = validateTranslationJson(value);
            if (validation !== true) {
              throw new Error(validation.error);
            }
            return value as TranslationNode;
          }

          const templateRes = await fetch(templatePath, { signal: controller.signal });
          if (!templateRes.ok) {
            throw new Error(`Failed to load ${templateLabel} (${templateRes.status})`);
          }
          const templateJson = (await templateRes.json()) as unknown;
          const templateValidation = validateTranslationJson(templateJson);
          if (templateValidation !== true) {
            throw new Error(templateValidation.error);
          }
          return templateJson as TranslationNode;
        };

        const [mobileNode, webNode] = await Promise.all([
          loadNodeWithFallback(
            normalized.translation,
            "/translation_template.json",
            "translation template",
          ),
          loadNodeWithFallback(
            normalized.translation_web,
            "/translation_web_template.json",
            "translation web template",
          ),
        ]);

        setTranslationData(mobileNode);
        setTranslationWebData(webNode);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const message = (err as Error).message;
          setDetailsError(message);
          showAlert(message, "error");
          setSelectedLanguage(null);
          setTranslationData(null);
          setTranslationWebData(null);
        }
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchLanguageDetails();

    return () => controller.abort();
  }, [selectedLanguageDocumentId, showAlert, strapiApiKey, strapiUrl]);

  const onDetailUpdate = useCallback(
    (path: string[], value: string) => {
      if (activeTab === "mobile") {
        setTranslationData((prev) => {
          if (!prev) return prev;
          return setByPath(prev, path, value);
        });
        return;
      }

      setTranslationWebData((prev) => {
        if (!prev) return prev;
        return setByPath(prev, path, value);
      });
    },
    [activeTab],
  );

  const onBack = useCallback(() => {
    setSelectedLanguageDocumentId(null);
    setSelectedLanguage(null);
    setTranslationData(null);
    setTranslationWebData(null);
    setDetailsError(null);
    setActiveTab("mobile");
  }, []);

  const onSave = useCallback(async () => {
    if (!selectedLanguage) return;
    const dataToSave = activeTab === "mobile" ? translationData : translationWebData;
    if (!dataToSave) return;

    setSaving(true);
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
            [activeTab === "mobile" ? "translation" : "translation_web"]: dataToSave,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save translation (${res.status})`);
      }

      showAlert(
        activeTab === "mobile"
          ? "Localizations Mobile updated successfully."
          : "Localization Web updated successfully.",
        "success",
      );
    } catch (err) {
      const message = (err as Error).message;
      setDetailsError(message);
      showAlert(message, "error");
    } finally {
      setSaving(false);
    }
  }, [activeTab, selectedLanguage, showAlert, strapiApiKey, strapiUrl, translationData, translationWebData]);

  const pageInfo = useMemo(() => {
    if (pagination.total === 0) return "No results";
    return `Showing page ${pagination.page} of ${pagination.pageCount} (${pagination.total} total)`;
  }, [pagination]);

  const canGoPrev = page > 1;
  const canGoNext = page < pagination.pageCount;
  const activeTree = activeTab === "mobile" ? translationData : translationWebData;
  const alertNode = alertModal ? (
    <div className="alert-modal-backdrop" role="presentation" onClick={() => setAlertModal(null)}>
      <div
        className="alert-modal"
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="alert-modal__title">
          {alertModal.tone === "error" ? "Error" : alertModal.tone === "success" ? "Success" : "Info"}
        </h2>
        <p className="alert-modal__message">{alertModal.message}</p>
        <button type="button" className="alert-modal__close" onClick={() => setAlertModal(null)}>
          Close
        </button>
      </div>
    </div>
  ) : null;
  const savingNode = saving ? (
    <div className="alert-modal-backdrop" role="presentation">
      <div className="alert-modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2 className="alert-modal__title">Saving</h2>
        <p className="alert-modal__message">Updating localization data...</p>
      </div>
    </div>
  ) : null;

  if (selectedLanguageDocumentId !== null) {
    return (
      <>
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
              <p className="app-message">Unable to load details.</p>
            ) : activeTree ? (
              <>
                <div className="tabs" role="tablist" aria-label="Localization tabs">
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === "mobile" ? "tab-btn--active" : ""}`}
                    role="tab"
                    aria-selected={activeTab === "mobile"}
                    onClick={() => setActiveTab("mobile")}
                  >
                    Localizations Mobile
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === "web" ? "tab-btn--active" : ""}`}
                    role="tab"
                    aria-selected={activeTab === "web"}
                    onClick={() => setActiveTab("web")}
                  >
                    Localization Web
                  </button>
                </div>
                <div className="app-tree-wrap">
                  <JsonTreeEditor data={activeTree} onUpdate={onDetailUpdate} />
                </div>
                <div className="details-actions">
                  <button type="button" onClick={onSave} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            ) : (
              <p className="app-message">No translation data available.</p>
            )}
          </div>
        </div>
        {savingNode}
        {alertNode}
      </>
    );
  }

  return (
    <>
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
      {savingNode}
      {alertNode}
    </>
  );
}

export default App;
