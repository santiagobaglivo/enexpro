"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EntregasPendientesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/ventas/hoja-ruta");
  }, [router]);
  return null;
}
