"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { EmptyState } from "./empty-state";
import { LoadingSpinner } from "./loading-spinner";

export interface Column<T> {
  key: string;
  header: string;
  /** Custom cell renderer. Falls back to `row[key]` */
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** If provided, renders pagination controls */
  pagination?: {
    page: number;
    totalPages: number;
    canNext: boolean;
    canPrev: boolean;
    nextPage: () => void;
    prevPage: () => void;
    setPage: (page: number) => void;
  };
  onRowClick?: (row: T, index: number) => void;
  rowClassName?: (row: T, index: number) => string;
}

/**
 * Reusable data table with pagination, loading, and empty states.
 *
 * @example
 * <DataTable
 *   columns={[
 *     { key: "nombre", header: "Nombre" },
 *     { key: "precio", header: "Precio", render: (p) => formatCurrency(p.precio) },
 *     { key: "actions", header: "", render: (p) => <Button onClick={() => edit(p)}>Editar</Button> },
 *   ]}
 *   data={products}
 *   loading={loading}
 *   pagination={pagination}
 * />
 */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyTitle,
  emptyDescription,
  pagination,
  onRowClick,
  rowClassName,
}: DataTableProps<T>) {
  if (loading) return <LoadingSpinner />;
  if (data.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.headerClassName}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow
                key={idx}
                className={`${onRowClick ? "cursor-pointer" : ""} ${rowClassName?.(row, idx) ?? ""}`}
                onClick={() => onRowClick?.(row, idx)}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render
                      ? col.render(row, idx)
                      : (row[col.key] as React.ReactNode) ?? ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted-foreground">
            Página {pagination.page} de {pagination.totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => pagination.setPage(1)}
              disabled={!pagination.canPrev}
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={pagination.prevPage}
              disabled={!pagination.canPrev}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={pagination.nextPage}
              disabled={!pagination.canNext}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => pagination.setPage(pagination.totalPages)}
              disabled={!pagination.canNext}
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
