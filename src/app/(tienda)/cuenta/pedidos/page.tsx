"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Package, ChevronDown, ChevronUp, Calendar, Hash, AlertCircle, ShoppingBag } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PedidoItem {
  id: number;
  nombre: string;
  presentacion: string;
  cantidad: number;
  precio_unitario: number;
}

interface NotaCredito {
  id: string;
  numero: string;
  fecha: string;
  total: number;
  items: { descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }[];
}

interface PagoDetalle {
  metodo_pago: string;
  monto: number;
  cuenta_bancaria?: string;
}

interface VentaRecord {
  id: string;
  numero: string;
  tipo_comprobante: string;
  fecha: string;
  forma_pago: string;
  total: number;
  origen: string;
  items: { descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }[];
  notas_credito: NotaCredito[];
  pagos: PagoDetalle[];
}

interface Pedido {
  id: number;
  numero: string;
  created_at: string;
  estado: string;
  total: number;
  items: PedidoItem[];
  venta?: VentaRecord;
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(value);

const estadoBadge: Record<string, { bg: string; text: string; dot: string }> = {
  pendiente: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  confirmado: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
  entregado: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  cancelado: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400" },
};

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [ventasPOS, setVentasPOS] = useState<VentaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const stored = localStorage.getItem("cliente_auth");
      if (!stored) return;
      const { id } = JSON.parse(stored);

      // Get cliente_id linked to this auth
      const { data: authRec } = await supabase
        .from("clientes_auth")
        .select("cliente_id")
        .eq("id", id)
        .single();
      const clienteId = authRec?.cliente_id;

      // Fetch pedidos tienda
      const { data } = await supabase
        .from("pedidos_tienda")
        .select("id, numero, created_at, estado, total, pedido_tienda_items(id, nombre, presentacion, cantidad, precio_unitario)")
        .eq("cliente_auth_id", id)
        .order("created_at", { ascending: false });

      // Fetch all ventas for this client (includes POS + web)
      let allVentas: any[] = [];
      if (clienteId) {
        const { data: ventas } = await supabase
          .from("ventas")
          .select("id, numero, tipo_comprobante, fecha, forma_pago, total, origen, venta_items(descripcion, cantidad, precio_unitario, subtotal)")
          .eq("cliente_id", clienteId)
          .not("tipo_comprobante", "ilike", "Nota de Crédito%")
          .not("tipo_comprobante", "ilike", "Nota de Débito%")
          .order("fecha", { ascending: false });
        allVentas = ventas || [];
      }

      // For each venta, find associated NCs
      const ventaIds = allVentas.map((v: any) => v.id);
      let ncMap: Record<string, NotaCredito[]> = {};
      if (ventaIds.length > 0) {
        const { data: ncs } = await supabase
          .from("ventas")
          .select("id, numero, fecha, total, remito_origen_id, venta_items(descripcion, cantidad, precio_unitario, subtotal)")
          .in("remito_origen_id", ventaIds)
          .ilike("tipo_comprobante", "Nota de Crédito%");
        for (const nc of ncs || []) {
          const key = (nc as any).remito_origen_id;
          if (!ncMap[key]) ncMap[key] = [];
          ncMap[key].push({
            id: nc.id,
            numero: nc.numero,
            fecha: nc.fecha,
            total: nc.total,
            items: (nc as any).venta_items || [],
          });
        }
      }

      // Fetch payment breakdown from caja_movimientos
      let pagosMap: Record<string, PagoDetalle[]> = {};
      if (ventaIds.length > 0) {
        const { data: movs } = await supabase
          .from("caja_movimientos")
          .select("referencia_id, metodo_pago, monto, cuenta_bancaria")
          .in("referencia_id", ventaIds)
          .eq("referencia_tipo", "venta");
        for (const m of movs || []) {
          const key = m.referencia_id;
          if (!pagosMap[key]) pagosMap[key] = [];
          pagosMap[key].push({
            metodo_pago: m.metodo_pago,
            monto: m.monto,
            cuenta_bancaria: m.cuenta_bancaria || undefined,
          });
        }
      }

