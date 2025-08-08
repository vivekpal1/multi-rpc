"use client";

import { useRef, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualizedListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
}

export const VirtualizedList = memo(<T extends any>({
  items,
  height,
  itemHeight,
  renderItem,
  overscan = 5,
  className = "",
}: VirtualizedListProps<T>) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
  });

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
});

VirtualizedList.displayName = "VirtualizedList";

// Optimized table virtualization
export const VirtualizedTable = memo(<T extends any>({
  items,
  columns,
  height = 600,
  rowHeight = 60,
  overscan = 10,
  onRowClick,
}: {
  items: T[];
  columns: Array<{
    key: string;
    header: string;
    render: (item: T) => React.ReactNode;
    width?: string;
  }>;
  height?: number;
  rowHeight?: number;
  overscan?: number;
  onRowClick?: (item: T) => void;
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Table Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b">
        <div className="flex">
          {columns.map((col) => (
            <div
              key={col.key}
              className="px-4 py-3 text-left text-sm font-medium text-gray-500"
              style={{ width: col.width || `${100 / columns.length}%` }}
            >
              {col.header}
            </div>
          ))}
        </div>
      </div>

      {/* Table Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: height - 50 }} // Subtract header height
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = items[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                className="flex hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className="px-4 py-3 flex items-center"
                    style={{ width: col.width || `${100 / columns.length}%` }}
                  >
                    {col.render(item)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

VirtualizedTable.displayName = "VirtualizedTable";