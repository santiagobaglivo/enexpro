"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Layout,
  Instagram,
  Facebook,
  Phone,
  Mail,
  MapPin,
  Bell,
  Shield,
  Settings,
  Loader2,
  Check,
  BookOpen,
} from "lucide-react";

interface InfoPage {
  slug: string;
  titulo: string;
  contenido: string;
}

const INFO_PAGES_DEFAULT: InfoPage[] = [
  { slug: "medios-de-pago", titulo: "Medios de pago", contenido: "" },
  { slug: "envios", titulo: "Envíos", contenido: "" },
  { slug: "como-comprar", titulo: "Cómo comprar", contenido: "" },
  { slug: "como-registrarse", titulo: "Cómo registrarse", contenido: "" },
  { slug: "faq", titulo: "Preguntas frecuentes", contenido: "" },
  { slug: "terminos", titulo: "Términos y condiciones", contenido: "" },
  { slug: "contacto", titulo: "Contacto", contenido: "" },
];

interface FooterForm {
  direccion: string;
  telefono: string;
  email: string;
  instagram_url: string;
  facebook_url: string;
  whatsapp_url: string;
  mostrar_newsletter: boolean;
  badges: string[];
  info_pages: InfoPage[];
}

const DEFAULT_FORM: FooterForm = {
  direccion: "",
  telefono: "",
  email: "",
  instagram_url: "",
  facebook_url: "",
  whatsapp_url: "",
  mostrar_newsletter: true,
  badges: [
    "Envío a domicilio",
    "Compra segura",
    "Múltiples medios de pago",
    "Atención personalizada",
  ],
  info_pages: INFO_PAGES_DEFAULT,
};

type Section = "contacto" | "newsletter" | "badges" | "info";

const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "contacto", label: "Contacto y Redes", icon: <MapPin className="w-4 h-4" /> },
  { key: "newsletter", label: "Newsletter", icon: <Bell className="w-4 h-4" /> },
  { key: "badges", label: "Badges de confianza", icon: <Shield className="w-4 h-4" /> },
  { key: "info", label: "Información General", icon: <BookOpen className="w-4 h-4" /> },
];

