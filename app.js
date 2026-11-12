// Pokémon Masta — sélection d'équipe (pseudo + personnage, puis 6 Pokémon)

const TEAM_SIZE = 6;
const MOVES_PER_MON = 6;

const TRAINERS = [
  ["player_m", "Lucas"], ["player_f", "Aurore"], ["barry", "Barry"], ["cynthia", "Cynthia"],
  ["roark", "Pierrick"], ["gardenia", "Flo"], ["maylene", "Mélina"], ["crasher_wake", "Lovis"],
  ["fantina", "Kiméra"], ["byron", "Charles"], ["candice", "Gladys"], ["volkner", "Tanguy"],
  ["aaron", "Aaron"], ["bertha", "Terry"], ["flint", "Adrien"], ["lucian", "Lucio"],
  ["cyrus", "Hélio"], ["looker", "Beladonis"], ["ace_trainer_m", "Topdresseur"], ["ace_trainer_f", "Topdresseuse"],
  ["hiker", "Montagnard"], ["lass", "Fillette"], ["youngster", "Gamin"], ["bug_catcher", "Scout"],
  ["psychic", "Kinésiste"], ["black_belt", "Karatéka"], ["battle_girl", "Combattante"], ["ninja_boy", "Ninja"],
  ["beauty", "Canon"], ["grunt_m", "Sbire Galaxie"], ["cowgirl", "Cowgirl"], ["clown", "Clown"],
  ["mars", "Mars"], ["jupiter", "Jupiter"], ["saturn", "Saturne"], ["grunt_f", "Sbire Galaxie (F)"],
  ["riley", "Armand"], ["cheryl", "Cheryl"], ["marley", "Marley"], ["buck", "Buck"],
  ["mira", "Mira"], ["jasmine", "Jasmine"], ["palmer", "Palmer"], ["thorton", "Thorton"],
  ["prof_rowan", "Professeur Sorbier"], ["prof_oak", "Professeur Chen"], ["rich_boy", "Petit riche"], ["socialite", "Mondaine"],
  ["gentleman", "Gentleman"], ["idol", "Idole"], ["guitarist", "Guitariste"], ["swimmer_f", "Nageuse"],
  ["swimmer_m", "Nageur"], ["fisherman", "Pêcheur"], ["sailor", "Marin"], ["policeman", "Policier"],
];

// Couleurs de type (types de l'époque Platine : pas de type Fée)
const TYPES = {
  normal: ["Normal", "#A8A77A"], fire: ["Feu", "#EE8130"], water: ["Eau", "#6390F0"],
  electric: ["Électrik", "#F7D02C"], grass: ["Plante", "#7AC74C"], ice: ["Glace", "#96D9D6"],
  fighting: ["Combat", "#C22E28"], poison: ["Poison", "#A33EA1"], ground: ["Sol", "#E2BF65"],
  flying: ["Vol", "#A98FF3"], psychic: ["Psy", "#F95587"], bug: ["Insecte", "#A6B91A"],
  rock: ["Roche", "#B6A136"], ghost: ["Spectre", "#735797"], dragon: ["Dragon", "#6F35FC"],
  dark: ["Ténèbres", "#705746"], steel: ["Acier", "#B7B7CE"],
};

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const pale = (hex, w) => `rgb(${rgb(hex).map((v) => Math.round(v * (1 - w) + 255 * w))})`;
const deep = (hex) => `rgb(${rgb(hex).map((v) => Math.round(v * 0.45))})`;
const esc = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const state = { pseudo: "", trainer: null, team: [], search: "", type: null, moves: {}, cur: 0, detail: null, moveSearch: "" };
let roster = [];
let byId = new Map();
let MOVES = {};      // id -> attaque (valeurs de l'époque Platine)
let LEARN = {};      // id Pokémon -> ids des attaques apprenables dans Platine

