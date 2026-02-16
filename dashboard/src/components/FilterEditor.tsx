import { useState } from 'react';
import { X, Plus, Filter } from 'lucide-react';
import type { TileFilters } from '../types';

interface FilterEditorProps {
  filters: TileFilters | undefined;
  onSave: (filters: TileFilters) => void;
}

const MAX_AGE_OPTIONS: Array<{ label: string; value: number | undefined }> = [
  { label: '1h', value: 3600 },
  { label: '6h', value: 21600 },
  { label: '12h', value: 43200 },
  { label: '24h', value: 86400 },
  { label: '3d', value: 259200 },
  { label: '7d', value: 604800 },
  { label: '30d', value: 2592000 },
  { label: 'No limit', value: undefined },
];

const NSFW_OPTIONS: Array<{ label: string; value: TileFilters['nsfwFilter'] }> = [
  { label: 'Hide', value: 'hide' },
  { label: 'Blur', value: 'blur' },
  { label: 'Show', value: 'show' },
];

export default function FilterEditor({ filters, onSave }: FilterEditorProps) {
  const [keywords, setKeywords] = useState<string[]>(filters?.keywords ?? []);
  const [keywordsExclude, setKeywordsExclude] = useState<string[]>(filters?.keywordsExclude ?? []);
  const [regex, setRegex] = useState(filters?.regex ?? '');
  const [regexError, setRegexError] = useState<string | null>(null);
  const [nsfwFilter, setNsfwFilter] = useState<TileFilters['nsfwFilter']>(filters?.nsfwFilter ?? 'hide');
  const [minScore, setMinScore] = useState<number | undefined>(filters?.minScore);
  const [minComments, setMinComments] = useState<number | undefined>(filters?.minComments);
  const [maxAge, setMaxAge] = useState<number | undefined>(filters?.maxAge);

  const [keywordInput, setKeywordInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');

  const handleAddKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = keywordInput.trim();
    if (value && !keywords.includes(value)) {
      setKeywords((prev) => [...prev, value]);
    }
    setKeywordInput('');
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords((prev) => prev.filter((k) => k !== keyword));
  };

  const handleAddExclude = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = excludeInput.trim();
    if (value && !keywordsExclude.includes(value)) {
      setKeywordsExclude((prev) => [...prev, value]);
    }
    setExcludeInput('');
  };

  const handleRemoveExclude = (keyword: string) => {
    setKeywordsExclude((prev) => prev.filter((k) => k !== keyword));
  };

  const handleRegexChange = (value: string) => {
    setRegex(value);
    if (!value.trim()) {
      setRegexError(null);
      return;
    }
    try {
      new RegExp(value);
      setRegexError(null);
    } catch (err) {
      setRegexError(err instanceof Error ? err.message : 'Invalid regex');
    }
  };

  const handleSave = () => {
    const updated: TileFilters = {};

    if (keywords.length > 0) updated.keywords = keywords;
    if (keywordsExclude.length > 0) updated.keywordsExclude = keywordsExclude;
    if (regex.trim() && !regexError) updated.regex = regex.trim();
    if (nsfwFilter) updated.nsfwFilter = nsfwFilter;
    if (minScore !== undefined) updated.minScore = minScore;
    if (minComments !== undefined) updated.minComments = minComments;
    if (maxAge !== undefined) updated.maxAge = maxAge;

    onSave(updated);
  };

  return (
    <div className="filter-editor">
      <div className="filter-editor__header">
        <Filter size={16} />
        <span>Content Filters</span>
      </div>

      {/* Keywords (include) */}
      <div className="filter-editor__section">
        <label className="modal__label">Keywords (include)</label>
        <div className="filter-editor__tags">
          {keywords.map((kw) => (
            <span key={kw} className="filter-editor__tag">
              {kw}
              <button type="button" onClick={() => handleRemoveKeyword(kw)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="filter-editor__tag-input">
          <input
            className="modal__input"
            type="text"
            placeholder="Type keyword and press Enter"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={handleAddKeyword}
          />
          <Plus size={14} className="filter-editor__tag-input-icon" />
        </div>
      </div>

      {/* Keywords (exclude) */}
      <div className="filter-editor__section">
        <label className="modal__label">Keywords (exclude)</label>
        <div className="filter-editor__tags">
          {keywordsExclude.map((kw) => (
            <span key={kw} className="filter-editor__tag filter-editor__tag--exclude">
              {kw}
              <button type="button" onClick={() => handleRemoveExclude(kw)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="filter-editor__tag-input">
          <input
            className="modal__input"
            type="text"
            placeholder="Type keyword and press Enter"
            value={excludeInput}
            onChange={(e) => setExcludeInput(e.target.value)}
            onKeyDown={handleAddExclude}
          />
          <Plus size={14} className="filter-editor__tag-input-icon" />
        </div>
      </div>

      {/* Regex filter */}
      <div className="filter-editor__section">
        <label className="modal__label">Regex filter</label>
        <input
          className={`modal__input${regexError ? ' modal__input--error' : ''}`}
          type="text"
          placeholder="e.g. \\bbreaking\\b"
          value={regex}
          onChange={(e) => handleRegexChange(e.target.value)}
        />
        {regexError && (
          <span className="filter-editor__error">{regexError}</span>
        )}
      </div>

      {/* NSFW filter */}
      <div className="filter-editor__section">
        <label className="modal__label">NSFW filter</label>
        <div className="filter-editor__toggle-group">
          {NSFW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`filter-editor__toggle-btn${nsfwFilter === opt.value ? ' filter-editor__toggle-btn--active' : ''}`}
              onClick={() => setNsfwFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Min score */}
      <div className="filter-editor__section">
        <label className="modal__label">Min score</label>
        <input
          className="modal__input"
          type="number"
          min={0}
          placeholder="e.g. 10"
          value={minScore ?? ''}
          onChange={(e) => setMinScore(e.target.value ? Number(e.target.value) : undefined)}
        />
      </div>

      {/* Min comments */}
      <div className="filter-editor__section">
        <label className="modal__label">Min comments</label>
        <input
          className="modal__input"
          type="number"
          min={0}
          placeholder="e.g. 5"
          value={minComments ?? ''}
          onChange={(e) => setMinComments(e.target.value ? Number(e.target.value) : undefined)}
        />
      </div>

      {/* Max age */}
      <div className="filter-editor__section">
        <label className="modal__label">Max age</label>
        <select
          className="modal__select"
          value={maxAge ?? ''}
          onChange={(e) => setMaxAge(e.target.value ? Number(e.target.value) : undefined)}
        >
          {MAX_AGE_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value ?? ''}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <button className="btn btn--primary filter-editor__save" onClick={handleSave}>
        Save Filters
      </button>
    </div>
  );
}
