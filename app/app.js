// ─────────────────────────────────────────────────────────
//  Où On Mange ? — app.js
//  Connexion Appwrite + logique SPA complète
// ─────────────────────────────────────────────────────────

const APPWRITE_ENDPOINT  = window.OOM_CONFIG?.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT   = window.OOM_CONFIG?.APPWRITE_PROJECT || '';
const DB_ID              = window.OOM_CONFIG?.DB_ID || 'ou_on_mange';
const COL_USERS          = window.OOM_CONFIG?.COL_USERS || 'users';
const COL_RESTAURANTS    = window.OOM_CONFIG?.COL_RESTAURANTS || 'restaurants';

// ── SDK Appwrite ─────────────────────────────────────────
const client = new Appwrite.Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT);
const databases = new Appwrite.Databases(client);
const { Query, ID } = Appwrite;

// ── État global ──────────────────────────────────────────
const state = {
  prenom:           localStorage.getItem('oom_prenom') || null,
  deviceId:         localStorage.getItem('oom_device_id') || null,
  selectedFriends:  [],
  statutFilter:     'a_tester',
  allUsers:         [],
  filteredRestos:   [],
  currentResult:    null,
  listFilter:       'a_tester',
};

// ── Couleurs avatars ─────────────────────────────────────
const AVATAR_COLORS = ['#7C3AED','#EC4899','#F97316','#10B981','#3B82F6','#F59E0B','#EF4444','#8B5CF6'];
function colorFor(str) {
  let h = 0; for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name) { return name.trim().slice(0,2).toUpperCase(); }

// ── Emojis cuisine ───────────────────────────────────────
const CUISINE_EMOJIS = {
  japonais:'🍱', sushi:'🍣', ramen:'🍜', italien:'🍕', pizza:'🍕',
  burger:'🍔', fast:'🌮', asiatique:'🍜', chinois:'🥡', indien:'🍛',
  français:'🥐', thai:'🍲', libanais:'🥙', mexicain:'🌯', snack:'🌮',
  gastronomique:'🍽️', seafood:'🦞', vegan:'🥗', default:'🍽️'
};
function cuisineEmoji(type) {
  if (!type) return '🍽️';
  const k = type.toLowerCase();
  for (const [key, val] of Object.entries(CUISINE_EMOJIS)) { if (k.includes(key)) return val; }
  return '🍽️';
}
function prixLabel(prix) {
  const map = { low: '€', mid: '€€', high: '€€€' };
  return map[prix] || (prix || '');
}

// ─────────────────────────────────────────────────────────
//  NAVIGATION (SPA)
// ─────────────────────────────────────────────────────────
function goTo(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(viewId);
  if (el) { el.classList.add('active'); el.scrollTop = 0; }
}

// ─────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ─────────────────────────────────────────────────────────
//  ONBOARDING
// ─────────────────────────────────────────────────────────
async function setupOnboarding() {
  document.getElementById('btn-onboarding').addEventListener('click', async () => {
    const prenom = document.getElementById('input-prenom').value.trim();
    if (!prenom) { toast('Entre ton prénom !', 'error'); return; }

    const btn = document.getElementById('btn-onboarding');
    btn.textContent = '⏳ Création...'; btn.disabled = true;

    try {
      // Génère un device ID via API gratuite
      let deviceId;
      try {
        const r = await fetch('https://uuid.rocks/plain');
        deviceId = (await r.text()).trim();
      } catch { deviceId = Date.now().toString(36) + Math.random().toString(36).slice(2); }

      // Crée le profil dans Appwrite
      await databases.createDocument(DB_ID, COL_USERS, ID.unique(), {
        device_id: deviceId, prenom, avatar_color: colorFor(prenom)
      });

      // Stocke localement
      localStorage.setItem('oom_prenom', prenom);
      localStorage.setItem('oom_device_id', deviceId);
      state.prenom = prenom; state.deviceId = deviceId;

      await initHome();
      goTo('view-home');
    } catch (e) {
      console.error(e);
      toast('Erreur de connexion 😕', 'error');
      btn.textContent = "C'est parti 🚀"; btn.disabled = false;
    }
  });

  // Valider avec Entrée
  document.getElementById('input-prenom').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-onboarding').click();
  });
}