// ---- Brouillon local (confort uniquement : la page marche sans) ----
const DRAFT_KEY = "pokemon-masta-draft";
function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ pseudo: state.pseudo, trainer: state.trainer, team: state.team, moves: Object.fromEntries(state.team.map((id) => [id, state.moves[id] || []])) })); } catch {}
}
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; } catch { return {}; }
}

const $ = (id) => document.getElementById(id);
function show(step) {
  for (const s of ["step-trainer", "step-team", "step-moves", "step-done"]) $(s).hidden = s !== step;
  window.scrollTo(0, 0);
}
function spriteStyle(key) { return `background-image:url(assets/dresseurs/${key}.png)`; }
function monStyle(p) {
  const c = TYPES[p.types[0]][1];
  return `background:${pale(c, 0.72)};border-color:${pale(c, 0.4)};color:${deep(c)}`;
}

// ---- Étape 1 ----
function renderTrainers() {
  $("trainers").innerHTML = TRAINERS.map(([key, name]) => `
    <button class="trainer${state.trainer === key ? " selected" : ""}" data-key="${key}" aria-pressed="${state.trainer === key}" aria-label="${name}">
      <span class="sprite" style="${spriteStyle(key)}"></span>
    </button>`).join("");
}
$("trainers").addEventListener("click", (e) => {
  const b = e.target.closest(".trainer");
  if (!b) return;
  state.trainer = b.dataset.key;
  $("trainer-error").hidden = true;
  renderTrainers();
  saveDraft();
});
$("pseudo").addEventListener("input", (e) => {
  state.pseudo = e.target.value;
  $("trainer-error").hidden = true;
  saveDraft();
});
$("to-team").addEventListener("click", () => {
  const pseudo = state.pseudo.trim();
  const err = !pseudo ? "Écris ton pseudo." : !state.trainer ? "Choisis ton personnage." : "";
  if (err) { $("trainer-error").textContent = err; $("trainer-error").hidden = false; return; }
  state.pseudo = pseudo;
  goTeam();
});

// ---- Étape 2 ----
function goTeam() {
  $("me-sprite").setAttribute("style", spriteStyle(state.trainer));
  $("me-name").textContent = state.pseudo;
  renderSlots();
  renderGrid();
  show("step-team");
}
$("back").addEventListener("click", () => { renderTrainers(); show("step-trainer"); });

function renderSlots() {
  let html = "";
  for (let i = 0; i < TEAM_SIZE; i++) {
    const p = byId.get(state.team[i]);
    html += p
      ? `<button class="slot filled" data-id="${p.id}" style="${monStyle(p)}" title="Retirer ${esc(p.fr)}">
           <span class="badge">${i + 1}</span><img src="assets/pokemon/${p.id}.png" alt="${esc(p.fr)}"></button>`
      : `<div class="slot">${i + 1}</div>`;
  }
  $("slots").innerHTML = html;
  $("validate").classList.toggle("off", state.team.length < TEAM_SIZE);
}

function renderTypes() {
  $("types").innerHTML = Object.entries(TYPES).map(([k, [label, c]]) =>
    `<button class="type-chip${state.type === k ? " on" : ""}" data-type="${k}" style="background:${pale(c, 0.72)};color:${deep(c)}">${label}</button>`
  ).join("");
}

// La grille est construite une seule fois ; ensuite on ne fait que masquer / marquer les cases.
function buildGrid() {
  $("grid").innerHTML = roster.map((p) => {
    const types = p.types.map((t) => TYPES[t][0]).join(" / ");
    return `<button class="mon" data-id="${p.id}" style="${monStyle(p)}" title="${esc(p.fr)} — ${types}">
      <span class="badge" hidden></span>
      <span class="num">${String(p.id).padStart(3, "0")}</span>
      <img src="assets/pokemon/${p.id}.png" alt="" loading="lazy">
      <span class="name">${esc(p.fr)}</span>
    </button>`;
  }).join("") + `<p class="empty" hidden>Aucun Pokémon ne correspond.</p>`;
}

