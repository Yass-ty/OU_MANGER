// ============================================================
//  Où On Mange ? — Appwrite Database Setup Script
//  Crée la BDD, les collections et tous les attributs
// ============================================================

import fs from 'fs';
import path from 'path';

// Charger le fichier .env si présent localement
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      process.env[key.trim()] = value.trim();
    }
  });
}

const ENDPOINT    = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const PROJECT_ID  = process.env.APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DB_ID || "ou_on_mange";

if (!PROJECT_ID || !API_KEY) {
  console.error("\x1b[31m[ERR]\x1b[0m Les variables APPWRITE_PROJECT_ID ou APPWRITE_API_KEY ne sont pas définies. Vérifiez votre fichier .env.");
  process.exit(1);
}

const headers = {
  "Content-Type":    "application/json",
  "X-Appwrite-Project": PROJECT_ID,
  "X-Appwrite-Key":  API_KEY,
};

// Petit helper avec logs colorés
const log  = (msg) => console.log(`\x1b[36m[INFO]\x1b[0m  ${msg}`);
const ok   = (msg) => console.log(`\x1b[32m[OK]\x1b[0m    ${msg}`);
const err  = (msg) => console.log(`\x1b[31m[ERR]\x1b[0m   ${msg}`);
const warn = (msg) => console.log(`\x1b[33m[WARN]\x1b[0m  ${msg}`);

async function api(method, path, body = null) {
  const res = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    // 409 = already exists → on continue sans planter
    if (res.status === 409) {
      warn(`Déjà existant (skipped) : ${path}`);
      return { skipped: true, ...data };
    }
    err(`${method} ${path} → ${res.status} : ${data.message}`);
    throw new Error(data.message);
  }
  return data;
}

// Attendre qu'un attribut soit "available" (Appwrite est async)
async function waitForAttr(collectionId, key, maxTries = 10) {
  for (let i = 0; i < maxTries; i++) {
    await new Promise(r => setTimeout(r, 800));
    const res = await fetch(
      `${ENDPOINT}/databases/${DATABASE_ID}/collections/${collectionId}/attributes`,
      { headers }
    );
    const data = await res.json();
    const attr = data.attributes?.find(a => a.key === key);
    if (attr?.status === "available") return;
  }
  warn(`Attribut '${key}' pas encore disponible — on continue quand même`);
}