      // Also check cuenta_corriente for CC payments
      if (ventaIds.length > 0) {
        const { data: ccMovs } = await supabase
          .from("cuenta_corriente")
          .select("venta_id, debe, forma_pago")
          .in("venta_id", ventaIds);
        for (const cc of ccMovs || []) {
          const key = cc.venta_id;
          if (!pagosMap[key]) pagosMap[key] = [];
          // Only add if not already tracked via caja_movimientos
          const hasCC = pagosMap[key].some((p) => p.metodo_pago === "Cuenta Corriente");
          if (!hasCC && cc.debe > 0) {
            pagosMap[key].push({ metodo_pago: "Cuenta Corriente", monto: cc.debe });
          }
        }
      }

      // Build venta records with NCs and payment info
      const ventaRecords: Record<string, VentaRecord> = {};
      for (const v of allVentas) {
        ventaRecords[v.numero] = {
          id: v.id,
          numero: v.numero,
          tipo_comprobante: v.tipo_comprobante,
          fecha: v.fecha,
          forma_pago: v.forma_pago,
          total: v.total,
          origen: v.origen || "admin",
          items: (v as any).venta_items || [],
          notas_credito: ncMap[v.id] || [],
          pagos: pagosMap[v.id] || [],
        };
      }

      // Map pedidos with their ventas
      const pedidosList: Pedido[] = (data || []).map((p: any) => ({
        ...p,
        items: p.pedido_tienda_items || [],
        venta: ventaRecords[p.numero] || undefined,
      }));

      setPedidos(pedidosList);

      // POS ventas that don't match any pedido
      const pedidoNumeros = new Set(pedidosList.map((p) => p.numero));
      const posOnly = Object.values(ventaRecords).filter(
        (v) => !pedidoNumeros.has(v.numero)
      );
      setVentasPOS(posOnly);

