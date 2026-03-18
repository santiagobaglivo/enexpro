"use client";

import { Sidebar } from "@/components/sidebar";
import AdminToastContainer from "@/components/admin-toast";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <AdminToastContainer />
    </div>
  );
}
