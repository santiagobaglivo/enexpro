"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Package, ShoppingCart,
  Loader2, Download, Calendar, Filter,
} from "lucide-react";

function fc(v: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(v);
}

interface VentaRow { id: string; fecha: string; total: number; forma_pago: string; tipo_comprobante: string; created_at: string; }
interface CompraRow { id: string; fecha: string; total: number; forma_pago: string; }
interface VentaItem { producto_id: string; cantidad: number; precio_unitario: number; subtotal: number; unidades_por_presentacion: number; }

export default function ReportesPage() {
  const [tab, setTab] = useState("ventas");
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  // Ventas report
  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [ventaItems, setVentaItems] = useState<VentaItem[]>([]);

  // Compras report
  const [compras, setCompras] = useState<CompraRow[]>([]);

  // Stock report
  const [productos, setProductos] = useState<{ id: string; nombre: string; codigo: string; stock: number; precio: number; costo: number; }[]>([]);

  const fetchReports = useCallback(async () => {
    setLoading(true);

    const [{ data: vts }, { data: cmps }, { data: prods }] = await Promise.all([
      supabase.from("ventas").select("id, fecha, total, forma_pago, tipo_comprobante, created_at")
        .gte("fecha", desde).lte("fecha", hasta)
        .not("tipo_comprobante", "ilike", "Nota de Crédito%")
        .order("fecha", { ascending: false }),
      supabase.from("compras").select("id, fecha, total, forma_pago")
        .gte("fecha", desde).lte("fecha", hasta)
        .order("fecha", { ascending: false }),
      supabase.from("productos").select("id, nombre, codigo, stock, precio, costo").eq("activo", true).order("nombre"),
    ]);

    setVentas((vts || []) as VentaRow[]);
    setCompras((cmps || []) as CompraRow[]);
    setProductos(prods || []);

    // Fetch venta items for profit calc
    if (vts && vts.length > 0) {
      const ids = vts.map((v: any) => v.id);
      const { data: items } = await supabase
        .from("venta_items")
        .select("producto_id, cantidad, precio_unitario, subtotal, unidades_por_presentacion, productos(costo)")
        .in("venta_id", ids);
      setVentaItems((items || []) as any[]);
    } else {
      setVentaItems([]);
    }

    setLoading(false);
  }, [desde, hasta]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // --- Derived ---
  const totalVentas = ventas.reduce((a, v) => a + v.total, 0);
  const totalCompras = compras.reduce((a, c) => a + c.total, 0);
  const ganancia = ventaItems.reduce((a, item: any) => {
    const costoU = item.productos?.costo || 0;
    const unidadesPres = Number(item.unidades_por_presentacion) || 1;
    return a + (item.precio_unitario - costoU * unidadesPres) * item.cantidad;
  }, 0);

  const ventasPorPago: Record<string, number> = {};
  ventas.forEach((v) => { ventasPorPago[v.forma_pago] = (ventasPorPago[v.forma_pago] || 0) + v.total; });

  const ventasPorDia: Record<string, number> = {};
  ventas.forEach((v) => { ventasPorDia[v.fecha] = (ventasPorDia[v.fecha] || 0) + v.total; });

  const stockCosto = productos.reduce((a, p) => a + p.stock * p.costo, 0);
  const stockVenta = productos.reduce((a, p) => a + p.stock * p.precio, 0);
  const sinStock = productos.filter((p) => p.stock <= 0).length;

  const exportCSV = (name: string, header: string, rows: string) => {
    const blob = new Blob([header + "\n" + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}_${desde}_${hasta}.csv`;
    a.click();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground text-sm">Analisis de ventas, compras y stock</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9 w-36" />
          <span className="text-muted-foreground text-sm">a</span>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9 w-36" />
          <Button size="sm" onClick={fetchReports} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Ventas</p>
          <p className="text-xl font-bold">{fc(totalVentas)}</p>
          <p className="text-xs text-muted-foreground">{ventas.length} operaciones</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Compras</p>
          <p className="text-xl font-bold">{fc(totalCompras)}</p>
          <p className="text-xs text-muted-foreground">{compras.length} operaciones</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Ganancia</p>
          <p className={`text-xl font-bold ${ganancia >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fc(ganancia)}</p>
          <p className="text-xs text-muted-foreground">{totalVentas > 0 ? `${((ganancia / totalVentas) * 100).toFixed(1)}% margen` : "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Stock (costo)</p>
          <p className="text-xl font-bold">{fc(stockCosto)}</p>
          <p className="text-xs text-muted-foreground">{productos.length} productos</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Stock (venta)</p>
          <p className="text-xl font-bold">{fc(stockVenta)}</p>
          <p className="text-xs text-red-500">{sinStock} sin stock</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
          <TabsTrigger value="stock">Stock Valorizado</TabsTrigger>
          <TabsTrigger value="pagos">Por Forma de Pago</TabsTrigger>
        </TabsList>

        <TabsContent value="ventas" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportCSV("ventas", "Fecha,Tipo,Forma Pago,Total", ventas.map((v) => `${v.fecha},${v.tipo_comprobante},${v.forma_pago},${v.total}`).join("\n"))}>
              <Download className="w-4 h-4 mr-1.5" />CSV
            </Button>
          </div>
          <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">Fecha</th>
                  <th className="text-left py-2 px-3 font-medium">Tipo</th>
                  <th className="text-left py-2 px-3 font-medium">Forma Pago</th>
                  <th className="text-right py-2 px-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3">{new Date(v.fecha + "T12:00:00").toLocaleDateString("es-AR")}</td>
                    <td className="py-2 px-3"><Badge variant="secondary" className="text-xs">{v.tipo_comprobante}</Badge></td>
                    <td className="py-2 px-3"><Badge variant="outline" className="text-xs">{v.forma_pago}</Badge></td>
                    <td className="py-2 px-3 text-right font-semibold">{fc(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="compras" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportCSV("compras", "Fecha,Forma Pago,Total", compras.map((c) => `${c.fecha},${c.forma_pago},${c.total}`).join("\n"))}>
              <Download className="w-4 h-4 mr-1.5" />CSV
            </Button>
          </div>
          <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">Fecha</th>
                  <th className="text-left py-2 px-3 font-medium">Forma Pago</th>
                  <th className="text-right py-2 px-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {compras.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3">{new Date(c.fecha + "T12:00:00").toLocaleDateString("es-AR")}</td>
                    <td className="py-2 px-3"><Badge variant="outline" className="text-xs">{c.forma_pago}</Badge></td>
                    <td className="py-2 px-3 text-right font-semibold">{fc(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="stock" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportCSV("stock", "Codigo,Nombre,Stock,Costo,Precio,Valor Costo,Valor Venta", productos.map((p) => `${p.codigo},${p.nombre},${p.stock},${p.costo},${p.precio},${p.stock * p.costo},${p.stock * p.precio}`).join("\n"))}>
              <Download className="w-4 h-4 mr-1.5" />CSV
            </Button>
          </div>
          <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">Producto</th>
                  <th className="text-center py-2 px-3 font-medium">Stock</th>
                  <th className="text-right py-2 px-3 font-medium">Costo</th>
                  <th className="text-right py-2 px-3 font-medium">Precio</th>
                  <th className="text-right py-2 px-3 font-medium">Valor Costo</th>
                  <th className="text-right py-2 px-3 font-medium">Valor Venta</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id} className={`border-b last:border-0 hover:bg-muted/30 ${p.stock <= 0 ? "opacity-40" : ""}`}>
                    <td className="py-2 px-3">
                      <p className="font-medium">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.codigo}</p>
                    </td>
                    <td className="py-2 px-3 text-center">{p.stock}</td>
                    <td className="py-2 px-3 text-right">{fc(p.costo)}</td>
                    <td className="py-2 px-3 text-right">{fc(p.precio)}</td>
                    <td className="py-2 px-3 text-right font-medium">{fc(p.stock * p.costo)}</td>
                    <td className="py-2 px-3 text-right font-semibold text-emerald-600">{fc(p.stock * p.precio)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/50 font-bold">
                  <td className="py-2 px-3">TOTAL</td>
                  <td className="py-2 px-3 text-center">{productos.reduce((a, p) => a + p.stock, 0)}</td>
                  <td colSpan={2}></td>
                  <td className="py-2 px-3 text-right">{fc(stockCosto)}</td>
                  <td className="py-2 px-3 text-right text-emerald-600">{fc(stockVenta)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="pagos" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(ventasPorPago).sort((a, b) => b[1] - a[1]).map(([metodo, monto]) => (
              <Card key={metodo}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{metodo}</p>
                      <p className="text-xl font-bold">{fc(monto)}</p>
                    </div>
                    <Badge variant="secondary">{((monto / totalVentas) * 100).toFixed(1)}%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{ventas.filter((v) => v.forma_pago === metodo).length} operaciones</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
