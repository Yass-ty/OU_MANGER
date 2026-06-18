# 🍽️ Guide Complet — "Où On Mange ?"
### De A à Z : iOS Shortcut · Airtable · Glide · IA (V2)

---

> [!IMPORTANT]
> **Stack finale retenue** : Apple Shortcuts (capture) → Airtable API (base de données) → Glide (interface mobile) → Make.com + OpenAI (V2 IA)

---

## 🗺️ Vue d'ensemble de l'architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FLUX COMPLET                          │
│                                                         │
│  TikTok / Instagram                                     │
│       │  (Copier le lien)                               │
│       ▼                                                 │
│  📱 Raccourci iOS  ──── POST JSON ───►  🗃️ Airtable    │
│  (1 tap sur l'écran)                  [Restaurants_Bruts]│
│                                              │          │
│                                              ▼          │
│                                    📲 Glide (App mobile) │
│                                    - Filtre par amis    │
│                                    - Roulette aléatoire │
│                                    - Embed vidéo        │
└─────────────────────────────────────────────────────────┘
```

---

## 🗃️ PRÉ-REQUIS : Configurer la base Airtable

### Étape 0.1 — Créer la table `Restaurants_Bruts`

1. Va sur [airtable.com](https://airtable.com) → **Create a base** → nomme-la `Ou_On_Mange`
2. Crée une table nommée exactement **`Restaurants_Bruts`**
3. Configure les colonnes comme suit :

| Nom du champ | Type Airtable | Détail |
|---|---|---|
| `ID` | **Autonumber** | Identifiant unique auto |
| `Lien_Video` | **URL** | URL brute TikTok ou Instagram |
| `Ajoute_Par` | **Single line text** | Prénom de l'ami |
| `Date_Ajout` | **Created time** | Rempli automatiquement |
| `Statut` | **Single select** | Options : `À tester` / `Déjà fait` / `Validé` |

> [!TIP]
> Pour `Statut`, configure la valeur par défaut sur **`À tester`** — ainsi chaque nouvel enregistrement est automatiquement marqué sans action manuelle.

### Étape 0.2 — Récupérer tes clés API Airtable

Tu auras besoin de **3 informations** :

1. **Personal Access Token** → [airtable.com/create/tokens](https://airtable.com/create/tokens)
   - Clique **+ Create new token**
   - Scopes requis : `data.records:read` + `data.records:write`
   - Accès : sélectionne ta base `Ou_On_Mange`
   - Copie le token — il ressemble à `patXXXXXXXXXXXXXX.XXXXXXXXXX`

2. **Base ID** → Dans l'URL de ta base Airtable : `airtable.com/appXXXXXXXXXXXX/...`
   - Le Base ID commence par `app` → ex: `appABC123DEF456`

3. **Table ID** → Clique sur ton nom de table → `...` → **Get API documentation**
   - Le Table ID commence par `tbl` → ex: `tblXXXXXXXXXXXXXX`

> [!NOTE]
> L'URL finale de l'API sera : `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`

---

## 📱 ÉTAPE 1 — Le Raccourci iOS (Apple Shortcuts)

### Objectif
L'utilisateur voit un restaurant sur TikTok → tape "Copier le lien" → tape sur un raccourci épinglé en écran d'accueil → **le lien est enregistré en 2 secondes**, sans ouvrir l'app.

### 1.1 — Créer le raccourci

Ouvre l'app **Raccourcis** sur iPhone → **+** (nouveau raccourci)

Configure les blocs **dans cet ordre exact** :

---

#### 🔷 BLOC 1 — Récupérer le presse-papier

```
Action : "Contenu du presse-papier"
Résultat : stocké dans une variable → nommée "URL_Copiee"
```

> Drag & drop **"Contenu du presse-papier"** depuis la bibliothèque d'actions.

---

#### 🔷 BLOC 2 — Vérifier que c'est bien un lien (optionnel mais recommandé)

```
Action : "Si"
Condition : URL_Copiee  [contient]  "tiktok.com"  OU  "instagram.com"
→ Sinon : Afficher alerte "⚠️ Le lien ne semble pas être TikTok ou Instagram"
→ Arrêter le raccourci
```

---

#### 🔷 BLOC 3 — Demander le prénom (une seule fois au premier lancement)

> [!TIP]
> Pour éviter de demander le prénom à chaque fois, stocke-le dans une **variable globale** via les réglages du raccourci ou utilise un raccourci de configuration séparé.

**Option A (ultra-simple) — Variable codée en dur dans le raccourci :**
```
Action : "Texte"
Contenu : Théo          ← (remplace par ton prénom)
→ Nommer la variable : "Mon_Prenom"
```

**Option B (dynamique) — Dictionnaire de prénoms par raccourci :**
> Crée **un raccourci par ami**, chacun avec son prénom codé. Chaque ami installe son propre raccourci depuis un lien iCloud partagé.

**Option C (pro) — Stocker le prénom dans les Réglages iCloud :**
```
Action : "Obtenir la valeur du dictionnaire"
Clé : "prenom_utilisateur"
→ Si vide → Demander "Quel est ton prénom ?" → Stocker dans iCloud KV
```

*Pour démarrer rapidement, utilise l'Option A.*

---

#### 🔷 BLOC 4 — Construire le corps JSON

```
Action : "Dictionnaire"
Clés :
  "fields" → [Dictionnaire]
    "Lien_Video"  → Variable [URL_Copiee]
    "Ajoute_Par"  → Variable [Mon_Prenom]
    "Statut"      → Texte "À tester"
```

Voici la représentation JSON exacte que ce dictionnaire génère :

```json
{
  "fields": {
    "Lien_Video": "https://www.tiktok.com/@chef_marco/video/123456789",
    "Ajoute_Par": "Théo",
    "Statut": "À tester"
  }
}
```

> [!NOTE]
> Airtable gère `Date_Ajout` automatiquement (champ *Created time*). Ne l'inclus pas dans le JSON.

---

#### 🔷 BLOC 5 — Envoyer la requête POST à Airtable

```
Action : "Obtenir le contenu de l'URL"
```

Configure ce bloc exactement ainsi :

| Paramètre | Valeur |
|---|---|
| **URL** | `https://api.airtable.com/v0/TON_BASE_ID/Restaurants_Bruts` |
| **Méthode** | `POST` |
| **En-têtes** | `Authorization` : `Bearer patXXXXXXXXXXXXXX.XXXXXXXXXX` |
| | `Content-Type` : `application/json` |
| **Corps de la requête** | `JSON` |
| **JSON** | Variable [Dictionnaire du Bloc 4] |

> [!IMPORTANT]
> Dans le champ URL, remplace `TON_BASE_ID` par ton identifiant commençant par `app`. La table `Restaurants_Bruts` peut être utilisée directement par son nom (URL-encodé automatiquement) ou par son Table ID (`tblXXX`).

---

#### 🔷 BLOC 6 — Confirmation visuelle

```
Action : "Afficher la notification"
Titre : "✅ Ajouté !"
Corps : URL_Copiee
Son : activé
```

> Une simple notification push apparaît en haut de l'écran — l'utilisateur sait que c'est enregistré sans même ouvrir une app.

---

### 1.2 — Épingler le raccourci sur l'écran d'accueil

1. Dans **Raccourcis** → appui long sur ton raccourci → **Détails**
2. **Ajouter à l'écran d'accueil**
3. Choisir une icône et un nom court : ex. `🍜 Sauvegarder`
4. L'icône apparaît comme une vraie app — **1 seul tap suffit**

### 1.3 — Partager le raccourci à tes amis

1. Dans Raccourcis → **...** sur ton raccourci → **Partager**
2. Active **"Autoriser le partage"** → copie le lien iCloud
3. Chaque ami ouvre le lien sur son iPhone et installe le raccourci
4. Ils changent juste le **BLOC 3** (Mon_Prenom) avec leur prénom

---

## 📲 ÉTAPE 2 — Intégration Glide (Frontend Mobile)

### 2.1 — Connecter Airtable à Glide

1. Va sur [glideapps.com](https://www.glideapps.com) → **New App**
2. Sélectionne **Airtable** comme source de données
3. Connecte ton compte Airtable → sélectionne la base `Ou_On_Mange`
4. Glide importe automatiquement la table `Restaurants_Bruts`

> [!TIP]
> Glide synchronise en temps réel avec Airtable. Chaque nouvel enregistrement créé via le raccourci iOS apparaît dans l'app en quelques secondes.

---

### 2.2 — Configurer l'écran de tirage au sort

#### Structure de l'app Glide

```
App "Où On Mange ?"
├── Écran 1 : "Qui est là ce soir ?" (Sélection des amis)
├── Écran 2 : "LANCER LA ROULETTE" (Bouton + Résultat)
└── Écran 3 : "Historique" (Liste de tous les restos)
```

---

#### 🖥️ Écran 1 — Sélection des amis présents

Dans l'éditeur Glide :

1. Ajoute un composant **"Choice"** (Choix multiple)
2. Configure-le :

| Paramètre | Valeur |
|---|---|
| **Label** | `Qui est là ce soir ?` |
| **Type** | `Multiple` (cases à cocher) |
| **Options** | Liste statique : `Théo`, `Léa`, `Lucas`, `Marie`... |
| **Destination** | User-specific column → `Amis_Presents` (texte) |

> [!NOTE]
> Dans Glide, crée une **"User-Specific Column"** nommée `Amis_Presents` (type Text). Cette colonne est propre à chaque utilisateur et ne s'écrit pas dans Airtable — elle sert uniquement de filtre local.

---

#### 🖥️ Écran 2 — Le Randomizer

**A. Créer la Collection filtrée**

1. Ajoute un composant **"Collection"** (invisible ou masqué)
2. Source : table `Restaurants_Bruts`
3. **Filtre** : 
   ```
   Ajoute_Par  [est dans]  Amis_Presents
   ```
   > Dans Glide, le filtre "est dans" (contains) sur un champ texte multi-valeurs fonctionne quand `Amis_Presents` contient des valeurs séparées par des virgules.

4. **Filtre supplémentaire** :
   ```
   Statut  [est]  À tester
   ```
   > Ainsi on ne tire jamais un restaurant déjà visité.

**B. Le bouton LANCER LA ROULETTE**

1. Ajoute un composant **"Button"** (gros bouton centré)
2. Label : `🎲 LANCER LA ROULETTE`
3. Action : **"Pick Random Item"** (sélectionner un élément aléatoire)
4. Source de l'action : la Collection filtrée créée à l'étape A
5. Destination : navigue vers **Écran Résultat** en passant l'item sélectionné

> [!IMPORTANT]
> Dans Glide, l'action **"Show Detail Screen"** + **"Pick Random Row"** est disponible dans les plans payants (Maker+). Si tu es sur le plan gratuit, utilise une **Computed Column** avec la formule `RANDBETWEEN` côté Airtable ou un webhook Make.com.

**C. Écran Résultat — Affichage du restaurant tiré**

Après le tirage, affiche :

| Composant Glide | Source | Rendu |
|---|---|---|
| **Text** (Titre) | `Ajoute_Par` | "Recommandé par Léa 🎉" |
| **WebView / Embed** | `Lien_Video` | Lecteur vidéo TikTok/Insta intégré |
| **Button** | Action personnalisée | "✅ On y va !" → change `Statut` → `Déjà fait` |
| **Button** | Relancer | "🎲 Retirer" → revient à l'écran de tirage |

**Configuration de l'Embed vidéo :**

```
Composant : "Web View" ou "Embed"
URL : champ Lien_Video de l'enregistrement tiré
→ TikTok et Instagram supportent nativement l'embed dans une WebView
```

---

### 2.3 — Gestion des statuts depuis l'app

Configure le bouton "On y va !" pour mettre à jour Airtable :

1. Action du bouton : **"Edit Row"**
2. Colonne : `Statut`
3. Valeur : `Déjà fait`

> Le restaurant disparaît automatiquement du prochain tirage car le filtre `Statut = À tester` l'exclura.

---

### 2.4 — Astuce : Filtres avancés multi-amis dans Glide

Le filtre natif de Glide sur des valeurs multiples peut être capricieux. Voici la technique robuste :

**Option 1 (Glide natif) :**
```
Condition : Ajoute_Par  [included in]  Amis_Presents
```
> Fonctionne quand `Amis_Presents` est une liste Glide (type "Array").

**Option 2 (via Airtable computed column) :**
Crée une colonne **"Formula"** dans Airtable :
```
IF(
  OR(
    {Ajoute_Par} = "Théo",
    {Ajoute_Par} = "Léa",
    {Ajoute_Par} = "Lucas"
  ),
  TRUE(),
  FALSE()
)
```
> Pour une app statique avec un groupe fixe d'amis, c'est la solution la plus fiable.

**Option 3 (Make.com webhook — la plus flexible) :**
Voir section V2 ci-dessous.

---

## 🤖 ÉTAPE 3 — V2 : Intégration IA (OpenAI + Make.com)

### Objectif V2
Quand un lien TikTok/Instagram est enregistré, un **agent IA** l'analyse automatiquement et remplit les champs enrichis sans intervention humuelle :
- **Nom du restaurant**
- **Type de cuisine**
- **Adresse / Géolocalisation**
- **Fourchette de prix**

### 3.1 — Nouvelles colonnes à ajouter dans Airtable

Ajoute ces colonnes à la table `Restaurants_Bruts` :

| Nom du champ | Type Airtable | Source |
|---|---|---|
| `Nom_Restaurant` | Single line text | Extrait par IA |
| `Type_Cuisine` | Single select | Extrait par IA |
| `Adresse` | Single line text | Extrait par IA |
| `Latitude` | Number | Via Google Maps API |
| `Longitude` | Number | Via Google Maps API |
| `Prix_Fourchette` | Single select | `€` / `€€` / `€€€` |
| `Enrichi` | Checkbox | `true` quand l'IA a traité |

---

### 3.2 — Architecture du pipeline Make.com

```
┌─────────────────────────────────────────────────────────────┐
│                    PIPELINE MAKE.COM (V2)                    │
│                                                             │
│  1. TRIGGER                                                 │
│  Airtable → "Watch Records" → Quand Enrichi = false        │
│       │                                                     │
│       ▼                                                     │
│  2. SCRAPER (optionnel)                                     │
│  HTTP Module → GET {Lien_Video}                             │
│  → Extraire le titre / description de la page              │
│       │                                                     │
│       ▼                                                     │
│  3. OPENAI (GPT-4o)                                        │
│  Prompt → "Extrait le nom du restaurant, type de cuisine,  │
│  adresse depuis ce texte : {description_page}"             │
│       │                                                     │
│       ▼                                                     │
│  4. GOOGLE MAPS API                                        │
│  Places API → Recherche par nom → Récupère lat/lng         │
│       │                                                     │
│       ▼                                                     │
│  5. AIRTABLE                                               │
│  Update Record → Remplit tous les champs enrichis          │
│  → Enrichi = true                                          │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.3 — Configuration Make.com pas à pas

#### Module 1 — Trigger Airtable

```
App : Airtable
Action : Watch Records
Base : Ou_On_Mange
Table : Restaurants_Bruts
Filter Formula : NOT({Enrichi})
Polling interval : 15 minutes (ou webhook immédiat)
```

#### Module 2 — Requête HTTP vers la vidéo

```
App : HTTP
Action : Make a Request
URL : {{1.Lien_Video}}
Method : GET
Headers : User-Agent: Mozilla/5.0...
→ Résultat : contenu HTML de la page
```

#### Module 3 — Parser le HTML

```
App : HTML/Text Parser (ou Regex dans Make)
→ Extraire : balises <title>, <meta name="description">, 
             <meta property="og:description">
→ Variable : description_page
```

#### Module 4 — Appel OpenAI GPT-4o

```
App : OpenAI (ChatGPT)
Action : Create a Completion
Model : gpt-4o
```

**Prompt système :**
```
Tu es un assistant spécialisé dans l'extraction d'informations 
sur les restaurants depuis des descriptions de vidéos sociales.
Réponds UNIQUEMENT en JSON valide, sans markdown.
```

**Prompt utilisateur :**
```
Voici la description d'une vidéo TikTok ou Instagram 
sur un restaurant :

---
{{description_page}}
---

Extrais les informations suivantes et réponds en JSON :
{
  "nom_restaurant": "Nom exact du restaurant ou null",
  "type_cuisine": "Type de cuisine (ex: Japonais, Italien, Burger) ou null",
  "adresse": "Adresse complète si mentionnée ou null",
  "ville": "Ville du restaurant ou null",
  "prix": "€, €€ ou €€€ selon le contexte ou null"
}
```

**Parsing de la réponse OpenAI :**
```
Dans Make : JSON Parser module
→ Extraire nom_restaurant, type_cuisine, adresse, ville, prix
```

#### Module 5 — Google Maps Places API (géolocalisation)

```
App : HTTP
Action : Make a Request
URL : https://maps.googleapis.com/maps/api/place/findplacefromtext/json
Params :
  input : {{nom_restaurant}} {{ville}}
  inputtype : textquery
  fields : geometry,name,formatted_address
  key : TON_GOOGLE_MAPS_API_KEY
```

**Parser la réponse :**
```
→ latitude  : {{candidates[].geometry.location.lat}}
→ longitude : {{candidates[].geometry.location.lng}}
→ adresse_confirmee : {{candidates[].formatted_address}}
```

#### Module 6 — Mise à jour Airtable

```
App : Airtable
Action : Update a Record
Record ID : {{1.ID}}  (depuis le trigger)
Champs à mettre à jour :
  Nom_Restaurant → {{nom_restaurant}}
  Type_Cuisine   → {{type_cuisine}}
  Adresse        → {{adresse_confirmee}}
  Latitude       → {{latitude}}
  Longitude      → {{longitude}}
  Prix_Fourchette → {{prix}}
  Enrichi        → true
```

---

### 3.4 — Évolutions V3 possibles

| Idée | Technologie | Complexité |
|---|---|---|
| Carte des restaurants (vue map) | Glide Map Component + lat/lng | ⭐⭐ |
| Notation collaborative (⭐⭐⭐⭐⭐) | Nouvelle table Airtable `Avis` | ⭐⭐ |
| Filtrer par type de cuisine | Glide filter sur `Type_Cuisine` | ⭐ |
| Notification push "On mange où ?" | Glide Notifications | ⭐⭐ |
| Historique partagé | Vue filtrée `Statut = Déjà fait` | ⭐ |
| Intégration Google Agenda | Make.com → Google Calendar | ⭐⭐⭐ |

---

## ✅ Checklist de lancement (Aujourd'hui)

```
□ Airtable
  ☐ Base "Ou_On_Mange" créée
  ☐ Table "Restaurants_Bruts" configurée avec les 5 colonnes
  ☐ Personal Access Token généré et copié
  ☐ Base ID et Table ID notés

□ Raccourci iOS (pour chaque ami)
  ☐ Raccourci créé avec les 6 blocs
  ☐ Token Airtable inséré dans le Bloc 5
  ☐ Prénom personnalisé dans le Bloc 3
  ☐ Raccourci testé → notification ✅ reçue
  ☐ Icône épinglée sur l'écran d'accueil
  ☐ Lien iCloud partagé aux amis

□ Glide
  ☐ Compte créé sur glideapps.com
  ☐ Airtable connecté
  ☐ Écran de sélection des amis configuré
  ☐ Filtre par Ajoute_Par configuré
  ☐ Bouton "LANCER LA ROULETTE" configuré
  ☐ Embed vidéo testé
  ☐ Bouton "On y va !" met à jour le statut

□ Test end-to-end
  ☐ Copier un lien TikTok → Raccourci → Vérifier dans Airtable
  ☐ Ouvrir Glide → Sélectionner amis → Lancer → Voir le résultat
```

---

## 🧪 Tester le Raccourci iOS sans iPhone (via curl)

Pour valider que ton token Airtable est correct avant de tout monter, teste depuis un terminal :

```bash
curl -X POST "https://api.airtable.com/v0/TON_BASE_ID/Restaurants_Bruts" \
  -H "Authorization: Bearer patXXXXXXXXXXXXXX.XXXXXXXXXX" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "Lien_Video": "https://www.tiktok.com/@test/video/000000001",
      "Ajoute_Par": "Test",
      "Statut": "À tester"
    }
  }'
```

**Réponse attendue (succès) :**
```json
{
  "id": "recXXXXXXXXXXXXXX",
  "createdTime": "2026-05-22T08:00:00.000Z",
  "fields": {
    "ID": 1,
    "Lien_Video": "https://www.tiktok.com/@test/video/000000001",
    "Ajoute_Par": "Test",
    "Statut": "À tester",
    "Date_Ajout": "2026-05-22T08:00:00.000Z"
  }
}
```

---

*Guide rédigé le 22 mai 2026 — Version 1.0*  
*Stack : Apple Shortcuts · Airtable API v0 · Glide · Make.com · OpenAI GPT-4o*