// ─────────────────────────────────────────────────────────
//  HOME
// ─────────────────────────────────────────────────────────
async function initHome() {
  // Greeting
  document.getElementById('greeting-name').textContent = state.prenom + ' 👋';

  // Charger les utilisateurs pour la sélection des amis
  await loadFriends();

  // Filtres statut
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.statutFilter = btn.dataset.statut;
      updateRestoCount();
    });
  });

  await updateRestoCount();
}

async function loadFriends() {
  try {
    const res = await databases.listDocuments(DB_ID, COL_USERS, [Query.limit(50)]);
    state.allUsers = res.documents;

    const container = document.getElementById('friends-container');
    container.innerHTML = '';

    res.documents.forEach(user => {
      const chip = document.createElement('button');
      chip.className = 'friend-chip';
      chip.dataset.prenom = user.prenom;

      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.style.background = colorFor(user.prenom);
      avatar.textContent = initials(user.prenom);

      chip.appendChild(avatar);
      chip.appendChild(document.createTextNode(user.prenom));

      // Soi-même sélectionné par défaut
      if (user.prenom === state.prenom) {
        chip.classList.add('selected');
        state.selectedFriends.push(user.prenom);
      }

      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
        const p = user.prenom;
        if (chip.classList.contains('selected')) {
          if (!state.selectedFriends.includes(p)) state.selectedFriends.push(p);
        } else {
          state.selectedFriends = state.selectedFriends.filter(x => x !== p);
        }
        updateRestoCount();
      });

      container.appendChild(chip);
    });

    // Si pas d'amis encore, affiche juste soi-même
    if (res.documents.length === 0) {
      const msg = document.createElement('p');
      msg.style.color = 'var(--muted)'; msg.style.fontSize = '14px';
      msg.textContent = 'Aucun ami encore — invite-les à installer l\'app !';
      container.appendChild(msg);
    }
  } catch (e) {
    console.error('loadFriends error:', e);
  }
}

async function updateRestoCount() {
  try {
    const queries = [Query.limit(200)];
    if (state.statutFilter !== 'all') queries.push(Query.equal('statut', state.statutFilter));
    if (state.selectedFriends.length > 0) {
      queries.push(Query.equal('ajoute_par', state.selectedFriends));
    }
    const res = await databases.listDocuments(DB_ID, COL_RESTAURANTS, queries);
    state.filteredRestos = res.documents;

    const count = res.total;
    document.getElementById('resto-count').textContent =
      count === 0 ? 'Aucun resto disponible avec ces filtres'
      : count === 1 ? '1 resto disponible'
      : `${count} restos disponibles`;

    const btn = document.getElementById('btn-spin');
    btn.disabled = count === 0;
  } catch (e) {
    console.error('updateRestoCount error:', e);
  }
}

// ─────────────────────────────────────────────────────────
//  SPIN — Lancer la roulette
// ─────────────────────────────────────────────────────────
function launchSpin() {
  if (state.filteredRestos.length === 0) return;

  goTo('view-spin');

  // Afficher quelques noms qui défilent
  const namesEl = document.getElementById('spin-names');
  namesEl.innerHTML = '';
  const shuffled = [...state.filteredRestos].sort(() => Math.random() - .5).slice(0, 6);
  shuffled.forEach((r, i) => {
    const pill = document.createElement('div');
    pill.className = 'spin-name-pill';
    pill.style.animationDelay = `${i * 0.1}s`;
    pill.textContent = r.nom_restaurant || '???';
    namesEl.appendChild(pill);
  });

  // Animation 2.5 secondes puis affiche le résultat
  setTimeout(() => {
    const winner = state.filteredRestos[Math.floor(Math.random() * state.filteredRestos.length)];
    state.currentResult = winner;
    showResult(winner);
  }, 2500);
}

