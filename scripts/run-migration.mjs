import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "migrate.sql"), "utf-8");

const SUPABASE_URL = "https://oepqhdjuujfdlpjjktbs.supabase.co";
const SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lcHFoZGp1dWpmZGxwamprdGJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYxMzkyMiwiZXhwIjoyMDg5MTg5OTIyfQ.NTlLOzIFzVjaCFVWz6cYgwbM2YWU7m_lHn0x0iEwOAw";

// Use the pg_net or direct SQL execution via Supabase's /sql endpoint (management API)
// Alternative: use the database URL directly with pg

// First, let's try the Supabase Management API
const PROJECT_REF = "oepqhdjuujfdlpjjktbs";

// We'll use the Supabase dashboard SQL API
const res = await fetch(`${SUPABASE_URL}/sql`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
  },
  body: JSON.stringify({ query: sql }),
});

if (!res.ok) {
  const text = await res.text();
  console.error("HTTP error:", res.status, text.substring(0, 500));

  // Fallback: try pg endpoint
  console.log("\nTrying alternative approach via pg-meta...");
  const res2 = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res2.ok) {
    const text2 = await res2.text();
    console.error("pg-meta error:", res2.status, text2.substring(0, 500));
  } else {
    const data2 = await res2.json();
    console.log("Success via pg-meta:", JSON.stringify(data2).substring(0, 200));
  }
} else {
  const data = await res.json();
  console.log("Migration completed successfully!");
  console.log(JSON.stringify(data).substring(0, 200));
}
