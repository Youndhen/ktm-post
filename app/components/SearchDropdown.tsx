"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, Loader2, X, ArrowRight } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  image: string | null;
  date: string;
}

interface SearchDropdownProps {
  variant?: "search" | "inline";
}

export default function SearchDropdown({ variant = "search" }: SearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search effect
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (err) {
        console.error("Search fetch error:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(query.trim())}`;
      setIsOpen(false);
    }
  };

  if (variant === "inline") {
    return (
      <div ref={containerRef} className="relative w-full">
        <form onSubmit={handleSubmit} className="relative flex items-center w-full">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="समाचार खोज्नुहोस्... (Search news)"
            className="w-full pl-10 pr-9 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-nepal-red focus:bg-white text-gray-900 font-poppins transition-all"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </form>

        {/* Live Results Dropdown */}
        {query.trim().length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
            {loading ? (
              <div className="p-4 flex items-center justify-center gap-2 text-sm text-gray-500 font-poppins">
                <Loader2 className="w-4 h-4 animate-spin text-nepal-red" />
                <span>खोज्दैछ... (Searching...)</span>
              </div>
            ) : results.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                {results.map((item) => (
                  <Link
                    key={item.id}
                    href={item.url}
                    className="p-3 flex gap-3 hover:bg-gray-50 transition-colors group block"
                  >
                    {item.image && (
                      <div className="w-12 h-12 shrink-0 bg-gray-100 rounded-md overflow-hidden">
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-gray-900 font-nepali-serif line-clamp-1 group-hover:text-nepal-red transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-gray-500 font-poppins line-clamp-1 mt-0.5">
                        {item.excerpt}
                      </p>
                    </div>
                  </Link>
                ))}
                <Link
                  href={`/search?q=${encodeURIComponent(query.trim())}`}
                  className="p-2.5 bg-gray-50 flex items-center justify-between text-xs font-bold text-nepal-red hover:bg-nepal-red hover:text-white transition-colors uppercase tracking-wider"
                >
                  <span>सबै नतिजाहरू ({results.length}+)</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-gray-500 font-poppins">
                "{query}" सम्बन्धी कुनै समाचार भेटिएन।
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex justify-end w-full max-w-[240px] sm:max-w-xs md:max-w-sm">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 sm:px-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1.5 sm:gap-2 text-gray-700 text-xs sm:text-sm font-medium border border-gray-200 bg-white shrink-0 shadow-sm"
          title="Search"
          aria-label="Search"
        >
          <Search className="w-4 h-4 text-nepal-red shrink-0" />
          <span className="hidden sm:inline text-gray-600 font-poppins text-xs font-semibold">खोज्नुहोस्</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="relative flex items-center w-full min-w-[200px] sm:min-w-[260px]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="समाचार खोज्नुहोस्..."
            autoFocus
            className="w-full pl-9 pr-8 py-1.5 text-sm bg-white border-2 border-nepal-red rounded-lg focus:outline-none shadow-sm text-gray-900 font-poppins"
          />
          <Search className="w-4 h-4 text-nepal-red absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      )}

      {/* Live Results Dropdown */}
      {isOpen && (query.trim().length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 min-w-[320px] md:min-w-[400px]">
          {loading ? (
            <div className="p-4 flex items-center justify-center gap-2 text-sm text-gray-500 font-poppins">
              <Loader2 className="w-4 h-4 animate-spin text-nepal-red" />
              <span>खोज्दैछ... (Searching...)</span>
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
              {results.map((item) => (
                <Link
                  key={item.id}
                  href={item.url}
                  onClick={() => setIsOpen(false)}
                  className="p-3 flex gap-3 hover:bg-gray-50 transition-colors group block"
                >
                  {item.image && (
                    <div className="w-14 h-14 shrink-0 bg-gray-100 rounded-md overflow-hidden">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 font-nepali-serif line-clamp-1 group-hover:text-nepal-red transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-xs text-gray-500 font-poppins line-clamp-1 mt-0.5">
                      {item.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
              <Link
                href={`/search?q=${encodeURIComponent(query.trim())}`}
                onClick={() => setIsOpen(false)}
                className="p-3 bg-gray-50 flex items-center justify-between text-xs font-bold text-nepal-red hover:bg-nepal-red hover:text-white transition-colors uppercase tracking-wider"
              >
                <span>सबै नतिजाहरू हेर्नुहोस् ({results.length}+)</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-gray-500 font-poppins">
              "{query}" सम्बन्धी कुनै समाचार भेटिएन।
            </div>
          )}
        </div>
      )}
    </div>
  );
}
