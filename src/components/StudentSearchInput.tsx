import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/** Removes diacritics for accent-insensitive matching. */
export function normalizeForSearch(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Case+accent-insensitive: matches when any word in `name` startsWith the query. */
export function matchesInitial(name: string, query: string): boolean {
  const q = normalizeForSearch(query.trim());
  if (!q) return true;
  const n = normalizeForSearch(name);
  if (n.startsWith(q)) return true;
  return n.split(/\s+/).some((word) => word.startsWith(q));
}

export function StudentSearchInput({ value, onChange, placeholder }: Props) {
  return (
    <div className="relative">
      <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Filtrar por iniciais (ex: Ma)"}
        className="pl-9 pr-9 h-9"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Limpar"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