function renderGrid() {
  const q = norm(state.search.trim());
  const full = state.team.length >= TEAM_SIZE;
  let visible = 0;
  for (const card of $("grid").querySelectorAll(".mon")) {
    const p = byId.get(+card.dataset.id);
    const match = (!q || norm(p.fr).includes(q) || norm(p.en).includes(q)) && (!state.type || p.types.includes(state.type));
    card.hidden = !match;
    if (match) visible++;
    const pos = state.team.indexOf(p.id);
    card.classList.toggle("picked", pos >= 0);
    card.classList.toggle("full", full);
    const badge = card.querySelector(".badge");
    badge.hidden = pos < 0;
    badge.textContent = pos >= 0 ? pos + 1 : "";
  }
  $("grid").querySelector(".empty").hidden = visible > 0;
  renderTypes();
}

function toggle(id) {
  const pos = state.team.indexOf(id);
  if (pos >= 0) { state.team.splice(pos, 1); delete state.moves[id]; }
  else if (state.team.length < TEAM_SIZE) state.team.push(id);
  else return;
  $("team-error").hidden = true;
  renderSlots();
  renderGrid();
  saveDraft();
}
$("grid").addEventListener("click", (e) => { const b = e.target.closest(".mon"); if (b) toggle(+b.dataset.id); });
$("slots").addEventListener("click", (e) => { const b = e.target.closest(".slot.filled"); if (b) toggle(+b.dataset.id); });
$("search").addEventListener("input", (e) => { state.search = e.target.value; renderGrid(); });
$("types").addEventListener("click", (e) => {
  const b = e.target.closest(".type-chip");
  if (!b) return;
  state.type = state.type === b.dataset.type ? null : b.dataset.type;
  renderGrid();
});

$("validate").addEventListener("click", () => {
  const left = TEAM_SIZE - state.team.length;
  if (left > 0) {
    $("team-error").textContent = `Encore ${left} Pokémon à choisir.`;
    $("team-error").hidden = false;
    return;
  }
  goMon(0);
});

// ---- Étape 3 : 6 attaques par Pokémon, dans l'ordre de l'équipe ----
const CAT_FR = { physical: "Physique", special: "Spéciale", status: "Statut" };
// « unknown » = type ??? de Platine (ex. Malédiction), absent des filtres de Pokémon
const typeLabel = (t) => (TYPES[t] ? TYPES[t][0] : "???");
const typeIcon = (t) => `<img class="type-icon" src="assets/types/${t}.png" alt="${typeLabel(t)}" title="${typeLabel(t)}">`;
const curId = () => state.team[state.cur];
const curMoves = () => (state.moves[curId()] ||= []);
const isDone = (id) => (state.moves[id] || []).length >= MOVES_PER_MON;

function goMon(i) {
  state.cur = i;
  state.detail = null;
  state.moveSearch = "";
  $("move-search").value = "";
  $("moves-error").hidden = true;
  const p = byId.get(curId());
  $("cur-img").src = `assets/pokemon/${p.id}.png`;
  $("cur-img").alt = p.fr;
  $("cur-name").textContent = p.fr;
  $("cur-types").innerHTML = p.types.map(typeIcon).join("");
  buildMoveList();
  renderMoves();
  show("step-moves");
}

function buildMoveList() {
  $("move-list").innerHTML = (LEARN[curId()] || []).map((mid) => {
    const m = MOVES[mid];
    return `<button class="move" data-mid="${mid}">${typeIcon(m.type)}<span>${esc(m.fr)}</span></button>`;
  }).join("") + `<p class="empty" hidden>Aucune attaque ne correspond.</p>`;
}

