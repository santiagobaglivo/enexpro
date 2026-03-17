"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Tag, Package, Loader2 } from "lucide-react";

// ─── Shared modules ───
import { useAsyncData } from "@/hooks/use-async-data";
import { useDialog } from "@/hooks/use-dialog";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { SearchInput } from "@/components/search-input";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";

interface Marca {
  id: string;
  nombre: string;
}

interface MarcaConConteo extends Marca {
  producto_count: number;
}

export default function MarcasPage() {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");

  const editDialog = useDialog<MarcaConConteo>();

  const fetchMarcas = useCallback(async (): Promise<MarcaConConteo[]> => {
    const { data: marcasData } = await supabase.from("marcas").select("*").order("nombre");
    if (!marcasData) return [];

    const { data: productos } = await supabase.from("productos").select("marca_id");
    const countMap: Record<string, number> = {};
    (productos ?? []).forEach((p: { marca_id: string | null }) => {
      if (p.marca_id) countMap[p.marca_id] = (countMap[p.marca_id] || 0) + 1;
    });

    return marcasData.map((m: Marca) => ({ ...m, producto_count: countMap[m.id] || 0 }));
  }, []);

  const { data: marcas, loading, refetch } = useAsyncData({
    fetcher: fetchMarcas,
    initialData: [],
  });

  const openCreate = () => {
    setNombre("");
    editDialog.onOpen();
  };

  const openEdit = (m: MarcaConConteo) => {
    setNombre(m.nombre);
    editDialog.onOpen(m);
  };

  const handleSave = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    if (editDialog.data) {
      await supabase.from("marcas").update({ nombre: nombre.trim() }).eq("id", editDialog.data.id);
    } else {
      await supabase.from("marcas").insert({ nombre: nombre.trim() });
    }
    setSaving(false);
    editDialog.onClose();
    refetch();
  };

  const handleDelete = async (id: string) => {
    const marca = marcas.find((m) => m.id === id);
    if (!marca) return;
    if (marca.producto_count > 0) {
      alert(`No se puede eliminar "${marca.nombre}" porque tiene ${marca.producto_count} producto(s) asociado(s).`);
      return;
    }
    if (!confirm(`¿Eliminar la marca "${marca.nombre}"?`)) return;
    await supabase.from("marcas").delete().eq("id", id);
    refetch();
  };

  // ─── Derived ───
  const filtered = marcas.filter((m) => m.nombre.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Marcas"
        description="Gestionar marcas de productos"
        backHref="/productos"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nueva marca</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total marcas" value={marcas.length} icon={Tag} />
        <StatCard title="Con productos" value={marcas.filter((m) => m.producto_count > 0).length} icon={Package} iconColor="text-emerald-600" iconBg="bg-emerald-100" />
        <StatCard title="Sin productos" value={marcas.filter((m) => m.producto_count === 0).length} icon={Tag} iconColor="text-gray-400" iconBg="bg-gray-100" />
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Buscar marcas..." className="max-w-sm" />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <LoadingSpinner />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Tag}
              title={search ? "No se encontraron marcas" : "No hay marcas creadas"}
              action={!search ? { label: "Crear marca", onClick: openCreate } : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium">Productos</th>
                    <th className="text-right px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{m.nombre}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary"><Package className="w-3 h-3 mr-1" />{m.producto_count}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={editDialog.setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editDialog.data ? "Editar Marca" : "Nueva Marca"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="marca-nombre">Nombre de la marca *</Label>
              <Input
                id="marca-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Arcor, Marolio, La Serenísima..."
                onKeyDown={(e) => { if (e.key === "Enter" && nombre.trim()) handleSave(); }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={editDialog.onClose}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !nombre.trim()}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editDialog.data ? "Guardar Cambios" : "Crear Marca"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
