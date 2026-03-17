"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Loader2,
  Truck,
  DollarSign,
  CheckCircle,
  CheckCheck,
} from "lucide-react";

interface VentaRow {
  id: string;
  numero: string;
  tipo_comprobante: string;
  fecha: string;
  total: number;
  clientes: { id: string; nombre: string } | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(value);
}

export default function EntregasPendientesPage() {
  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchPendientes = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("ventas")
      .select("id, numero, tipo_comprobante, fecha, total, clientes(id, nombre)")
      .eq("entregado", false)
      .order("fecha", { ascending: false });

    if (dateFrom) query = query.gte("fecha", dateFrom);
    if (dateTo) query = query.lte("fecha", dateTo);

    const { data } = await query;
    let results = (data as unknown as VentaRow[]) || [];

    if (search) {
      const s = search.toLowerCase();
      results = results.filter(
        (v) =>
          v.numero.toLowerCase().includes(s) ||
          (v.clientes?.nombre || "").toLowerCase().includes(s)
      );
    }

    setVentas(results);
    setLoading(false);
  }, [search, dateFrom, dateTo]);

  useEffect(() => { fetchPendientes(); }, [fetchPendientes]);

  const marcarEntregado = async (id: string) => {
    setActionLoading(id);
    await supabase.from("ventas").update({ entregado: true }).eq("id", id);
    await fetchPendientes();
    setActionLoading(null);
  };

  const marcarTodos = async () => {
    setBulkLoading(true);
    const ids = ventas.map((v) => v.id);
    await supabase.from("ventas").update({ entregado: true }).in("id", ids);
    await fetchPendientes();
    setBulkLoading(false);
  };

  const totalPendientes = ventas.length;
  const montoPendiente = ventas.reduce((a, v) => a + v.total, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entregas Pendientes</h1>
          <p className="text-muted-foreground text-sm">Repartos pendientes de entrega</p>
        </div>
        {ventas.length > 0 && (
          <Button onClick={marcarTodos} disabled={bulkLoading}>
            {bulkLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCheck className="w-4 h-4 mr-2" />}
            Marcar todos entregados
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Truck className="w-5 h-5 text-amber-500" /></div>
            <div><p className="text-xs text-muted-foreground">Total pendientes</p><p className="text-xl font-bold">{totalPendientes}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-500" /></div>
            <div><p className="text-xs text-muted-foreground">Monto total pendiente</p><p className="text-xl font-bold">{formatCurrency(montoPendiente)}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Numero o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-4 font-medium">Numero</th>
                    <th className="text-left py-3 px-4 font-medium">Tipo</th>
                    <th className="text-left py-3 px-4 font-medium">Fecha</th>
                    <th className="text-left py-3 px-4 font-medium">Cliente</th>
                    <th className="text-right py-3 px-4 font-medium">Total</th>
                    <th className="text-right py-3 px-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((v) => (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{v.numero}</td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-xs font-normal">{v.tipo_comprobante}</Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(v.fecha).toLocaleDateString("es-AR")}</td>
                      <td className="py-3 px-4 font-medium">{v.clientes?.nombre || "—"}</td>
                      <td className="py-3 px-4 text-right font-semibold">{formatCurrency(v.total)}</td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          disabled={actionLoading === v.id}
                          onClick={() => marcarEntregado(v.id)}
                        >
                          {actionLoading === v.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                          Marcar entregado
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ventas.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">No hay entregas pendientes</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
