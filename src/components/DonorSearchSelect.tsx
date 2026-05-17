import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface DonorOption {
  id: string;
  name: string;
  pan: string;
  email?: string;
}

interface DonorSearchSelectProps {
  donors: DonorOption[];
  value: string;
  onChange: (donorId: string) => void;
  placeholder?: string;
}

export function DonorSearchSelect({
  donors,
  value,
  onChange,
  placeholder = 'Search by name or PAN…',
}: DonorSearchSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = donors.find((d) => d.id === value);

  useEffect(() => {
    if (selected) {
      setQuery(`${selected.name} (${selected.pan})`);
    } else if (!value) {
      setQuery('');
    }
  }, [value, selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || (selected && query === `${selected.name} (${selected.pan})`)) {
      return donors.slice(0, 50);
    }
    return donors
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.pan.toLowerCase().includes(q) ||
          d.email?.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [donors, query, selected]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (selected) setQuery(`${selected.name} (${selected.pan})`);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [selected]);

  const pick = (donor: DonorOption) => {
    onChange(donor.id);
    setQuery(`${donor.name} (${donor.pan})`);
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange('');
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full pl-11 pr-10 py-4 border-2 border-slate-100 rounded-2xl font-bold outline-none bg-white focus:border-brand-gold"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
          aria-label="Clear donor"
        >
          <X size={16} />
        </button>
      )}
      {!value && (
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
      )}

      {open && (
        <ul className="absolute z-[70] left-0 right-0 mt-2 max-h-56 overflow-y-auto bg-white border-2 border-slate-100 rounded-2xl shadow-xl py-2">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-400 font-medium">No donors match your search</li>
          ) : (
            filtered.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => pick(d)}
                  className={`w-full text-left px-4 py-3 hover:bg-brand-cream transition-colors ${
                    d.id === value ? 'bg-brand-cream/80' : ''
                  }`}
                >
                  <div className="font-bold text-brand-navy">{d.name}</div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase">{d.pan}</div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
