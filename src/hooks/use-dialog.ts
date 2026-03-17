"use client";

import { useState, useCallback } from "react";

interface DialogState<T = undefined> {
  open: boolean;
  data: T | null;
}

interface UseDialogReturn<T = undefined> {
  open: boolean;
  data: T | null;
  onOpen: (data?: T) => void;
  onClose: () => void;
  onToggle: () => void;
  setOpen: (open: boolean) => void;
}

/**
 * Reusable dialog/modal state management.
 * Replaces the repeated `const [dialogOpen, setDialogOpen] = useState(false)` pattern.
 *
 * @example
 * // Simple dialog
 * const deleteDialog = useDialog();
 * <Dialog open={deleteDialog.open} onOpenChange={deleteDialog.setOpen}>
 *
 * // Dialog with data (e.g., editing an item)
 * const editDialog = useDialog<Producto>();
 * editDialog.onOpen(product); // opens with data
 * editDialog.data // the product being edited
 */
export function useDialog<T = undefined>(): UseDialogReturn<T> {
  const [state, setState] = useState<DialogState<T>>({ open: false, data: null });

  const onOpen = useCallback((data?: T) => {
    setState({ open: true, data: data ?? null });
  }, []);

  const onClose = useCallback(() => {
    setState({ open: false, data: null });
  }, []);

  const onToggle = useCallback(() => {
    setState((prev) => ({ ...prev, open: !prev.open }));
  }, []);

  const setOpen = useCallback((open: boolean) => {
    if (!open) {
      setState({ open: false, data: null });
    } else {
      setState((prev) => ({ ...prev, open: true }));
    }
  }, []);

  return { open: state.open, data: state.data, onOpen, onClose, onToggle, setOpen };
}
