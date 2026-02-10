import { useState, useEffect, useCallback, useRef } from "react";
import type { TranslationNode } from "./types/translation";
import {
  setByPath,
  formatForExport,
  validateTranslationJson,
} from "./utils/jsonHelpers";
import JsonTreeEditor from "./components/JsonTreeEditor";
import "./App.css";

function App() {
  const [data, setData] = useState<TranslationNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/translation_template.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load template: ${res.status}`);
        return res.json();
      })
      .then((json: unknown) => {
        const validation = validateTranslationJson(json);
        if (validation !== true) {
          setError(validation.error);
          return;
        }
        setData(json as TranslationNode);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  const onUpdate = useCallback((path: string[], value: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return setByPath(prev, path, value);
    });
  }, []);

  const onExportDownload = useCallback(() => {
    if (!data) return;
    const blob = new Blob([formatForExport(data)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "translation_updated.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const onCopyClipboard = useCallback(async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(formatForExport(data));
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      setError("Failed to copy to clipboard.");
    }
  }, [data]);

  const onImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string) as unknown;
        const validation = validateTranslationJson(json);
        if (validation !== true) {
          setError(validation.error);
          return;
        }
        setData(json as TranslationNode);
        setError(null);
      } catch {
        setError("Invalid JSON in file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  if (!loaded) {
    return (
      <div className="app">
        <div className="app-card">
          <p className="app-message">Loading translation template…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="app">
        <div className="app-card app-card--error">
          <h1 className="app-title">Translation Editor</h1>
          <p className="app-message app-message--error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Translation Editor</h1>
      </header>
      {error && (
        <div className="app-banner app-banner--warning" role="alert">
          {error}
        </div>
      )}
      <div className="app-card">
        <div className="app-tree-wrap">
          {data && <JsonTreeEditor data={data} onUpdate={onUpdate} />}
        </div>
        <div className="app-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={onFileChange}
            className="app-file-input"
            aria-label="Import JSON file"
          />
          <button
            type="button"
            className="app-btn app-btn--secondary"
            onClick={onImportClick}
          >
            Import JSON
          </button>
          <button
            type="button"
            className="app-btn app-btn--primary"
            onClick={onExportDownload}
            disabled={!data}
          >
            Download
          </button>
          <button
            type="button"
            className="app-btn app-btn--secondary"
            onClick={onCopyClipboard}
            disabled={!data}
          >
            {copyFeedback ? "Copied!" : "Copy to clipboard"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