function renderMoves() {
  const id = curId();
  const chosen = curMoves();
  const full = chosen.length >= MOVES_PER_MON;

  $("mon-tabs").innerHTML = state.team.map((tid, i) => {
    const p = byId.get(tid);
    const n = (state.moves[tid] || []).length;
    return `<button class="mon-tab${i === state.cur ? " on" : ""}${isDone(tid) ? " done" : ""}" data-i="${i}" title="${esc(p.fr)}">
      <img src="assets/pokemon/${tid}.png" alt="${esc(p.fr)}"><span>${n}/${MOVES_PER_MON}</span></button>`;
  }).join("");

  $("cur-count").textContent = `${chosen.length}/${MOVES_PER_MON} attaques`;

  let slots = "";
  for (let i = 0; i < MOVES_PER_MON; i++) {
    const m = MOVES[chosen[i]];
    slots += m
      ? `<li><button class="move picked${state.detail === m.id ? " focus" : ""}" data-mid="${m.id}">${typeIcon(m.type)}<span>${esc(m.fr)}</span></button></li>`
      : `<li><div class="move empty-slot">—</div></li>`;
  }
  $("move-slots").innerHTML = slots;

  const q = norm(state.moveSearch.trim());
  let visible = 0;
  for (const b of $("move-list").querySelectorAll(".move")) {
    const mid = +b.dataset.mid;
    const match = !q || norm(MOVES[mid].fr).includes(q);
    b.hidden = !match;
    if (match) visible++;
    b.classList.toggle("picked", chosen.includes(mid));
    b.classList.toggle("focus", state.detail === mid);
    b.classList.toggle("full", full && !chosen.includes(mid));
  }
  $("move-list").querySelector(".empty").hidden = visible > 0;

  $("prev-mon").textContent = state.cur === 0 ? "Équipe" : "Précédent";
  $("prev-mon").title = state.cur === 0 ? "Revenir au choix des Pokémon" : "";
  $("next-mon").textContent = state.cur === state.team.length - 1 ? "Terminer" : "Suivant";
  $("next-mon").classList.toggle("off", !full);
  renderDetail();
}

