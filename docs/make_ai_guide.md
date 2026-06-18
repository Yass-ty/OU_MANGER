# 🤖 Guide Make.com & Gemini (L'Intelligence Artificielle)

Ce guide va te permettre de créer le "cerveau" de ton application. Dès qu'un lien sera ajouté dans Appwrite, Make.com va s'activer, lire la page, envoyer le texte à Gemini, et renseigner les détails dans ta base de données.

---

## ÉTAPE 1 : Récupérer ta clé gratuite Gemini

1. Va sur [Google AI Studio](https://aistudio.google.com/app/apikey) (Connecte-toi avec ton compte Google).
2. Clique sur le bouton **"Create API Key"** (Créer une clé API).
3. Choisis de créer la clé dans un nouveau projet (New Project).
4. Copie la longue suite de caractères qui s'affiche. Garde-la de côté, c'est ta clé !

---

## ÉTAPE 2 : Créer le scénario sur Make.com

1. Va sur [Make.com](https://www.make.com/) et crée un compte gratuit.
2. Une fois connecté, clique sur **"Scenarios"** (à gauche) puis sur le bouton en haut à droite **"Create a new scenario"**.
3. Tu arrives sur une grande page blanche avec un bouton `+` au milieu. C'est ici qu'on va tout construire !

Voici les 5 modules (bulles) à ajouter et connecter dans l'ordre :

### 🟢 Bulle 1 : Le déclencheur (Webhook Appwrite)
- Clique sur le `+` et cherche **"Webhooks"**.
- Choisis l'action **"Custom Webhook"**.
- Clique sur **"Add"**, donne-lui un nom (ex: `Webhook Où On Mange`) et sauvegarde.
- Make.com va générer une URL (ex: `https://hook.eu2.make.com/xxxxxx`). **Copie cette URL !**
- *Laisse Make.com tourner ("Stop" pour le moment) et va dans ton onglet Appwrite.*

> **👉 Action dans Appwrite :** 
> 1. Va dans ton projet Appwrite.
> 2. Va dans le menu de gauche **"Overview"**, descends et clique sur **"Webhooks"** ➔ **"Add Webhook"**.
> 3. Nom : `Trigger Make IA`
> 4. POST URL : *Colle l'URL de Make.com*
> 5. Events (Événements) : Cherche et coche uniquement `databases.ou_on_mange.collections.restaurants.documents.*.create`.
> 6. Clique sur "Create". (Maintenant, à chaque nouveau resto, Appwrite alertera Make.com !).

### 🔵 Bulle 2 : Récupérer les infos de la vidéo (Scraping)
- Retourne sur Make.com. À côté du Webhook, clique sur le demi-cercle pour ajouter un module.
- Cherche **"HTTP"** ➔ Choisis **"Make a request"**.
- URL : Utilise la variable `data.lien_video` (qui vient de la Bulle 1).
- Méthode : `GET`
- Descends tout en bas et coche **"Parse response"** ➔ OK.

### 🟣 Bulle 3 : Extraire le texte de la page (Parser)
- Ajoute le module **"Text Parser"** ➔ Choisis **"Match Pattern"**.
- Pattern : `<title>(.*?)<\/title>` (Ceci va extraire le titre de la page TikTok/Insta).
- Text : Utilise la variable `Data` venant de la Bulle 2 (le code HTML brut).
- Coche "Global match" ➔ OK.

### 🟠 Bulle 4 : Le Cerveau IA (Gemini)
- Ajoute le module **"Google Gemini (Generative AI)"**.
- Choisis **"Generate Text"** (ou *Generate Content*).
- Il va te demander ta clé API (Celle de l'Étape 1 !).
- Modèle : `gemini-1.5-flash` (Très rapide et gratuit).
- **Prompt :**
  ```text
  Tu es un assistant culinaire. Voici la description d'une vidéo TikTok :
  " [Insère ici la variable résultat de la Bulle 3] "
  
  Analyse ce texte et retourne-moi UNIQUEMENT un objet JSON valide avec ces clés :
  {
    "nom_restaurant": "Le nom exact, ou null si introuvable",
    "type_cuisine": "Italien, Snack, Asiatique, etc., ou null",
    "ville": "La ville mentionnée, ou null",
    "prix": "low (si pas cher), mid (moyen), ou high (très cher)"
  }
  ```

### 🟡 Bulle 5 : Mettre à jour Appwrite
- Ajoute le module **"JSON"** ➔ **"Parse JSON"** (pour lire la réponse de Gemini).
- Ajoute un dernier module **"HTTP"** ➔ **"Make a request"**.
- URL : `https://cloud.appwrite.io/v1/databases/ou_on_mange/collections/restaurants/documents/[Variable: documentId de la Bulle 1]`
- Méthode : `PATCH`
- Headers : 
  - `X-Appwrite-Project` : `<VOTRE_PROJECT_ID>`
  - `X-Appwrite-Key` : `[TA_NOUVELLE_CLE_APPWRITE]`
  - `Content-Type` : `application/json`
- Body type : `Raw` (JSON)
- Request content :
  ```json
  {
    "data": {
      "nom_restaurant": "[Variable: nom_restaurant de la bulle JSON]",
      "type_cuisine": "[Variable: type_cuisine]",
      "ville": "[Variable: ville]",
      "prix": "[Variable: prix]",
      "enrichi": true
    }
  }
  ```

---

## 🚀 Activer et Tester

1. En bas à gauche sur Make.com, sauvegarde (icône disquette) et active le scénario (bouton **ON**).
2. Prends ton iPhone.
3. Va sur TikTok, copie une vidéo de resto, et lance ton raccourci "Sauvegarder Resto".
4. Regarde l'écran de Make.com : tu vas voir les bulles s'allumer une par une en quelques secondes !
5. Va dans Appwrite : Ton restaurant devrait apparaître avec le Nom, la Ville et le Type remplis par magie ! ✨
