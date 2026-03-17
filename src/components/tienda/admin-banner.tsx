"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Shield, ArrowRight } from "lucide-react";

export default function AdminBanner() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setIsAdmin(true);
    });
  }, []);

  if (!isAdmin) return null;

  return (
    <div className="sticky top-0 z-50 bg-primary text-white text-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>Estás viendo la tienda como administrador</span>
        </div>
        <Link
          href="/admin"
          className="flex items-center gap-1 font-medium hover:underline"
        >
          Ir al panel
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