// Fiche d'attaque : fenêtre flottante ouverte juste à côté de l'attaque cliquée (pas besoin de remonter la page)
let popAnchor = null;
function renderDetail() {
  const pop = $("move-detail");
  const m = MOVES[state.detail];
  if (!m) { pop.hidden = true; popAnchor = null; return; }
  const chosen = curMoves();
  const has = chosen.includes(m.id);
  const full = chosen.length >= MOVES_PER_MON;
  const val = (v, suffix = "") => (v == null ? "—" : v + suffix);
  pop.innerHTML = `
    <button class="pop-close" data-act="close" aria-label="Fermer">×</button>
    <div class="detail-head">
      ${typeIcon(m.type)}<img class="type-icon" src="assets/types/${m.cat}.png" alt="${CAT_FR[m.cat]}" title="${CAT_FR[m.cat]}">
      <span class="detail-name">${esc(m.fr)}</span>
    </div>
    <dl class="detail-stats">
      <div><dt>Catégorie</dt><dd>${CAT_FR[m.cat]}</dd></div>
      <div><dt>Puissance</dt><dd>${val(m.power)}</dd></div>
      <div><dt>Précision</dt><dd>${val(m.acc, " %")}</dd></div>
      <div><dt>PP</dt><dd>${val(m.pp)}</dd></div>
      ${m.prio ? `<div><dt>Priorité</dt><dd>${m.prio > 0 ? "+" : ""}${m.prio}</dd></div>` : ""}
    </dl>
    <p class="detail-desc">${esc(m.desc)}</p>
    <div class="detail-actions">
      ${has ? `<button class="btn" data-act="toggle">Oublier</button>`
        : full ? `<span class="detail-full">${MOVES_PER_MON} attaques déjà choisies : oublies-en une d'abord.</span>`
        : `<button class="btn primary" data-act="toggle">Apprendre</button>`}
    </div>`;
  pop.hidden = false;
  placePop();
}

function placePop() {
  const pop = $("move-detail");
  if (pop.hidden || !popAnchor || !popAnchor.isConnected) return;
  if (window.innerWidth <= 760) { pop.removeAttribute("style"); return; } // téléphone : volet en bas de l'écran
  const r = popAnchor.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight, m = 8, W = window.innerWidth, H = window.innerHeight;
  let left, top;
  if (r.right + m + w <= W - m) left = r.right + m;            // à droite de l'attaque
  else if (r.left - m - w >= m) left = r.left - m - w;          // sinon à gauche
  if (left !== undefined) {
    top = Math.min(Math.max(m, r.top), H - h - m);
  } else {                                                      // sinon dessous (ou dessus)
    left = Math.min(Math.max(m, r.left), W - w - m);
    top = r.bottom + m + h <= H - m ? r.bottom + m : Math.max(m, r.top - m - h);
  }
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}
function closePop() { state.detail = null; renderMoves(); }

function toggleMove(mid) {
  const chosen = curMoves();
  const pos = chosen.indexOf(mid);
  if (pos >= 0) chosen.splice(pos, 1);
  else if (chosen.length < MOVES_PER_MON) chosen.push(mid);
  else return;
  $("moves-error").hidden = true;
  saveDraft();
  renderMoves();
}

function onMoveClick(e) {
  const b = e.target.closest(".move[data-mid]");
  if (!b) return;
  const mid = +b.dataset.mid;
  if (state.detail === mid && popAnchor === b) return closePop();   // re-clic : on referme
  state.detail = mid;
  popAnchor = b;
  renderMoves();
  popAnchor = document.querySelector(`#${b.closest("#move-slots") ? "move-slots" : "move-list"} .move[data-mid="${mid}"]`);
  placePop();
}
function onMoveDblClick(e) {
  const b = e.target.closest(".move[data-mid]");
  if (b) toggleMove(+b.dataset.mid);
}
for (const el of ["move-list", "move-slots"]) {
  $(el).addEventListener("click", onMoveClick);
  $(el).addEventListener("dblclick", onMoveDblClick);
}
$("move-detail").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  if (b.dataset.act === "toggle") toggleMove(state.detail);
  closePop();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.detail != null) closePop(); });
document.addEventListener("click", (e) => {
  if (state.detail == null || e.target.closest("#move-detail, .move[data-mid]")) return;
  closePop();
});
window.addEventListener("scroll", () => { if (window.innerWidth > 760) placePop(); }, { passive: true });
window.addEventListener("resize", placePop);
$("move-search").addEventListener("input", (e) => { state.moveSearch = e.target.value; renderMoves(); });
$("mon-tabs").addEventListener("click", (e) => { const b = e.target.closest(".mon-tab"); if (b) goMon(+b.dataset.i); });
$("prev-mon").addEventListener("click", () => (state.cur === 0 ? goTeam() : goMon(state.cur - 1)));
$("next-mon").addEventListener("click", () => {
  const left = MOVES_PER_MON - curMoves().length;
  if (left > 0) {
    $("moves-error").textContent = `Encore ${left} attaque${left > 1 ? "s" : ""} à choisir.`;
    $("moves-error").hidden = false;
    return;
  }
  if (state.cur < state.team.length - 1) return goMon(state.cur + 1);
  const missing = state.team.findIndex((id) => !isDone(id));
  if (missing >= 0) return goMon(missing);
  renderRecap();
  show("step-done");
});

// ---- Étape 4 : récap ----
function renderRecap() {
  $("done-title").textContent = "Équipe prête !";
  $("send-status").textContent = "Vérifie ton équipe, puis envoie-la à Léo.";
  $("send").hidden = false;
  $("send").classList.remove("off");
  $("recap").innerHTML = `
    <div class="me"><span class="sprite" style="${spriteStyle(state.trainer)}"></span><span>${esc(state.pseudo)}</span></div>
    <div class="recap-team">${state.team.map((id, i) => {
      const p = byId.get(id);
      return `<div class="frame recap-mon">
        <div class="recap-head"><span class="badge">${i + 1}</span><img src="assets/pokemon/${id}.png" alt=""><span class="cur-name">${esc(p.fr)}</span></div>
        <ul>${state.moves[id].map((mid) => `<li>${typeIcon(MOVES[mid].type)}<span>${esc(MOVES[mid].fr)}</span></li>`).join("")}</ul>
      </div>`;
    }).join("")}</div>`;
}
$("edit").addEventListener("click", goTeam);

