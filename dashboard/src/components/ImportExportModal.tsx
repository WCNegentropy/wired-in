import { useState, useRef } from 'react';
import { useWiredInStore } from '../store';
import * as api from '../lib/api';
import type { WorkspaceExport } from '../types';
import { Download, Upload, FileJson, Rss, X } from 'lucide-react';

type TabType = 'export' | 'import';

interface JsonPreview {
  workspaces: Array<{ name: string; tileCount: number }>;
}

export default function ImportExportModal() {
  const {
    importExportModalOpen,
    setImportExportModalOpen,
    workspaces,
    loadWorkspaces,
    addToast,
  } = useWiredInStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('export');

  // Export state
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  // JSON import state
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonPreview, setJsonPreview] = useState<JsonPreview | null>(null);
  const [jsonData, setJsonData] = useState<WorkspaceExport | null>(null);
  const [importingJson, setImportingJson] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // OPML import state
  const [opmlFile, setOpmlFile] = useState<File | null>(null);
  const [opmlContent, setOpmlContent] = useState<string>('');
  const [opmlWorkspaceName, setOpmlWorkspaceName] = useState('');
  const [importingOpml, setImportingOpml] = useState(false);
  const opmlInputRef = useRef<HTMLInputElement>(null);

  // Status message
  const [statusMessage, setStatusMessage] = useState<string>('');

  if (!importExportModalOpen) return null;

  const handleClose = () => {
    setImportExportModalOpen(false);
    setActiveTab('export');
    setSelectedWorkspaceId('');
    setJsonFile(null);
    setJsonPreview(null);
    setJsonData(null);
    setOpmlFile(null);
    setOpmlContent('');
    setOpmlWorkspaceName('');
    setStatusMessage('');
  };

  // ---------------------------------------------------------------------------
  // File download helper
  // ---------------------------------------------------------------------------

  const downloadJson = (data: WorkspaceExport, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------------------
  // Export handlers
  // ---------------------------------------------------------------------------

  const handleExportSelected = async () => {
    if (!selectedWorkspaceId) {
      addToast('Please select a workspace to export', 'error');
      return;
    }
    setExporting(true);
    try {
      const data = await api.exportWorkspace(selectedWorkspaceId);
      const ws = workspaces.find((w) => w.id === selectedWorkspaceId);
      const safeName = (ws?.name ?? 'workspace').replace(/[^a-zA-Z0-9_-]/g, '_');
      downloadJson(data, `wiredin-${safeName}.json`);
      addToast('Workspace exported successfully', 'success');
    } catch (err) {
      addToast(
        `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    } finally {
      setExporting(false);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const data = await api.exportAllWorkspaces();
      downloadJson(data, `wiredin-all-workspaces.json`);
      addToast('All workspaces exported successfully', 'success');
    } catch (err) {
      addToast(
        `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    } finally {
      setExporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // JSON import handlers
  // ---------------------------------------------------------------------------

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setJsonFile(file);
    setJsonPreview(null);
    setJsonData(null);
    setStatusMessage('');

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as WorkspaceExport;
        if (!parsed.workspaces || !Array.isArray(parsed.workspaces)) {
          addToast('Invalid export file: missing workspaces array', 'error');
          return;
        }
        setJsonData(parsed);
        setJsonPreview({
          workspaces: parsed.workspaces.map((ws) => ({
            name: ws.name,
            tileCount: ws.tiles?.length ?? 0,
          })),
        });
      } catch {
        addToast('Failed to parse JSON file', 'error');
        setJsonFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleJsonImport = async () => {
    if (!jsonData) return;
    setImportingJson(true);
    setStatusMessage('');
    try {
      const result = await api.importWorkspaces(jsonData);
      setStatusMessage(
        `Successfully imported ${result.workspaceCount} workspace${result.workspaceCount !== 1 ? 's' : ''} with ${result.tileCount} tile${result.tileCount !== 1 ? 's' : ''}.`,
      );
      await loadWorkspaces();
      addToast('Import completed successfully', 'success');
      setJsonFile(null);
      setJsonPreview(null);
      setJsonData(null);
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    } catch (err) {
      addToast(
        `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    } finally {
      setImportingJson(false);
    }
  };

  // ---------------------------------------------------------------------------
  // OPML import handlers
  // ---------------------------------------------------------------------------

  const handleOpmlFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOpmlFile(file);
    setOpmlContent('');
    setStatusMessage('');

    const reader = new FileReader();
    reader.onload = (ev) => {
      setOpmlContent(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleOpmlImport = async () => {
    if (!opmlContent) return;
    setImportingOpml(true);
    setStatusMessage('');
    try {
      const result = await api.importOpml(
        opmlContent,
        opmlWorkspaceName.trim() || undefined,
      );
      setStatusMessage(
        `Successfully imported ${result.tileCount} RSS feed${result.tileCount !== 1 ? 's' : ''} into workspace "${result.workspaceName}".`,
      );
      await loadWorkspaces();
      addToast('OPML import completed successfully', 'success');
      setOpmlFile(null);
      setOpmlContent('');
      setOpmlWorkspaceName('');
      if (opmlInputRef.current) opmlInputRef.current.value = '';
    } catch (err) {
      addToast(
        `OPML import failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    } finally {
      setImportingOpml(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Import / Export</h2>
          <button className="modal__close" onClick={handleClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal__body">
          {/* Tabs */}
          <div className="import-export__tabs">
            <button
              className={`import-export__tab${activeTab === 'export' ? ' import-export__tab--active' : ''}`}
              onClick={() => { setActiveTab('export'); setStatusMessage(''); }}
            >
              <Download size={14} />
              Export
            </button>
            <button
              className={`import-export__tab${activeTab === 'import' ? ' import-export__tab--active' : ''}`}
              onClick={() => { setActiveTab('import'); setStatusMessage(''); }}
            >
              <Upload size={14} />
              Import
            </button>
          </div>

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label className="modal__label">
                Workspace
                <select
                  className="modal__select"
                  value={selectedWorkspaceId}
                  onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                >
                  <option value="">Select a workspace...</option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name} ({ws.tiles.length} tile{ws.tiles.length !== 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn--primary"
                  onClick={handleExportSelected}
                  disabled={exporting || !selectedWorkspaceId}
                >
                  <Download size={14} />
                  {exporting ? 'Exporting...' : 'Export Selected'}
                </button>
                <button
                  className="btn btn--primary"
                  onClick={handleExportAll}
                  disabled={exporting}
                >
                  <Download size={14} />
                  {exporting ? 'Exporting...' : 'Export All'}
                </button>
              </div>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* JSON Import Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <FileJson size={16} />
                  JSON Import
                </div>
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json"
                  className="modal__input"
                  onChange={handleJsonFileChange}
                  style={{ padding: '8px' }}
                />
                {jsonPreview && (
                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--bg-secondary, #1a1a2e)',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>Preview:</div>
                    {jsonPreview.workspaces.map((ws, i) => (
                      <div key={i} style={{ marginLeft: '8px' }}>
                        {ws.name} -- {ws.tileCount} tile{ws.tileCount !== 1 ? 's' : ''}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="btn btn--primary"
                  onClick={handleJsonImport}
                  disabled={!jsonData || importingJson}
                >
                  <Upload size={14} />
                  {importingJson ? 'Importing...' : 'Import'}
                </button>
              </div>

              {/* Divider */}
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color, #2a2a3e)', margin: 0 }} />

              {/* OPML Import Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <Rss size={16} />
                  OPML Import (RSS Feeds)
                </div>
                <input
                  ref={opmlInputRef}
                  type="file"
                  accept=".opml,.xml"
                  className="modal__input"
                  onChange={handleOpmlFileChange}
                  style={{ padding: '8px' }}
                />
                <label className="modal__label">
                  Workspace Name (optional)
                  <input
                    className="modal__input"
                    type="text"
                    placeholder="Leave blank for default"
                    value={opmlWorkspaceName}
                    onChange={(e) => setOpmlWorkspaceName(e.target.value)}
                  />
                </label>
                <button
                  className="btn btn--primary"
                  onClick={handleOpmlImport}
                  disabled={!opmlContent || importingOpml}
                >
                  <Rss size={14} />
                  {importingOpml ? 'Importing...' : 'Import RSS Feeds'}
                </button>
              </div>

              {/* Status message */}
              {statusMessage && (
                <div style={{
                  padding: '10px 12px',
                  background: 'var(--success-bg, #0d3320)',
                  border: '1px solid var(--success-border, #1a6b3c)',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  color: 'var(--success-text, #4ade80)',
                }}>
                  {statusMessage}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