// ─────────────────────────────────────────────────────────
//  RÉSULTAT
// ─────────────────────────────────────────────────────────
function showResult(resto) {
  // Nom
  const nom = resto.nom_restaurant || 'Restaurant mystère 🎭';
  document.getElementById('result-name').textContent = nom;

  // Cuisine
  const cuisine = resto.type_cuisine || '';
  const cuisineEl = document.getElementById('result-cuisine');
  cuisineEl.textContent = cuisine ? `${cuisineEmoji(cuisine)} ${cuisine}` : '🍽️ Divers';

  // Prix
  document.getElementById('result-prix').textContent = prixLabel(resto.prix) || '';

  // Ville
  const villeEl = document.getElementById('result-ville');
  villeEl.textContent = resto.ville ? `📍 ${resto.ville}` : '';

  // Ajouté par
  document.getElementById('result-by').textContent = `Ajouté par ${resto.ajoute_par}`;

  // Vidéo
  const linkEl = document.getElementById('result-video-link');
  const videoContainer = document.getElementById('result-video-container');
  if (resto.lien_video) {
    linkEl.href = resto.lien_video;
    videoContainer.style.display = 'block';
  } else {
    videoContainer.style.display = 'none';
  }

  goTo('view-result');
}

// ─────────────────────────────────────────────────────────
//  LISTE
// ─────────────────────────────────────────────────────────
async function loadList() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

  try {
    const queries = [Query.limit(100), Query.orderDesc('$createdAt')];
    if (state.listFilter !== 'all') queries.push(Query.equal('statut', state.listFilter));

    const res = await databases.listDocuments(DB_ID, COL_RESTAURANTS, queries);
    container.innerHTML = '';

    if (res.documents.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">🍽️</div>
        <p>Aucun restaurant ici encore.</p>
      </div>`;
      return;
    }

    res.documents.forEach(r => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div class="list-item-avatar" style="background:linear-gradient(135deg,${colorFor(r.ajoute_par)},${colorFor(r.nom_restaurant||'x')})">
          ${cuisineEmoji(r.type_cuisine)}
        </div>
        <div class="list-item-info">
          <div class="list-item-name">${r.nom_restaurant || 'Sans nom'}</div>
          <div class="list-item-sub">${r.ville ? r.ville + ' · ' : ''}${r.type_cuisine || ''} · Par ${r.ajoute_par}</div>
        </div>
        <span class="list-item-status status-${r.statut}">${statutLabel(r.statut)}</span>
      `;
      item.addEventListener('click', () => {
        state.currentResult = r;
        showResult(r);
      });
      container.appendChild(item);
    });
  } catch (e) {
    console.error('loadList error:', e);
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px">Erreur de chargement 😕</p>';
  }
}

function statutLabel(s) {
  const map = { a_tester: 'À tester', deja_fait: 'Déjà fait', valide: '⭐ Validé' };
  return map[s] || s;
}

