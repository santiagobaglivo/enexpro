"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
}

const variantConfig = {
  danger: {
    icon: Trash2,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    buttonClass: "bg-red-600 hover:bg-red-700 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    buttonClass: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  default: {
    icon: AlertTriangle,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    buttonClass: "",
  },
};

/**
 * Reusable confirmation dialog.
 *
 * @example
 * <ConfirmDialog
 *   open={deleteDialog.open}
 *   onOpenChange={deleteDialog.setOpen}
 *   onConfirm={() => handleDelete(deleteDialog.data)}
 *   title="Eliminar producto"
 *   description="¿Estás seguro? Esta acción no se puede deshacer."
 *   variant="danger"
 * />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "¿Estás seguro?",
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className={`w-14 h-14 rounded-full ${config.iconBg} flex items-center justify-center`}>
            <Icon className={`w-7 h-7 ${config.iconColor}`} />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{title}</p>
            {description && (
              <p className="text-sm text-muted-foreground mt-2">{description}</p>
            )}
          </div>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
            <Button
              className={`flex-1 ${config.buttonClass}`}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
