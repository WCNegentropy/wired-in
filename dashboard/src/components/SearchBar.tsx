import { useState } from 'react';
import { useWiredInStore } from '../store';
import { Search } from 'lucide-react';
import type { Platform } from '../types';

const PLATFORMS: Array<{ label: string; value: Platform | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Reddit', value: 'reddit' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'X', value: 'x' },
  { label: 'RSS', value: 'rss' },
  { label: 'News', value: 'news' },
];

export default function SearchBar() {
  const { globalSearch, setGlobalSearch } = useWiredInStore();
  const [activeFilter, setActiveFilter] = useState<Platform | 'all'>('all');

  return (
    <div className="search-bar">
      <div className="search-bar__input-wrap">
        <Search size={16} className="search-bar__icon" />
        <input
          className="search-bar__input"
          type="text"
          placeholder="Search across all feeds..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
        />
      </div>
      <div className="search-bar__filters">
        {PLATFORMS.map((p) => (
          <button
            key={p.value}
            className={`search-bar__chip ${activeFilter === p.value ? 'search-bar__chip--active' : ''}`}
            onClick={() => setActiveFilter(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
