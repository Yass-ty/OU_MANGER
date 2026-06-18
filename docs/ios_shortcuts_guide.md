# 📱 Raccourcis iOS — "Où On Mange ?" × Appwrite
### Configuration complète bloc par bloc

---

> [!IMPORTANT]
> Tu vas créer **2 raccourcis** :
> - 🔧 **"OOM Config"** — à lancer **une seule fois** par ami pour enregistrer son prénom
> - 🍜 **"Sauvegarder Resto"** — épinglé sur l'écran d'accueil, utilisé au quotidien

---

## 🔑 Tes paramètres Appwrite

| Paramètre | Valeur |
|---|---|
| **Endpoint** | `https://cloud.appwrite.io/v1` |
| **Project ID** | `<VOTRE_PROJECT_ID>` |
| **Database ID** | `ou_on_mange` |
| **Collection users** | `users` |
| **Collection restos** | `restaurants` |

---

## 🔧 RACCOURCI 1 — "OOM Config" (une seule fois)

### Rôle
Demande le prénom → génère un ID unique pour cet appareil → crée le profil dans Appwrite → stocke tout dans iCloud Drive pour que le Raccourci 2 puisse le lire.

---

### BLOC 1 — Demander le prénom

```
Action : Demander une entrée
Question : "Comment tu t'appelles ?"
Type de réponse : Texte
Réponse par défaut : (laisser vide)
→ Stocker le résultat dans la variable : "Mon_Prenom"
```

---

### BLOC 2 — Générer un identifiant unique pour cet appareil

```
Action : Générer un GUID
→ Stocker le résultat dans la variable : "Mon_Device_ID"
```

> [!NOTE]
> Le GUID est un identifiant universel unique (ex: `550e8400-e29b-41d4-a716-446655440000`). Il sera généré une seule fois et stocké — c'est l'empreinte permanente de cet iPhone.

---

### BLOC 3 — Construire le JSON pour créer le profil utilisateur

```
Action : Dictionnaire
Contenu :
  "documentId" → Texte : "unique()"
  "data"       → Dictionnaire :
      "device_id"    → Variable [Mon_Device_ID]
      "prenom"       → Variable [Mon_Prenom]
      "avatar_color" → Texte : "blue"
```

JSON généré :
```json
{
  "documentId": "unique()",
  "data": {
    "device_id": "550e8400-e29b-41d4-a716-446655440000",
    "prenom": "Théo",
    "avatar_color": "blue"
  }
}
```

---

### BLOC 4 — Envoyer le profil à Appwrite

```
Action : Obtenir le contenu de l'URL

URL     : https://cloud.appwrite.io/v1/databases/ou_on_mange/collections/users/documents
Méthode : POST

En-têtes :
  X-Appwrite-Project  →  <VOTRE_PROJECT_ID>
  Content-Type        →  application/json

Corps de la requête : JSON
JSON : Variable [Dictionnaire du Bloc 3]
```

> [!TIP]
> Si tu reçois un code 201 en retour → succès. Le profil est créé dans Appwrite.

---

### BLOC 5 — Sauvegarder le prénom et l'ID dans iCloud Drive

```
Action : Sauvegarder le fichier

--- FICHIER 1 (prénom) ---
Contenu  : Variable [Mon_Prenom]
Chemin   : Shortcuts/oom_prenom.txt
iCloud   : ✅ Activé
Remplacer: ✅ Oui

--- FICHIER 2 (device ID) ---
Contenu  : Variable [Mon_Device_ID]  
Chemin   : Shortcuts/oom_device_id.txt
iCloud   : ✅ Activé
Remplacer: ✅ Oui
```

> Ces deux petits fichiers texte servent de "mémoire" permanente. Le Raccourci 2 les lira à chaque utilisation.

---

### BLOC 6 — Confirmation

```
Action : Afficher alerte
Titre  : "✅ Profil créé !"
Message: "Bienvenue [Mon_Prenom] ! Tu peux maintenant utiliser le raccourci Sauvegarder Resto."
```

---

## 🍜 RACCOURCI 2 — "Sauvegarder Resto" (quotidien)

### Rôle
1 seul tap → lit le lien TikTok/Insta dans le presse-papier → l'envoie à Appwrite avec le prénom stocké → notification de confirmation.

---

### BLOC 1 — Lire le prénom stocké

```
Action : Obtenir le fichier
Chemin : Shortcuts/oom_prenom.txt
iCloud : ✅ Activé
→ Stocker dans la variable : "Mon_Prenom"
```

---

### BLOC 2 — Lire le Device ID stocké

```
Action : Obtenir le fichier
Chemin : Shortcuts/oom_device_id.txt
iCloud : ✅ Activé
→ Stocker dans la variable : "Mon_Device_ID"
```

---

### BLOC 3 — Récupérer le presse-papier

```
Action : Contenu du presse-papier
→ Stocker dans la variable : "URL_Copiee"
```

---

### BLOC 4 — Vérifier que c'est bien TikTok ou Instagram

```
Action : Si
  Condition : URL_Copiee [contient] "tiktok.com"
              OU
              URL_Copiee [contient] "instagram.com"
              OU
              URL_Copiee [contient] "vm.tiktok.com"
→ Sinon :
    Afficher alerte "⚠️ Lien non reconnu"
    Message : "Copie d'abord un lien TikTok ou Instagram"
    Arrêter le raccourci
```

---

### BLOC 5 — Construire le JSON pour Appwrite