// ─────────────────────────────────────────────────────────
//  AJOUT MANUEL
// ─────────────────────────────────────────────────────────
function setupAddManual() {
  // Chips cuisine
  document.querySelectorAll('#cuisine-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#cuisine-chips .chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      document.getElementById('add-cuisine').value = chip.dataset.val;
    });
  });

  document.getElementById('btn-save-add').addEventListener('click', async () => {
    const nom = document.getElementById('add-nom').value.trim();
    if (!nom) { toast('Le nom est obligatoire !', 'error'); return; }

    const btn = document.getElementById('btn-save-add');
    btn.textContent = '⏳ Sauvegarde...'; btn.disabled = true;

    try {
      const data = {
        lien_video:      document.getElementById('add-lien').value.trim() || null,
        ajoute_par:      state.prenom,
        user_id:         state.deviceId,
        nom_restaurant:  nom,
        type_cuisine:    document.getElementById('add-cuisine').value.trim() || null,
        ville:           document.getElementById('add-ville').value.trim() || null,
        prix:            document.getElementById('add-prix').value || null,
        statut:          'a_tester',
        enrichi:         true,
      };
      // Supprimer les clés null pour Appwrite
      Object.keys(data).forEach(k => { if (data[k] === null || data[k] === '') delete data[k]; });

      await databases.createDocument(DB_ID, COL_RESTAURANTS, ID.unique(), data);

      toast('✅ Restaurant ajouté !', 'success');
      // Reset form
      ['add-nom','add-lien','add-cuisine','add-ville'].forEach(id => { document.getElementById(id).value = ''; });
      document.getElementById('add-prix').value = '';
      document.querySelectorAll('#cuisine-chips .chip').forEach(c => c.classList.remove('selected'));

      await updateRestoCount();
      btn.textContent = 'Sauvegarder 💾'; btn.disabled = false;

      setTimeout(() => goTo('view-home'), 1000);
    } catch (e) {
      console.error(e);
      toast('Erreur lors de la sauvegarde 😕', 'error');
      btn.textContent = 'Sauvegarder 💾'; btn.disabled = false;
    }
  });
}

// ─────────────────────────────────────────────────────────
//  ACTIONS RÉSULTAT
// ─────────────────────────────────────────────────────────
async function markAsDone(statut) {
  if (!state.currentResult) return;
  try {
    await databases.updateDocument(DB_ID, COL_RESTAURANTS, state.currentResult.$id, { statut });
    state.currentResult.statut = statut;
    toast(statut === 'deja_fait' ? '✅ Marqué comme "Déjà fait" !' : '⭐ Validé !', 'success');
    await updateRestoCount();
    setTimeout(() => goTo('view-home'), 1200);
  } catch (e) {
    console.error(e);
    toast('Erreur de mise à jour', 'error');
  }
}

// ─────────────────────────────────────────────────────────
//  INITIALISATION PRINCIPALE
// ─────────────────────────────────────────────────────────
async function init() {
  // Onboarding
  setupOnboarding();
  setupAddManual();

  // Déjà connecté ?
  if (state.prenom && state.deviceId) {
    await initHome();
    goTo('view-home');
  } else {
    goTo('view-onboarding');
  }

  // ── Events navigation ──

  // Spin
  document.getElementById('btn-spin').addEventListener('click', launchSpin);

  // Retour home
  document.getElementById('btn-back-home').addEventListener('click', async () => {
    await updateRestoCount();
    goTo('view-home');
  });

  // Retirer (tirer un autre)
  document.getElementById('btn-retirer').addEventListener('click', () => {
    if (state.filteredRestos.length <= 1) { toast('Plus de restaurant disponible !', 'error'); return; }
    // Exclure le résultat actuel
    const pool = state.filteredRestos.filter(r => r.$id !== state.currentResult?.$id);
    if (pool.length === 0) { toast('Aucun autre disponible !', 'error'); return; }
    const winner = pool[Math.floor(Math.random() * pool.length)];
    state.currentResult = winner;
    showResult(winner);
  });

  // On y va
  document.getElementById('btn-on-y-va').addEventListener('click', () => markAsDone('deja_fait'));

  // Goto liste
  document.getElementById('btn-goto-list').addEventListener('click', async () => {
    await loadList();
    goTo('view-list');
  });

  // Retour depuis liste
  document.getElementById('btn-back-list').addEventListener('click', () => goTo('view-home'));

  // Tabs liste
  document.querySelectorAll('.list-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.list-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.listFilter = tab.dataset.filter;
      loadList();
    });
  });

  // Ajouter manuellement
  document.getElementById('btn-add-manual').addEventListener('click', () => goTo('view-add'));
  document.getElementById('btn-back-add').addEventListener('click', () => goTo('view-home'));
}

// ── Lancement ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
