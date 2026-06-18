import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDigest, fetchMeta } from '../services/api';
import { CATEGORY_META } from '../lib/categories';
import type { Category } from '../lib/categories';

function addDays(dateStr: string, delta: number): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function safeHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : '#';
}

const SECTION_COLOR: Record<string, string> = {
  blue:   'border-blue-700 bg-blue-950',
  purple: 'border-purple-700 bg-purple-950',
  red:    'border-red-700 bg-red-950',
  green:  'border-green-700 bg-green-950',
};

const SECTION_LABEL_COLOR: Record<string, string> = {
  blue:   'text-blue-300',
  purple: 'text-purple-300',
  red:    'text-red-300',
  green:  'text-green-300',
};

export function DigestPage() {
  const { data: meta, isLoading: isMetaLoading } = useQuery({
    queryKey: ['meta'],
    queryFn: fetchMeta,
  });

  // Use actual latest digest date (written by collect.ts when digest succeeds).
  // Fall back to lastUpdated date, then calendar today.
  const latestDigestDate = meta?.latestDigestDate?.slice(0, 10)
    ?? meta?.lastUpdated?.slice(0, 10)
    ?? new Date().toISOString().slice(0, 10);
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const displayDate = currentDate ?? latestDigestDate;

  const { data: digest, isLoading } = useQuery({
    queryKey: ['digest', currentDate ?? 'latest'],
    queryFn: () => currentDate ? fetchDigest(currentDate) : fetchDigest(),
    staleTime: 0,
  });

  const handlePrev = () => {
    if (!isAtEarliest) setCurrentDate(addDays(displayDate, -1));
  };
  const handleNext = () => {
    const next = addDays(displayDate, 1);
    // Cap at latestDigestDate to avoid navigating into days with no digest data
    if (next <= latestDigestDate) setCurrentDate(next);
  };

  const isAtLatest = displayDate >= latestDigestDate;
  const earliestDigestDate = meta?.earliestDigestDate?.slice(0, 10) ?? null;
  const isAtEarliest = earliestDigestDate ? displayDate <= earliestDigestDate : true;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Date navigation */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          onClick={handlePrev}
          disabled={isMetaLoading || isAtEarliest}
          className={`p-2 rounded-md transition-colors ${
            isMetaLoading || isAtEarliest
              ? 'bg-gray-900 text-gray-700 cursor-not-allowed'
              : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          aria-label="前の日"
        >
          ←
        </button>
        <span className="text-lg font-semibold text-gray-100 font-mono tabular-nums">
          {displayDate}
        </span>
        <button
          onClick={handleNext}
          disabled={isMetaLoading || isAtLatest}
          className={`p-2 rounded-md transition-colors ${
            isMetaLoading || isAtLatest
              ? 'bg-gray-900 text-gray-700 cursor-not-allowed'
              : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          aria-label="次の日"
        >
          →
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-4 bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-800 rounded w-5/6" />
          <div className="h-4 bg-gray-800 rounded w-4/6" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!digest?.overviewJa && !(digest?.sections?.length)) && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">この日のダイジェストがありません</p>
          <p className="text-sm mt-1">{displayDate} のデータはまだ生成されていません</p>
        </div>
      )}

      {/* Digest content */}
      {!isLoading && (digest?.overviewJa || (digest?.sections?.length ?? 0) > 0) && (
        <div className="space-y-6">
          {/* Overview */}
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              概要
            </h2>
            <p className="text-sm text-gray-200 leading-relaxed">{digest.overviewJa}</p>
            {digest.generatedAt && (
              <p className="text-xs text-gray-600 mt-3">
                生成: {new Date(digest.generatedAt).toLocaleString('ja-JP')}
              </p>
            )}
          </section>

          {/* Per-category sections */}
          {digest.sections.map((section) => {
            const sectionMeta = CATEGORY_META[section.category as Category];
            if (!sectionMeta || section.highlights.length === 0) return null;
            const colorKey = sectionMeta.color;
            const sectionStyle = SECTION_COLOR[colorKey] ?? 'border-gray-700 bg-gray-900';
            const labelStyle = SECTION_LABEL_COLOR[colorKey] ?? 'text-gray-300';

            return (
              <section
                key={section.category}
                className={`border rounded-lg p-5 ${sectionStyle}`}
              >
                <h2 className={`text-sm font-bold mb-4 ${labelStyle}`}>
                  {sectionMeta.label}
                </h2>
                <div className="space-y-4">
                  {section.highlights.map((highlight, idx) => (
                    <div key={highlight.url || String(idx)} className="border-t border-gray-800 pt-3 first:border-t-0 first:pt-0">
                      <h3 className="text-sm font-semibold text-gray-100 mb-1 leading-snug">
                        <a
                          href={safeHref(highlight.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-400 transition-colors"
                        >
                          {highlight.title}
                        </a>
                      </h3>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {highlight.summaryJa}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