// ---- Démarrage ----
Promise.all(["roster", "moves", "learnsets"].map((f) => fetch(`data/${f}.json`).then((r) => r.json())))
  .then(([data, moves, learn]) => {
    roster = data;
    MOVES = moves;
    LEARN = learn;
    byId = new Map(roster.map((p) => [p.id, p]));
    buildGrid();
    const d = loadDraft();
    state.pseudo = d.pseudo || "";
    state.trainer = TRAINERS.some(([k]) => k === d.trainer) ? d.trainer : null;
    state.team = (d.team || []).filter((id) => byId.has(id)).slice(0, TEAM_SIZE);
    for (const id of state.team) {
      const ok = new Set(LEARN[id] || []);
      state.moves[id] = ((d.moves || {})[id] || []).filter((m) => ok.has(m)).slice(0, MOVES_PER_MON);
    }
    $("pseudo").value = state.pseudo;
    renderTrainers();
  });

// ---- Envoi par mail (FormSubmit : pas de serveur, pièces jointes jusqu'à 10 Mo) ----
// Le mail contient : un résumé lisible, equipe-<pseudo>.json (toutes les données pour la conception du jeu),
// une carte image de l'équipe, et les sprites (6 Pokémon + planche du personnage).
const SEND_ENDPOINT = "https://formsubmit.co/ajax/contact@quartzsolutions.fr";

const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "dresseur";
const trainerName = (key) => (TRAINERS.find(([k]) => k === key) || [key, key])[1];

function teamData() {
  return {
    format: "pokemon-masta-equipe/1",
    envoye_le: new Date().toISOString(),
    pseudo: state.pseudo,
    personnage: { cle: state.trainer, nom: trainerName(state.trainer), planche: `${state.trainer}.png`, vue_de_face: "images 4 à 7 (32×32) d'une planche 32×512" },
    equipe: state.team.map((id, i) => {
      const p = byId.get(id);
      return {
        emplacement: i + 1, id, nom: p.fr, nom_en: p.en, types: p.types, sprite: `pokemon-${id}.png`,
        attaques: state.moves[id].map((mid) => {
          const m = MOVES[mid];
          return { id: m.id, nom: m.fr, nom_en: m.en, type: m.type, categorie: m.cat, puissance: m.power, precision: m.acc, pp: m.pp, priorite: m.prio, description: m.desc };
        }),
      };
    }),
    sources: "Données de l'époque Platine (PokeAPI, groupe de versions 9). Sprites : Pokédex Platine (PokeAPI) et décompilé pret/pokeplatinum.",
  };
}

const loadImg = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });

// Carte récap dessinée en pixels nets (police Platine, icônes de type)
async function teamCard() {
  await document.fonts.load('32px "Platine"');
  const colW = 420, headH = 112, rowH = 34, monH = headH + MOVES_PER_MON * rowH + 20, pad = 16, top = 120;
  const W = pad * 2 + colW * 3 + 16 * 2, H = top + monH * 2 + 16 + pad;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  g.fillStyle = "#e9eaf0"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#383840"; g.fillRect(0, 0, W, 96); g.fillStyle = "#c8a858"; g.fillRect(0, 96, W, 4);
  const text = (t, x, y, size = 32, color = "#383838", shadow = "#d8d8d8") => {
    g.font = `${size}px "Platine"`; g.textBaseline = "top"; const s = size / 16;
    g.fillStyle = shadow; g.fillText(t, x + s, y); g.fillText(t, x, y + s); g.fillText(t, x + s, y + s);
    g.fillStyle = color; g.fillText(t, x, y);
  };
  const sheet = await loadImg(`assets/dresseurs/${state.trainer}.png`);
  g.drawImage(sheet, 0, 128, 32, 32, pad, 2, 96, 96);
  text(`Équipe de ${state.pseudo}`, pad + 110, 28, 48, "#f8f8f8", "#707078");
  for (let i = 0; i < state.team.length; i++) {
    const id = state.team[i], p = byId.get(id);
    const x = pad + (i % 3) * (colW + 16), y = top + Math.floor(i / 3) * (monH + 16);
    g.fillStyle = "#fff"; g.fillRect(x, y, colW, monH);
    g.strokeStyle = "#4a5a78"; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, colW - 4, monH - 4);
    g.drawImage(await loadImg(`assets/pokemon/${id}.png`), x + 10, y + 12, 96, 96);
    text(`${i + 1}. ${p.fr}`, x + 116, y + 24);
    let tx = x + 116;
    for (const t of p.types) { g.drawImage(await loadImg(`assets/types/${t}.png`), tx, y + 66, 64, 32); tx += 70; }
    for (let k = 0; k < state.moves[id].length; k++) {
      const m = MOVES[state.moves[id][k]], my = y + headH + 8 + k * rowH;
      g.drawImage(await loadImg(`assets/types/${m.type}.png`), x + 14, my, 64, 32);
      text(m.fr, x + 88, my);
    }
  }
  return new Promise((ok) => c.toBlob(ok, "image/png"));
}

async function buildSubmission() {
  const data = teamData();
  const fd = new FormData();
  fd.append("_subject", `Pokémon Masta — équipe de ${state.pseudo}`);
  fd.append("_template", "table");
  fd.append("_captcha", "false");
  fd.append("Pseudo", state.pseudo);
  fd.append("Personnage", `${trainerName(state.trainer)} (${state.trainer})`);
  data.equipe.forEach((p) => {
    fd.append(`Pokémon ${p.emplacement}`, `${p.nom} (#${p.id}) : ${p.attaques.map((a) => a.nom).join(", ")}`);
  });
  fd.append("Données", "Toutes les données sont dans le fichier JSON joint (à transférer à la session du jeu).");
  const name = slug(state.pseudo);
  fd.append("donnees", new File([JSON.stringify(data, null, 2)], `equipe-${name}.json`, { type: "application/json" }));
  fd.append("carte", new File([await teamCard()], `carte-equipe-${name}.png`, { type: "image/png" }));
  const blob = async (url) => (await fetch(url)).blob();
  fd.append("personnage", new File([await blob(`assets/dresseurs/${state.trainer}.png`)], `${state.trainer}.png`, { type: "image/png" }));
  for (const p of data.equipe) {
    fd.append(`sprite${p.emplacement}`, new File([await blob(`assets/pokemon/${p.id}.png`)], `pokemon-${p.id}.png`, { type: "image/png" }));
  }
  return fd;
}

$("send").addEventListener("click", async () => {
  const btn = $("send"), status = $("send-status");
  if (btn.dataset.busy) return;
  btn.dataset.busy = "1";
  btn.classList.add("off");
  status.textContent = "Envoi en cours…";
  try {
    const res = await fetch(SEND_ENDPOINT, { method: "POST", body: await buildSubmission(), headers: { Accept: "application/json" } });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || String(out.success) === "false") throw new Error(out.message || `HTTP ${res.status}`);
    $("done-title").textContent = "Équipe envoyée !";
    status.textContent = "C'est parti, Léo a bien reçu ton équipe. Tu peux fermer la page.";
    btn.hidden = true;
  } catch (err) {
    console.error(err);
    status.textContent = "L'envoi n'a pas marché. Vérifie ta connexion et réessaie.";
    btn.classList.remove("off");
  } finally {
    delete btn.dataset.busy;
  }
});