      setLoading(false);
    };
    fetchData();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back button */}
      <Link
        href="/cuenta"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-pink-600 transition-colors mb-6 text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a mi cuenta
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Pedidos</h1>
          <p className="text-gray-400 text-sm mt-1">
            {pedidos.length + ventasPOS.length > 0
              ? `${pedidos.length + ventasPOS.length} ${(pedidos.length + ventasPOS.length) === 1 ? "registro" : "registros"} en total`
              : "Tu historial de compras"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-20 h-4 bg-gray-200 rounded" />
                <div className="w-24 h-4 bg-gray-100 rounded" />
                <div className="w-16 h-6 bg-gray-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (pedidos.length === 0 && ventasPOS.length === 0) ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">No tenés pedidos todavía</p>
          <p className="text-gray-400 text-sm mt-1">Cuando hagas tu primera compra, aparecerá acá</p>
          <Link
            href="/"
            className="inline-block mt-5 bg-pink-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-pink-700 transition-colors"
          >
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {pedidos.map((pedido) => {
            const badge = estadoBadge[pedido.estado] || { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400" };
            const isExpanded = expanded === `pedido-${pedido.id}`;

            return (
              <div
                key={pedido.id}
                className={`bg-white rounded-2xl border transition-all duration-200 ${
                  isExpanded ? "border-pink-200 shadow-lg" : "border-gray-100 hover:border-gray-200"
                }`}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : `pedido-${pedido.id}`)}
                  className="w-full text-left p-5 md:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Top row: number + status */}
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <div className="flex items-center gap-1.5 text-gray-900">
                          <Hash className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-mono font-semibold text-sm">{pedido.numero}</span>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span className="capitalize">{pedido.estado}</span>
                        </span>
                        {pedido.venta?.notas_credito && pedido.venta.notas_credito.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                            <AlertCircle className="w-3 h-3" />
                            NC
                          </span>
                        )}
                      </div>

                      {/* Date + items count */}
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(pedido.created_at)}
                        </span>
                        <span className="text-gray-200">|</span>
                        <span>
                          {pedido.items.length} {pedido.items.length === 1 ? "producto" : "productos"}
                        </span>
                      </div>
                    </div>

                    {/* Total + chevron */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        {pedido.venta?.notas_credito && pedido.venta.notas_credito.length > 0 ? (
                          <>
                            <span className="text-sm text-gray-400 line-through">{formatPrice(pedido.total)}</span>
                            <span className="text-lg font-bold text-pink-600 ml-1">
                              {formatPrice(pedido.total - pedido.venta.notas_credito.reduce((s, nc) => s + nc.total, 0))}
                            </span>
                          </>
                        ) : (
                          <span className="text-lg font-bold text-gray-900">{formatPrice(pedido.total)}</span>
                        )}
                      </div>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        isExpanded ? "bg-pink-50" : "bg-gray-50"
                      }`}>
                        {isExpanded ? (
                          <ChevronUp className={`w-4 h-4 ${isExpanded ? "text-pink-600" : "text-gray-400"}`} />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded items */}
                {isExpanded && (
                  <div className="border-t border-gray-100 mx-5 md:mx-6">
                    {pedido.items.length > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 uppercase tracking-wider">
                            <th className="py-3 text-left font-medium">Producto</th>
                            <th className="py-3 text-center font-medium">Cant.</th>
                            <th className="py-3 text-right font-medium">Precio</th>
                            <th className="py-3 text-right font-medium">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pedido.items.map((item) => (
                            <tr key={item.id} className="border-t border-gray-50">
                              <td className="py-3 text-gray-700 font-medium">{item.nombre}{item.presentacion && item.presentacion !== "Unidad" ? ` (${item.presentacion})` : ""}</td>
                              <td className="py-3 text-center text-gray-500">{item.cantidad}</td>
                              <td className="py-3 text-right text-gray-500">{formatPrice(item.precio_unitario)}</td>
                              <td className="py-3 text-right font-semibold text-gray-900">
                                {formatPrice(item.precio_unitario * item.cantidad)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200">
                            <td colSpan={3} className="py-3 text-right font-semibold text-gray-500 text-xs uppercase tracking-wider">
                              Total
                            </td>
                            <td className="py-3 text-right font-bold text-pink-600 text-base">
                              {formatPrice(pedido.total)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}

                    {/* Payment breakdown */}
                    {pedido.venta && pedido.venta.pagos.length > 0 && (
                      <div className="mt-3 bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detalle de pago</p>
                        <div className="space-y-1.5">
                          {pedido.venta.pagos.map((p, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                {p.metodo_pago}
                                {p.cuenta_bancaria && <span className="text-gray-400 text-xs ml-1">→ {p.cuenta_bancaria}</span>}
                              </span>
                              <span className="font-medium text-gray-900">{formatPrice(p.monto)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {pedido.venta && pedido.venta.pagos.length === 0 && pedido.venta.forma_pago && (
                      <div className="mt-3 bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Forma de pago</p>
                        <p className="text-sm text-gray-700">{pedido.venta.forma_pago}</p>
                      </div>
                    )}

                    {/* Notas de crédito */}
                    {pedido.venta?.notas_credito && pedido.venta.notas_credito.length > 0 && (
                      <div className="mt-3 mb-4">
                        {pedido.venta.notas_credito.map((nc) => (
                          <div key={nc.id} className="bg-red-50 rounded-xl p-4 mt-2">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                                <span className="text-sm font-semibold text-red-700">Nota de Crédito</span>
                                <span className="text-xs text-red-500 font-mono">{nc.numero}</span>
                              </div>
                              <span className="text-sm font-bold text-red-600">-{formatPrice(nc.total)}</span>
                            </div>
                            {nc.items.length > 0 && (
                              <div className="space-y-1">
                                {nc.items.map((ni, idx) => (
                                  <div key={idx} className="flex justify-between text-xs text-red-600">
                                    <span>{ni.cantidad}x {ni.descripcion.replace(/\s*\(Unidad\)$/, "")}</span>
                                    <span>-{formatPrice(ni.subtotal)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Total final after NCs */}
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-red-200">
                          <span className="text-sm font-semibold text-gray-700">Total final</span>
                          <span className="text-lg font-bold text-pink-600">
                            {formatPrice(pedido.total - pedido.venta!.notas_credito.reduce((s, nc) => s + nc.total, 0))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* POS ventas (not from tienda) */}
          {ventasPOS.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-6 mb-3">
                <ShoppingBag className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-500">Compras en local</span>
              </div>
              {ventasPOS.map((v) => {
                const isExp = expanded === `venta-${v.id}`;
                const hasNC = v.notas_credito.length > 0;
                return (
                  <div
                    key={v.id}
                    className={`bg-white rounded-2xl border transition-all duration-200 ${
                      isExp ? "border-pink-200 shadow-lg" : "border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <button
                      onClick={() => setExpanded(isExp ? null : `venta-${v.id}`)}
                      className="w-full text-left p-5 md:p-6"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap mb-2">
                            <div className="flex items-center gap-1.5 text-gray-900">
                              <Hash className="w-3.5 h-3.5 text-gray-400" />
                              <span className="font-mono font-semibold text-sm">{v.numero}</span>
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                              {v.tipo_comprobante}
                            </span>
                            {hasNC && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                                <AlertCircle className="w-3 h-3" />
                                NC
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-400">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(v.fecha + "T12:00:00")}
                            </span>
                            <span className="text-gray-200">|</span>
                            <span>{v.forma_pago}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            {v.notas_credito.length > 0 ? (
                              <>
                                <span className="text-sm text-gray-400 line-through">{formatPrice(v.total)}</span>
                                <span className="text-lg font-bold text-pink-600 ml-1">
                                  {formatPrice(v.total - v.notas_credito.reduce((s, nc) => s + nc.total, 0))}
                                </span>
                              </>
                            ) : (
                              <span className="text-lg font-bold text-gray-900">{formatPrice(v.total)}</span>
                            )}
                          </div>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isExp ? "bg-pink-50" : "bg-gray-50"}`}>
                            {isExp ? <ChevronUp className="w-4 h-4 text-pink-600" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </div>
                        </div>
                      </div>
                    </button>

                    {isExp && (
                      <div className="border-t border-gray-100 mx-5 md:mx-6">
                        {v.items.length > 0 && (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-gray-400 uppercase tracking-wider">
                                <th className="py-3 text-left font-medium">Producto</th>
                                <th className="py-3 text-center font-medium">Cant.</th>
                                <th className="py-3 text-right font-medium">Precio</th>
                                <th className="py-3 text-right font-medium">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {v.items.map((item, idx) => (
                                <tr key={idx} className="border-t border-gray-50">
                                  <td className="py-3 text-gray-700 font-medium">{item.descripcion}</td>
                                  <td className="py-3 text-center text-gray-500">{item.cantidad}</td>
                                  <td className="py-3 text-right text-gray-500">{formatPrice(item.precio_unitario)}</td>
                                  <td className="py-3 text-right font-semibold text-gray-900">{formatPrice(item.subtotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-gray-200">
                                <td colSpan={3} className="py-3 text-right font-semibold text-gray-500 text-xs uppercase tracking-wider">Total</td>
                                <td className="py-3 text-right font-bold text-pink-600 text-base">{formatPrice(v.total)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        )}

                        {/* Payment breakdown */}
                        {v.pagos.length > 0 && (
                          <div className="mt-3 bg-gray-50 rounded-xl p-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detalle de pago</p>
                            <div className="space-y-1.5">
                              {v.pagos.map((p, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                  <span className="text-gray-600">
                                    {p.metodo_pago}
                                    {p.cuenta_bancaria && <span className="text-gray-400 text-xs ml-1">→ {p.cuenta_bancaria}</span>}
                                  </span>
                                  <span className="font-medium text-gray-900">{formatPrice(p.monto)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {v.pagos.length === 0 && v.forma_pago && (
                          <div className="mt-3 bg-gray-50 rounded-xl p-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Forma de pago</p>
                            <p className="text-sm text-gray-700">{v.forma_pago}</p>
                          </div>
                        )}

                        {v.notas_credito.length > 0 && (
                          <div className="mt-3 mb-4">
                            {v.notas_credito.map((nc) => (
                              <div key={nc.id} className="bg-red-50 rounded-xl p-4 mt-2">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                    <span className="text-sm font-semibold text-red-700">Nota de Crédito</span>
                                    <span className="text-xs text-red-500 font-mono">{nc.numero}</span>
                                  </div>
                                  <span className="text-sm font-bold text-red-600">-{formatPrice(nc.total)}</span>
                                </div>
                                {nc.items.length > 0 && (
                                  <div className="space-y-1">
                                    {nc.items.map((ni, idx) => (
                                      <div key={idx} className="flex justify-between text-xs text-red-600">
                                        <span>{ni.cantidad}x {ni.descripcion.replace(/\s*\(Unidad\)$/, "")}</span>
                                        <span>-{formatPrice(ni.subtotal)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                            {/* Total final after NCs */}
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-red-200">
                              <span className="text-sm font-semibold text-gray-700">Total final</span>
                              <span className="text-lg font-bold text-pink-600">
                                {formatPrice(v.total - v.notas_credito.reduce((s, nc) => s + nc.total, 0))}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