```
Action : Dictionnaire
Contenu :
  "documentId" → Texte : "unique()"
  "data"       → Dictionnaire :
      "lien_video"  → Variable [URL_Copiee]
      "ajoute_par"  → Variable [Mon_Prenom]
      "user_id"     → Variable [Mon_Device_ID]
```

JSON généré :
```json
{
  "documentId": "unique()",
  "data": {
    "lien_video": "https://www.tiktok.com/@chef_marco/video/123456789",
    "ajoute_par": "Théo",
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

> [!NOTE]
> Le champ `statut` n'est pas inclus car sa valeur par défaut `a_tester` est appliquée automatiquement par Appwrite.

---

### BLOC 6 — Envoyer à Appwrite

```
Action : Obtenir le contenu de l'URL

URL     : https://cloud.appwrite.io/v1/databases/ou_on_mange/collections/restaurants/documents
Méthode : POST

En-têtes :
  X-Appwrite-Project  →  <VOTRE_PROJECT_ID>
  Content-Type        →  application/json

Corps de la requête : JSON
JSON : Variable [Dictionnaire du Bloc 5]
```

---

### BLOC 7 — Notification de confirmation

```
Action : Afficher la notification
Titre  : "🍜 Resto sauvegardé !"
Message: Variable [URL_Copiee]
Son    : ✅ Activé
```

> Une notification push apparaît en haut de l'écran. En 2 secondes, c'est enregistré.

---

## 📲 Épingler le Raccourci 2 sur l'écran d'accueil

1. Dans **Raccourcis** → appui long sur **"Sauvegarder Resto"**
2. → **Détails** → **Ajouter à l'écran d'accueil**
3. Choisir une icône (🍜 ou 🎲) et un nom court : `Sauvegarder`
4. L'icône apparaît comme une vraie app native

---

## 👥 Partager aux amis

### Méthode
1. Dans Raccourcis → `...` sur **"OOM Config"** → **Partager** → activer **"Autoriser le partage"** → copier le lien iCloud
2. Faire pareil pour **"Sauvegarder Resto"**
3. Envoyer les **2 liens** dans le groupe WhatsApp

### Ce que chaque ami doit faire
```
1. Ouvrir le lien "OOM Config" → Ajouter → Lancer une fois
2. Saisir son prénom → Valider
3. Ouvrir le lien "Sauvegarder Resto" → Ajouter
4. Épingler l'icône sur son écran d'accueil
```

> [!TIP]
> **Chaque ami a son propre prénom stocké sur son iPhone.** Le Raccourci 2 est identique pour tout le monde — c'est le fichier `oom_prenom.txt` qui personnalise automatiquement chaque envoi.

---

## 🧪 Tester sans iPhone (curl)

Valide que ton endpoint Appwrite fonctionne depuis un terminal :

```bash
# Créer un utilisateur test
curl -X POST "https://cloud.appwrite.io/v1/databases/ou_on_mange/collections/users/documents" \
  -H "X-Appwrite-Project: <VOTRE_PROJECT_ID>" \
  -H "X-Appwrite-Key: <VOTRE_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "unique()",
    "data": {
      "device_id": "test-device-001",
      "prenom": "Test",
      "avatar_color": "blue"
    }
  }'

# Ajouter un restaurant test
curl -X POST "https://cloud.appwrite.io/v1/databases/ou_on_mange/collections/restaurants/documents" \
  -H "X-Appwrite-Project: <VOTRE_PROJECT_ID>" \
  -H "X-Appwrite-Key: <VOTRE_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "unique()",
    "data": {
      "lien_video": "https://www.tiktok.com/@test/video/000000001",
      "ajoute_par": "Test",
      "user_id": "test-device-001"
    }
  }'
```

**Réponse attendue (succès) :**
```json
{
  "$id": "recXXXXXXXXXXXXXX",
  "$createdAt": "2026-05-22T14:00:00.000+00:00",
  "lien_video": "https://www.tiktok.com/@test/video/000000001",
  "ajoute_par": "Test",
  "user_id": "test-device-001",
  "statut": "a_tester",
  "enrichi": false
}
```

---

## ✅ Checklist Raccourcis

```
□ Raccourci "OOM Config"
  ☐ Bloc 1 : demande prénom
  ☐ Bloc 2 : génère GUID
  ☐ Bloc 3 : dictionnaire JSON correct
  ☐ Bloc 4 : POST /users/documents → reçoit 201
  ☐ Bloc 5 : 2 fichiers sauvegardés dans iCloud
  ☐ Bloc 6 : alerte de confirmation visible
  ☐ Testé → prénom visible dans console Appwrite

□ Raccourci "Sauvegarder Resto"
  ☐ Bloc 1 : lit oom_prenom.txt
  ☐ Bloc 2 : lit oom_device_id.txt
  ☐ Bloc 3 : lit presse-papier
  ☐ Bloc 4 : filtre TikTok/Instagram
  ☐ Bloc 5 : dictionnaire JSON correct
  ☐ Bloc 6 : POST /restaurants/documents → reçoit 201
  ☐ Bloc 7 : notification visible en haut de l'écran
  ☐ Icône épinglée sur l'écran d'accueil
  ☐ Testé avec un vrai lien TikTok

□ Partage aux amis
  ☐ Lien iCloud "OOM Config" envoyé
  ☐ Lien iCloud "Sauvegarder Resto" envoyé
  ☐ Chaque ami a lancé "OOM Config" une fois
  ☐ Les prénoms de chaque ami sont visibles dans Appwrite Console
```

---

*Étape suivante : Interface mobile (Glide ou PWA) connectée à Appwrite*
