"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PackageOpen } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Empty state placeholder used when lists/tables have no data.
 *
 * @example
 * {items.length === 0 && (
 *   <EmptyState
 *     icon={ShoppingCart}
 *     title="No hay ventas"
 *     description="Las ventas del día aparecerán aquí"
 *     action={{ label: "Nueva Venta", onClick: () => router.push("/ventas") }}
 *   />
 * )}
 */
export function EmptyState({
  icon: Icon = PackageOpen,
  title = "Sin datos",
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="w-12 h-12 text-muted-foreground/30 mb-4" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-[300px]">{description}</p>
      )}
      {action && (
        <Button size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
