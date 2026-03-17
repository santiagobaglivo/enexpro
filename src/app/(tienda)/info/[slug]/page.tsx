import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const SLUG_TITLES: Record<string, string> = {
  "medios-de-pago": "Medios de pago",
  "envios": "Envíos",
  "como-comprar": "Cómo comprar",
  "como-registrarse": "Cómo registrarse",
  "faq": "Preguntas frecuentes",
  "terminos": "Términos y condiciones",
  "contacto": "Contacto",
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function InfoPage({ params }: Props) {
  const { slug } = await params;
  const titulo = SLUG_TITLES[slug] || slug;

  const { data } = await supabase
    .from("tienda_config")
    .select("footer_config")
    .limit(1)
    .single();

  const infoPages: { slug: string; contenido: string }[] =
    (data as any)?.footer_config?.info_pages || [];
  const page = infoPages.find((p) => p.slug === slug);
  const contenido = page?.contenido || "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver al inicio
      </Link>

      <h1 className="mb-6 text-3xl font-bold text-gray-900">{titulo}</h1>

      {contenido ? (
        <div
          className="prose prose-gray max-w-none"
          dangerouslySetInnerHTML={{ __html: contenido }}
        />
      ) : (
        <p className="text-gray-400 italic">
          Esta página aún no tiene contenido cargado.
        </p>
      )}
    </div>
  );
}
