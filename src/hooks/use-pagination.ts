"use client";

import { useState, useMemo } from "react";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

interface UsePaginationOptions {
  totalItems: number;
  pageSize?: number;
}

interface UsePaginationReturn {
  page: number;
  pageSize: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  canNext: boolean;
  canPrev: boolean;
}

/**
 * Pagination state management hook.
 *
 * @example
 * const pagination = usePagination({ totalItems: products.length });
 * const visible = products.slice(pagination.startIndex, pagination.endIndex);
 */
export function usePagination(options: UsePaginationOptions): UsePaginationReturn {
  const { totalItems, pageSize: initialPageSize = DEFAULT_PAGE_SIZE } = options;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const safePage = useMemo(() => Math.min(page, totalPages), [page, totalPages]);

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return {
    page: safePage,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    setPage: (p: number) => setPage(Math.max(1, Math.min(p, totalPages))),
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
    nextPage: () => setPage((p) => Math.min(p + 1, totalPages)),
    prevPage: () => setPage((p) => Math.max(p - 1, 1)),
    canNext: safePage < totalPages,
    canPrev: safePage > 1,
  };
}
