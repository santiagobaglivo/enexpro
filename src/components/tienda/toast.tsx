"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, ShoppingBag, X } from "lucide-react";

interface ToastItem {
  id: number;
  message: string;
  exiting: boolean;
}

let toastId = 0;

export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent("show-toast", { detail: message }));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      const msg = (e as CustomEvent).detail as string;
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message: msg, exiting: false }]);
      setTimeout(() => dismiss(id), 3000);
    }
    window.addEventListener("show-toast", handler);
    return () => window.removeEventListener("show-toast", handler);
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col-reverse gap-3 items-center pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto"
          style={{
            animation: t.exiting
              ? "toast-out 0.3s ease-in forwards"
              : "toast-in 0.4s cubic-bezier(0.21,1.02,0.73,1) forwards",
          }}
        >
          <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] border border-gray-100 min-w-[280px] max-w-[380px]">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50 shrink-0">
              <ShoppingBag className="h-4.5 w-4.5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 truncate">{t.message}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Agregado al carrito</p>
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-full p-1 text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="mx-4 mt-0 h-[2px] rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-pink-500 rounded-full"
              style={{ animation: "toast-progress 3s linear forwards" }}
            />
          </div>
        </div>
      ))}

      <style jsx>{`
        @keyframes toast-in {
          0% { opacity: 0; transform: translateY(16px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toast-out {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(8px) scale(0.95); }
        }
        @keyframes toast-progress {
          0% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
    </div>
  );
}
