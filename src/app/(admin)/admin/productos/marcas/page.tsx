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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Tag, Package, Loader2, FolderTree, Layers } from "lucide-react";

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

interface Categoria {
  id: string;
  nombre: string;
  producto_count: number;
}

interface Subcategoria {
  id: string;
  nombre: string;
  categoria_id: string;
  categoria_nombre?: string;
  producto_count: number;
}

export default function MarcasPage() {
  const [activeTab, setActiveTab] = useState("marcas");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");

  // Categories state
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [catNombre, setCatNombre] = useState("");
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subcategoria | null>(null);
  const [subNombre, setSubNombre] = useState("");
  const [subCatId, setSubCatId] = useState("");

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

  // ─── Categories fetch ───
  const fetchCategorias = useCallback(async () => {
    setCatLoading(true);
    const [{ data: cats }, { data: subs }, { data: prods }] = await Promise.all([
      supabase.from("categorias").select("id, nombre").order("nombre"),
      supabase.from("subcategorias").select("id, nombre, categoria_id").order("nombre"),
      supabase.from("productos").select("categoria_id, subcategoria_id"),
    ]);
    const catCount: Record<string, number> = {};
    const subCount: Record<string, number> = {};
    (prods ?? []).forEach((p: any) => {
      if (p.categoria_id) catCount[p.categoria_id] = (catCount[p.categoria_id] || 0) + 1;
      if (p.subcategoria_id) subCount[p.subcategoria_id] = (subCount[p.subcategoria_id] || 0) + 1;
    });
    const catMap: Record<string, string> = {};
    (cats ?? []).forEach((c: any) => { catMap[c.id] = c.nombre; });
    setCategorias((cats ?? []).map((c: any) => ({ ...c, producto_count: catCount[c.id] || 0 })));
    setSubcategorias((subs ?? []).map((s: any) => ({ ...s, categoria_nombre: catMap[s.categoria_id] || "—", producto_count: subCount[s.id] || 0 })));
    setCatLoading(false);
  }, []);

  useState(() => { fetchCategorias(); });

  const handleSaveCat = async () => {
    if (!catNombre.trim()) return;
    setSaving(true);
    if (editingCat) {
      await supabase.from("categorias").update({ nombre: catNombre.trim() }).eq("id", editingCat.id);
    } else {
      await supabase.from("categorias").insert({ nombre: catNombre.trim() });
    }
    setSaving(false);
    setCatDialogOpen(false);
    setEditingCat(null);
    setCatNombre("");
    fetchCategorias();
  };

  const handleDeleteCat = async (id: string) => {
    const cat = categorias.find((c) => c.id === id);
    if (cat && cat.producto_count > 0) { alert(`No se puede eliminar "${cat.nombre}" porque tiene productos asociados.`); return; }
    if (!confirm(`¿Eliminar la categoría "${cat?.nombre}"?`)) return;
    await supabase.from("categorias").delete().eq("id", id);
    fetchCategorias();
  };

  const handleSaveSub = async () => {
    if (!subNombre.trim() || !subCatId) return;
    setSaving(true);
    if (editingSub) {
      await supabase.from("subcategorias").update({ nombre: subNombre.trim(), categoria_id: subCatId }).eq("id", editingSub.id);
    } else {
      await supabase.from("subcategorias").insert({ nombre: subNombre.trim(), categoria_id: subCatId });
    }
    setSaving(false);
    setSubDialogOpen(false);
    setEditingSub(null);
    setSubNombre("");
    setSubCatId("");
    fetchCategorias();
  };

  const handleDeleteSub = async (id: string) => {
    const sub = subcategorias.find((s) => s.id === id);
    if (sub && sub.producto_count > 0) { alert(`No se puede eliminar "${sub.nombre}" porque tiene productos asociados.`); return; }
    if (!confirm(`¿Eliminar la subcategoría "${sub?.nombre}"?`)) return;
    await supabase.from("subcategorias").delete().eq("id", id);
    fetchCategorias();
  };

  // ─── Derived ───
  const filtered = marcas.filter((m) => m.nombre.toLowerCase().includes(search.toLowerCase()));
  const filteredCats = categorias.filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase()));
  const filteredSubs = subcategorias.filter((s) => s.nombre.toLowerCase().includes(search.toLowerCase()) || (s.categoria_nombre || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Marcas y Categorías"
        description="Gestionar marcas, categorías y subcategorías de productos"
        backHref="/productos"
        actions={
          activeTab === "marcas" ? <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nueva marca</Button>
          : activeTab === "categorias" ? <Button onClick={() => { setCatNombre(""); setEditingCat(null); setCatDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Nueva categoría</Button>
          : <Button onClick={() => { setSubNombre(""); setSubCatId(""); setEditingSub(null); setSubDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Nueva subcategoría</Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="marcas"><Tag className="w-3.5 h-3.5 mr-1.5" />Marcas</TabsTrigger>
          <TabsTrigger value="categorias"><FolderTree className="w-3.5 h-3.5 mr-1.5" />Categorías</TabsTrigger>
          <TabsTrigger value="subcategorias"><Layers className="w-3.5 h-3.5 mr-1.5" />Subcategorías</TabsTrigger>
        </TabsList>

        <TabsContent value="marcas" className="space-y-4 mt-4">

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

        </TabsContent>

        {/* Categorías Tab */}
        <TabsContent value="categorias" className="space-y-4 mt-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar categorías..." className="max-w-sm" />
          <Card>
            <CardContent className="p-0">
              {catLoading ? <LoadingSpinner /> : filteredCats.length === 0 ? (
                <EmptyState icon={FolderTree} title="No hay categorías" action={{ label: "Crear categoría", onClick: () => { setCatNombre(""); setEditingCat(null); setCatDialogOpen(true); } }} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50"><th className="text-left px-4 py-3 font-medium">Nombre</th><th className="text-left px-4 py-3 font-medium">Productos</th><th className="text-right px-4 py-3 font-medium">Acciones</th></tr></thead>
                    <tbody>
                      {filteredCats.map((c) => (
                        <tr key={c.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{c.nombre}</td>
                          <td className="px-4 py-3"><Badge variant="secondary"><Package className="w-3 h-3 mr-1" />{c.producto_count}</Badge></td>
                          <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingCat(c); setCatNombre(c.nombre); setCatDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCat(c.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subcategorías Tab */}
        <TabsContent value="subcategorias" className="space-y-4 mt-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar subcategorías..." className="max-w-sm" />
          <Card>
            <CardContent className="p-0">
              {catLoading ? <LoadingSpinner /> : filteredSubs.length === 0 ? (
                <EmptyState icon={Layers} title="No hay subcategorías" action={{ label: "Crear subcategoría", onClick: () => { setSubNombre(""); setSubCatId(""); setEditingSub(null); setSubDialogOpen(true); } }} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50"><th className="text-left px-4 py-3 font-medium">Nombre</th><th className="text-left px-4 py-3 font-medium">Categoría</th><th className="text-left px-4 py-3 font-medium">Productos</th><th className="text-right px-4 py-3 font-medium">Acciones</th></tr></thead>
                    <tbody>
                      {filteredSubs.map((s) => (
                        <tr key={s.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{s.nombre}</td>
                          <td className="px-4 py-3 text-muted-foreground">{s.categoria_nombre}</td>
                          <td className="px-4 py-3"><Badge variant="secondary"><Package className="w-3 h-3 mr-1" />{s.producto_count}</Badge></td>
                          <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingSub(s); setSubNombre(s.nombre); setSubCatId(s.categoria_id); setSubDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteSub(s.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Marca Create / Edit Dialog */}
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
      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingCat ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre de la categoría *</Label>
              <Input value={catNombre} onChange={(e) => setCatNombre(e.target.value)} placeholder="Ej: Golosinas, Bebidas..." onKeyDown={(e) => { if (e.key === "Enter" && catNombre.trim()) handleSaveCat(); }} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveCat} disabled={saving || !catNombre.trim()}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingCat ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingSub ? "Editar Subcategoría" : "Nueva Subcategoría"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Categoría padre *</Label>
              <Select value={subCatId} onValueChange={(v) => setSubCatId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre de la subcategoría *</Label>
              <Input value={subNombre} onChange={(e) => setSubNombre(e.target.value)} placeholder="Ej: Chocolates, Gaseosas..." onKeyDown={(e) => { if (e.key === "Enter" && subNombre.trim() && subCatId) handleSaveSub(); }} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSubDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveSub} disabled={saving || !subNombre.trim() || !subCatId}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingSub ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
