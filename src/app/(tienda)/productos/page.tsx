"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { showToast } from "@/components/tienda/toast";
import { supabase } from "@/lib/supabase";
import {
  Search,
  SlidersHorizontal,
  Grid,
  List,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShoppingCart,
  X,
  Heart,
  Minus,
  Plus,
} from "lucide-react";

const PER_PAGE = 12;

const formatPrice = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(value);

interface Categoria {
  id: string;
  nombre: string;
  count?: number;
}

interface Subcategoria {
  id: string;
  nombre: string;
  categoria_id: string;
  count?: number;
}

interface Marca {
  id: string;
  nombre: string;
  count?: number;
}

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  imagen_url: string | null;
  categoria_id: string;
  subcategoria_id: string | null;
  marca_id: string | null;
  stock: number;
  created_at: string;
  categorias: { nombre: string } | null;
  marcas: { nombre: string } | null;
}

/* ───── Skeleton loader ───── */
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden animate-pulse">
          <div className="aspect-[4/3] bg-gray-100" />
          <div className="p-4 space-y-3">
            <div className="h-3 w-16 bg-gray-100 rounded-full" />
            <div className="space-y-1.5">
              <div className="h-3.5 bg-gray-100 rounded-full w-full" />
              <div className="h-3.5 bg-gray-100 rounded-full w-2/3" />
            </div>
            <div className="h-5 w-24 bg-gray-100 rounded-full" />
            <div className="h-10 bg-gray-100 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───── Pagination helpers ───── */
function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [];
  pages.push(1);
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

function ProductosContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [categoriasShowAll, setCategoriasShowAll] = useState(false);
  const [marcasShowAll, setMarcasShowAll] = useState(false);
  const [allSubcategorias, setAllSubcategorias] = useState<Subcategoria[]>([]);
  const [categoriasCollapsed, setCategoriasCollapsed] = useState(false);
  const [marcasCollapsed, setMarcasCollapsed] = useState(false);
  const [presentacionesMap, setPresentacionesMap] = useState<Record<string, { nombre: string; cantidad: number; precio: number }[]>>({});
  const [selectedPres, setSelectedPres] = useState<Record<string, number>>({}); // productId -> presentacion index
  const [cartUnits, setCartUnits] = useState<Record<string, number>>({}); // productId -> total units in cart

  // Sync cart units
  useEffect(() => {
    function syncCart() {
      const stored = localStorage.getItem("carrito");
      const carrito: { id: string; cantidad: number }[] = stored ? JSON.parse(stored) : [];
      const map: Record<string, number> = {};
      carrito.forEach((item) => {
        const parts = item.id.split("_");
        const prodId = parts[0];
        const match = item.id.match(/Caja \(x(\d+)\)/);
        const units = match ? Number(match[1]) : 1;
        map[prodId] = (map[prodId] || 0) + item.cantidad * units;
      });
      setCartUnits(map);
    }
    syncCart();
    window.addEventListener("cart-updated", syncCart);
    return () => window.removeEventListener("cart-updated", syncCart);
  }, []);

  // Price inputs local state for "Aplicar" button
  const [localPrecioMin, setLocalPrecioMin] = useState("");
  const [localPrecioMax, setLocalPrecioMax] = useState("");

  // Read filters from URL
  const categoriaId = searchParams.get("categoria");
  const subcategoriaId = searchParams.get("subcategoria");
  const marcaParam = searchParams.get("marca");
  const searchQuery = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "recientes";
  const page = Number(searchParams.get("page") || "1");
  const precioMin = searchParams.get("precio_min") || "";
  const precioMax = searchParams.get("precio_max") || "";
  const disponibilidad = searchParams.get("disponibilidad") || "";

  // Sync local price inputs with URL
  useEffect(() => {
    setLocalPrecioMin(precioMin);
    setLocalPrecioMax(precioMax);
  }, [precioMin, precioMax]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      if (!("page" in updates)) {
        params.delete("page");
      }
      router.push(`?${params.toString()}`);
    },
    [searchParams, router]
  );

  // Fetch categorias with counts
  useEffect(() => {
    async function load() {
      const { data: cats } = await supabase
        .from("categorias")
        .select("id, nombre");
      if (!cats) return;

      const { data: prods } = await supabase
        .from("productos")
        .select("categoria_id");

      const countMap: Record<string, number> = {};
      prods?.forEach((p: { categoria_id: string }) => {
        countMap[p.categoria_id] = (countMap[p.categoria_id] || 0) + 1;
      });

      setCategorias(
        cats.map((c: { id: string; nombre: string }) => ({
          ...c,
          count: countMap[c.id] || 0,
        }))
      );
    }
    load();
  }, []);

  // Fetch ALL subcategorias with counts
  useEffect(() => {
    async function loadSubs() {
      const { data: subs } = await supabase
        .from("subcategorias")
        .select("id, nombre, categoria_id");
      if (!subs) return;

      const { data: prods } = await supabase
        .from("productos")
        .select("subcategoria_id");

      const countMap: Record<string, number> = {};
      prods?.forEach((p: { subcategoria_id: string | null }) => {
        if (p.subcategoria_id) {
          countMap[p.subcategoria_id] = (countMap[p.subcategoria_id] || 0) + 1;
        }
      });

      const subsWithCounts = subs.map((s: { id: string; nombre: string; categoria_id: string }) => ({
        ...s,
        count: countMap[s.id] || 0,
      }));
      setAllSubcategorias(subsWithCounts);
      // Keep old subcategorias for backward compat with filtered subcats
      if (categoriaId) {
        setSubcategorias(subsWithCounts.filter((s: Subcategoria) => s.categoria_id === categoriaId));
      }
    }
    loadSubs();
  }, [categoriaId]);

  // Auto-expand selected category
  useEffect(() => {
    if (categoriaId) {
      setExpandedCats((prev) => {
        const next = new Set(prev);
        next.add(categoriaId);
        return next;
      });
    }
  }, [categoriaId]);

  // Fetch marcas with counts
  useEffect(() => {
    async function loadMarcas() {
      const { data: marcasList } = await supabase
        .from("marcas")
        .select("id, nombre");
      if (!marcasList) return;

      const { data: prods } = await supabase
        .from("productos")
        .select("marca_id");

      const countMap: Record<string, number> = {};
      prods?.forEach((p: { marca_id: string | null }) => {
        if (p.marca_id) {
          countMap[p.marca_id] = (countMap[p.marca_id] || 0) + 1;
        }
      });

      setMarcas(
        marcasList.map((m: { id: string; nombre: string }) => ({
          ...m,
          count: countMap[m.id] || 0,
        }))
      );
    }
    loadMarcas();
  }, []);

  // Fetch products
  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("productos")
        .select("*, categorias(nombre), marcas(nombre)", { count: "exact" });

      if (categoriaId) query = query.eq("categoria_id", categoriaId);
      if (subcategoriaId)
        query = query.eq("subcategoria_id", subcategoriaId);
      if (marcaParam)
        query = query.eq("marca_id", marcaParam);
      if (searchQuery)
        query = query.ilike("nombre", `%${searchQuery}%`);
      if (precioMin) query = query.gte("precio", Number(precioMin));
      if (precioMax) query = query.lte("precio", Number(precioMax));
      if (disponibilidad === "en_stock") query = query.gt("stock", 0);
      if (disponibilidad === "sin_stock") query = query.eq("stock", 0);

      switch (sort) {
        case "precio_asc":
          query = query.order("precio", { ascending: true });
          break;
        case "precio_desc":
          query = query.order("precio", { ascending: false });
          break;
        case "az":
          query = query.order("nombre", { ascending: true });
          break;
        default:
          query = query.order("created_at", { ascending: false });
      }

      const from = (page - 1) * PER_PAGE;
      query = query.range(from, from + PER_PAGE - 1);

      const { data, count } = await query;
      setProductos((data as Producto[]) || []);
      setTotal(count || 0);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaId, subcategoriaId, marcaParam, searchQuery, sort, page, precioMin, precioMax, disponibilidad]);

  // Fetch presentaciones for displayed products
  useEffect(() => {
    async function loadPresentaciones() {
      if (productos.length === 0) { setPresentacionesMap({}); return; }
      const ids = productos.map((p) => p.id);
      const { data } = await supabase
        .from("presentaciones")
        .select("producto_id, nombre, cantidad, precio")
        .in("producto_id", ids)
        .order("cantidad");
      const map: Record<string, { nombre: string; cantidad: number; precio: number }[]> = {};
      (data || []).forEach((pr: { producto_id: string; nombre: string; cantidad: number; precio: number }) => {
        if (!map[pr.producto_id]) map[pr.producto_id] = [];
        map[pr.producto_id].push({ nombre: pr.nombre, cantidad: pr.cantidad, precio: pr.precio });
      });
      setPresentacionesMap(map);
    }
    loadPresentaciones();
  }, [productos]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const activeCategoryName = categorias.find(
    (c) => c.id === categoriaId
  )?.nombre;

  const [quantities, setQuantities] = useState<Record<string, number>>({});

  function getQty(id: string) {
    return quantities[id] ?? 1;
  }

  function setQty(id: string, val: number) {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, val) }));
  }

  function getActivePrice(producto: Producto) {
    const pres = presentacionesMap[producto.id];
    if (pres && pres.length > 1) {
      const idx = selectedPres[producto.id] ?? 0;
      return pres[idx]?.precio ?? producto.precio;
    }
    return producto.precio;
  }

  function getActivePresLabel(producto: Producto) {
    const pres = presentacionesMap[producto.id];
    if (pres && pres.length > 1) {
      const idx = selectedPres[producto.id] ?? 0;
      const p = pres[idx];
      return p.cantidad === 1 ? "Unidad" : `Caja (x${p.cantidad})`;
    }
    return null;
  }

  function addToCart(producto: Producto, qty?: number) {
    const amount = qty ?? getQty(producto.id);
    const price = getActivePrice(producto);
    const presLabel = getActivePresLabel(producto);
    const cartKey = presLabel ? `${producto.id}_${presLabel}` : producto.id;
    const stored = localStorage.getItem("carrito");
    const carrito: { id: string; nombre: string; precio: number; imagen_url: string | null; cantidad: number; presentacion?: string }[] = stored
      ? JSON.parse(stored)
      : [];
    const existing = carrito.find((item) => item.id === cartKey);
    if (existing) {
      existing.cantidad += amount;
    } else {
      carrito.push({
        id: cartKey,
        nombre: presLabel ? `${producto.nombre} - ${presLabel}` : producto.nombre,
        precio: price,
        imagen_url: producto.imagen_url,
        cantidad: amount,
        presentacion: presLabel || undefined,
      });
    }
    localStorage.setItem("carrito", JSON.stringify(carrito));
    window.dispatchEvent(new Event("cart-updated"));
    showToast(`${producto.nombre} se agregó al carrito`);
    setQuantities((prev) => ({ ...prev, [producto.id]: 1 }));
  }

  function selectMarca(marcaId: string) {
    const isSame = marcaParam === marcaId;
    updateParams({ marca: isSame ? null : String(marcaId) });
  }

  /* ───── Active filter count ───── */
  const activeFilterCount =
    (categoriaId ? 1 : 0) +
    (subcategoriaId ? 1 : 0) +
    (marcaParam ? 1 : 0) +
    (precioMin ? 1 : 0) +
    (precioMax ? 1 : 0) +
    (searchQuery ? 1 : 0) +
    (disponibilidad ? 1 : 0);

  const activeSubcategoryName = allSubcategorias.find(
    (s) => s.id === subcategoriaId
  )?.nombre;

  function toggleExpand(catId: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  /* ───── Custom radio component ───── */
  const RadioCircle = ({ selected }: { selected: boolean }) => (
    <span
      className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
        selected ? "border-pink-600" : "border-gray-300"
      }`}
    >
      {selected && <span className="w-2.5 h-2.5 rounded-full bg-pink-600" />}
    </span>
  );

  /* ───── Sidebar content ───── */
  const sidebarContent = (
    <div className="space-y-6">
      {/* Active filters chips */}
      {activeFilterCount > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
            Filtros activos:
          </h4>
          <div className="flex flex-wrap gap-2">
            {categoriaId && activeCategoryName && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-50 text-pink-600 rounded-full px-3 py-1.5">
                {activeCategoryName}
                <button
                  onClick={() => updateParams({ categoria: null, subcategoria: null })}
                  className="hover:bg-pink-100 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {subcategoriaId && activeSubcategoryName && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-50 text-pink-600 rounded-full px-3 py-1.5">
                {activeSubcategoryName}
                <button
                  onClick={() => updateParams({ subcategoria: null })}
                  className="hover:bg-pink-100 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {marcaParam && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-50 text-pink-600 rounded-full px-3 py-1.5">
                {marcas.find((m) => m.id === marcaParam)?.nombre || "Marca"}
                <button
                  onClick={() => updateParams({ marca: null })}
                  className="hover:bg-pink-100 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {(precioMin || precioMax) && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-50 text-pink-600 rounded-full px-3 py-1.5">
                Precio{precioMin ? ` desde ${formatPrice(Number(precioMin))}` : ""}{precioMax ? ` hasta ${formatPrice(Number(precioMax))}` : ""}
                <button
                  onClick={() => updateParams({ precio_min: null, precio_max: null })}
                  className="hover:bg-pink-100 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {disponibilidad && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-50 text-pink-600 rounded-full px-3 py-1.5">
                {disponibilidad === "en_stock" ? "En stock" : "Sin stock"}
                <button
                  onClick={() => updateParams({ disponibilidad: null })}
                  className="hover:bg-pink-100 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-50 text-pink-600 rounded-full px-3 py-1.5">
                &quot;{searchQuery}&quot;
                <button
                  onClick={() => updateParams({ q: null })}
                  className="hover:bg-pink-100 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Buscar</h4>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar productos..."
            defaultValue={searchQuery}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                updateParams({ q: (e.target as HTMLInputElement).value || null });
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 placeholder:text-gray-400"
          />
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* Categorias - Tree style */}
      <div>
        <button
          onClick={() => setCategoriasCollapsed(!categoriasCollapsed)}
          className="flex items-center justify-between w-full mb-3"
        >
          <div className="flex items-center gap-2">
            <h4 className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
              Categorias
            </h4>
            <span className="text-[10px] bg-gray-100 text-gray-400 rounded-full px-1.5 py-0.5 font-medium">
              {categorias.length}
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              categoriasCollapsed ? "-rotate-90" : ""
            }`}
          />
        </button>

        {!categoriasCollapsed && (
          <div className="space-y-0.5">
            {/* "Todas" option */}
            <button
              onClick={() => updateParams({ categoria: null, subcategoria: null })}
              className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer w-full transition-colors"
            >
              <RadioCircle selected={!categoriaId} />
              <span className={`text-sm ${!categoriaId ? "font-semibold text-pink-600" : "text-gray-600"}`}>
                Todas
              </span>
              <span className="text-gray-400 text-sm ml-auto">
                ({categorias.reduce((sum, c) => sum + (c.count || 0), 0)})
              </span>
            </button>

            <div className={categoriasShowAll ? "max-h-[200px] overflow-y-auto space-y-0.5" : "space-y-0.5"}>
            {(categoriasShowAll ? categorias : categorias.slice(0, 5)).map((cat) => {
              const isSelected = categoriaId === cat.id;
              const isExpanded = expandedCats.has(cat.id);
              const catSubs = allSubcategorias.filter(
                (s) => s.categoria_id === cat.id
              );
              const hasSubcats = catSubs.length > 0;

              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-1 w-full">
                    {/* Expand chevron */}
                    {hasSubcats ? (
                      <button
                        onClick={() => toggleExpand(cat.id)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors shrink-0"
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </button>
                    ) : (
                      <span className="w-[26px] shrink-0" />
                    )}

                    {/* Category row */}
                    <button
                      onClick={() => {
                        updateParams({
                          categoria: String(cat.id),
                          subcategoria: null,
                        });
                        if (hasSubcats && !isExpanded) {
                          toggleExpand(cat.id);
                        }
                      }}
                      className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer flex-1 min-w-0 transition-colors"
                    >
                      <RadioCircle selected={isSelected} />
                      <span
                        className={`text-sm truncate ${
                          isSelected ? "font-semibold text-pink-600" : "text-gray-600"
                        }`}
                      >
                        {cat.nombre}
                      </span>
                      <span className="text-gray-400 text-sm ml-auto shrink-0">
                        ({cat.count})
                      </span>
                    </button>
                  </div>

                  {/* Subcategories */}
                  {isExpanded && hasSubcats && (
                    <div className="ml-8 space-y-0.5">
                      {catSubs.map((sub) => {
                        const subSelected = subcategoriaId === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() =>
                              updateParams({
                                categoria: String(cat.id),
                                subcategoria: String(sub.id),
                              })
                            }
                            className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer w-full transition-colors"
                          >
                            <RadioCircle selected={subSelected} />
                            <span
                              className={`text-sm truncate ${
                                subSelected
                                  ? "font-semibold text-pink-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {sub.nombre}
                            </span>
                            <span className="text-gray-400 text-sm ml-auto shrink-0">
                              ({sub.count})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            </div>

            {categorias.length > 5 && (
              <button
                onClick={() => setCategoriasShowAll(!categoriasShowAll)}
                className="text-sm text-pink-600 hover:text-pink-700 font-medium mt-2 px-2"
              >
                {categoriasShowAll ? "Ver menos" : "Ver más"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100" />

      {/* Marcas */}
      {marcas.length > 0 && (
        <>
          <div>
            <button
              onClick={() => setMarcasCollapsed(!marcasCollapsed)}
              className="flex items-center justify-between w-full mb-3"
            >
              <div className="flex items-center gap-2">
                <h4 className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
                  Marcas
                </h4>
                <span className="text-[10px] bg-gray-100 text-gray-400 rounded-full px-1.5 py-0.5 font-medium">
                  {marcas.length}
                </span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                  marcasCollapsed ? "-rotate-90" : ""
                }`}
              />
            </button>

            {!marcasCollapsed && (
              <div className="space-y-0.5">
                {/* "Todas las marcas" option */}
                <button
                  onClick={() => updateParams({ marca: null })}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer w-full transition-colors"
                >
                  <RadioCircle selected={!marcaParam} />
                  <span className={`text-sm ${!marcaParam ? "font-semibold text-pink-600" : "text-gray-600"}`}>
                    Todas las marcas
                  </span>
                  <span className="text-gray-400 text-sm ml-auto">
                    ({marcas.reduce((sum, m) => sum + (m.count || 0), 0)})
                  </span>
                </button>

                <div className={marcasShowAll ? "max-h-[200px] overflow-y-auto space-y-0.5" : "space-y-0.5"}>
                {(marcasShowAll ? marcas : marcas.slice(0, 5)).map((marca) => {
                  const isSelected = marcaParam === marca.id;
                  return (
                    <button
                      key={marca.id}
                      onClick={() => selectMarca(marca.id)}
                      className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer w-full transition-colors"
                    >
                      <RadioCircle selected={isSelected} />
                      <span
                        className={`text-sm truncate ${
                          isSelected ? "font-semibold text-pink-600" : "text-gray-600"
                        }`}
                      >
                        {marca.nombre}
                      </span>
                      <span className="text-gray-400 text-sm ml-auto shrink-0">
                        ({marca.count})
                      </span>
                    </button>
                  );
                })}
                </div>

                {marcas.length > 5 && (
                  <button
                    onClick={() => setMarcasShowAll(!marcasShowAll)}
                    className="text-sm text-pink-600 hover:text-pink-700 font-medium mt-2 px-2"
                  >
                    {marcasShowAll ? "Ver menos" : "Ver más"}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="border-t border-gray-100" />
        </>
      )}

      {/* Disponibilidad */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Disponibilidad</h4>
        <div className="space-y-0.5">
          {[
            { value: "", label: "Todos" },
            { value: "en_stock", label: "En stock" },
            { value: "sin_stock", label: "Sin stock" },
          ].map((opt) => {
            const isSelected = disponibilidad === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => updateParams({ disponibilidad: opt.value || null })}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer w-full transition-colors"
              >
                <RadioCircle selected={isSelected} />
                <span className={`text-sm ${isSelected ? "font-semibold text-pink-600" : "text-gray-600"}`}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* Precio */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Precio</h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={localPrecioMin}
            onChange={(e) => setLocalPrecioMin(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-gray-50 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 placeholder:text-gray-400"
          />
          <span className="text-gray-300 text-sm shrink-0">a</span>
          <input
            type="number"
            placeholder="Max"
            value={localPrecioMax}
            onChange={(e) => setLocalPrecioMax(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-gray-50 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 placeholder:text-gray-400"
          />
        </div>
        <button
          onClick={() =>
            updateParams({
              precio_min: localPrecioMin || null,
              precio_max: localPrecioMax || null,
            })
          }
          className="mt-2.5 w-full text-xs font-semibold text-pink-600 bg-pink-50 hover:bg-pink-100 rounded-lg py-2 transition-colors"
        >
          Aplicar
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* ─── Breadcrumb ─── */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-pink-600 transition-colors">
          Inicio
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/productos" className="hover:text-pink-600 transition-colors">
          Productos
        </Link>
        {activeCategoryName && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-700 font-medium">{activeCategoryName}</span>
          </>
        )}
      </nav>

      {/* ─── Title row ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {activeCategoryName || "Productos"}
          </h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-1">
              {total} {total === 1 ? "resultado" : "resultados"}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Mobile filter button */}
          <button
            onClick={() => setMobileFilters(true)}
            className="md:hidden flex items-center gap-2 text-sm font-medium bg-white border border-gray-200 rounded-xl px-4 py-2.5 hover:border-gray-300 transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </button>

          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            className="text-sm bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent appearance-none cursor-pointer pr-8 font-medium text-gray-700"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
            }}
          >
            <option value="recientes">Mas recientes</option>
            <option value="precio_asc">Menor precio</option>
            <option value="precio_desc">Mayor precio</option>
            <option value="az">A-Z</option>
          </select>

          <div className="hidden sm:flex bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setView("grid")}
              className={`p-2.5 transition-colors ${
                view === "grid"
                  ? "bg-pink-50 text-pink-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2.5 transition-colors ${
                view === "list"
                  ? "bg-pink-50 text-pink-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main layout ─── */}
      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-24">
            {sidebarContent}
          </div>
        </aside>

        {/* Mobile filter drawer */}
        {mobileFilters && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setMobileFilters(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-lg text-gray-900">Filtros</h2>
                <button
                  onClick={() => setMobileFilters(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {sidebarContent}
              </div>
              <div className="p-5 border-t border-gray-100">
                <button
                  onClick={() => setMobileFilters(false)}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Aplicar Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Products */}
          {loading ? (
            <SkeletonGrid />
          ) : productos.length === 0 ? (
            /* ─── Empty state ─── */
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center mb-6">
                <Package className="h-12 w-12 text-gray-200" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No encontramos productos
              </h3>
              <p className="text-gray-400 mb-6">
                Intenta con otros filtros o terminos de busqueda
              </p>
              <button
                onClick={() => router.push("/productos")}
                className="text-sm font-semibold text-pink-600 bg-pink-50 hover:bg-pink-100 px-6 py-2.5 rounded-xl transition-colors"
              >
                Limpiar filtros
              </button>
            </div>
          ) : view === "grid" ? (
            /* ─── Grid view ─── */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {productos.map((producto) => {
                const qty = getQty(producto.id);
                const pres = presentacionesMap[producto.id];
                const activePrice = pres && pres.length > 1 ? (pres[selectedPres[producto.id] ?? 0]?.precio ?? producto.precio) : producto.precio;
                const availableStock = Math.max(0, producto.stock - (cartUnits[producto.id] || 0));
                return (
                  <div
                    key={producto.id}
                    className="group rounded-2xl border border-gray-100 bg-white overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300 flex flex-col"
                  >
                    {/* Image */}
                    <Link href={`/productos/${producto.id}`} className="relative">
                      <div className="aspect-square bg-gray-50 overflow-hidden">
                        {producto.imagen_url ? (
                          <img
                            src={producto.imagen_url}
                            alt={producto.nombre}
                            className="w-full h-full object-contain p-6 group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-14 w-14 text-gray-200" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                      >
                        <Heart className="w-4 h-4 text-gray-400 hover:text-pink-500 transition-colors" />
                      </button>
                    </Link>

                    {/* Info */}
                    <Link href={`/productos/${producto.id}`} className="px-4 pt-3 pb-1">
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-1">
                        {producto.categorias?.nombre && (
                          <span>{producto.categorias.nombre}</span>
                        )}
                        {producto.categorias?.nombre && producto.marcas?.nombre && (
                          <span className="text-gray-300">|</span>
                        )}
                        {producto.marcas?.nombre && (
                          <span>{producto.marcas.nombre}</span>
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-gray-800 line-clamp-2 min-h-[2.5rem] leading-tight">
                        {producto.nombre}
                      </h3>
                    </Link>

                    <div className="px-4 pb-4 flex-1 flex flex-col justify-end">
                      <p className="text-lg font-bold text-gray-900 mb-2">
                        {formatPrice(activePrice)}
                      </p>

                      {/* Presentacion pills */}
                      {pres && pres.length > 1 && (() => {
                        const activeIdx = selectedPres[producto.id] ?? 0;
                        return (
                        <div className="flex gap-1.5 mb-3">
                          {pres.map((pr, idx) => {
                            const isActive = activeIdx === idx;
                            const label = pr.cantidad === 1 ? "Unidad" : `Caja (x${pr.cantidad})`;
                            const presDisabled = Math.floor(availableStock / Number(pr.cantidad)) <= 0;
                            return (
                              <button
                                key={idx}
                                disabled={presDisabled}
                                onClick={() => {
                                  setSelectedPres((prev) => ({ ...prev, [producto.id]: idx }));
                                  const newMax = Math.floor(availableStock / Number(pr.cantidad));
                                  if (qty > newMax) setQuantities((prev) => ({ ...prev, [producto.id]: Math.max(1, newMax) }));
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                  presDisabled
                                    ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                                    : isActive
                                    ? "bg-pink-600 text-white border-pink-600"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-pink-300"
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        );
                      })()}

                      {/* Quantity + Add to cart */}
                      {(() => {
                        const activePres = pres && pres.length > 1 ? pres[selectedPres[producto.id] ?? 0] : null;
                        const presUnits = activePres ? Number(activePres.cantidad) : 1;
                        const maxForPres = Math.floor(availableStock / presUnits);
                        const canBuy = maxForPres > 0;
                        return canBuy ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                            <button
                              onClick={() => setQty(producto.id, qty - 1)}
                              className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm font-medium tabular-nums">{qty}</span>
                            <button
                              onClick={() => setQty(producto.id, Math.min(qty + 1, maxForPres))}
                              disabled={qty >= maxForPres}
                              className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-30"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            onClick={() => addToCart(producto, qty)}
                            className="flex-1 bg-pink-600 hover:bg-pink-700 text-white text-sm py-2.5 rounded-xl font-semibold transition-colors"
                          >
                            Agregar {formatPrice(activePrice * qty)}
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled
                          className="w-full bg-gray-100 text-gray-400 text-sm py-2.5 rounded-xl font-medium cursor-not-allowed"
                        >
                          Sin stock
                        </button>
                      );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ─── List view ─── */
            <div className="space-y-3">
              {productos.map((producto) => {
                const qty = getQty(producto.id);
                const pres = presentacionesMap[producto.id];
                const activePrice = pres && pres.length > 1 ? (pres[selectedPres[producto.id] ?? 0]?.precio ?? producto.precio) : producto.precio;
                const availableStock = Math.max(0, producto.stock - (cartUnits[producto.id] || 0));
                return (
                  <div
                    key={producto.id}
                    className="group rounded-2xl border border-gray-100 bg-white overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300 flex gap-4"
                  >
                    <Link
                      href={`/productos/${producto.id}`}
                      className="shrink-0 w-32 h-32 bg-gray-50 overflow-hidden rounded-xl relative"
                    >
                      {producto.imagen_url ? (
                        <img
                          src={producto.imagen_url}
                          alt={producto.nombre}
                          className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-10 w-10 text-gray-200" />
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 py-4 pr-4 flex items-center justify-between gap-4 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-1">
                          {producto.categorias?.nombre && <span>{producto.categorias.nombre}</span>}
                          {producto.categorias?.nombre && producto.marcas?.nombre && <span className="text-gray-300">|</span>}
                          {producto.marcas?.nombre && <span>{producto.marcas.nombre}</span>}
                        </div>
                        <Link href={`/productos/${producto.id}`}>
                          <h3 className="font-medium text-gray-800 line-clamp-2 text-sm leading-tight">
                            {producto.nombre}
                          </h3>
                        </Link>
                        <p className="text-lg font-bold text-gray-900 mt-1">
                          {formatPrice(activePrice)}
                        </p>
                        {pres && pres.length > 1 && (
                          <div className="flex gap-1.5 mt-1.5">
                            {pres.map((pr, idx) => {
                              const isActive = (selectedPres[producto.id] ?? 0) === idx;
                              const label = pr.cantidad === 1 ? "Unidad" : `Caja (x${pr.cantidad})`;
                              const presDisabled = Math.floor(availableStock / Number(pr.cantidad)) <= 0;
                              return (
                                <button
                                  key={idx}
                                  disabled={presDisabled}
                                  onClick={() => {
                                    setSelectedPres((prev) => ({ ...prev, [producto.id]: idx }));
                                    const newMax = Math.floor(availableStock / Number(pr.cantidad));
                                    if (qty > newMax) setQuantities((prev) => ({ ...prev, [producto.id]: Math.max(1, newMax) }));
                                  }}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                                    presDisabled ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed" :
                                    isActive ? "bg-pink-600 text-white border-pink-600" : "bg-white text-gray-600 border-gray-200 hover:border-pink-300"
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {(() => {
                        const activePres = pres && pres.length > 1 ? pres[selectedPres[producto.id] ?? 0] : null;
                        const presUnits = activePres ? Number(activePres.cantidad) : 1;
                        const maxForPres = Math.floor(availableStock / presUnits);
                        const canBuy = maxForPres > 0;
                        return canBuy ? (
                        <div className="shrink-0 flex items-center gap-2">
                          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                            <button onClick={() => setQty(producto.id, qty - 1)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-medium tabular-nums">{qty}</span>
                            <button onClick={() => setQty(producto.id, Math.min(qty + 1, maxForPres))} disabled={qty >= maxForPres} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => addToCart(producto, qty)}
                            className="bg-pink-600 hover:bg-pink-700 text-white text-sm py-2.5 px-4 rounded-xl font-semibold transition-colors"
                          >
                            Agregar {formatPrice(activePrice * qty)}
                          </button>
                        </div>
                      ) : (
                        <button disabled className="shrink-0 bg-gray-100 text-gray-400 text-sm py-2.5 px-5 rounded-xl font-medium cursor-not-allowed">
                          Sin stock
                        </button>
                      );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── Pagination ─── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {getPageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="w-10 h-10 flex items-center justify-center text-gray-400 text-sm">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => updateParams({ page: String(p) })}
                    className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      page === p
                        ? "bg-pink-600 text-white shadow-md"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ProductosPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse mb-6" />
          <div className="flex gap-8">
            <div className="hidden md:block w-72 shrink-0">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 animate-pulse">
                <div className="h-10 bg-gray-100 rounded-xl" />
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-8 bg-gray-50 rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1">
              <SkeletonGrid />
            </div>
          </div>
        </div>
      }
    >
      <ProductosContent />
    </Suspense>
  );
}
