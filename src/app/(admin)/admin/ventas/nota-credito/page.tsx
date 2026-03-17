"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Cliente, Producto, Venta } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus,
  Search,
  FileText,
  X,
  Loader2,
  FileMinus,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

interface LineItem {
  id: string;
  producto_id: string | null;
  code: string;
  description: string;
  qty: number;
  maxQty: number; // max returnable (original - already returned)
  unit: string;
  price: number;
  subtotal: number;
  presentacion: string;
  unidades_por_presentacion: number;
  alreadyReturned: boolean; // fully returned already
}

interface NotaCreditoRow extends Venta {
  clientes?: { nombre: string } | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(value);
}

function getTipoFactura(cliente: Cliente | undefined): string {
  if (!cliente || !cliente.tipo_factura) return "B";
  return cliente.tipo_factura;
}

export default function NotaCreditoPage() {
  const [tab, setTab] = useState("listado");

  // List state
  const [notas, setNotas] = useState<NotaCreditoRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Form state
  const [clients, setClients] = useState<Cliente[]>([]);
  const [products, setProducts] = useState<Producto[]>([]);
  const [presMap, setPresMap] = useState<Record<string, { codigo: string }[]>>({});
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [origenId, setOrigenId] = useState("");
  const [clientVentas, setClientVentas] = useState<Venta[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [observacion, setObservacion] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [freeText, setFreeText] = useState(false);
  const [freeDesc, setFreeDesc] = useState("");
  const [freePrice, setFreePrice] = useState(0);
  const [freeQty, setFreeQty] = useState(1);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchNotas = useCallback(async () => {
    setLoadingList(true);
    const { data } = await supabase
      .from("ventas")
      .select("*, clientes(nombre)")
      .ilike("tipo_comprobante", "Nota de Crédito%")
      .order("fecha", { ascending: false })
      .limit(100);
    setNotas((data as NotaCreditoRow[]) || []);
    setLoadingList(false);
  }, []);

  const fetchFormData = useCallback(async () => {
    const [{ data: cls }, { data: prods }] = await Promise.all([
      supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
      supabase.from("productos").select("*").eq("activo", true).order("nombre"),
    ]);
    setClients(cls || []);
    setProducts(prods || []);
    // Load presentaciones for code search
    const { data: allPres } = await supabase.from("presentaciones").select("producto_id, sku");
    if (allPres) {
      const map: Record<string, { codigo: string }[]> = {};
      for (const pr of allPres) { if (!map[pr.producto_id]) map[pr.producto_id] = []; map[pr.producto_id].push({ codigo: pr.sku || "" }); }
      setPresMap(map);
    }
  }, []);

  useEffect(() => {
    fetchNotas();
    fetchFormData();
  }, [fetchNotas, fetchFormData]);

  // When client changes, fetch their ventas for origen
  useEffect(() => {
    if (!clientId) {
      setClientVentas([]);
      setOrigenId("");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("ventas")
        .select("*")
        .eq("cliente_id", clientId)
        .not("tipo_comprobante", "ilike", "Nota de Crédito%")
        .not("tipo_comprobante", "ilike", "Nota de Débito%")
        .order("fecha", { ascending: false })
        .limit(50);
      setClientVentas(data || []);
    })();
  }, [clientId]);

  // When origin comprobante changes, load its items and check already returned
  useEffect(() => {
    if (!origenId || origenId === "none") {
      return;
    }
    (async () => {
      // 1. Load original items
      const { data: origItems } = await supabase
        .from("venta_items")
        .select("producto_id, codigo, descripcion, cantidad, unidad_medida, precio_unitario, subtotal, presentacion, unidades_por_presentacion")
        .eq("venta_id", origenId);

      if (!origItems || origItems.length === 0) return;

      // 2. Find all existing NCs for the same origin
      const { data: existingNCs } = await supabase
        .from("ventas")
        .select("id")
        .eq("remito_origen_id", origenId)
        .ilike("tipo_comprobante", "Nota de Crédito%");

      // 3. Get items already returned in those NCs
      const returnedMap: Record<string, number> = {}; // producto_id+descripcion -> qty returned
      if (existingNCs && existingNCs.length > 0) {
        const ncIds = existingNCs.map((nc: any) => nc.id);
        const { data: ncItems } = await supabase
          .from("venta_items")
          .select("producto_id, descripcion, cantidad")
          .in("venta_id", ncIds);
        if (ncItems) {
          for (const ni of ncItems) {
            const key = `${ni.producto_id || ""}|${ni.descripcion}`;
            returnedMap[key] = (returnedMap[key] || 0) + (ni.cantidad || 0);
          }
        }
      }

      // 4. Build items with remaining qty
      const loaded: LineItem[] = [];
      for (const item of origItems) {
        const key = `${item.producto_id || ""}|${item.descripcion}`;
        const alreadyReturnedQty = returnedMap[key] || 0;
        const remaining = (item.cantidad || 0) - alreadyReturnedQty;
        const fullyReturned = remaining <= 0;

        loaded.push({
          id: crypto.randomUUID(),
          producto_id: item.producto_id,
          code: item.codigo || "-",
          description: item.descripcion,
          qty: 0,
          maxQty: fullyReturned ? 0 : remaining,
          unit: item.unidad_medida || "UN",
          price: item.precio_unitario,
          subtotal: 0,
          presentacion: item.presentacion || "Unidad",
          unidades_por_presentacion: item.unidades_por_presentacion || 1,
          alreadyReturned: fullyReturned,
        });
      }

      // Only set items that still have remaining qty
      setItems(loaded.filter((i) => !i.alreadyReturned));
    })();
  }, [origenId]);

  const selectedClient = clients.find((c) => c.id === clientId);

  const filteredClients = clients.filter(
    (c) => c.nombre.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const filteredProducts = products.filter(
    (p) =>
      p.nombre.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.codigo.toLowerCase().includes(productSearch.toLowerCase()) ||
      (presMap[p.id] || []).some((pr) => (pr.codigo || "").toLowerCase().includes(productSearch.toLowerCase()))
  );

  const addItem = (product: Producto) => {
    const existing = items.find((i) => i.producto_id === product.id);
    if (existing) {
      setItems(
        items.map((i) =>
          i.id === existing.id
            ? { ...i, qty: i.qty + 1, subtotal: i.price * (i.qty + 1) }
            : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          id: crypto.randomUUID(),
          producto_id: product.id,
          code: product.codigo,
          description: product.nombre,
          qty: 1,
          maxQty: 9999,
          unit: product.unidad_medida,
          price: product.precio,
          subtotal: product.precio,
          presentacion: "Unidad",
          unidades_por_presentacion: 1,
          alreadyReturned: false,
        },
      ]);
    }
    setSearchOpen(false);
    setProductSearch("");
  };

  const addFreeItem = () => {
    if (!freeDesc.trim() || freePrice <= 0) return;
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        producto_id: null,
        code: "-",
        description: freeDesc,
        qty: freeQty,
        maxQty: 9999,
        unit: "UN",
        price: freePrice,
        subtotal: freePrice * freeQty,
        presentacion: "Unidad",
        unidades_por_presentacion: 1,
        alreadyReturned: false,
      },
    ]);
    setFreeDesc("");
    setFreePrice(0);
    setFreeQty(1);
    setFreeText(false);
  };

  const removeItem = (id: string) => setItems(items.filter((i) => i.id !== id));

  const updateQty = (id: string, qty: number) => {
    if (qty < 1) return;
    setItems(
      items.map((i) => {
        if (i.id !== id) return i;
        const clampedQty = Math.min(qty, i.maxQty);
        return { ...i, qty: clampedQty, subtotal: i.price * clampedQty };
      })
    );
  };

  const updatePrice = (id: string, price: number) => {
    setItems(
      items.map((i) =>
        i.id === id ? { ...i, price, subtotal: price * i.qty } : i
      )
    );
  };

  const total = items.reduce((acc, i) => acc + i.subtotal, 0);

  const handleSave = async () => {
    if (!clientId || items.length === 0) return;
    setSaving(true);

    const letra = getTipoFactura(selectedClient);
    const tipoComprobante = `Nota de Crédito ${letra}`;

    const { data: numData } = await supabase.rpc("next_numero", {
      p_tipo: "nota_credito",
    });
    const numero = numData || "00001-00000000";

    const hoy = new Date().toISOString().split("T")[0];

    const { data: venta } = await supabase
      .from("ventas")
      .insert({
        numero,
        tipo_comprobante: tipoComprobante,
        fecha: hoy,
        cliente_id: clientId,
        vendedor_id: null,
        forma_pago: "Cuenta Corriente",
        subtotal: total,
        descuento_porcentaje: 0,
        recargo_porcentaje: 0,
        total,
        estado: "cerrada",
        entregado: true, // NCs don't need delivery
        observacion: observacion || null,
        remito_origen_id: origenId && origenId !== "none" ? origenId : null,
      })
      .select()
      .single();

    if (venta) {
      // Insert items with presentation info
      const ventaItems = items.map((i) => ({
        venta_id: venta.id,
        producto_id: i.producto_id,
        codigo: i.code,
        descripcion: i.description,
        cantidad: i.qty,
        unidad_medida: i.unit,
        precio_unitario: i.price,
        descuento: 0,
        subtotal: i.subtotal,
        presentacion: i.presentacion,
        unidades_por_presentacion: i.unidades_por_presentacion,
      }));
      await supabase.from("venta_items").insert(ventaItems);

      // Re-add stock for returned products using unidades_por_presentacion
      for (const item of items) {
        if (item.producto_id) {
          const prod = products.find((p) => p.id === item.producto_id);
          if (prod) {
            const unitsToReturn = item.qty * (item.unidades_por_presentacion || 1);
            const newStock = prod.stock + unitsToReturn;
            await supabase
              .from("productos")
              .update({ stock: newStock })
              .eq("id", item.producto_id);
            await supabase.from("stock_movimientos").insert({
              producto_id: item.producto_id,
              tipo: "devolucion",
              cantidad_antes: prod.stock,
              cantidad_despues: newStock,
              cantidad: unitsToReturn,
              referencia: `Nota de Crédito: ${numero}`,
              descripcion: `Devolucion - ${item.description}`,
              usuario: "Admin Sistema",
              orden_id: venta.id,
            });
          }
        }
      }

      // Determine original payment method from the origin sale
      let formaPagoOriginal = "Cuenta Corriente";
      if (origenId && origenId !== "none") {
        const origenVenta = clientVentas.find((v) => v.id === origenId);
        if (origenVenta?.forma_pago) {
          formaPagoOriginal = origenVenta.forma_pago;
        }
      }

      // Register egreso in caja_movimientos (reverse the payment)
      const hora = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      await supabase.from("caja_movimientos").insert({
        fecha: hoy,
        hora,
        tipo: "egreso",
        descripcion: `Nota de Crédito #${numero}`,
        metodo_pago: formaPagoOriginal,
        monto: total,
        referencia_id: venta.id,
        referencia_tipo: "nota_credito",
      });

      // Register haber in cuenta_corriente (credit to client)
      const nuevoSaldo = (selectedClient?.saldo || 0) - total;
      await supabase.from("cuenta_corriente").insert({
        cliente_id: clientId,
        fecha: hoy,
        comprobante: `NC ${numero}`,
        descripcion: `Nota de Crédito ${numero}`,
        debe: 0,
        haber: total,
        saldo: nuevoSaldo,
        forma_pago: formaPagoOriginal,
        venta_id: venta.id,
      });

      // Update client saldo (can go negative = saldo a favor)
      await supabase
        .from("clientes")
        .update({ saldo: nuevoSaldo })
        .eq("id", clientId);

      // Reset form
      setItems([]);
      setObservacion("");
      setOrigenId("");
      setClientId("");
      setClientSearch("");
      setTab("listado");
      fetchNotas();
      fetchFormData();

      const saldoMsg = nuevoSaldo < 0
        ? ` — Saldo a favor del cliente: ${formatCurrency(Math.abs(nuevoSaldo))}`
        : nuevoSaldo > 0
        ? ` — Deuda restante: ${formatCurrency(nuevoSaldo)}`
        : " — Deuda saldada";
      setSuccessMsg(`Nota de Crédito ${numero} creada por ${formatCurrency(total)}${saldoMsg}`);
    }

    setSaving(false);
  };

  // Stats
  const totalNC = notas.reduce((acc, n) => acc + n.total, 0);
  const countMes = notas.filter(
    (n) => n.fecha >= new Date().toISOString().slice(0, 7)
  ).length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notas de Crédito</h1>
          <p className="text-muted-foreground text-sm">
            Crear y consultar notas de crédito
          </p>
        </div>
        <Badge variant="outline">
          <FileMinus className="w-3.5 h-3.5 mr-1" />
          NC
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total NC emitidas</p>
            <p className="text-2xl font-bold">{notas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Monto total NC</p>
            <p className="text-2xl font-bold">{formatCurrency(totalNC)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">NC este mes</p>
            <p className="text-2xl font-bold">{countMes}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v ?? "list")}>
        <TabsList>
          <TabsTrigger value="listado">Listado</TabsTrigger>
          <TabsTrigger value="nueva">Nueva Nota de Crédito</TabsTrigger>
        </TabsList>

        <TabsContent value="listado" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {loadingList ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : notas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No hay notas de crédito</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-3 font-medium">Número</th>
                        <th className="text-left py-2 px-3 font-medium">Fecha</th>
                        <th className="text-left py-2 px-3 font-medium">Tipo</th>
                        <th className="text-left py-2 px-3 font-medium">Cliente</th>
                        <th className="text-right py-2 px-3 font-medium">Total</th>
                        <th className="text-left py-2 px-3 font-medium">Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notas.map((n) => (
                        <tr key={n.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2 px-3 font-mono text-xs">{n.numero}</td>
                          <td className="py-2 px-3">{n.fecha}</td>
                          <td className="py-2 px-3">
                            <Badge variant="secondary">{n.tipo_comprobante}</Badge>
                          </td>
                          <td className="py-2 px-3">{n.clientes?.nombre || "-"}</td>
                          <td className="py-2 px-3 text-right font-semibold">
                            {formatCurrency(n.total)}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground text-xs max-w-[200px] truncate">
                            {n.observacion || "-"}
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

        <TabsContent value="nueva" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Client & Origin */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Cliente</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar cliente..."
                          value={clientSearch}
                          onChange={(e) => {
                            setClientSearch(e.target.value);
                            if (clientId) {
                              setClientId("");
                              setOrigenId("");
                              setItems([]);
                            }
                          }}
                          className="pl-9"
                        />
                        {!clientId && clientSearch.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                            {filteredClients.slice(0, 10).map((c) => (
                              <button
                                key={c.id}
                                className="w-full text-left px-3 py-2 hover:bg-muted text-sm transition-colors"
                                onClick={() => {
                                  setClientId(c.id);
                                  setClientSearch(c.nombre);
                                }}
                              >
                                {c.nombre}
                              </button>
                            ))}
                            {filteredClients.length === 0 && (
                              <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
                            )}
                          </div>
                        )}
                        {clientId && (
                          <button
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setClientId("");
                              setClientSearch("");
                              setOrigenId("");
                              setItems([]);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Comprobante de origen (opcional)
                      </Label>
                      <Select value={origenId} onValueChange={(v) => { setOrigenId(v || ""); setItems([]); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin referencia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin referencia</SelectItem>
                          {clientVentas.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.tipo_comprobante} {v.numero} - {formatCurrency(v.total)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {selectedClient && (
                    <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
                      <span>CUIT: {selectedClient.cuit || "-"}</span>
                      <span>IVA: {selectedClient.situacion_iva}</span>
                      <span>Factura: {selectedClient.tipo_factura || "B"}</span>
                      <span>Saldo: {formatCurrency(selectedClient.saldo)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Items */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Items a devolver</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFreeText(true)}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Texto libre
                      </Button>
                      {(!origenId || origenId === "none") && (
                        <Button size="sm" onClick={() => setSearchOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Agregar producto
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <RotateCcw className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No hay items cargados</p>
                      <p className="text-xs mt-1">
                        {origenId && origenId !== "none"
                          ? "Todos los productos de este comprobante ya fueron devueltos"
                          : "Seleccione un comprobante de origen o agregue productos manualmente"}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-2 px-3 font-medium w-24">Código</th>
                            <th className="text-left py-2 px-3 font-medium">Descripción</th>
                            <th className="text-center py-2 px-3 font-medium w-20">Cant</th>
                            <th className="text-right py-2 px-3 font-medium w-28">Precio</th>
                            <th className="text-right py-2 px-3 font-medium w-28">Subtotal</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr key={item.id} className="border-b last:border-0">
                              <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                                {item.code}
                              </td>
                              <td className="py-2 px-3">
                                <p className="font-medium">{item.description}</p>
                              </td>
                              <td className="py-2 px-3">
                                <Input
                                  type="number"
                                  value={item.qty}
                                  onChange={(e) =>
                                    updateQty(item.id, Number(e.target.value))
                                  }
                                  className="w-16 text-center h-8 mx-auto"
                                  min={1}
                                  max={item.maxQty}
                                />
                              </td>
                              <td className="py-2 px-3">
                                <Input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) =>
                                    updatePrice(item.id, Number(e.target.value))
                                  }
                                  className="w-24 text-right h-8 ml-auto"
                                  min={0}
                                />
                              </td>
                              <td className="py-2 px-3 text-right font-semibold">
                                {formatCurrency(item.subtotal)}
                              </td>
                              <td className="py-2 px-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeItem(item.id)}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Observacion */}
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Motivo / Observación
                  </Label>
                  <Textarea
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    placeholder="Motivo de la nota de crédito..."
                    rows={3}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resumen NC</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tipo</span>
                    <Badge variant="secondary">
                      Nota de Crédito {getTipoFactura(selectedClient)}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items</span>
                    <span>{items.length}</span>
                  </div>
                  {origenId && origenId !== "none" && (() => {
                    const origenVenta = clientVentas.find((v) => v.id === origenId);
                    return origenVenta?.forma_pago ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Devolución vía</span>
                        <Badge variant="outline">{origenVenta.forma_pago}</Badge>
                      </div>
                    ) : null;
                  })()}
                  {selectedClient && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Saldo actual</span>
                      <span className={selectedClient.saldo > 0 ? "text-red-500 font-medium" : selectedClient.saldo < 0 ? "text-emerald-500 font-medium" : ""}>
                        {formatCurrency(selectedClient.saldo)}
                      </span>
                    </div>
                  )}
                  {selectedClient && total > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Saldo después NC</span>
                      {(() => {
                        const nuevoSaldo = (selectedClient.saldo || 0) - total;
                        return (
                          <span className={nuevoSaldo < 0 ? "text-emerald-500 font-semibold" : nuevoSaldo > 0 ? "text-red-500 font-medium" : "text-muted-foreground"}>
                            {formatCurrency(nuevoSaldo)}
                            {nuevoSaldo < 0 && <span className="text-xs ml-1">(a favor)</span>}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSave}
                disabled={!clientId || items.length === 0 || saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileMinus className="w-4 h-4 mr-2" />
                )}
                Emitir Nota de Crédito
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Product search dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buscar producto</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código o descripción..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {filteredProducts.slice(0, 20).map((p) => (
              <button
                key={p.id}
                onClick={() => addItem(p)}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {p.codigo}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(p.precio)}</p>
                  <p className="text-xs text-muted-foreground">Stock: {p.stock}</p>
                </div>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No se encontraron productos
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Free text dialog */}
      <Dialog open={freeText} onOpenChange={setFreeText}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar concepto libre</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={freeDesc}
                onChange={(e) => setFreeDesc(e.target.value)}
                placeholder="Descripción del concepto"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  value={freeQty}
                  onChange={(e) => setFreeQty(Number(e.target.value))}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Precio unitario</Label>
                <Input
                  type="number"
                  value={freePrice}
                  onChange={(e) => setFreePrice(Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>
            <Button className="w-full" onClick={addFreeItem}>
              Agregar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success dialog */}
      <Dialog open={!!successMsg} onOpenChange={(open) => !open && setSuccessMsg("")}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            </div>
            <p className="text-sm">{successMsg}</p>
            <Button className="w-full" onClick={() => setSuccessMsg("")}>Aceptar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
