'use client';

import { useCanvasList } from '@/hooks/useCanvasList';
import StatusTabs from '@/components/browse/StatusTabs';
import SortDropdown from '@/components/browse/SortDropdown';
import CanvasGrid from '@/components/browse/CanvasGrid';
import PixelBlockBackground from '@/components/background/PixelBlockBackground';

export default function BrowsePage() {
  const {
    isLoading,
    error,
    filter,
    setFilter,
    sort,
    setSort,
    filteredCanvases,
    thumbnails,
  } = useCanvasList();

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* Animated background */}
      <PixelBlockBackground />

      <div className="relative z-10 mt-14 p-6 sm:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Page title */}
          <h1 className="font-display text-lg sm:text-xl text-text mb-6">
            Browse Canvases
          </h1>

          {/* Filters bar: StatusTabs left, SortDropdown right */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <StatusTabs current={filter} onChange={setFilter} />
            <SortDropdown current={sort} onChange={setSort} />
          </div>

          {/* Error state */}
          {error && (
            <div className="text-center py-12">
              <div
                className="inline-block bg-surface border border-grid p-6"
                style={{ borderRadius: 0 }}
              >
                <p className="font-body text-sm text-error">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Canvas grid */}
          {!error && (
            <CanvasGrid
              canvases={filteredCanvases}
              thumbnails={thumbnails}
              isLoading={isLoading}
              filter={filter}
              onClearFilter={() => setFilter('all')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