export default function FooterConfigPage() {
  const [form, setForm] = useState<FooterForm>(DEFAULT_FORM);
  const [configId, setConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("contacto");
  const [activeInfoSlug, setActiveInfoSlug] = useState(INFO_PAGES_DEFAULT[0].slug);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tienda_config")
      .select("id, footer_config")
      .limit(1)
      .single();

    if (data) {
      setConfigId(data.id);
      const fc = (data as any).footer_config || {};
      const savedPages: InfoPage[] = fc.info_pages || [];
      const mergedPages = INFO_PAGES_DEFAULT.map((def) => {
        const saved = savedPages.find((p) => p.slug === def.slug);
        return saved ? { ...def, contenido: saved.contenido } : def;
      });
      setForm({
        ...DEFAULT_FORM,
        ...fc,
        info_pages: mergedPages,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const update = <K extends keyof FooterForm>(key: K, value: FooterForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateBadge = (index: number, value: string) => {
    const badges = [...form.badges];
    badges[index] = value;
    update("badges", badges);
  };

  const updateInfoPage = (slug: string, contenido: string) => {
    const pages = form.info_pages.map((p) =>
      p.slug === slug ? { ...p, contenido } : p
    );
    update("info_pages", pages);
  };

  const save = async () => {
    if (!configId) return;
    setSaving(true);
    await supabase
      .from("tienda_config")
      .update({ footer_config: form })
      .eq("id", configId);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeInfoPage = form.info_pages.find((p) => p.slug === activeInfoSlug);

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Settings className="w-3.5 h-3.5" />
            <span>Configuración</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-foreground font-medium">Footer</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layout className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Configuración del Footer
              </h1>
              <p className="text-muted-foreground text-sm">
                Editá el pie de página y las páginas informativas de la tienda
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex px-6 lg:px-8 py-6 gap-6">
        {/* Sidebar nav */}
        <nav className="w-56 shrink-0 hidden md:block">
          <div className="sticky top-6 space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  activeSection === item.key
                    ? "bg-accent text-accent-foreground border-l-2 border-primary pl-[10px]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto md:hidden pb-2 self-start">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeSection === item.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 max-w-3xl space-y-6 pb-20">

          {/* ── CONTACTO Y REDES ── */}
          {activeSection === "contacto" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Información de contacto</CardTitle>
                  <CardDescription>Se muestra en el footer de la tienda</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Dirección
                    </Label>
                    <Input
                      value={form.direccion}
                      onChange={(e) => update("direccion", e.target.value)}
                      placeholder="Av. Corrientes 1234, Buenos Aires"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Teléfono
                    </Label>
                    <Input
                      value={form.telefono}
                      onChange={(e) => update("telefono", e.target.value)}
                      placeholder="+54 11 1234-5678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email
                    </Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="info@mitienda.com"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Redes sociales</CardTitle>
                  <CardDescription>Dejá vacío para ocultar el ícono</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Instagram className="w-3.5 h-3.5 text-muted-foreground" /> Instagram
                    </Label>
                    <Input
                      value={form.instagram_url}
                      onChange={(e) => update("instagram_url", e.target.value)}
                      placeholder="https://instagram.com/mitienda"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Facebook className="w-3.5 h-3.5 text-muted-foreground" /> Facebook
                    </Label>
                    <Input
                      value={form.facebook_url}
                      onChange={(e) => update("facebook_url", e.target.value)}
                      placeholder="https://facebook.com/mitienda"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" /> WhatsApp
                    </Label>
                    <Input
                      value={form.whatsapp_url}
                      onChange={(e) => update("whatsapp_url", e.target.value)}
                      placeholder="https://wa.me/5491112345678"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── NEWSLETTER ── */}
          {activeSection === "newsletter" && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-pink-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Sección Newsletter</p>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        Muestra u oculta la sección de suscripción por email en el footer
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => update("mostrar_newsletter", !form.mostrar_newsletter)}
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                      form.mostrar_newsletter ? "bg-emerald-500" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                        form.mostrar_newsletter ? "translate-x-8" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── BADGES ── */}
          {activeSection === "badges" && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Badges de confianza</CardTitle>
                <CardDescription>
                  Textos que se muestran en la barra inferior del footer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {form.badges.map((badge, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                      {i + 1}
                    </span>
                    <Input
                      value={badge}
                      onChange={(e) => updateBadge(i, e.target.value)}
                      placeholder={`Badge ${i + 1}`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── INFORMACIÓN GENERAL ── */}
          {activeSection === "info" && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Editá el contenido de cada página informativa de la tienda.
                    Los clientes acceden desde los links del footer.
                  </p>
                </CardContent>
              </Card>

              <div className="flex gap-4">
                {/* Page list */}
                <nav className="w-48 shrink-0 space-y-1">
                  {form.info_pages.map((page) => (
                    <button
                      key={page.slug}
                      onClick={() => setActiveInfoSlug(page.slug)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeInfoSlug === page.slug
                          ? "bg-accent text-accent-foreground font-medium border-l-2 border-primary pl-[10px]"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {page.titulo}
                    </button>
                  ))}
                </nav>

                {/* Editor */}
                {activeInfoPage && (
                  <div className="flex-1">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{activeInfoPage.titulo}</CardTitle>
                        <CardDescription>
                          URL: <code className="text-xs bg-muted px-1 py-0.5 rounded">/info/{activeInfoPage.slug}</code>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={activeInfoPage.contenido}
                          onChange={(e) => updateInfoPage(activeInfoPage.slug, e.target.value)}
                          placeholder={`Escribí aquí el contenido de "${activeInfoPage.titulo}"...`}
                          className="min-h-[320px] resize-none font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          Podés usar texto plano o HTML básico (&lt;b&gt;, &lt;ul&gt;, &lt;p&gt;, etc.)
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-end px-6 lg:px-8 py-3">
          <Button onClick={save} disabled={saving} className="min-w-[160px]">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  );
}