// ────────────────────────────────────────────────
async function main() {
  console.log("\n\x1b[1m🍽️  Où On Mange ? — Setup Appwrite\x1b[0m\n");

  // ── 1. BASE DE DONNÉES ──────────────────────────
  log("Création de la base de données 'ou_on_mange'...");
  await api("POST", "/databases", {
    databaseId: DATABASE_ID,
    name: "Où On Mange",
  });
  ok("Base de données créée ✓");

  // ── 2. COLLECTION : users ────────────────────────
  log("Création de la collection 'users'...");
  await api("POST", `/databases/${DATABASE_ID}/collections`, {
    collectionId: "users",
    name: "Users",
    permissions: [
      "create(\"any\")",
      "read(\"any\")",
      "update(\"any\")",
      "delete(\"any\")",
    ],
    documentSecurity: false,
  });
  ok("Collection 'users' créée ✓");

  // Attributs users
  const userAttrs = [
    { type: "string",  key: "device_id",  size: 255,  required: true  },
    { type: "string",  key: "prenom",     size: 100,  required: true  },
    { type: "string",  key: "avatar_emoji", size: 10, required: false, default: "🍽️" },
    { type: "datetime",key: "created_at",             required: false },
  ];

  for (const attr of userAttrs) {
    log(`  Attribut users.${attr.key}...`);
    const path = `/databases/${DATABASE_ID}/collections/users/attributes/${attr.type}`;
    const body = attr.type === "datetime"
      ? { key: attr.key, required: attr.required ?? false }
      : { key: attr.key, size: attr.size, required: attr.required, default: attr.default ?? null };
    await api("POST", path, body);
    await waitForAttr("users", attr.key);
    ok(`  users.${attr.key} ✓`);
  }

  // Index unique sur device_id
  log("  Index unique sur users.device_id...");
  await api("POST", `/databases/${DATABASE_ID}/collections/users/indexes`, {
    key: "idx_device_id",
    type: "unique",
    attributes: ["device_id"],
  });
  ok("  Index device_id ✓");

  // ── 3. COLLECTION : restaurants ─────────────────
  log("Création de la collection 'restaurants'...");
  await api("POST", `/databases/${DATABASE_ID}/collections`, {
    collectionId: "restaurants",
    name: "Restaurants",
    permissions: [
      "create(\"any\")",
      "read(\"any\")",
      "update(\"any\")",
      "delete(\"any\")",
    ],
    documentSecurity: false,
  });
  ok("Collection 'restaurants' créée ✓");

  // Attributs restaurants
  log("  Attributs de 'restaurants'...");

  // lien_video
  await api("POST", `/databases/${DATABASE_ID}/collections/restaurants/attributes/url`, {
    key: "lien_video", required: true,
  });
  await waitForAttr("restaurants", "lien_video");
  ok("  restaurants.lien_video ✓");

  // ajoute_par
  await api("POST", `/databases/${DATABASE_ID}/collections/restaurants/attributes/string`, {
    key: "ajoute_par", size: 100, required: true,
  });
  await waitForAttr("restaurants", "ajoute_par");
  ok("  restaurants.ajoute_par ✓");

  // user_id (référence souple)
  await api("POST", `/databases/${DATABASE_ID}/collections/restaurants/attributes/string`, {
    key: "user_id", size: 255, required: true,
  });
  await waitForAttr("restaurants", "user_id");
  ok("  restaurants.user_id ✓");

  // statut (enum)
  await api("POST", `/databases/${DATABASE_ID}/collections/restaurants/attributes/enum`, {
    key: "statut",
    elements: ["a_tester", "deja_fait", "valide"],
    required: true,
    default: "a_tester",
  });
  await waitForAttr("restaurants", "statut");
  ok("  restaurants.statut ✓");

  // nom_restaurant (optionnel — rempli par IA en V2)
  await api("POST", `/databases/${DATABASE_ID}/collections/restaurants/attributes/string`, {
    key: "nom_restaurant", size: 255, required: false, default: null,
  });
  await waitForAttr("restaurants", "nom_restaurant");
  ok("  restaurants.nom_restaurant ✓");

  // type_cuisine (optionnel)
  await api("POST", `/databases/${DATABASE_ID}/collections/restaurants/attributes/string`, {
    key: "type_cuisine", size: 100, required: false, default: null,
  });
  await waitForAttr("restaurants", "type_cuisine");
  ok("  restaurants.type_cuisine ✓");

  // adresse (optionnel)
  await api("POST", `/databases/${DATABASE_ID}/collections/restaurants/attributes/string`, {
    key: "adresse", size: 500, required: false, default: null,
  });
  await waitForAttr("restaurants", "adresse");
  ok("  restaurants.adresse ✓");

  // prix (optionnel)
  await api("POST", `/databases/${DATABASE_ID}/collections/restaurants/attributes/enum`, {
    key: "prix",
    elements: ["€", "€€", "€€€"],
    required: false,
    default: null,
  });
  await waitForAttr("restaurants", "prix");
  ok("  restaurants.prix ✓");

  // enrichi (flag IA)
  await api("POST", `/databases/${DATABASE_ID}/collections/restaurants/attributes/boolean`, {
    key: "enrichi", required: false, default: false,
  });
  await waitForAttr("restaurants", "enrichi");
  ok("  restaurants.enrichi ✓");

  // ── 4. INDEX pour filtrage rapide ───────────────
  log("Création des index de recherche...");

  await api("POST", `/databases/${DATABASE_ID}/collections/restaurants/indexes`, {
    key: "idx_ajoute_par",
    type: "key",
    attributes: ["ajoute_par"],
  });
  ok("  Index ajoute_par ✓");

  await api("POST", `/databases/${DATABASE_ID}/collections/restaurants/indexes`, {
    key: "idx_statut",
    type: "key",
    attributes: ["statut"],
  });
  ok("  Index statut ✓");

  await api("POST", `/databases/${DATABASE_ID}/collections/restaurants/indexes`, {
    key: "idx_user_id",
    type: "key",
    attributes: ["user_id"],
  });
  ok("  Index user_id ✓");

  await api("POST", `/databases/${DATABASE_ID}/collections/restaurants/indexes`, {
    key: "idx_ajoute_par_statut",
    type: "key",
    attributes: ["ajoute_par", "statut"],
  });
  ok("  Index composé ajoute_par+statut ✓");

  // ── RÉSUMÉ FINAL ────────────────────────────────
  console.log(`
\x1b[1m\x1b[32m✅ Setup terminé avec succès !\x1b[0m

  Base de données : \x1b[1mou_on_mange\x1b[0m
  Collections     : \x1b[1musers\x1b[0m · \x1b[1mrestaurants\x1b[0m

  ┌─────────────────────────────────────────┐
  │  Collection : users                      │
  │   • device_id   (string, unique, requis) │
  │   • prenom      (string, requis)         │
  │   • avatar_emoji (string, optionnel)     │
  │   • created_at  (datetime, optionnel)    │
  └─────────────────────────────────────────┘
  ┌─────────────────────────────────────────┐
  │  Collection : restaurants                │
  │   • lien_video     (url, requis)         │
  │   • ajoute_par     (string, requis)      │
  │   • user_id        (string, requis)      │
  │   • statut         (enum, défaut: a_tester)│
  │   • nom_restaurant (string, optionnel)   │
  │   • type_cuisine   (string, optionnel)   │
  │   • adresse        (string, optionnel)   │
  │   • prix           (enum, optionnel)     │
  │   • enrichi        (boolean, défaut: false)│
  └─────────────────────────────────────────┘

  🔗 Console : https://cloud.appwrite.io/console/project-fra-6a1041f50005ea891757
`);
}

main().catch(e => {
  err(`Erreur fatale : ${e.message}`);
  process.exit(1);
});
