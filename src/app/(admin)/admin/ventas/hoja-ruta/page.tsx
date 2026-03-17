"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import {
  Truck,
  Package,
  Eye,
  RefreshCw,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  Loader2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface ClienteInfo {
  id: string;
  nombre: string;
  domicilio: string | null;
  localidad: string | null;
  telefono: string | null;
  saldo: number;
}

interface VentaRow {
  id: string;
  numero: string;
  tipo_comprobante: string;
  fecha: string;
  forma_pago: string;
  total: number;
  estado: string;
  observacion: string | null;
  entregado: boolean;
  cliente_id: string | null;
  clientes: ClienteInfo | null;
  venta_items: VentaItemRow[];
}

interface VentaItemRow {
  id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  unidad_medida: string | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(value);
}

function getArgentinaToday() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default function HojaDeRutaPage() {
  const [selectedDate, setSelectedDate] = useState(getArgentinaToday());
  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailVenta, setDetailVenta] = useState<VentaRow | null>(null);
  const [orden, setOrden] = useState<Record<string, number>>({});

  // Track how much was actually paid per order (from caja_movimientos)
  const [pagadoPorVenta, setPagadoPorVenta] = useState<Record<string, number>>({});

  const fetchVentas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ventas")
      .select(
        "id, numero, tipo_comprobante, fecha, forma_pago, total, estado, observacion, entregado, cliente_id, clientes(id, nombre, domicilio, localidad, telefono, saldo), venta_items(id, descripcion, cantidad, precio_unitario, subtotal, unidad_medida)"
      )
      .eq("entregado", false)
      .eq("fecha", selectedDate)
      .neq("estado", "anulada")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const rows = (data || []) as unknown as VentaRow[];
    setVentas(rows);

    // Fetch payments per order from caja_movimientos
    if (rows.length > 0) {
      const ventaIds = rows.map((v) => v.id);
      const { data: movs } = await supabase
        .from("caja_movimientos")
        .select("referencia_id, monto")
        .eq("tipo", "ingreso")
        .eq("referencia_tipo", "venta")
        .in("referencia_id", ventaIds);

      const pagadoMap: Record<string, number> = {};
      (movs || []).forEach((m: { referencia_id: string; monto: number }) => {
        pagadoMap[m.referencia_id] = (pagadoMap[m.referencia_id] || 0) + m.monto;
      });
      setPagadoPorVenta(pagadoMap);
    } else {
      setPagadoPorVenta({});
    }

    // Initialize order sequence
    const newOrden: Record<string, number> = {};
    rows.forEach((v, i) => {
      newOrden[v.id] = orden[v.id] ?? i + 1;
    });
    setOrden(newOrden);

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    fetchVentas();
  }, [fetchVentas]);

  const handleMarkDelivered = async (id: string) => {
    const { error } = await supabase
      .from("ventas")
      .update({ entregado: true })
      .eq("id", id);
    if (error) {
      console.error(error);
      return;
    }
    setVentas((prev) => prev.filter((v) => v.id !== id));
  };

  const handleViewDetail = (venta: VentaRow) => {
    setDetailVenta(venta);
    setDetailOpen(true);
  };

  const handleOrdenChange = (id: string, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      setOrden((prev) => ({ ...prev, [id]: num }));
    }
  };

  const moveOrder = (id: string, direction: "up" | "down") => {
    setOrden((prev) => {
      const currentVal = prev[id] ?? 1;
      const newVal = direction === "up" ? Math.max(1, currentVal - 1) : currentVal + 1;
      return { ...prev, [id]: newVal };
    });
  };

  // Sort ventas by their order number
  const sortedVentas = [...ventas].sort(
    (a, b) => (orden[a.id] ?? 999) - (orden[b.id] ?? 999)
  );

  // Stats
  const totalPedidos = ventas.length;
  const valorTotal = ventas.reduce((s, v) => s + v.total, 0);
  const totalYaPagado = ventas.reduce((s, v) => s + (pagadoPorVenta[v.id] || 0), 0);
  const totalACobrar = Math.max(0, valorTotal - totalYaPagado);

  const tabs = [
    { name: "Todas las Ventas", href: "/ventas/listado" },
    { name: "Hoja de Ruta", href: "/ventas/hoja-ruta" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Tabs */}
      <div className="bg-gray-100 rounded-xl p-1 inline-flex">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-6 py-2.5 text-sm transition-all ${
              tab.href === "/ventas/hoja-ruta"
                ? "bg-white shadow-sm font-semibold text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.name}
          </Link>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="w-7 h-7 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Hoja de Ruta</h1>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Package className="w-4 h-4" />
              Total Entregas
            </div>
            <div className="text-2xl font-bold">{totalPedidos}</div>
            <div className="text-xs text-gray-400 mt-1">
              Pendientes de entrega
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              Valor Total
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(valorTotal)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Suma de todas las entregas
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-500 text-sm mb-1">
              <Clock className="w-4 h-4" />
              A Cobrar
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(totalACobrar)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Saldo pendiente de clientes
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-500 text-sm mb-1">
              <CheckCircle className="w-4 h-4" />
              Ya Pagado
            </div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalYaPagado)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Cobrado previamente
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Entregas del Dia
              </h2>
              <span className="inline-block mt-1 text-sm text-green-600 font-medium">
                {totalPedidos} entrega{totalPedidos !== 1 ? "s" : ""} pendiente
                {totalPedidos !== 1 ? "s" : ""}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchVentas}
              disabled={loading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : ventas.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Truck className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium text-gray-500">
                No hay entregas pendientes para esta fecha
              </p>
              <p className="text-sm mt-1">
                Selecciona otra fecha o espera nuevas ventas
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 px-3 w-24">Orden</th>
                    <th className="pb-3 px-3">Nro. Venta</th>
                    <th className="pb-3 px-3">Cliente</th>
                    <th className="pb-3 px-3">Direccion</th>
                    <th className="pb-3 px-3 text-right">Total</th>
                    <th className="pb-3 px-3 text-right">Pagado</th>
                    <th className="pb-3 px-3 text-right">Debe</th>
                    <th className="pb-3 px-3">Estado Pago</th>
                    <th className="pb-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedVentas.map((venta) => {
                    const pagado = pagadoPorVenta[venta.id] || 0;
                    const debe = Math.max(0, venta.total - pagado);
                    const estaPago = debe <= 0;

                    return (
                      <tr
                        key={venta.id}
                        className="border-b hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={1}
                              value={orden[venta.id] ?? ""}
                              onChange={(e) =>
                                handleOrdenChange(venta.id, e.target.value)
                              }
                              className="w-14 h-8 text-center text-sm"
                            />
                            <div className="flex flex-col">
                              <button
                                onClick={() => moveOrder(venta.id, "up")}
                                className="text-gray-400 hover:text-gray-700 p-0.5"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => moveOrder(venta.id, "down")}
                                className="text-gray-400 hover:text-gray-700 p-0.5"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono text-xs font-semibold text-gray-700">
                            {venta.numero}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {venta.tipo_comprobante}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-gray-900">
                            {venta.clientes?.nombre ?? "Sin cliente"}
                          </div>
                          {venta.clientes?.telefono && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                              <Phone className="w-3 h-3" />
                              {venta.clientes.telefono}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                            <div className="text-gray-700">
                              {[
                                venta.clientes?.domicilio,
                                venta.clientes?.localidad,
                              ]
                                .filter(Boolean)
                                .join(", ") || "Sin direccion"}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-gray-900">
                          {formatCurrency(venta.total)}
                        </td>
                        <td className="py-3 px-3 text-right text-green-600 font-medium">
                          {formatCurrency(pagado)}
                        </td>
                        <td className="py-3 px-3 text-right text-orange-600 font-medium">
                          {debe > 0 ? formatCurrency(debe) : "-"}
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant="secondary"
                            className={
                              estaPago
                                ? "bg-green-100 text-green-700 hover:bg-green-100"
                                : "bg-orange-100 text-orange-700 hover:bg-orange-100"
                            }
                          >
                            {estaPago ? "Pagado" : "Debe"}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleViewDetail(venta)}
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4 text-gray-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleMarkDelivered(venta.id)}
                              title="Marcar como entregado"
                            >
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Detalle de Venta
              {detailVenta && (
                <span className="font-mono text-sm text-gray-500 ml-2">
                  {detailVenta.numero}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailVenta && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Cliente:</span>{" "}
                  <span className="font-medium">
                    {detailVenta.clientes?.nombre ?? "Sin cliente"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Fecha:</span>{" "}
                  <span className="font-medium">{detailVenta.fecha}</span>
                </div>
                <div>
                  <span className="text-gray-500">Direccion:</span>{" "}
                  <span className="font-medium">
                    {[
                      detailVenta.clientes?.domicilio,
                      detailVenta.clientes?.localidad,
                    ]
                      .filter(Boolean)
                      .join(", ") || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Forma de pago:</span>{" "}
                  <span className="font-medium">
                    {detailVenta.forma_pago || "N/A"}
                  </span>
                </div>
                {detailVenta.clientes?.telefono && (
                  <div>
                    <span className="text-gray-500">Telefono:</span>{" "}
                    <span className="font-medium">
                      {detailVenta.clientes.telefono}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Saldo cliente:</span>{" "}
                  <span className="font-medium text-orange-600">
                    {formatCurrency(detailVenta.clientes?.saldo ?? 0)}
                  </span>
                </div>
              </div>

              {detailVenta.observacion && (
                <div className="text-sm bg-gray-50 rounded-lg p-3">
                  <span className="text-gray-500 font-medium">
                    Observacion:
                  </span>{" "}
                  {detailVenta.observacion}
                </div>
              )}

              {/* Items table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-500">
                      <th className="py-2 px-3">Producto</th>
                      <th className="py-2 px-3 text-center">Cant.</th>
                      <th className="py-2 px-3 text-right">Precio Unit.</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailVenta.venta_items?.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="py-2 px-3 font-medium">
                          {item.descripcion}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {item.cantidad} {item.unidad_medida ?? ""}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {formatCurrency(item.precio_unitario)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2 border-t">
                <div className="text-lg font-bold">
                  Total: {formatCurrency(detailVenta.total)}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
