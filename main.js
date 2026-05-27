const murAttrsPanel = document.getElementById("mur-attributes-panel");
const murSelectedInfo = document.getElementById("mur-selected-info");
const murTypeSelect = document.getElementById("mur-type-materiau");
const murAttrsApplyBtn = document.getElementById("mur-attrs-apply");
const murTypeStructSelect = document.getElementById("mur-type-struct");
const murTypeStructRampantSelect = document.getElementById("mur-type-struct-rampant");

const poutreAttrsPanel = document.getElementById("poutre-attributes-panel");
const poutreSelectedInfo = document.getElementById("poutre-selected-info");
const poutreAttrsApplyBtn = document.getElementById("poutre-attrs-apply");
const poutreHaN0 = document.getElementById("poutre-ha-n-0");
const poutreHaD0 = document.getElementById("poutre-ha-d-0");
const poutreHaN1 = document.getElementById("poutre-ha-n-1");
const poutreHaD1 = document.getElementById("poutre-ha-d-1");
const poutreHaN2 = document.getElementById("poutre-ha-n-2");
const poutreHaD2 = document.getElementById("poutre-ha-d-2");
const poutreHaN3 = document.getElementById("poutre-ha-n-3");
const poutreHaD3 = document.getElementById("poutre-ha-d-3");
const poutreAstPreview = document.getElementById("poutre-ast-preview");
const poutreSectionOverrideCb = document.getElementById("poutre-section-override");
const poutreSectionFields = document.getElementById("poutre-section-fields");
const poutreSectionB = document.getElementById("poutre-section-b");
const poutreSectionH = document.getElementById("poutre-section-h");
const poutreTypeMurSelect = document.getElementById("poutre-type-mur");
const poutreTypeStructSelect = document.getElementById("poutre-type-struct");
// main.js
// Prototype : chargement IFC + vue 3D (IfcViewerAPI) + calcul sismique très simplifié.

import { IfcViewerAPI } from "web-ifc-viewer";
import * as THREE from "three";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer";

// Numéro de version de l'appli (à incrémenter à chaque itération)
const APP_VERSION = "V1.1.34";

// --- ÉTAT GLOBAL SIMPLIFIÉ -------------------------------------------------

const state = {
  ifcLoaded: false,
  selectedFile: null,
  viewer: null,
  ifcModelID: null,
  loadedModel: null,
  modelOffsetY: 0,
  importedElements: [],
  // Dans une version ultérieure, ces deux tableaux viendront directement de l’IFC :
  mursPorteurs: [], // { id, nom, longueur, niveau, directionPortance }
  niveaux: [], // { id, z, masseApprox }
  charpenteAttributes: {}, // expressID -> { sens, matCharpente, ... }
  mursAttributes: {}, // expressID -> { typeMurKey }
  poutresAttributes: {}, // expressID -> { Ast }
  associationMask: {
    murs: {}, // murId -> Set(dalleIds) ou tableau
    poutres: {}, // poutreId -> Set(dalleIds) ou tableau
  },
  murToSlabs: {}, // rempli lors de computeAdjacencesMurDalle
  slabToMurs: {},
  poutreToSlabs: {},
  associationCounters: {
    murs: {}, // murId -> { dalleId: compteur }
    poutres: {}, // poutreId: { dalleId: compteur }
  },
  // Pour les murs à plusieurs hauteurs : segment de hauteur sélectionné par mur (index dans heightSegments / heightSegmentsDetail)
  selectedWallSegments: {}, // murId -> segmentIndex (0,1,2,...)
  // Configuration fine par arase de mur : murs[murId][araseIndex] = { enabled, slabs: { slabId: { enabled, stacks: [bool,bool,bool] } }, stackRefs: { 1: { refHaute, refBasse, userHaute, userBasse } } }
  wallAraseConfig: {
    murs: {},
  },
  // Configuration par poutre / dalle : poutres[poutreId][slabId] = { enabled, stacks: [bool,bool,bool] }
  poutreStackConfig: {},
  // Résultats calcul : murId -> { stable:boolean }
  massStabilityByMur: {},
  // Résultats calcul : poutreId -> { stable:boolean }
  massStabilityByPoutre: {},
  // Offsets manuels (drag-and-drop) appliqués aux étiquettes de la vue
  // "Effort en tête de mur" : labelKey -> { dx, dy }.
  effortsTopViewLabelPositions: {},
};

// --- SÉLECTION DES ÉLÉMENTS DU DOM ----------------------------------------

const fileInput = document.getElementById("ifc-file-input");
const tagEtat = document.querySelector(".tag");
const viewerContainer = document.getElementById("viewer-container");
const viewerOverlay = document.getElementById("viewer-overlay");

const agInput = document.getElementById("ag");
const qInput = document.getElementById("q");
const gammaIInput = document.getElementById("gammaI");
const psiExploitInput = document.getElementById("psiExploit");
const coeffSolInput = document.getElementById("coeffSol");
const psiAltInput = document.getElementById("psiAlt");
const sdTInput = document.getElementById("sdT");
const graviteInput = document.getElementById("gravite");

const zoneSismiqueSelect = document.getElementById("zoneSismique");
const categorieBatimentSelect = document.getElementById("categorieBatiment");
const classeSolSelect = document.getElementById("classeSol");
const coeffComportementSelect = document.getElementById("coeffComportement");
const categorieChargesSelect = document.getElementById("categorieCharges");
const altimetrieSelect = document.getElementById("altimetrie");

const btnReset = document.getElementById("btn-reset");
const btnCalcul = document.getElementById("btn-calcul");
const btnCalculFinal = document.getElementById("btn-calcul-final");
const resultsDiv = document.getElementById("results");
const btnLoadIfc = document.getElementById("btn-load-ifc");
const btnExportStudy = document.getElementById("btn-export-study");
const btnImportStudy = document.getElementById("btn-import-study");
const studyImportInput = document.getElementById("study-import-input");
const versionLabel = document.getElementById("app-version");

const elementsPanel = document.getElementById("elements-panel");
const elementsCountCharpente = document.getElementById("elements-count-charpente");
const elementsCountMurs = document.getElementById("elements-count-murs");
const elementsCountPoutres = document.getElementById("elements-count-poutres");
const filterSearchInput = document.getElementById("filter-search");
const elementsTbodyCharpente = document.getElementById("elements-tbody-charpente");
const elementsTbodyMurs = document.getElementById("elements-tbody-murs");
const elementsTbodyPoutres = document.getElementById("elements-tbody-poutres");

const tabButtons = document.querySelectorAll(".tab-btn");
const seismicTab = document.getElementById("tab-seismic");
const materialsTab = document.getElementById("tab-materials");
const definirTab = document.getElementById("tab-definir");
const resultatsTab = document.getElementById("tab-resultats");
const resultsTabBtn = document.getElementById("tab-results-btn");
const massesTab = document.getElementById("tab-masses");
const massesTabBtn = document.getElementById("tab-masses-btn");
const massesResultsDiv = document.getElementById("mass-results");
const btnExportMassesExcel = document.getElementById("btn-export-masses-excel");
const btnExportMassesPdf = document.getElementById("btn-export-masses-pdf");
const btnExportNoteCalculPdf = document.getElementById("btn-export-note-calcul-pdf");
const btnExport3dPdf = document.getElementById("btn-export-3d-pdf");
const btnExportEffortsTopPdf = document.getElementById("btn-export-efforts-top-pdf");

const panelPlanPreview = document.getElementById("panel-plan-preview");
const planPreviewContainer = document.getElementById("plan-preview-container");
const btnPlanRefresh = document.getElementById("btn-plan-refresh");
const btnPlanReset = document.getElementById("btn-plan-reset");

const panelViewer = document.querySelector(".panel-viewer");
const panelElementsWrapper = document.querySelector(".panel-elements");
const associationPanel = document.getElementById("association-panel");
const mainLayout = document.querySelector("main");

const charpenteAttrsPanel = document.getElementById("charpente-attributes-panel");
const charpenteSelectedInfo = document.getElementById("charpente-selected-info");
const charpenteSensSelect = document.getElementById("charpente-sens");
const charpenteMatCharpente = document.getElementById("charpente-mat-charpente");
const charpenteMatVolige = document.getElementById("charpente-mat-volige");
const charpenteMatCouverture = document.getElementById("charpente-mat-couverture");
const charpenteMatIsolant = document.getElementById("charpente-mat-isolant");
const charpenteMatPlafond = document.getElementById("charpente-mat-plafond");
const charpenteMatPlancher = document.getElementById("charpente-mat-plancher");
const charpenteMatCloisons = document.getElementById("charpente-mat-cloisons");
const charpenteMatAutres = document.getElementById("charpente-mat-autres");
const charpenteQexpInput = document.getElementById("charpente-Qexp");
const charpenteGmlInput = document.getElementById("charpente-Gml");
const charpenteQmlInput = document.getElementById("charpente-Qml");
const charpenteAttrsApplyBtn = document.getElementById("charpente-attrs-apply");
const charpenteGqSummary = document.getElementById("charpente-gq-summary");

const elementsGroupHeaders = document.querySelectorAll(".elements-group-header");
const selectAllCharpenteCheckbox = document.getElementById("select-all-charpente");
const selectAllMursCheckbox = document.getElementById("select-all-murs");
const selectAllPoutresCheckbox = document.getElementById("select-all-poutres");

const selectAllMursLabel = selectAllMursCheckbox?.parentElement || null;
const selectAllPoutresLabel = selectAllPoutresCheckbox?.parentElement || null;

const charpenteGroupWrapper = document.getElementById("elements-group-charpente");
const mursGroupWrapper = document.getElementById("elements-group-murs");
const poutresGroupWrapper = document.getElementById("elements-group-poutres");

let currentMainTab = "seismic";

const MATERIALS_STORAGE_KEY = "effort_en_tete_mur_materials_v1";
const MATERIALS_LABELS_STORAGE_KEY = "effort_en_tete_mur_materials_labels_v1";
const MATERIALS_DEFAULTS = {
  // Charpente (daN/m²)
  "charpente.pas": 0,
  "charpente.fermettes": 25,
  "charpente.tradi-bois": 40,
  "charpente.tradi-bois-metal": 40,
  "charpente.tradi-bois-contrevent": 50,
  "charpente.metal": 40,
  "charpente.libre1": 0,
  "charpente.libre2": 0,
  // Murs (daN/m³)
  "mur.agg-creux": 1450,
  "mur.agg-semi": 1800,
  "mur.agg-pleins": 2250,
  "mur.brique": 1250,
  "mur.vertical-bloc": 2700,
  "mur.voile-ba": 2500,
  "mur.ossature-bois": 450,
  "mur.libre1": 0,
  "mur.libre2": 0,
  // Plafond (daN/m²)
  "plafond.pas": 0,
  "plafond.brique-platre": 40,
  "plafond.placo": 15,
  "plafond.perfo-enduit": 30,
  "plafond.double-placo": 30,
  "plafond.gyplat": 25,
  "plafond.placostil": 15,
  "plafond.libre1": 0,
  "plafond.libre2": 0,
  // Couverture (daN/m²)
  "couverture.pas": 0,
  "couverture.tuiles": 50,
  "couverture.ardoises": 30,
  "couverture.osb-etanche": 30,
  "couverture.osb-etanche-veg": 60,
  "couverture.osb-etanche-isolant": 40,
  "couverture.bac-acier": 27,
  "couverture.libre1": 0,
  "couverture.libre2": 0,
  // Plancher (daN/m²)
  "plancher.pas": 0,
  "plancher.bois": 50,
  "plancher.bois-metal": 70,
  "plancher.metal": 90,
  "plancher.libre1": 0,
  "plancher.libre2": 0,
  // Cloisons sur plancher (daN/m²)
  "cloisons.pas": 0,
  "cloisons.legeres": 80,
  "cloisons.lourdes": 120,
  "cloisons.libre1": 0,
  "cloisons.libre2": 0,
  // Autres (daN/m²)
  "autres.grenier": 40,
  "autres.non": 0,
  "autres.libre1": 0,
  "autres.libre2": 0,
  // Volige / OSB (daN/m²)
  "volige.plus15": 20,
  "volige.15": 12,
  "volige.pas": 0,
  // Isolants (daN/m²)
  "isolant.pas": 0,
  "isolant.leger": 15,
  "isolant.dense": 30,
};

// Tableau des types de chaînage de mur (pour futur calcul)
const MUR_TYPE_TABLE = {
  "Type 1": {
    description: "CH 15x15Ht mini avec 4 HA10 filants + cad HA5 (e≈15cm)",
    b: 0.15,
    h: 0.15,
    d1: 4.0,
    d2: 4.0,
    As1: 1.57,
    Mmax: 7120,
  },
  "Type 2": {
    description: "CH 15x15Ht mini avec 2 HA14 filants + étrier HA5 (e≈15cm)",
    b: 0.15,
    h: 0.15,
    d1: 7.5,
    d2: 7.5,
    As1: 1.57,
    Mmax: 4040,
  },
  "Type 3": {
    description: "CH dans Vertical Bloc avec deux fois 2 HA10 filants",
    b: 0.30,
    h: 0.09,
    d1: 4.5,
    d2: 4.5,
    As1: 1.57,
    Mmax: 2020,
  },
  "Type 4": {
    description: "CH 20x10Ht rampant avec 2 HA10 filants",
    b: 0.10,
    h: 0.20,
    d1: 4.0,
    d2: 4.0,
    As1: 0.79,
    Mmax: 5710,
  },
  "Type 5": {
    description: "CH 20x15Ht avec 4 HA10 filants + cad HA5 (e≈15cm)",
    b: 0.15,
    h: 0.20,
    d1: 6.5,
    d2: 6.5,
    As1: 1.57,
    Mmax: 8990,
  },
  "Type 6": {
    description: "CH 20x15Ht avec 2 HA14 filants + étrier HA5 (e≈15cm)",
    b: 0.15,
    h: 0.20,
    d1: 10.0,
    d2: 10.0,
    As1: 1.57,
    Mmax: 6320,
  },
  "Type 7": {
    description: "CH 20x20Ht avec 4 HA10 filants + cad HA5 (e≈15cm)",
    b: 0.20,
    h: 0.20,
    d1: 6.5,
    d2: 6.5,
    As1: 1.57,
    Mmax: 9550,
  },
  "Type 8": {
    description: "CH 20x20Ht avec 2 HA14 filants + étrier HA5 (e≈15cm)",
    b: 0.20,
    h: 0.20,
    d1: 10.0,
    d2: 10.0,
    As1: 1.57,
    Mmax: 6740,
  },
};

const selectedExpressIDs = new Set();
let selectionMaterial = null;
let hoverMaterial = null;
let slabLabelRenderer = null;
const slabLabelObjects = new Map();
const slabBearingArrowObjects = new Map();
const massWallLabelObjects = new Map();
const massBeamLabelObjects = new Map();

if (versionLabel) {
  versionLabel.textContent = APP_VERSION;
}
console.log("Efforts en tête de mur - version", APP_VERSION);

// État initial : aucun IFC chargé
// (la couleur de la pastille est configurée en rouge par défaut dans le CSS)

// --- MISE À JOUR DES FACTEURS EN FONCTION DES MENUS DÉROULANTS ---------------

function updateSeismicFactorsFromSelectors() {
  if (zoneSismiqueSelect) {
    const opt = zoneSismiqueSelect.selectedOptions[0];
    const ag = opt?.dataset?.ag;
    if (ag != null && agInput) agInput.value = String(ag);
  }
  if (categorieBatimentSelect) {
    const opt = categorieBatimentSelect.selectedOptions[0];
    const gammaI = opt?.dataset?.gammai;
    if (gammaI != null && gammaIInput) gammaIInput.value = String(gammaI);
  }
  if (classeSolSelect) {
    const opt = classeSolSelect.selectedOptions[0];
    const sol = opt?.dataset?.sol;
    if (sol != null && coeffSolInput) coeffSolInput.value = String(sol);
  }
  if (coeffComportementSelect) {
    const opt = coeffComportementSelect.selectedOptions[0];
    const q = opt?.dataset?.q;
    if (q != null && qInput) qInput.value = String(q);
  }
  if (categorieChargesSelect) {
    const opt = categorieChargesSelect.selectedOptions[0];
    const psi = opt?.dataset?.psi;
    if (psi != null && psiExploitInput) psiExploitInput.value = String(psi);
  }
  if (altimetrieSelect) {
    const opt = altimetrieSelect.selectedOptions[0];
    const altVal = opt?.value;
    let psiAlt = 0;
    if (altVal === ">1000") {
      psiAlt = 0.2;
    }
    if (psiAltInput) psiAltInput.value = String(psiAlt);
  }

  updateCharpenteGqSummaryPreview();

  // Mise à jour de l'accélération sismique réelle Sd(T)
  const agVal = parseFloat(agInput?.value ?? "0");
  const gammaIVal = parseFloat(gammaIInput?.value ?? "0");
  const sVal = parseFloat(coeffSolInput?.value ?? "0");
  const qVal = parseFloat(qInput?.value ?? "0");
  if (
    sdTInput &&
    Number.isFinite(agVal) &&
    Number.isFinite(gammaIVal) &&
    Number.isFinite(sVal) &&
    Number.isFinite(qVal) &&
    qVal !== 0
  ) {
    const sdT = agVal * gammaIVal * sVal * (2.5 / qVal);
    sdTInput.value = sdT.toFixed(2);
  }
}

zoneSismiqueSelect?.addEventListener("change", updateSeismicFactorsFromSelectors);
categorieBatimentSelect?.addEventListener("change", updateSeismicFactorsFromSelectors);
classeSolSelect?.addEventListener("change", updateSeismicFactorsFromSelectors);
coeffComportementSelect?.addEventListener("change", updateSeismicFactorsFromSelectors);
categorieChargesSelect?.addEventListener("change", updateSeismicFactorsFromSelectors);
altimetrieSelect?.addEventListener("change", updateSeismicFactorsFromSelectors);

// Initialisation des valeurs numériques à partir des sélections par défaut
updateSeismicFactorsFromSelectors();

// --- Onglets paramètres / matériaux ------------------------------------------
function setActiveMainTab(target) {
  const previousTab = currentMainTab;
  currentMainTab = target;
  tabButtons.forEach((b) => b.classList.remove("active"));
  const btn = Array.from(tabButtons).find((b) => b.dataset.tab === target) || null;
  if (btn) btn.classList.add("active");

  seismicTab?.classList.remove("active");
  materialsTab?.classList.remove("active");
  definirTab?.classList.remove("active");
  resultatsTab?.classList.remove("active");
  massesTab?.classList.remove("active");

  if (target === "materials") {
    materialsTab?.classList.add("active");
  } else if (target === "definir") {
    definirTab?.classList.add("active");
  } else if (target === "resultats") {
    resultatsTab?.classList.add("active");
  } else if (target === "masses") {
    massesTab?.classList.add("active");
  } else {
    seismicTab?.classList.add("active");
  }

  const showAnalysisPanels = target === "definir" || target === "resultats" || target === "masses";
  if (panelViewer) panelViewer.style.display = showAnalysisPanels ? "" : "none";
  // En "masses" et "resultats" (Association) : on masque les Éléments importés pour laisser la place à la 3D / liste d'association
  if (panelElementsWrapper) {
    if (target === "masses" || target === "resultats") {
      panelElementsWrapper.style.display = "none";
    } else {
      panelElementsWrapper.style.display = showAnalysisPanels ? "" : "none";
    }
  }
  if (associationPanel) associationPanel.style.display = target === "resultats" ? "" : "none";
  if (mainLayout) {
    mainLayout.classList.toggle("layout-association", target === "resultats");
    mainLayout.classList.toggle("layout-masses", target === "masses");
  }
  if (mainLayout) {
    mainLayout.classList.toggle("layout-association", target === "resultats");
    mainLayout.classList.toggle("layout-masses", target === "masses");
  }

  // Sur l’onglet Résultat, on masque la partie charpente et tous les panneaux d’attributs
  if (target === "resultats" || target === "masses") {
    if (charpenteGroupWrapper) charpenteGroupWrapper.style.display = "none";
    if (charpenteAttrsPanel) charpenteAttrsPanel.style.display = "none";
    if (murAttrsPanel) murAttrsPanel.style.display = "none";
    if (poutreAttrsPanel) poutreAttrsPanel.style.display = "none";
    if (selectAllMursLabel) selectAllMursLabel.style.display = "none";
    if (selectAllPoutresLabel) selectAllPoutresLabel.style.display = "none";
  } else {
    if (charpenteGroupWrapper) charpenteGroupWrapper.style.display = "";
    if (selectAllMursLabel) selectAllMursLabel.style.display = "";
    if (selectAllPoutresLabel) selectAllPoutresLabel.style.display = "";
    // Les panneaux d’attributs seront contrôlés par les fonctions de mise à jour
  }

  // Passage entre "Définir modèle" et "Résultat" : on réinitialise la sélection
  if (
    (previousTab === "definir" && target === "resultats") ||
    (previousTab === "resultats" && target === "definir")
  ) {
    selectedExpressIDs.clear();
    try {
      clearHighlight();
      clearHoverHighlight();
    } catch (_) {}
    renderElementsTables();
    updateAllAttributePanels();
  }

  // Entrée sur "Résultats masses" : on désélectionne tout avant de désactiver la sélection
  if (target === "masses") {
    selectedExpressIDs.clear();
    try {
      clearHighlight();
      clearHoverHighlight();
    } catch (_) {}
    renderElementsTables();
  }

  if (target !== "resultats") {
    clearAllSlabLabels();
  } else {
    updateSlabLabels();
  }

  // Surbrillance stable/instable uniquement sur l'onglet masses
  if (target === "masses") {
    applyMassStabilityHighlight();
    updateMassWallLabels();
    updateMassBeamLabels();
  } else {
    clearMassStabilityHighlight();
    updateMassWallLabels();
    updateMassBeamLabels();
  }

  // Aperçu interactif "Effort en tête de mur" : visible uniquement sur l'onglet
  // Résultats masses. On le re-rend dès l'entrée sur l'onglet pour qu'il reflète
  // l'état courant des calculs et la dernière disposition manuelle.
  if (panelPlanPreview) {
    if (target === "masses") {
      panelPlanPreview.style.display = "";
      renderEffortsTopPreview();
    } else {
      panelPlanPreview.style.display = "none";
    }
  }

  // Si on affiche de nouveau la vue 3D ou qu'on change de layout,
  // on force un resize du viewer (et des labels) après reflow.
  if (showAnalysisPanels) {
    resizeViewerAndLabels();
  }

  if (target === "definir") {
    updateCharpenteBearingArrows();
  } else {
    clearCharpenteBearingArrows();
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab || "seismic";
    setActiveMainTab(target);
  });
});

btnCalculFinal?.addEventListener("click", () => {
  if (!state.ifcLoaded) return;
  if (massesTabBtn) massesTabBtn.style.display = "";
  renderMassResults();
  setActiveMainTab("masses");
});

btnExportMassesExcel?.addEventListener("click", () => {
  const cases = buildMassCases();
  const { sdT, g } = getSdTandG();
  const rows = buildMassTableRows(cases, sdT, g);
  const header = [
    "Type",
    "ID",
    "Arase",
    "H arase [m]",
    "Stack",
    "Dalles",
    "H dalle (top) [m]",
    "H calc mur [m]",
    "Mat / densité",
    "Masse mur [daN]",
    "Masse dalles [daN]",
    "Masse poutre [daN]",
    "Total [daN]",
    "Effort en tête [daN/ml]",
    "A_tri pignon [m²]",
    "Eff. pointe 65% [daN]",
    "Vérifié sur",
    "Auto-stabilité",
    "Nb. ancrage",
  ];
  const lines = [header];
  rows.forEach((r) => {
    lines.push([
      r.type,
      r.id,
      r.arase ?? "",
      r.hArase ?? "",
      r.stack ?? "",
      r.dalles ?? "",
      r.hDalleTop ?? "",
      r.hCalcMur ?? "",
      r.mat ?? "",
      r.masseMur ?? "",
      r.masseDalles ?? "",
      r.massePoutre ?? "",
      r.total ?? "",
      r.effortTete ?? "",
      r.pignonATriM2 ?? "",
      r.pignonEffortPointe ?? "",
      r.verifieSur ?? "",
      r.autoStab ?? "",
      r.nbAncrage ?? "",
    ]);
  });
  const csv = lines
    .map((row) => row.map(escapeCsvCell).join(";"))
    .join("\r\n");
  downloadBlob(`resultats_masses_${APP_VERSION}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
});

btnExportMassesPdf?.addEventListener("click", () => {
  const html = massesResultsDiv?.innerHTML || "";
  openPrintWindow(
    "Résultats masses (tableau)",
    `<h1>Résultats masses</h1><div class="meta">${APP_VERSION}</div>${html}`,
    { landscape: true, fitTable: true }
  );
});

btnExportNoteCalculPdf?.addEventListener("click", async () => {
  const cases = buildMassCases();
  const { sdT, g } = getSdTandG();
  const rows = buildMassTableRows(cases, sdT, g);
  const now = new Date();
  const img3d = captureViewerWithWallLabels();
  const view3dSection = img3d
    ? `<h2>Vue 3D – synthèse</h2><p class="muted">Couleurs : vert = stable, rouge = instable. Étiquettes = murs calculés (type + arase).</p><img src="${img3d}" alt="Vue 3D"/>`
    : `<h2>Vue 3D – synthèse</h2><p class="muted">Capture indisponible.</p>`;
  const intro = `
    <h1>Note de calcul – Efforts en tête de mur</h1>
    <div class="meta">Version: ${APP_VERSION} – Date: ${now.toLocaleString()}</div>
    ${view3dSection}
    <h2>Rappels de méthode</h2>
    <ul class="muted">
      <li>Masse charpente par m² : G + ψ·Q (ψ = facteur charges d’exploitation, dépend de la catégorie de charges).</li>
      <li>Demi-portée prise sur l’axe porteur (X ou Y en plan) ; 0,5 m si le mur/poutre n’est pas considéré porteur de la dalle.</li>
      <li>Effort en tête (par mètre linéaire) : Total × S_d(T) / g_r (S_d(T)=${sdT.toFixed(2)} m/s², g_r=${g.toFixed(2)} m/s²).</li>
      <li>Auto-stabilité chaînage : F_res = min(F_M, F_f) comparé à l’effort en tête ; nombre d’ancrages = découpe en N travées jusqu’à F_res ≥ F_tête.</li>
      <li>Double chaînage (murs pignon/rampant) : un second « Type de chaînage en rampant/pignon » peut être défini en plus du chaînage horizontal. Il est utilisé dans le calcul de F_res (et donc dans le nombre d’ancrages requis) dès que le mur est classé « Pignon » ou « Rampant » <b>ET</b> que l’un des deux critères suivants est satisfait : (a) le stack a réf. haute = réf. basse = « Pointe de pignon » ; (b) le stack contient au moins une dalle géométriquement rampante (variation d’altitude ≥ 10 cm) — colonne « Forme » du tableau dalles dans l’onglet *Définir modèle*. Pour un mur « Rive », le chaînage horizontal est toujours utilisé, même si la dalle associée est rampante.</li>
    </ul>

    <h2>Comment sont construits les cas mur</h2>
    <p class="muted">Pour chaque mur, on génère un cas par couple (<b>arase</b>, <b>stack</b>) actif :</p>
    <ul class="muted">
      <li><b>Arase</b> : tronçon de mur identifié à partir des sauts en plan (segmentation IFC). Une arase = un niveau d’interface tête de mur (ou bas-de-pente / pointe pour un pignon).</li>
      <li><b>Stack</b> : empilement logique (1, 2 ou 3) de dalles cochées sur une même arase. Toutes les dalles d’un même stack sont supposées au même niveau (= référence centrale du calcul).</li>
      <li><b>Référence centrale (y<sub>C</sub>)</b> = interface haute des dalles du stack (max si plusieurs). Pour un pignon avec dalles rampantes ou réf. haute « Bas / Pointe de pignon », y<sub>C</sub> est aligné sur la réf. haute résolue.</li>
      <li><b>Référence haute / basse</b> : choisies par stack (menu). Possibles : Arase du mur, Pied de mur, Dalle la plus haute/basse du stack, Dalle n° XXX, Donnée utilisateur, et (pignon) Pointe / Bas de pignon.</li>
    </ul>

    <h3>Hauteur équivalente de mur h<sub>calc</sub></h3>
    <p class="muted">h<sub>calc</sub> = h<sub>bas</sub> + h<sub>haut</sub> autour de y<sub>C</sub> :</p>
    <ul class="muted">
      <li><b>Réf. basse</b> : si « Donnée utilisateur » → L<sub>user</sub>/2 ; si la réf. coïncide avec la pointe → 0 ; sinon (y<sub>C</sub> − y<sub>basse</sub>)/2 (si la réf. est sous y<sub>C</sub>).</li>
      <li><b>Réf. haute</b> :
        <ul>
          <li><b>Arase du mur (libre en tête)</b> : (y<sub>arase</sub> − y<sub>C</sub>) plein, sans ÷2.</li>
          <li><b>Pointe de pignon</b> : (y<sub>pointe</sub> − y<sub>C</sub>) / 3.</li>
          <li><b>Bas de pignon</b> : 0 (y<sub>C</sub> aligné sur bas-de-pente).</li>
          <li><b>Donnée utilisateur</b> : L<sub>user</sub>/2.</li>
          <li><b>Dalle (max/min/numérotée)</b> : (y<sub>haute</sub> − y<sub>C</sub>)/2.</li>
        </ul>
      </li>
    </ul>

    <h3>Cas particulier pignon : Pointe / Pointe</h3>
    <p class="muted">Quand réf. haute = réf. basse = « Pointe de pignon » :</p>
    <ul class="muted">
      <li>Aire triangulaire au-dessus de y<sub>C</sub> : A<sub>tri</sub> = 0,5 × L<sub>mur</sub> × H<sub>pointe</sub>.</li>
      <li>Effort ponctuel (sans charpente) : F<sub>pointe</sub> = 0,65 · A<sub>tri</sub> · ρ<sub>mur</sub> · t · S<sub>d</sub>/g_r.</li>
      <li>Masse linéique mur retenue : F<sub>pointe</sub>/L<sub>mur</sub> (masse dalle non comptée).</li>
    </ul>

    <h3>Dalles rampantes</h3>
    <p class="muted">Repérées par l’étiquette <i>rampante</i> dans l’association. Mur pignon + porteur parallèle au mur + dalle non horizontale. Le niveau central du stack est alors aligné sur la réf. haute (pointe / bas-de-pente / dalle) pour éviter une hauteur faussée par la position centrale de la dalle.</p>

    <h3>Masse linéique totale</h3>
    <p class="muted">m<sub>tot</sub> [daN/ml] = m<sub>mur</sub> + m<sub>dalles</sub> + m<sub>poutre</sub>, avec m<sub>mur</sub> = ρ<sub>mur</sub> · t · h<sub>calc</sub>, m<sub>dalles</sub> = Σ (G + ψ·Q) · demi-portée.</p>
  `;
  const details = rows
    .map((r) => `<tr>
      <td>${escapeHtml(r.type)}</td>
      <td class="num">${escapeHtml(r.id)}</td>
      <td class="num">${escapeHtml(r.arase ?? "—")}</td>
      <td class="num">${formatNum(r.hArase)}</td>
      <td class="num">${escapeHtml(r.stack ?? "—")}</td>
      <td>${escapeHtml(r.dalles)}</td>
      <td class="num">${formatNum(r.hDalleTop)}</td>
      <td class="num">${formatNum(r.hCalcMur)}</td>
      <td>${escapeHtml(r.mat ?? "—")}</td>
      <td class="num">${formatDaN(r.masseMur)}</td>
      <td class="num">${formatDaN(r.masseDalles)}</td>
      <td class="num">${formatDaN(r.massePoutre)}</td>
      <td class="num">${formatDaN(r.total)}</td>
      <td class="num">${formatDaN(r.effortTete)}</td>
      <td class="num">${r.pignonATriM2 != null ? formatNum(r.pignonATriM2) : "—"}</td>
      <td class="num">${r.pignonEffortPointe != null ? formatDaN(r.pignonEffortPointe) : "—"}</td>
      <td class="num">${escapeHtml(r.verifieSur ?? "—")}</td>
      <td class="num">${escapeHtml(r.autoStab)}</td>
      <td class="num">${escapeHtml(r.nbAncrage)}</td>
    </tr>`)
    .join("");
  openPrintWindow(
    "Note de calcul",
    `${intro}
     <h2>Synthèse des cas</h2>
     <table>
       <thead><tr>
         <th>Type</th>
         <th class="num">ID</th>
         <th class="num">Arase</th>
         <th class="num">H arase [m]</th>
         <th class="num">Stack</th>
         <th>Dalles</th>
         <th class="num">H dalle (top) [m]</th>
         <th class="num">H calc mur [m]</th>
         <th>Mat / densité</th>
         <th class="num">Masse mur [daN/ml]</th>
         <th class="num">Masse dalles [daN/ml]</th>
         <th class="num">Masse poutre [daN/ml]</th>
         <th class="num">Total [daN/ml]</th>
         <th class="num">Effort tête [daN/ml]</th>
         <th class="num">A<sub>tri</sub> pignon [m²]</th>
         <th class="num">Eff. pointe 65 % [daN]</th>
         <th class="num">Vérifié sur</th>
         <th class="num">Auto-stabilité</th>
         <th class="num">Nb. ancrage</th>
       </tr></thead>
       <tbody>${details}</tbody>
     </table>`,
    { landscape: true, fitTable: true }
  );
});

btnExport3dPdf?.addEventListener("click", async () => {
  // PDF 3D "réaliste" n'est pas possible en pur navigateur sans lib; on exporte une capture (couleurs + labels).
  const img = await captureViewerWithWallLabels();
  if (!img) {
    alert("Impossible de capturer la vue 3D.");
    return;
  }
  openPrintWindow("Vue 3D (capture)", `<h1>Vue 3D – Résultats masses</h1><div class="meta">${APP_VERSION}</div><img src="${img}" alt="Vue 3D"/>`);
});

btnExportEffortsTopPdf?.addEventListener("click", () => {
  const built = buildEffortsTopViewSVG();
  if (!built || !built.svg) {
    alert("Aucun effort en tête de mur calculé. Lance d'abord le calcul (onglet Résultats masses).");
    return;
  }
  const { svg, canvasW, canvasH } = built;
  // Choix automatique d'orientation : on choisit le sens qui colle le mieux au canvas pour remplir la page.
  const useLandscape = canvasW >= canvasH;
  const now = new Date();
  openPrintWindow(
    "Effort en tête de mur (vue du dessus)",
    `<h1>Effort en tête de mur – vue du dessus</h1>
     <div class="meta">Version: ${APP_VERSION} – Date: ${now.toLocaleString()}</div>
     ${svg}`,
    { landscape: useLandscape, fillPage: true }
  );
});

/**
 * Construit une vue 2D du modèle (projection XZ) avec les efforts en tête de mur
 * annotés sous forme de flèches et de valeurs.
 * @returns {string|null} contenu SVG (string) ou null si rien à dessiner
 */
function buildEffortsTopViewSVG() {
  const cases = buildMassCases();
  const { sdT, g } = getSdTandG();
  if (!cases.length) return null;

  // Helpers d'ancrage murs / poutres
  const computeAnchorTxtMur = (c) => {
    const murEl = state.importedElements.find((e) => e.id === c.murId);
    const effortLin = g && Number.isFinite(c.total) ? (c.total * sdT) / g : 0;
    if (!murEl || effortLin <= 0) return { anchorTxt: "", effortLin: 0 };
    const stab = typeof computeAutoStability === "function"
      ? computeAutoStability(murEl, c.murId, effortLin, { useRampant: c.useRampantChainage })
      : null;
    if (stab?.stable === true) return { anchorTxt: "auto-stable", effortLin };
    if (stab && stab.stable === false) {
      const anch = typeof computeAnchorageNeed === "function"
        ? computeAnchorageNeed(murEl, c.murId, effortLin, stab, { useRampant: c.useRampantChainage })
        : null;
      if (anch && anch.anchors != null && anch.anchors > 0) return { anchorTxt: `${anch.anchors} ancr.`, effortLin };
      if (anch && anch.label) return { anchorTxt: anch.label, effortLin };
      return { anchorTxt: "ancrage", effortLin };
    }
    return { anchorTxt: "", effortLin };
  };

  const computeAnchorTxtPoutre = (c) => {
    const poutreEl = state.importedElements.find((e) => e.id === c.poutreId);
    const effortLin = g && Number.isFinite(c.total) ? (c.total * sdT) / g : 0;
    if (!poutreEl || effortLin <= 0) return { anchorTxt: "", effortLin: 0 };
    let stab = null, anch = null;
    if (c.hasOverride && c.checkMode === "chainage") {
      const typeStructKey = c.ov?.typeStructKey || "";
      const L = getBeamSpanLength(poutreEl);
      stab = computeAutoStabilityForLength(typeStructKey, L, effortLin);
      if (stab && stab.stable === false) {
        anch = computeBeamChainageAnchorageNeed(typeStructKey, L, effortLin, stab);
      }
    } else {
      const Ast_cm2 = Number(state.poutresAttributes?.[c.poutreId]?.Ast || 0);
      const b = c.hasOverride ? Number(c.ov?.h_cm) / 100 : toNumberMaybe(poutreEl.height);
      const h = c.hasOverride ? Number(c.ov?.b_cm) / 100 : toNumberMaybe(poutreEl.width);
      const L = getBeamSpanLength(poutreEl);
      stab = computeBeamAutoStability(poutreEl, c.poutreId, effortLin, { b, h, Ast_cm2, L });
      if (stab && stab.stable === false) {
        anch = computeBeamAnchorageNeed(poutreEl, c.poutreId, effortLin, stab, { b, h, Ast_cm2, Lfull: L });
      }
    }
    if (stab?.stable === true) return { anchorTxt: "auto-stable", effortLin };
    if (anch && anch.anchors != null && anch.anchors > 0) return { anchorTxt: `${anch.anchors} ancr.`, effortLin };
    if (anch && anch.label) return { anchorTxt: anch.label, effortLin };
    return { anchorTxt: stab ? "ancrage" : "", effortLin };
  };

  // Cas Mur (un par arase/stack), avec calcul de l'ancrage cas par cas.
  const wallCases = cases
    .filter((c) => c.kind === "Mur")
    .map((c) => {
      const { anchorTxt, effortLin } = computeAnchorTxtMur(c);
      const pointEffort = c.pignonEffortPointe != null && g ? (c.pignonEffortPointe * sdT) / g : 0;
      return {
        murId: c.murId,
        araseIndex: c.araseIndex,
        stack: c.stack,
        slabIds: Array.isArray(c.slabIds) ? c.slabIds.slice() : [],
        effortLin,
        pointEffort,
        anchorTxt,
      };
    })
    .filter((c) => c.effortLin > 0 || c.pointEffort > 0);

  // Cas Poutre (un par stack).
  const beamCases = cases
    .filter((c) => c.kind === "Poutre")
    .map((c) => {
      const { anchorTxt, effortLin } = computeAnchorTxtPoutre(c);
      return {
        poutreId: c.poutreId,
        stack: c.stack,
        slabIds: Array.isArray(c.slabIds) ? c.slabIds.slice() : [],
        effortLin,
        anchorTxt,
        checkMode: c.checkMode,
      };
    })
    .filter((c) => c.effortLin > 0);

  if (!wallCases.length && !beamCases.length) return null;

  // Bbox modèle (plan XZ) sur tous les murs / dalles / poutres connus
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  state.importedElements.forEach((el) => {
    if (
      !matchesCategory(el, "murs") &&
      !matchesCategory(el, "charpente") &&
      !matchesCategory(el, "poutres")
    ) return;
    const x = toNumberMaybe(el.x);
    const z = toNumberMaybe(el.z);
    if (x == null || z == null) return;
    const L = toNumberMaybe(el.length) || 0;
    const P = toNumberMaybe(el.width) || 0;
    const hX = L / 2;
    const hZ = P / 2;
    if (x - hX < minX) minX = x - hX;
    if (x + hX > maxX) maxX = x + hX;
    if (z - hZ < minZ) minZ = z - hZ;
    if (z + hZ > maxZ) maxZ = z + hZ;
  });
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) return null;

  const worldW = Math.max(maxX - minX, 0.001);
  const worldD = Math.max(maxZ - minZ, 0.001);

  // Nombre max d'efforts ponctuels (pointe pignon) empilés au-dessus d'un même mur
  const pointCountByWall = new Map();
  wallCases.forEach((c) => {
    if (c.pointEffort > 0) {
      pointCountByWall.set(c.murId, (pointCountByWall.get(c.murId) || 0) + 1);
    }
  });
  const maxPointPerWall = pointCountByWall.size ? Math.max(...pointCountByWall.values()) : 0;
  const pointEffortHeadroom = maxPointPerWall > 0
    ? 70 + (maxPointPerWall - 1) * 22 + 18 + 8
    : 0;

  const marginTop = Math.max(90, pointEffortHeadroom + 24);
  const marginSides = 160;
  const legendH = 100;
  const marginBottom = 70 + legendH;

  const targetUsefulW = 1400;
  const targetUsefulH = 900;
  const scale = Math.min(targetUsefulW / worldW, targetUsefulH / worldD);

  const canvasW = Math.max(700, Math.round(worldW * scale) + 2 * marginSides);
  const canvasH = Math.max(500, Math.round(worldD * scale) + marginTop + marginBottom);
  const projX = (xw) => marginSides + (xw - minX) * scale;
  // Vue plongeante standard : world +Z descend dans le SVG.
  const projZ = (zw) => marginTop + (zw - minZ) * scale;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}" width="${canvasW}" height="${canvasH}" preserveAspectRatio="xMidYMid meet" style="background:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">`);
  parts.push(`<defs>
    <marker id="arr-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#dc2626"/></marker>
    <marker id="arr-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1d4ed8"/></marker>
    <marker id="arr-purple" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7e22ce"/></marker>
  </defs>`);

  // Dalles en fond clair
  state.importedElements.filter((e) => matchesCategory(e, "charpente")).forEach((el) => {
    const x = toNumberMaybe(el.x);
    const z = toNumberMaybe(el.z);
    if (x == null || z == null) return;
    const L = toNumberMaybe(el.length) || 0;
    const P = toNumberMaybe(el.width) || 0;
    const x1 = projX(x - L / 2);
    const x2 = projX(x + L / 2);
    const y1 = projZ(z + P / 2);
    const y2 = projZ(z - P / 2);
    parts.push(`<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" fill="#fef9c3" stroke="#ca8a04" stroke-width="0.4" opacity="0.55"/>`);
  });

  // Murs : pochage selon auto-stabilité (vert / rouge / gris si non calculé)
  state.importedElements.filter((e) => matchesCategory(e, "murs")).forEach((el) => {
    const x = toNumberMaybe(el.x);
    const z = toNumberMaybe(el.z);
    if (x == null || z == null) return;
    const L = toNumberMaybe(el.length) || 0;
    const P = toNumberMaybe(el.width) || 0;
    const x1 = projX(x - L / 2);
    const x2 = projX(x + L / 2);
    const y1 = projZ(z + P / 2);
    const y2 = projZ(z - P / 2);
    const st = state.massStabilityByMur?.[el.id];
    let fill = "#cbd5e1";
    let stroke = "#475569";
    if (st?.stable === true) { fill = "#86efac"; stroke = "#15803d"; }
    else if (st?.stable === false) { fill = "#fca5a5"; stroke = "#b91c1c"; }
    parts.push(`<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" fill="${fill}" stroke="${stroke}" stroke-width="0.9" fill-opacity="0.85"/>`);
  });

  // Poutres : pochage selon auto-stabilité (violet pâle / violet vif liseré)
  state.importedElements.filter((e) => matchesCategory(e, "poutres")).forEach((el) => {
    const x = toNumberMaybe(el.x);
    const z = toNumberMaybe(el.z);
    if (x == null || z == null) return;
    const L = toNumberMaybe(el.length) || 0;
    const P = toNumberMaybe(el.width) || 0;
    const x1 = projX(x - L / 2);
    const x2 = projX(x + L / 2);
    const y1 = projZ(z + P / 2);
    const y2 = projZ(z - P / 2);
    const st = state.massStabilityByPoutre?.[el.id];
    let fill = "#ede9fe";
    let stroke = "#6d28d9";
    if (st?.stable === true) { fill = "#bbf7d0"; stroke = "#15803d"; }
    else if (st?.stable === false) { fill = "#fecaca"; stroke = "#b91c1c"; }
    parts.push(`<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" fill="${fill}" stroke="${stroke}" stroke-width="1.1" fill-opacity="0.85"/>`);
  });

  // Positions manuelles (drag) : labelKey -> { dx, dy }
  const manualPositions = state.effortsTopViewLabelPositions || {};

  // Buffers séparés : on dessine d'abord les flèches/leaders, puis les labels
  // (z-order garanti = labels au-dessus des flèches/lignes de rappel).
  const arrowsAndLeaders = [];
  const labelGroups = [];

  // ───────────────────────────────────────────────────────────────────────
  // Helper commun pour dessiner les étiquettes + double-flèche d'un élément
  // (mur ou poutre). Positionne l'étiquette directement SUR la flèche par
  // défaut (gain de place), sauf :
  //   - s'il y a une étiquette de chaque côté (2 cas opposés)
  //   - si la flèche projetée est trop courte pour accueillir l'étiquette
  // ───────────────────────────────────────────────────────────────────────
  const drawElementLabels = ({ el, bySide, strokeColor, fillColor, textColor, kindKey }) => {
    const wx = toNumberMaybe(el.x);
    const wz = toNumberMaybe(el.z);
    const L = toNumberMaybe(el.length) || 0;
    const P = toNumberMaybe(el.width) || 0;
    if (wx == null || wz == null || L <= 0) return;
    const wallAxis = getDominantPlanAxis(el) || "X";
    const spanWorld = wallAxis === "X" ? L : P;
    const thickWorld = wallAxis === "X" ? P : L;
    const arrowProjLen = spanWorld * scale;
    const hasBothSides = bySide.size > 1;

    bySide.forEach((groupCases, side) => {
      groupCases.sort((a, b) => (b.effortLin - a.effortLin));
      const linCases = groupCases.filter((c) => c.effortLin > 0);
      if (!linCases.length) return;

      const perpOffsetWorld = thickWorld / 2 + 0.45;
      let aWX, aWZ, bWX, bWZ;
      if (wallAxis === "X") {
        aWX = wx - spanWorld / 2;
        bWX = wx + spanWorld / 2;
        aWZ = bWZ = wz + side * perpOffsetWorld;
      } else {
        aWZ = wz - spanWorld / 2;
        bWZ = wz + spanWorld / 2;
        aWX = bWX = wx + side * perpOffsetWorld;
      }
      const ax = projX(aWX), ay = projZ(aWZ);
      const bx = projX(bWX), by = projZ(bWZ);
      const markerRef = strokeColor === "#dc2626" ? "arr-red" : (strokeColor === "#7e22ce" ? "arr-purple" : "arr-blue");
      arrowsAndLeaders.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${strokeColor}" stroke-width="1.8" marker-start="url(#${markerRef})" marker-end="url(#${markerRef})"/>`);

      const lines = linCases.map((c) => {
        const v = `${formatDaN(c.effortLin)} daN/ml`;
        return c.anchorTxt ? `${v} – ${c.anchorTxt}` : v;
      });
      const fontSize = 8.5;
      const lineH = 11;
      const padX = 6;
      const padY = 4;
      const maxLen = Math.max(...lines.map((l) => l.length));
      const labelW = Math.max(96, Math.round(maxLen * 4.9) + 2 * padX);
      const labelH = lines.length * lineH + 2 * padY;

      // Placement par défaut : centré sur la flèche (gain de place) sauf contrainte.
      const arrowFitsLabel = arrowProjLen >= labelW + 18;
      const stackOnCenter = !hasBothSides && arrowFitsLabel;
      const midX = (ax + bx) / 2;
      const midY = (ay + by) / 2;
      let defaultTx = midX, defaultTy = midY;
      if (!stackOnCenter) {
        const labelOffset = 6 + labelH / 2;
        if (wallAxis === "X") defaultTy += side > 0 ? labelOffset : -labelOffset;
        else defaultTx += side > 0 ? labelOffset : -labelOffset;
      }

      const angle = wallAxis === "X" ? 0 : -90;

      const visW = wallAxis === "X" ? labelW : labelH;
      const visH = wallAxis === "X" ? labelH : labelW;
      const padCanvas2 = 6;
      defaultTx = Math.max(visW / 2 + padCanvas2, Math.min(canvasW - visW / 2 - padCanvas2, defaultTx));
      defaultTy = Math.max(visH / 2 + padCanvas2, Math.min(canvasH - visH / 2 - padCanvas2, defaultTy));

      // Application de l'éventuel offset manuel (drag-and-drop)
      const labelKey = `${kindKey}:${el.id}:${side}`;
      const manual = manualPositions[labelKey];
      const tx = defaultTx + (manual?.dx || 0);
      const ty = defaultTy + (manual?.dy || 0);
      const hasOffset = !!(manual && (Math.abs(manual.dx || 0) + Math.abs(manual.dy || 0) > 0.5));

      // Ligne de rappel (visible uniquement si l'étiquette a été déplacée)
      arrowsAndLeaders.push(`<line class="leader-line" data-leader-for="${labelKey}" x1="${midX}" y1="${midY}" x2="${tx}" y2="${ty}" stroke="#6b7280" stroke-width="0.7" stroke-dasharray="4 3" opacity="${hasOffset ? 0.85 : 0}"/>`);

      const dataAttrs = ` data-label-key="${labelKey}" data-default-tx="${defaultTx}" data-default-ty="${defaultTy}" data-anchor-x="${midX}" data-anchor-y="${midY}" data-angle="${angle}" data-label-w="${labelW}" data-label-h="${labelH}"`;
      labelGroups.push(`<g${dataAttrs} transform="translate(${tx}, ${ty}) rotate(${angle})">`);
      labelGroups.push(`<rect x="${-labelW / 2}" y="${-labelH / 2}" width="${labelW}" height="${labelH}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="0.7" rx="3" ry="3"/>`);
      lines.forEach((line, i) => {
        const yPos = -labelH / 2 + padY + (i + 0.5) * lineH;
        labelGroups.push(`<text x="0" y="${yPos}" font-size="${fontSize}" fill="${textColor}" text-anchor="middle" font-weight="600" dominant-baseline="middle">${escapeHtml(line)}</text>`);
      });
      labelGroups.push(`</g>`);
    });
  };

  // ─── MURS : grouper par mur ET par côté ────────────────────────────────
  const casesByMurSide = new Map();
  wallCases.forEach((c) => {
    const wallEl = state.importedElements.find((e) => e.id === c.murId);
    if (!wallEl) return;
    const wx = toNumberMaybe(wallEl.x);
    const wz = toNumberMaybe(wallEl.z);
    if (wx == null || wz == null) return;
    const wallAxis = getDominantPlanAxis(wallEl) || "X";

    const firstSlab = c.slabIds
      .map((sid) => state.importedElements.find((e) => e.id === sid))
      .find((s) => s && toNumberMaybe(s.x) != null && toNumberMaybe(s.z) != null);

    let side = 1;
    if (firstSlab) {
      if (wallAxis === "X") {
        const dz = toNumberMaybe(firstSlab.z) - wz;
        side = dz >= 0 ? 1 : -1;
      } else {
        const dx = toNumberMaybe(firstSlab.x) - wx;
        side = dx >= 0 ? 1 : -1;
      }
    }

    let bySide = casesByMurSide.get(c.murId);
    if (!bySide) { bySide = new Map(); casesByMurSide.set(c.murId, bySide); }
    if (!bySide.has(side)) bySide.set(side, []);
    bySide.get(side).push(c);
  });

  // Dessine les étiquettes des murs (et empile les efforts ponctuels)
  casesByMurSide.forEach((bySide, murId) => {
    const wallEl = state.importedElements.find((e) => e.id === murId);
    if (!wallEl) return;
    drawElementLabels({
      el: wallEl,
      bySide,
      strokeColor: "#dc2626",
      fillColor: "#fef2f2",
      textColor: "#7f1d1d",
      kindKey: "mur",
    });

    // Efforts ponctuels (pointe de pignon) – glissables individuellement
    const wx = toNumberMaybe(wallEl.x);
    const wz = toNumberMaybe(wallEl.z);
    let pointIdx = 0;
    bySide.forEach((groupCases, side) => {
      groupCases.forEach((c) => {
        if (c.pointEffort > 0) {
          const targetX = projX(wx);
          const targetY = projZ(wz);
          const ptVal = `${formatDaN(c.pointEffort)} daN (pointe)`;
          const ptw = Math.max(120, ptVal.length * 5.4);
          const pth = 18;
          let defFromX = targetX + side * 70;
          let defFromY = targetY - 70 - pointIdx * 22;
          const padCanvas = 6;
          const minRectTop = padCanvas;
          const minFromY = minRectTop + pth + 4;
          defFromY = Math.max(minFromY, defFromY);
          const minFromX = ptw / 2 + padCanvas;
          const maxFromX = canvasW - ptw / 2 - padCanvas;
          defFromX = Math.max(minFromX, Math.min(maxFromX, defFromX));

          const labelKey = `point:${wallEl.id}:${c.araseIndex}:${c.stack}`;
          const manual = manualPositions[labelKey];
          const fromX = defFromX + (manual?.dx || 0);
          const fromY = defFromY + (manual?.dy || 0);

          // L'arrow line sert aussi de leader (du label vers le sommet du pignon)
          arrowsAndLeaders.push(`<line class="point-arrow" data-leader-for="${labelKey}" x1="${fromX}" y1="${fromY}" x2="${targetX}" y2="${targetY}" stroke="#1d4ed8" stroke-width="1.8" marker-end="url(#arr-blue)"/>`);

          const dataAttrs = ` data-label-key="${labelKey}" data-default-tx="${defFromX}" data-default-ty="${defFromY}" data-anchor-x="${targetX}" data-anchor-y="${targetY}" data-angle="0" data-label-w="${ptw}" data-label-h="${pth}" data-point="1"`;
          labelGroups.push(`<g${dataAttrs} transform="translate(${fromX}, ${fromY})">`);
          labelGroups.push(`<rect x="${-ptw / 2}" y="${-pth - 4}" width="${ptw}" height="${pth}" fill="#eff6ff" stroke="#1d4ed8" stroke-width="0.7" rx="3" ry="3"/>`);
          labelGroups.push(`<text x="0" y="${-pth / 2 - 4}" font-size="9" fill="#1e3a8a" text-anchor="middle" font-weight="700" dominant-baseline="middle">${escapeHtml(ptVal)}</text>`);
          labelGroups.push(`</g>`);
          pointIdx += 1;
        }
      });
    });
  });

  // ─── POUTRES : grouper par poutre ET par côté ──────────────────────────
  // Une poutre porte des dalles. Le côté est déterminé par la position de la
  // 1ère dalle du stack par rapport à l'axe de la poutre.
  const casesByPoutreSide = new Map();
  beamCases.forEach((c) => {
    const poutreEl = state.importedElements.find((e) => e.id === c.poutreId);
    if (!poutreEl) return;
    const wx = toNumberMaybe(poutreEl.x);
    const wz = toNumberMaybe(poutreEl.z);
    if (wx == null || wz == null) return;
    const wallAxis = getDominantPlanAxis(poutreEl) || "X";
    const firstSlab = c.slabIds
      .map((sid) => state.importedElements.find((e) => e.id === sid))
      .find((s) => s && toNumberMaybe(s.x) != null && toNumberMaybe(s.z) != null);
    let side = 1;
    if (firstSlab) {
      if (wallAxis === "X") {
        const dz = toNumberMaybe(firstSlab.z) - wz;
        side = dz >= 0 ? 1 : -1;
      } else {
        const dx = toNumberMaybe(firstSlab.x) - wx;
        side = dx >= 0 ? 1 : -1;
      }
    }
    let bySide = casesByPoutreSide.get(c.poutreId);
    if (!bySide) { bySide = new Map(); casesByPoutreSide.set(c.poutreId, bySide); }
    if (!bySide.has(side)) bySide.set(side, []);
    bySide.get(side).push(c);
  });

  casesByPoutreSide.forEach((bySide, poutreId) => {
    const poutreEl = state.importedElements.find((e) => e.id === poutreId);
    if (!poutreEl) return;
    drawElementLabels({
      el: poutreEl,
      bySide,
      strokeColor: "#7e22ce",
      fillColor: "#f5f3ff",
      textColor: "#581c87",
      kindKey: "poutre",
    });
  });

  // On émet maintenant l'ensemble des flèches/leaders puis l'ensemble des labels.
  parts.push(arrowsAndLeaders.join(""));
  parts.push(labelGroups.join(""));

  // Légende en bas du canvas
  parts.push(`<g transform="translate(${Math.max(20, marginSides - 30)}, ${canvasH - legendH + 10})" font-size="11" fill="#111">
    <rect x="0" y="0" width="490" height="92" fill="#ffffff" stroke="#475569" stroke-width="0.6" rx="4" ry="4"/>
    <line x1="10" y1="14" x2="60" y2="14" stroke="#dc2626" stroke-width="1.8" marker-start="url(#arr-red)" marker-end="url(#arr-red)"/>
    <text x="68" y="17">Effort en tête de mur [daN/ml] – ancrages indiqués</text>
    <line x1="10" y1="32" x2="60" y2="32" stroke="#7e22ce" stroke-width="1.8" marker-start="url(#arr-purple)" marker-end="url(#arr-purple)"/>
    <text x="68" y="35">Effort sur poutre [daN/ml] – ancrages indiqués</text>
    <line x1="10" y1="50" x2="60" y2="50" stroke="#1d4ed8" stroke-width="1.8" marker-end="url(#arr-blue)"/>
    <text x="68" y="53">Effort ponctuel pointe de pignon [daN]</text>
    <rect x="10" y="64" width="20" height="14" fill="#86efac" stroke="#15803d"/>
    <text x="36" y="75">Auto-stable</text>
    <rect x="120" y="64" width="20" height="14" fill="#fca5a5" stroke="#b91c1c"/>
    <text x="146" y="75">Non auto-stable</text>
  </g>`);

  // Boussole en haut à gauche (vue plongeante : +Z descend, +X à droite)
  parts.push(`<g transform="translate(20, 20)" font-size="10" fill="#111">
    <rect x="0" y="0" width="120" height="60" fill="#ffffff" stroke="#475569" stroke-width="0.5" rx="3" ry="3"/>
    <text x="10" y="18">Vue plongeante</text>
    <text x="10" y="34">→ X (monde) · ↓ Z (monde)</text>
    <text x="10" y="50">Échelle 1 m ≈ ${scale.toFixed(1)} px</text>
  </g>`);

  parts.push(`</svg>`);
  return { svg: parts.join(""), canvasW, canvasH };
}

// ───────────────────────────────────────────────────────────────────────────
// Aperçu interactif "Effort en tête de mur" (drag-and-drop des étiquettes)
// ───────────────────────────────────────────────────────────────────────────

/**
 * (Re)Construit le SVG et l'insère dans #plan-preview-container, puis active
 * le drag-and-drop sur les étiquettes (data-label-key).
 */
function renderEffortsTopPreview() {
  if (!planPreviewContainer) return;
  const built = buildEffortsTopViewSVG();
  if (!built || !built.svg) {
    planPreviewContainer.innerHTML = `<div style="padding:1.2rem; color:#6b7280; font-size:0.85rem; text-align:center;">
      Aucun effort calculé. Lance d'abord le calcul (bouton « Calcul final des efforts » ou onglet « Définir modèle »).
    </div>`;
    return;
  }
  planPreviewContainer.innerHTML = built.svg;
  const svg = planPreviewContainer.querySelector("svg");
  if (svg) attachLabelDragHandlers(svg);
}

/**
 * Active le drag-and-drop sur tous les groupes <g data-label-key> du SVG.
 * - Met à jour `state.effortsTopViewLabelPositions[key] = { dx, dy }`
 * - Met à jour visuellement la ligne de rappel (leader) en temps réel.
 */
function attachLabelDragHandlers(svg) {
  const groups = svg.querySelectorAll("[data-label-key]");
  groups.forEach((g) => {
    g.addEventListener("pointerdown", (ev) => startLabelDrag(ev, g, svg));
  });
}

let _activeDrag = null;

function startLabelDrag(ev, g, svg) {
  ev.preventDefault();
  ev.stopPropagation();
  const labelKey = g.getAttribute("data-label-key");
  if (!labelKey) return;
  const defaultTx = Number(g.getAttribute("data-default-tx")) || 0;
  const defaultTy = Number(g.getAttribute("data-default-ty")) || 0;
  const anchorX = Number(g.getAttribute("data-anchor-x")) || 0;
  const anchorY = Number(g.getAttribute("data-anchor-y")) || 0;
  const angle = Number(g.getAttribute("data-angle")) || 0;
  const isPoint = g.getAttribute("data-point") === "1";
  const current = state.effortsTopViewLabelPositions?.[labelKey] || { dx: 0, dy: 0 };

  const startPt = svgPointFromEvent(svg, ev);
  _activeDrag = { labelKey, g, svg, defaultTx, defaultTy, anchorX, anchorY, angle, isPoint, startPt, startDx: current.dx || 0, startDy: current.dy || 0 };
  g.classList.add("dragging");
  try { g.setPointerCapture(ev.pointerId); } catch (_) {}

  const move = (e) => onLabelDragMove(e);
  const up = (e) => {
    onLabelDragEnd(e);
    g.removeEventListener("pointermove", move);
    g.removeEventListener("pointerup", up);
    g.removeEventListener("pointercancel", up);
  };
  g.addEventListener("pointermove", move);
  g.addEventListener("pointerup", up);
  g.addEventListener("pointercancel", up);
}

function onLabelDragMove(ev) {
  if (!_activeDrag) return;
  const { g, svg, defaultTx, defaultTy, anchorX, anchorY, angle, isPoint, startPt, startDx, startDy, labelKey } = _activeDrag;
  const pt = svgPointFromEvent(svg, ev);
  const dx = startDx + (pt.x - startPt.x);
  const dy = startDy + (pt.y - startPt.y);
  const tx = defaultTx + dx;
  const ty = defaultTy + dy;
  if (isPoint) {
    g.setAttribute("transform", `translate(${tx}, ${ty})`);
  } else {
    g.setAttribute("transform", `translate(${tx}, ${ty}) rotate(${angle})`);
  }
  // Mise à jour de la ligne de rappel correspondante (la valeur d'attribut
  // est entre guillemets, donc les ":" du labelKey ne nécessitent pas d'escape).
  const leader = svg.querySelector(`[data-leader-for="${labelKey}"]`);
  if (leader) {
    leader.setAttribute("x1", anchorX);
    leader.setAttribute("y1", anchorY);
    leader.setAttribute("x2", tx);
    leader.setAttribute("y2", ty);
    if (!isPoint) {
      leader.setAttribute("opacity", "0.85");
    }
  }
  _activeDrag.lastDx = dx;
  _activeDrag.lastDy = dy;
}

function onLabelDragEnd(ev) {
  if (!_activeDrag) return;
  const { g, labelKey, lastDx, lastDy } = _activeDrag;
  g.classList.remove("dragging");
  if (!state.effortsTopViewLabelPositions) state.effortsTopViewLabelPositions = {};
  const dx = lastDx ?? state.effortsTopViewLabelPositions[labelKey]?.dx ?? 0;
  const dy = lastDy ?? state.effortsTopViewLabelPositions[labelKey]?.dy ?? 0;
  if (Math.abs(dx) + Math.abs(dy) < 0.5) {
    delete state.effortsTopViewLabelPositions[labelKey];
  } else {
    state.effortsTopViewLabelPositions[labelKey] = { dx, dy };
  }
  _activeDrag = null;
}

function svgPointFromEvent(svg, ev) {
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: pt.x, y: pt.y };
  const inv = ctm.inverse();
  const p = pt.matrixTransform(inv);
  return { x: p.x, y: p.y };
}

btnPlanRefresh?.addEventListener("click", () => {
  renderEffortsTopPreview();
});

btnPlanReset?.addEventListener("click", () => {
  state.effortsTopViewLabelPositions = {};
  renderEffortsTopPreview();
});

// L'état initial (panneaux visibles) sera ajusté après création du viewer

// Groupes rétractables pour les listes d’éléments importés
elementsGroupHeaders.forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
    if (!targetId) return;
    const body = document.getElementById(targetId);
    if (!body) return;
    const icon = btn.querySelector(".toggle-icon");
    const isHidden = body.style.display === "none";
    body.style.display = isHidden ? "" : "none";
    if (icon) icon.textContent = isHidden ? "▼" : "▶";
  });
});

function selectAllInCategory(category, checked) {
  const ifcManager = state.viewer?.IFC?.loader?.ifcManager;
  const modelID = state.ifcModelID;

  state.importedElements.forEach((el) => {
    if (!matchesCategory(el, category)) return;
    if (typeof el.id !== "number") return;
    if (checked) {
      selectedExpressIDs.add(el.id);
    } else {
      selectedExpressIDs.delete(el.id);
    }
  });

  if (category === "murs" && currentMainTab === "resultats") {
    recomputeSlabSelectionFromWalls();
  }

  renderElementsTables();

  if (ifcManager && modelID != null) {
    updateHighlight();
  }
  updateAllAttributePanels();
  updateSlabLabels();
  updateAssociationPanelHighlight();
}

selectAllCharpenteCheckbox?.addEventListener("change", (e) => {
  const checked = e.target.checked;
  selectAllInCategory("charpente", checked);
});

selectAllMursCheckbox?.addEventListener("change", (e) => {
  const checked = e.target.checked;
  selectAllInCategory("murs", checked);
});

selectAllPoutresCheckbox?.addEventListener("change", (e) => {
  const checked = e.target.checked;
  selectAllInCategory("poutres", checked);
});

// --- Bibliothèque de matériaux : édition + persistance locale ---------------

function loadMaterialsFromStorage() {
  try {
    const raw = localStorage.getItem(MATERIALS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getMaterialValue(key) {
  const stored = loadMaterialsFromStorage();
  const v = stored && Object.prototype.hasOwnProperty.call(stored, key) ? Number(stored[key]) : null;
  if (Number.isFinite(v)) return v;
  const def = MATERIALS_DEFAULTS[key];
  return Number.isFinite(def) ? def : 0;
}

function getCharpenteExploitPsi() {
  const psi = Number(psiExploitInput?.value);
  return Number.isFinite(psi) ? psi : 0;
}

function getCharpenteMassPerM2(attrs) {
  if (!attrs) return { G: 0, Q0: 0, psi: 0, Q: 0, total: 0 };
  const keysG = [
    attrs.matCharpente,
    attrs.matVolige,
    attrs.matCouverture,
    attrs.matIsolant,
    attrs.matPlafond,
    attrs.matPlancher,
    attrs.matCloisons,
    attrs.matAutres,
  ].filter(Boolean);
  const G = keysG.reduce((sum, k) => sum + getMaterialValue(k), 0) + (Number(attrs.Gml) || 0);
  const Q0 = (Number(attrs.Qexp) || 0) + (Number(attrs.Qml) || 0);
  const psi = getCharpenteExploitPsi();
  const Q = Q0 * psi;
  return { G, Q0, psi, Q, total: G + Q };
}

function getSlabTopY(slabEl) {
  const y = toNumberMaybe(slabEl?.y);
  const h = toNumberMaybe(slabEl?.height) || 0;
  if (y == null) return null;
  return y + h / 2;
}

function getWallThickness(el) {
  const a = toNumberMaybe(el?.length);
  const b = toNumberMaybe(el?.width);
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

function getWallSpanLength(el) {
  const a = toNumberMaybe(el?.length);
  const b = toNumberMaybe(el?.width);
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

function computeWallHeightForMass(araseHeight, slabY) {
  // Formule demandée : (slab/2) + (arase - slab) = arase - slab/2
  const H = Number(araseHeight);
  const hs = Number(slabY);
  if (!Number.isFinite(H) || !Number.isFinite(hs)) return null;
  const hCalc = H - hs / 2;
  return hCalc > 0 ? hCalc : 0;
}

/** Base du mur en cote monde (Y), si connue. */
function getWallBaseWorldY(murEl) {
  if (!murEl) return null;
  const b = toNumberMaybe(murEl.heightBaseY);
  if (b != null) return b;
  const y = toNumberMaybe(murEl.y);
  const h = toNumberMaybe(murEl.height);
  if (y != null && h != null) return y - h / 2;
  return null;
}

/** Cote monde (Y) de l’arase courante (index dans araseHeights). */
function getWallAraseWorldY(murEl, araseIndex) {
  const base = getWallBaseWorldY(murEl);
  const H = toNumberMaybe(murEl?.araseHeights?.[araseIndex]);
  if (base == null || !Number.isFinite(H)) return null;
  return base + H;
}

/**
 * Niveau central du stack = interface dalle (même niveau si plusieurs dalles cochées).
 * On prend le max des cotes d’interface haute des dalles du stack.
 */
function getWallStackCentralSlabY(slabIds) {
  const ys = (slabIds || [])
    .map((sid) => getSlabTopY(state.importedElements.find((e) => e.id === sid)))
    .filter((v) => v != null);
  if (!ys.length) return null;
  return Math.max(...ys);
}

function parseUserRefHeightM(userStr) {
  const v = toNumberMaybe(String(userStr ?? "").replace(",", "."));
  if (v == null || !Number.isFinite(v) || v < 0) return null;
  return v;
}

const WALL_REF_ARASE = "arase_mur";
const WALL_REF_PIED = "pied_mur";
const WALL_REF_USER = "user";
const WALL_REF_SLAB_MAX = "slab_max_stack";
const WALL_REF_SLAB_MIN = "slab_min_stack";
const WALL_REF_SLAB_PREFIX = "slab:";
const WALL_REF_PIGNON_POINTE = "pignon_pointe";
const WALL_REF_PIGNON_BAS = "pignon_bas";

function parseWallRefKey(raw) {
  const s = String(raw || "").trim();
  if (!s) return { kind: WALL_REF_PIED, slabId: null };
  if (
    s === WALL_REF_ARASE ||
    s === WALL_REF_PIED ||
    s === WALL_REF_USER ||
    s === WALL_REF_SLAB_MAX ||
    s === WALL_REF_SLAB_MIN ||
    s === WALL_REF_PIGNON_POINTE ||
    s === WALL_REF_PIGNON_BAS
  ) {
    return { kind: s, slabId: null };
  }
  if (s.startsWith(WALL_REF_SLAB_PREFIX)) {
    const id = Number(s.slice(WALL_REF_SLAB_PREFIX.length));
    return { kind: "slab", slabId: Number.isFinite(id) ? id : null };
  }
  return { kind: WALL_REF_PIED, slabId: null };
}

/**
 * Résout une référence de cote (monde Y) pour le calcul mur/stack.
 * @param {string} refKey
 * @param {string} userMStr
 * @param {*} murEl
 * @param {number} araseIndex
 * @param {number[]} slabIdsInCase dalles du cas (stack)
 */
function resolveWallRefWorldY(refKey, userMStr, murEl, araseIndex, slabIdsInCase) {
  const parsed = parseWallRefKey(refKey);
  const kind = parsed.kind === "slab" ? "slab" : parsed.kind;
  if (kind === WALL_REF_USER) {
    // « Donnée utilisateur » = longueur (m) à traiter côté calcul (÷2), pas une cote Y absolue.
    return null;
  }
  if (kind === WALL_REF_PIGNON_POINTE) return getWallPignonPointeWorldY(murEl);
  if (kind === WALL_REF_PIGNON_BAS) return getWallAraseWorldY(murEl, araseIndex);
  if (kind === WALL_REF_PIED) return getWallBaseWorldY(murEl);
  if (kind === WALL_REF_ARASE) return getWallAraseWorldY(murEl, araseIndex);
  if (kind === WALL_REF_SLAB_MAX) {
    const ys = (slabIdsInCase || [])
      .map((sid) => {
        const s = state.importedElements.find((e) => e.id === sid);
        return getSlabTopY(s);
      })
      .filter((v) => v != null);
    if (!ys.length) return null;
    return Math.max(...ys);
  }
  if (kind === WALL_REF_SLAB_MIN) {
    const ys = (slabIdsInCase || [])
      .map((sid) => {
        const s = state.importedElements.find((e) => e.id === sid);
        return getSlabTopY(s);
      })
      .filter((v) => v != null);
    if (!ys.length) return null;
    return Math.min(...ys);
  }
  if (kind === "slab" && parsed.slabId != null) {
    const s = state.importedElements.find((e) => e.id === parsed.slabId);
    return getSlabTopY(s);
  }
  return null;
}

/**
 * Détail masse mur/stack : hauteur équivalente, cas pignon pointe–pointe, dalle rampante (niveau central = ref. haute résolue).
 * @returns {{ hMur: number|null, mMurLinear: number|null, skipSlabs: boolean, effortPointeDaN: number|null, ATriM2: number|null}|null}
 */
function computeWallStackMurMassDetail(murEl, araseIndex, slabIds, sr) {
  if (!sr) return null;
  const yC0 = getWallStackCentralSlabY(slabIds);
  const yWallTop = getWallAraseWorldY(murEl, araseIndex);
  if (yC0 == null || yWallTop == null) return null;

  const hKey = String(sr.refHaute || "").trim();
  const bKey = String(sr.refBasse || "").trim();

  if (hKey === WALL_REF_PIGNON_POINTE && bKey === WALL_REF_PIGNON_POINTE) {
    const yPeak = getWallPignonPointeWorldY(murEl);
    if (yPeak == null) return null;
    const H = Math.max(0, yPeak - yC0);
    const Lspan = getWallSpanLength(murEl) || 0;
    const ATri = 0.5 * Lspan * H;
    const densKey = state.mursAttributes?.[murEl.id]?.typeMurKey || "";
    const dens = densKey ? getMaterialValue(densKey) : 0;
    const t = getWallThickness(murEl) || 0;
    const effortPointeDaN = 0.65 * ATri * dens * t;
    const mMurLinear = Lspan > 0 ? effortPointeDaN / Lspan : 0;
    const hMur = dens > 0 && t > 0 ? mMurLinear / (dens * t) : null;
    return { hMur, mMurLinear, skipSlabs: true, effortPointeDaN, ATriM2: ATri };
  }

  let yC = yC0;
  const wallKind = classifyWallRoofFromProfiles(murEl).kind;
  const yRefHaute = resolveWallRefWorldY(sr.refHaute, sr.userHaute, murEl, araseIndex, slabIds);
  if (
    wallKind === "Pignon" &&
    (stackHasRampantPignonSlab(murEl, slabIds) ||
      hKey === WALL_REF_PIGNON_BAS ||
      hKey === WALL_REF_PIGNON_POINTE)
  ) {
    if (yRefHaute != null) yC = yRefHaute;
  }

  const basParsed = parseWallRefKey(sr.refBasse);
  let below = 0;
  if (basParsed.kind === WALL_REF_USER) {
    const L = parseUserRefHeightM(sr.userBasse);
    if (L != null) below = L / 2;
  } else {
    const yB = resolveWallRefWorldY(sr.refBasse, sr.userBasse, murEl, araseIndex, slabIds);
    const yPeak = getWallPignonPointeWorldY(murEl);
    if (yB != null && yPeak != null && yB >= yPeak - 0.02) {
      below = 0;
    } else if (yB != null && yB < yC) {
      below = (yC - yB) / 2;
    }
  }

  let above = 0;
  if (hKey === WALL_REF_ARASE) {
    above = Math.max(0, yWallTop - yC);
  } else if (hKey === WALL_REF_PIGNON_BAS) {
    above = 0;
  } else if (hKey === WALL_REF_PIGNON_POINTE) {
    const yPeak = getWallPignonPointeWorldY(murEl);
    if (yPeak != null && yPeak > yC) above = (yPeak - yC) / 3;
  } else if (parseWallRefKey(sr.refHaute).kind === WALL_REF_USER) {
    const L = parseUserRefHeightM(sr.userHaute);
    if (L != null) above = L / 2;
  } else {
    const yH = resolveWallRefWorldY(sr.refHaute, sr.userHaute, murEl, araseIndex, slabIds);
    if (yH != null && yH > yC) above = (yH - yC) / 2;
  }

  return { hMur: below + above, mMurLinear: null, skipSlabs: false, effortPointeDaN: null, ATriM2: null };
}

function computeWallStackMurHeightFromRefs(murEl, araseIndex, slabIds, sr) {
  const d = computeWallStackMurMassDetail(murEl, araseIndex, slabIds, sr);
  return d ? d.hMur : null;
}

function getDefaultWallStackRefs() {
  return {
    refHaute: WALL_REF_ARASE,
    refBasse: WALL_REF_PIED,
    userHaute: "",
    userBasse: "",
  };
}

function ensureWallStackRefs(cfg) {
  if (!cfg.stackRefs || typeof cfg.stackRefs !== "object") {
    cfg.stackRefs = {};
  }
  for (let si = 1; si <= 3; si++) {
    if (!cfg.stackRefs[si]) {
      cfg.stackRefs[si] = { ...getDefaultWallStackRefs() };
    } else {
      const d = getDefaultWallStackRefs();
      cfg.stackRefs[si].refHaute = cfg.stackRefs[si].refHaute ?? d.refHaute;
      cfg.stackRefs[si].refBasse = cfg.stackRefs[si].refBasse ?? d.refBasse;
      cfg.stackRefs[si].userHaute = cfg.stackRefs[si].userHaute ?? "";
      cfg.stackRefs[si].userBasse = cfg.stackRefs[si].userBasse ?? "";
      // Ancien défaut (haut = dalle max, bas = pied) → nouveau modèle « arase en tête » pleine au-dessus de la dalle
      if (cfg.stackRefs[si].refHaute === WALL_REF_SLAB_MAX && cfg.stackRefs[si].refBasse === WALL_REF_PIED) {
        cfg.stackRefs[si].refHaute = WALL_REF_ARASE;
      }
    }
  }
}

function getActiveStacksOnArase(cfg) {
  const active = new Set();
  if (!cfg?.slabs) return active;
  for (const info of Object.values(cfg.slabs)) {
    if (!info?.enabled) continue;
    for (let si = 0; si < 3; si++) {
      if (info.stacks?.[si]) active.add(si + 1);
    }
  }
  return active;
}

/**
 * Reconstruit le bloc « définition des niveaux par stack » sous une arase.
 */
function renderWallAraseStackRefSection(murId, araseIndex, cfg, slabIds, araseBody) {
  let wrap = araseBody.querySelector(`[data-stack-refs-wrap="${araseIndex}"]`);
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.dataset.stackRefsWrap = String(araseIndex);
    wrap.style.marginTop = "0.35rem";
    wrap.style.padding = "0.25rem 0.35rem";
    wrap.style.borderRadius = "0.35rem";
    wrap.style.background = "rgba(30,41,59,0.55)";
    wrap.style.border = "1px solid rgba(71,85,105,0.5)";
    araseBody.appendChild(wrap);
  }
  wrap.innerHTML = "";
  ensureWallStackRefs(cfg);
  const murEl = state.importedElements.find((e) => e.id === murId);
  const murRoofKind = murEl ? classifyWallRoofFromProfiles(murEl).kind : "Mur";

  const active = getActiveStacksOnArase(cfg);
  if (!active.size) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";

  const title = document.createElement("div");
  title.textContent = "Définition des niveaux par stack";
  title.style.fontSize = "0.68rem";
  title.style.fontWeight = "600";
  title.style.color = "#cbd5e1";
  title.style.marginBottom = "0.25rem";
  wrap.appendChild(title);

  const refOptions = () => {
    if (murRoofKind === "Pignon") {
      const opts = [
        { v: WALL_REF_PIGNON_POINTE, label: "Pointe de pignon" },
        { v: WALL_REF_PIGNON_BAS, label: "Bas de pignon" },
        { v: WALL_REF_PIED, label: "Pied de mur" },
        { v: WALL_REF_SLAB_MAX, label: "Dalle la plus haute (stack)" },
        { v: WALL_REF_SLAB_MIN, label: "Dalle la plus basse (stack)" },
        { v: WALL_REF_USER, label: "Donnée utilisateur" },
      ];
      slabIds.forEach((sid) => {
        opts.push({ v: `${WALL_REF_SLAB_PREFIX}${sid}`, label: `Dalle n° ${sid}` });
      });
      return opts;
    }
    const opts = [
      { v: WALL_REF_ARASE, label: "Arase du mur (libre en tête)" },
      { v: WALL_REF_PIED, label: "Pied de mur" },
      { v: WALL_REF_SLAB_MAX, label: "Dalle la plus haute (stack)" },
      { v: WALL_REF_SLAB_MIN, label: "Dalle la plus basse (stack)" },
      { v: WALL_REF_USER, label: "Donnée utilisateur" },
    ];
    slabIds.forEach((sid) => {
      opts.push({ v: `${WALL_REF_SLAB_PREFIX}${sid}`, label: `Dalle n° ${sid}` });
    });
    return opts;
  };

  if (murRoofKind === "Pignon") {
    for (let si = 1; si <= 3; si++) {
      const sr0 = cfg.stackRefs[si];
      if (sr0.refHaute === WALL_REF_ARASE) sr0.refHaute = WALL_REF_PIGNON_POINTE;
      if (sr0.refBasse === WALL_REF_ARASE) sr0.refBasse = WALL_REF_PIGNON_BAS;
    }
  }

  const buildRefRow = (labelText, stackNum, field) => {
    const sr = cfg.stackRefs[stackNum];
    const userKey = field === "refHaute" ? "userHaute" : "userBasse";
    const curKey = field === "refHaute" ? "refHaute" : "refBasse";

    const wrapRow = document.createElement("div");
    wrapRow.style.marginBottom = "0.18rem";

    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "minmax(0, 1fr) minmax(0, 1.4fr)";
    row.style.alignItems = "center";
    row.style.gap = "0.35rem";
    row.style.fontSize = "0.66rem";

    const lab = document.createElement("span");
    lab.textContent = labelText;
    lab.style.color = "#94a3b8";
    row.appendChild(lab);

    const sel = document.createElement("select");
    sel.style.fontSize = "0.66rem";
    sel.style.maxWidth = "100%";
    const cur = sr[curKey];
    let matched = false;
    refOptions().forEach((o) => {
      const op = document.createElement("option");
      op.value = o.v;
      op.textContent = o.label;
      if (o.v === cur) {
        op.selected = true;
        matched = true;
      }
      sel.appendChild(op);
    });
    if (!matched && cur) {
      const op = document.createElement("option");
      op.value = cur;
      op.textContent = `Réf. sauvegardée : ${cur}`;
      op.selected = true;
      sel.appendChild(op);
    }
    sel.addEventListener("change", () => {
      sr[curKey] = sel.value;
      renderWallAraseStackRefSection(murId, araseIndex, cfg, slabIds, araseBody);
    });
    row.appendChild(sel);
    wrapRow.appendChild(row);

    if (parseWallRefKey(sr[curKey]).kind === WALL_REF_USER) {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.placeholder = "Hauteur [m] (÷2 pour masse)";
      inp.value = sr[userKey] ?? "";
      inp.style.width = "100%";
      inp.style.fontSize = "0.66rem";
      inp.style.marginTop = "0.12rem";
      inp.addEventListener("input", () => {
        sr[userKey] = inp.value;
      });
      wrapRow.appendChild(inp);
    }

    return wrapRow;
  };

  [...active].sort((a, b) => a - b).forEach((stackNum) => {
    const block = document.createElement("div");
    block.style.marginBottom = "0.35rem";
    block.style.paddingBottom = "0.25rem";
    block.style.borderBottom = "1px solid rgba(51,65,85,0.45)";

    const st = document.createElement("div");
    st.textContent = `Stack ${stackNum}`;
    st.style.fontSize = "0.65rem";
    st.style.fontWeight = "600";
    st.style.color = "#e2e8f0";
    st.style.marginBottom = "0.15rem";
    block.appendChild(st);

    block.appendChild(buildRefRow("Référence haute =", stackNum, "refHaute"));
    block.appendChild(buildRefRow("Référence basse =", stackNum, "refBasse"));

    wrap.appendChild(block);
  });
}

function computeAutoStabilityForLength(typeStructKey, L, effortTete) {
  const cfg = typeStructKey ? MUR_TYPE_TABLE[typeStructKey] : null;
  if (!cfg || !Number.isFinite(effortTete) || !Number.isFinite(L) || L <= 0) return null;

  const Mmax = Number(cfg.Mmax);
  const b = Number(cfg.b);
  const h = Number(cfg.h);
  if (!Number.isFinite(Mmax) || !Number.isFinite(b) || !Number.isFinite(h)) return null;

  const F_M = ((8 * Mmax) / (L ** 2)) / 10;

  const F_lim = 0.005;
  const E_eff = 1.5e10;
  const I_quadra = (b * (h ** 3)) / 12;
  const F_f = ((((F_lim * E_eff * I_quadra) / (L ** 4)) * (384 / 5))) / 10;

  const F_res = Math.min(F_M, F_f);
  return { typeStructKey, F_M, F_f, F_res, stable: F_res >= effortTete };
}

/**
 * Sélectionne le chaînage à utiliser pour un mur :
 *  - si opts.useRampant est vrai et qu'un chaînage rampant/pignon est défini, on l'utilise
 *    (le double chaînage suit le pan du toit) ;
 *  - sinon on prend le chaînage horizontal classique.
 *
 * Le caller (typiquement `buildMassCases`) décide quand `useRampant` doit valoir true.
 * Règles utilisées en amont :
 *   - réf. haute = réf. basse = "Pointe de pignon" (cas spécial pignon pointe/pointe)
 *   - OU au moins une des dalles du stack est géométriquement "rampante"
 */
function getEffectiveTypeStructKey(murId, opts = {}) {
  const attrs = state.mursAttributes?.[murId] || {};
  if (opts.useRampant && attrs.typeStructKeyRampant) {
    return attrs.typeStructKeyRampant;
  }
  return attrs.typeStructKey || "";
}

function computeAutoStability(murEl, murId, effortTete, opts = {}) {
  const typeStructKey = getEffectiveTypeStructKey(murId, { useRampant: !!opts.useRampant });
  const L = getWallSpanLength(murEl);
  return computeAutoStabilityForLength(typeStructKey, L, effortTete);
}

function computeAnchorageNeed(murEl, murId, effortTete, stab, opts = {}) {
  // Si autostable, pas d'ancrage à dimensionner
  if (stab && stab.stable) return { label: "pas de besoin", anchors: 0 };
  const typeStructKey = getEffectiveTypeStructKey(murId, { useRampant: !!opts.useRampant });
  const Lfull = getWallSpanLength(murEl);
  if (!typeStructKey || !Number.isFinite(Lfull) || Lfull <= 0 || !Number.isFinite(effortTete)) return null;

  // On divise la longueur du mur en N travées (L = Lfull / N).
  // Le nombre d'ancrages correspond aux appuis intermédiaires : N - 1.
  const MAX_N = 50;
  for (let N = 2; N <= MAX_N; N++) {
    const L = Lfull / N;
    const check = computeAutoStabilityForLength(typeStructKey, L, effortTete);
    if (check && check.stable) {
      return { label: String(N - 1), anchors: N - 1 };
    }
  }
  return { label: `>${MAX_N - 1}`, anchors: null };
}

function getBeamSpanLength(el) {
  const L = toNumberMaybe(el?.length);
  const P = toNumberMaybe(el?.width);
  if (L == null && P == null) return null;
  if (L == null) return P;
  if (P == null) return L;
  return Math.max(L, P);
}

function getBeamSectionDims(el) {
  const L = toNumberMaybe(el?.length);
  const P = toNumberMaybe(el?.width);
  const H = toNumberMaybe(el?.height);
  if (H == null || (L == null && P == null)) return null;
  const span = getBeamSpanLength(el);
  let thickness = null;
  if (L != null && P != null) thickness = Math.min(L, P);
  else thickness = L != null ? L : P;
  return { height: H, thickness, span };
}

function computeBeamStabilityForLength({ b, h, Ast_cm2, L }) {
  // b = hauteur (m), h = épaisseur (m), Ast_cm2 = cm² (un côté), L = portée (m)
  const bM = Number(b);
  const hM = Number(h);
  const LM = Number(L);
  const Ast = Number(Ast_cm2);
  if (![bM, hM, LM, Ast].every(Number.isFinite) || bM <= 0 || hM <= 0 || LM <= 0) return null;

  const e = hM > 0.15 ? 0.04 : 0.035; // m
  const d = hM - e;
  if (d <= 0) return null;

  const _ast = Ast / 10000; // m²
  const _fe = 500000000;
  const _fbu = (0.85 * 25000000) / 1.5;

  const Mmax =
    -(
      (20 * _ast * _fe * (10 * _ast * _fe - 23 * bM * d * _fbu)) /
      (529 * bM * _fbu)
    );

  const I_quadra = (bM * (hM ** 3)) / 12;
  const Eeff = 1.5e10;
  const Flim = 0.005;

  const F_M = ((8 * Mmax) / (LM ** 2)) / 10;
  const F_f = (((Flim * Eeff * I_quadra) / (LM ** 4)) * (384 / 5)) / 10;
  const F_res = Math.min(F_M, F_f);
  return { F_M, F_f, F_res, stable: F_res >= 0 };
}

function computeBeamAutoStability(poutreEl, poutreId, effortTete, options = {}) {
  if (!poutreEl || !Number.isFinite(effortTete)) return null;
  const L = options.L ?? getBeamSpanLength(poutreEl);
  const sec3d = getBeamSectionDims(poutreEl);
  const defaultB = sec3d ? sec3d.height : toNumberMaybe(poutreEl.height); // hauteur
  const defaultH = sec3d ? sec3d.thickness : toNumberMaybe(poutreEl.width); // épaisseur
  const b = options.b ?? defaultB;
  const h = options.h ?? defaultH;
  const Ast_cm2 = options.Ast_cm2 ?? Number(state.poutresAttributes?.[poutreId]?.Ast || 0);
  const res = computeBeamStabilityForLength({ b, h, Ast_cm2, L });
  if (!res) return null;
  return { ...res, stable: res.F_res >= effortTete };
}

function computeBeamAnchorageNeed(poutreEl, poutreId, effortTete, stab, options = {}) {
  if (stab && stab.stable) return { label: "pas de besoin", anchors: 0 };
  const Lfull = options.Lfull ?? getBeamSpanLength(poutreEl);
  if (!Number.isFinite(Lfull) || Lfull <= 0 || !Number.isFinite(effortTete)) return null;
  const MAX_N = 50;
  for (let N = 2; N <= MAX_N; N++) {
    const L = Lfull / N;
    const check = computeBeamAutoStability(poutreEl, poutreId, effortTete, { ...options, L });
    if (check && check.stable) return { label: String(N - 1), anchors: N - 1 };
  }
  return { label: `>${MAX_N - 1}`, anchors: null };
}

function computeBeamChainageAnchorageNeed(typeStructKey, Lfull, effortTete, stab) {
  // Même méthode que pour les murs : découpage en N travées (L = Lfull / N),
  // puis on prend N-1 ancrages si la vérification devient stable.
  if (stab && stab.stable) return { label: "pas de besoin", anchors: 0 };
  if (!typeStructKey || !Number.isFinite(Lfull) || Lfull <= 0 || !Number.isFinite(effortTete)) return null;
  const MAX_N = 50;
  for (let N = 2; N <= MAX_N; N++) {
    const L = Lfull / N;
    const check = computeAutoStabilityForLength(typeStructKey, L, effortTete);
    if (check && check.stable) return { label: String(N - 1), anchors: N - 1 };
  }
  return { label: `>${MAX_N - 1}`, anchors: null };
}

function getDominantPlanAxis(el) {
  const lx = Math.abs(toNumberMaybe(el?.length) || 0);
  const lz = Math.abs(toNumberMaybe(el?.width) || 0);
  if (lx === 0 && lz === 0) return null;
  return lx >= lz ? "X" : "Z";
}

/** Sens porteur affiché : X (monde X) ou Y (monde Z en plan). Compat. L/P. */
function normalizeCharpenteSens(slabEl, sens) {
  const s = String(sens || "").trim().toUpperCase();
  if (s === "X") return "X";
  if (s === "Y" || s === "Z") return "Y";
  if (s === "L" || s === "P") {
    const major = getDominantPlanAxis(slabEl);
    if (!major) return s === "P" ? "X" : "Y";
    const minor = major === "X" ? "Z" : "X";
    const axis = s === "P" ? major : minor;
    return axis === "X" ? "X" : "Y";
  }
  return "";
}

function getBearingPlanAxisFromSens(slabEl, sens) {
  const n = normalizeCharpenteSens(slabEl, sens);
  if (n === "X") return "X";
  if (n === "Y") return "Z";
  return null;
}

function getSlabBearingSpanM(slabEl, sens) {
  const lx = Math.abs(toNumberMaybe(slabEl?.length) || 0);
  const lz = Math.abs(toNumberMaybe(slabEl?.width) || 0);
  const bearing = getBearingPlanAxisFromSens(slabEl, sens);
  if (bearing === "X") return lx;
  if (bearing === "Z") return lz;
  return Math.max(lx, lz);
}

function getSlabDemiPorteeM(slabEl, sens) {
  return getSlabBearingSpanM(slabEl, sens) / 2;
}

function getSlabBearingDirUnitXZ(slabEl, sens) {
  const bearing = getBearingPlanAxisFromSens(slabEl, sens);
  if (bearing === "X") return new THREE.Vector3(1, 0, 0);
  if (bearing === "Z") return new THREE.Vector3(0, 0, 1);
  return null;
}

function isWallBearingSlab(murEl, slabEl, sens) {
  const wallAxis = getDominantPlanAxis(murEl);
  const bearingAxis = getBearingPlanAxisFromSens(slabEl, sens);
  if (!wallAxis || !bearingAxis) return true;
  return bearingAxis !== wallAxis;
}

/**
 * Dalle « rampante » : mur pignon, porteur parallèle au mur (pan), hors dalle horizontale à plat.
 */
function getSlabTopDeltaAlongAxis(slabEl, axisKey) {
  const prof = slabEl?.slabTopProfile;
  if (!prof || !axisKey) return 0;
  return axisKey === "X" ? prof.deltaX : prof.deltaZ;
}

function isSlabTopNearlyHorizontal(slabEl) {
  const prof = slabEl?.slabTopProfile;
  if (!prof) return false;
  return Math.max(prof.deltaX || 0, prof.deltaZ || 0) < WALL_SLOPE_MIN_DH * 0.5;
}

/**
 * Classification géométrique simple d'une dalle :
 *   - "Rampante" si la dalle a une variation d'altitude > seuil (suit la pente du toit)
 *   - "Horiz."   sinon (dalle plate)
 * Indépendant du mur associé : c'est purement la géométrie de l'interface haute de la dalle.
 */
function getSlabFormeKind(slabEl) {
  const prof = slabEl?.slabTopProfile;
  if (!prof) return "Horiz.";
  const maxDelta = Math.max(prof.deltaX || 0, prof.deltaZ || 0);
  return maxDelta >= WALL_SLOPE_MIN_DH * 0.5 ? "Rampante" : "Horiz.";
}

function isSlabRampanteGeo(slabEl) {
  return getSlabFormeKind(slabEl) === "Rampante";
}

function isSlabRampantePourMurPignon(murEl, slabEl, sens) {
  if (!murEl || !slabEl) return false;
  if (classifyWallRoofFromProfiles(murEl).kind !== "Pignon") return false;
  if (isWallBearingSlab(murEl, slabEl, sens)) return false;
  if (isSlabTopNearlyHorizontal(slabEl)) return false;
  const wallAxis = getDominantPlanAxis(murEl);
  if (wallAxis && getSlabTopDeltaAlongAxis(slabEl, wallAxis) > WALL_SLOPE_MIN_DH * 0.5) return true;
  const prof = slabEl?.slabTopProfile;
  if (prof && Math.max(prof.deltaX || 0, prof.deltaZ || 0) > WALL_SLOPE_MIN_DH * 0.5) return true;
  return true;
}

function stackHasRampantPignonSlab(murEl, slabIds) {
  if (!murEl || !slabIds?.length) return false;
  for (const sid of slabIds) {
    const slabEl = state.importedElements.find((e) => e.id === sid);
    const sens = state.charpenteAttributes?.[sid]?.sens || "";
    if (slabEl && isSlabRampantePourMurPignon(murEl, slabEl, sens)) return true;
  }
  return false;
}

function formatDaN(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function escapeCsvCell(value) {
  const s = value == null ? "" : String(value);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildMassTableRows(cases, sdT, g) {
  const rows = [];
  for (const c of cases) {
    const Ftete = g ? (c.total * sdT) / g : 0;
    if (c.kind === "Mur") {
      const murEl = state.importedElements.find((e) => e.id === c.murId);
      const stab = computeAutoStability(murEl, c.murId, Ftete, { useRampant: c.useRampantChainage });
      const stabTxt = stab ? (stab.stable ? "Oui" : "Non") : "—";
      const anch = computeAnchorageNeed(murEl, c.murId, Ftete, stab, { useRampant: c.useRampantChainage });
      const anchTxt = stabTxt === "Oui" ? "pas de besoin" : (anch?.label ?? "—");
      const usedRampant = !!c.useRampantChainage
        && !!state.mursAttributes?.[c.murId]?.typeStructKeyRampant;
      const verifieSurTxt = usedRampant ? "Chaînage rampant (mur)" : "Chaînage (mur)";
      rows.push({
        type: "Mur",
        id: c.murId,
        arase: c.araseIndex + 1,
        hArase: c.H_arase,
        stack: c.stack,
        dalles: c.slabIds.join(", "),
        hDalleTop: c.slabY,
        hCalcMur: c.hCalc,
        mat: c.densKey || "—",
        masseMur: c.mMur,
        masseDalles: c.mDalles,
        massePoutre: null,
        total: c.total,
        effortTete: Ftete,
        verifieSur: verifieSurTxt,
        autoStab: stabTxt,
        nbAncrage: anchTxt,
        pignonATriM2: c.pignonATriM2 ?? null,
        pignonEffortPointe:
          c.pignonEffortPointe != null && g ? (c.pignonEffortPointe * sdT) / g : null,
      });
    } else {
      const poutreEl = state.importedElements.find((e) => e.id === c.poutreId);
      let autoStab = "—";
      let nbAncrage = "—";
      let verifieSur = "Poutre";
      if (poutreEl) {
        if (c.hasOverride && c.checkMode === "chainage") {
          const typeStructKey = c.ov?.typeStructKey || "";
          const L = getBeamSpanLength(poutreEl);
          const stab = computeAutoStabilityForLength(typeStructKey, L, Ftete);
          autoStab = stab ? (stab.stable ? "Oui" : "Non") : "—";
          const anch = stab ? computeBeamChainageAnchorageNeed(typeStructKey, L, Ftete, stab) : null;
          nbAncrage = autoStab === "Oui" ? "pas de besoin" : (anch?.label ?? "—");
          verifieSur = "Chaînage (poutre)";
        } else {
          const Ast_cm2 = Number(state.poutresAttributes?.[c.poutreId]?.Ast || 0);
          const b = c.hasOverride ? Number(c.ov?.h_cm) / 100 : toNumberMaybe(poutreEl.height); // b=hauteur
          const h = c.hasOverride ? Number(c.ov?.b_cm) / 100 : toNumberMaybe(poutreEl.width);  // h=épaisseur
          const L = getBeamSpanLength(poutreEl);
          const stab = computeBeamAutoStability(poutreEl, c.poutreId, Ftete, { b, h, Ast_cm2, L });
          autoStab = stab ? (stab.stable ? "Oui" : "Non") : "—";
          const anch = stab ? computeBeamAnchorageNeed(poutreEl, c.poutreId, Ftete, stab, { b, h, Ast_cm2, Lfull: L }) : null;
          nbAncrage = autoStab === "Oui" ? "pas de besoin" : (anch?.label ?? "—");
          verifieSur = "Poutre";
        }
      }
      rows.push({
        type: "Poutre",
        id: c.poutreId,
        arase: null,
        hArase: null,
        stack: c.stack,
        dalles: c.slabIds.join(", "),
        hDalleTop: null,
        hCalcMur: null,
        mat: "BA 2500",
        masseMur: c.mMur,
        masseDalles: c.mDalles,
        massePoutre: c.mPoutre,
        total: c.total,
        effortTete: Ftete,
        verifieSur,
        autoStab,
        nbAncrage,
        pignonATriM2: null,
        pignonEffortPointe: null,
      });
    }
  }
  return rows;
}

function openPrintWindow(title, bodyHtml, options = {}) {
  const landscape = options.landscape === true;
  const fillPage = options.fillPage === true;
  const fitTable = options.fitTable === true;
  const w = window.open("", "_blank");
  if (!w) return;
  const pageMargin = landscape ? "6mm" : "10mm";
  const pageRule = `@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: ${pageMargin}; }`;
  const fillPageCSS = fillPage
    ? `
    html,body{margin:0;padding:0}
    body{padding:6px}
    h1{font-size:14px;margin:0 0 4px}
    .meta{font-size:10px;margin-bottom:2px}
    .muted{font-size:10px;line-height:1.25;margin:0 0 4px}
    svg{display:block;margin:0 auto;max-width:100%;max-height:calc(100vh - 70px);width:auto;height:auto}
    @media print {
      body{padding:0}
      h1{margin:0 0 2px;font-size:12px}
      .meta{font-size:9px}
      .muted{font-size:9px;line-height:1.2;margin:0 0 2px}
      svg{max-width:100%;max-height:88vh;width:auto;height:auto;margin:0 auto}
    }`
    : `@media print { body{padding:0} }`;
  // CSS spécifique pour faire tenir les grands tableaux sur la page (en paysage typiquement).
  const fitTableCSS = fitTable
    ? `
    body{padding:6px}
    h1{font-size:14px;margin:0 0 4px}
    .meta{font-size:10px;margin-bottom:4px}
    table{width:100%;table-layout:auto;border-collapse:collapse;font-size:9px;line-height:1.15}
    th,td{padding:2px 3px;border:1px solid #ccc;vertical-align:top;word-break:break-word;overflow-wrap:anywhere}
    th{background:#f3f4f6;font-weight:600}
    td.num,th.num{text-align:right;white-space:nowrap}
    /* En impression : on autorise la table à se découper sur plusieurs pages tout en restant lisible */
    @media print {
      body{padding:0}
      table{font-size:8.5px}
      thead{display:table-header-group}
      tr{page-break-inside:avoid}
    }`
    : "";
  w.document.open();
  w.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <style>
    ${pageRule}
    body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:16px;color:#111}
    h1{font-size:18px;margin:0 0 10px}
    h2{font-size:14px;margin:16px 0 8px}
    .meta{font-size:12px;color:#444;margin-bottom:10px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{border:1px solid #ddd;padding:4px 6px;vertical-align:top}
    th{background:#f3f4f6}
    .num{text-align:right}
    .muted{color:#666}
    img{max-width:100%;height:auto}
    svg{max-width:100%;height:auto;display:block;margin:0 auto}
    ${fillPageCSS}
    ${fitTableCSS}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`);
  w.document.close();
  w.focus();
  // Laisser un tick pour le rendu avant print
  setTimeout(() => w.print(), 150);
}

function captureViewerWithWallLabels() {
  const scene = getViewerScene();
  const camera = getViewerCamera();
  if (!scene || !camera || !viewerContainer) return null;
  const ctx3d = state.viewer?.context || {};
  const renderer3d =
    typeof ctx3d.getRenderer === "function" ? ctx3d.getRenderer() : ctx3d.renderer;
  const baseCanvas = renderer3d?.domElement || viewerContainer.querySelector("canvas");
  if (!baseCanvas) return null;

  const w = baseCanvas.width;
  const h = baseCanvas.height;
  if (!w || !h) return null;

  // Capture robuste : rendu dans un RenderTarget + readPixels (pas besoin de preserveDrawingBuffer)
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx || !renderer3d) return null;
  try {
    const rt = new THREE.WebGLRenderTarget(w, h);
    const prevRt = renderer3d.getRenderTarget?.() ?? null;
    renderer3d.setRenderTarget(rt);
    renderer3d.render(scene, camera);
    const pixels = new Uint8Array(w * h * 4);
    renderer3d.readRenderTargetPixels(rt, 0, 0, w, h, pixels);
    renderer3d.setRenderTarget(prevRt);
    rt.dispose();

    // WebGL est inversé verticalement → on flip sur canvas
    const imageData = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const srcRow = h - 1 - y;
      const srcStart = srcRow * w * 4;
      const dstStart = y * w * 4;
      imageData.data.set(pixels.subarray(srcStart, srcStart + w * 4), dstStart);
    }
    ctx.putImageData(imageData, 0, 0);
  } catch (_) {
    // fallback best effort
    try {
      const imgDataUrl = baseCanvas.toDataURL("image/png");
      const img = new Image();
      img.src = imgDataUrl;
      // on ne bloque pas : ce fallback peut rester vide, mais c'est mieux que rien
    } catch (_) {}
    return null;
  }

  // Dessiner des labels "Mur ID" uniquement pour les murs calculés (rouge/vert)
  const allowedMurs = new Set(
    Object.entries(state.massStabilityByMur || {})
      .map(([idStr, info]) => ({ id: Number(idStr), info }))
      .filter((x) => Number.isFinite(x.id) && (x.info?.stable === true || x.info?.stable === false))
      .map((x) => x.id)
  );
  const walls = state.importedElements
    .filter((e) => matchesCategory(e, "murs"))
    .filter((e) => allowedMurs.has(e.id));

  // Dessiner aussi des labels "Poutre ID" pour les poutres calculées (rouge/vert)
  const allowedPoutres = new Set(
    Object.entries(state.massStabilityByPoutre || {})
      .map(([idStr, info]) => ({ id: Number(idStr), info }))
      .filter((x) => Number.isFinite(x.id) && (x.info?.stable === true || x.info?.stable === false))
      .map((x) => x.id)
  );
  const beams = state.importedElements
    .filter((e) => matchesCategory(e, "poutres"))
    .filter((e) => allowedPoutres.has(e.id));
  const tmpV = new THREE.Vector3();
  const rect = baseCanvas.getBoundingClientRect();
  const scaleX = w / rect.width;
  const scaleY = h / rect.height;

  const drawLabelBox = (x, y, wBox, hBox) => {
    ctx.fillRect(x, y, wBox, hBox);
    ctx.strokeRect(x, y, wBox, hBox);
  };

  ctx.font = "12px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textBaseline = "middle";

  walls.forEach((el) => {
    const x = toNumberMaybe(el.x);
    const y = toNumberMaybe(el.y);
    const z = toNumberMaybe(el.z);
    if (x == null || y == null || z == null) return;
    const hh = toNumberMaybe(el.height) || 0;
    tmpV.set(x, y + hh * 0.6, z).project(camera);
    const sx = (tmpV.x * 0.5 + 0.5) * rect.width;
    const sy = (-tmpV.y * 0.5 + 0.5) * rect.height;
    const px = sx * scaleX;
    const py = sy * scaleY;
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    if (px < 0 || py < 0 || px > w || py > h) return;

    const roof = classifyWallRoofFromProfiles(el);
    const araseTxt =
      roof.araseCount && Number.isFinite(roof.araseHeight)
        ? ` (arase ${roof.araseCount} : ${formatNum(roof.araseHeight)} m)`
        : "";
    const label = `Mur ${el.id} "${roof.kind}"${araseTxt}`;
    const padX = 6;
    const tw = ctx.measureText(label).width;
    const bw = tw + padX * 2;
    const bh = 18;
    const bx = Math.max(0, Math.min(w - bw, px - bw / 2));
    const by = Math.max(0, Math.min(h - bh, py - bh / 2));

    const st = state.massStabilityByMur?.[el.id];
    const isStable = st && st.stable === true;
    ctx.fillStyle = isStable ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)";
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    drawLabelBox(bx, by, bw, bh);
    ctx.fillStyle = "#0b1220";
    ctx.fillText(label, bx + padX, by + bh / 2);
  });

  // Labels pour les poutres
  beams.forEach((el) => {
    const x = toNumberMaybe(el.x);
    const y = toNumberMaybe(el.y);
    const z = toNumberMaybe(el.z);
    if (x == null || y == null || z == null) return;
    const hh = toNumberMaybe(el.height) || 0;
    tmpV.set(x, y + hh * 0.6, z).project(camera);
    const sx = (tmpV.x * 0.5 + 0.5) * rect.width;
    const sy = (-tmpV.y * 0.5 + 0.5) * rect.height;
    const px = sx * scaleX;
    const py = sy * scaleY;
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    if (px < 0 || py < 0 || px > w || py > h) return;

    const label = `Poutre ${el.id}`;
    const padX = 6;
    const tw = ctx.measureText(label).width;
    const bw = tw + padX * 2;
    const bh = 18;
    const bx = Math.max(0, Math.min(w - bw, px - bw / 2));
    const by = Math.max(0, Math.min(h - bh, py - bh / 2));

    const st = state.massStabilityByPoutre?.[el.id];
    const isStable = st && st.stable === true;
    ctx.fillStyle = isStable ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)";
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    drawLabelBox(bx, by, bw, bh);
    ctx.fillStyle = "#0b1220";
    ctx.fillText(label, bx + padX, by + bh / 2);
  });

  return out.toDataURL("image/png");
}

function getSdTandG() {
  const sdT = Number(sdTInput?.value);
  const g = Number(graviteInput?.value);
  return {
    sdT: Number.isFinite(sdT) ? sdT : 0,
    g: Number.isFinite(g) ? g : 9.81,
  };
}

function buildMassCases() {
  const cases = [];

  // --- MURS ---
  const mursCfg = state.wallAraseConfig?.murs || {};
  for (const [murIdStr, arasesCfg] of Object.entries(mursCfg)) {
    const murId = Number(murIdStr);
    const murEl = state.importedElements.find((e) => e.id === murId);
    if (!murEl) continue;
    const araseHeights = Array.isArray(murEl.araseHeights) ? murEl.araseHeights : null;
    if (!araseHeights || !Array.isArray(arasesCfg)) continue;

    for (let araseIndex = 0; araseIndex < arasesCfg.length; araseIndex++) {
      const araseCfg = arasesCfg[araseIndex];
      if (!araseCfg?.enabled) continue;

      for (let stack = 1; stack <= 3; stack++) {
        const slabIds = [];
        for (const [slabIdStr, info] of Object.entries(araseCfg.slabs || {})) {
          const slabId = Number(slabIdStr);
          if (!Number.isFinite(slabId)) continue;
          if (!info?.enabled) continue;
          if (!info.stacks?.[stack - 1]) continue;
          slabIds.push(slabId);
        }
        if (!slabIds.length) continue;

        const slabs = slabIds
          .map((sid) => state.importedElements.find((e) => e.id === sid))
          .filter(Boolean);
        if (!slabs.length) continue;

        const slabTopYs = slabs.map(getSlabTopY).filter((v) => v != null);
        const slabY = slabTopYs.length ? Math.max(...slabTopYs) : null;

        const H_arase = araseHeights[araseIndex];
        ensureWallStackRefs(araseCfg);
        const sr = araseCfg.stackRefs?.[stack];
        let hCalc = null;
        let massDetail = null;
        if (sr) {
          massDetail = computeWallStackMurMassDetail(murEl, araseIndex, slabIds, sr);
          hCalc = massDetail?.hMur ?? null;
        }
        if (hCalc == null) {
          hCalc = slabY != null ? computeWallHeightForMass(H_arase, slabY) : null;
        }

        const densKey = state.mursAttributes?.[murId]?.typeMurKey || "";
        const dens = densKey ? getMaterialValue(densKey) : 0; // daN/m3
        const t = getWallThickness(murEl) || 0;
        let mMur;
        if (massDetail?.mMurLinear != null) {
          mMur = massDetail.mMurLinear;
        } else {
          mMur = hCalc != null ? dens * hCalc * 1 * t : 0;
        }

        const skipSlabs = massDetail?.skipSlabs === true;
        let mDalles = 0;
        const slabDetails = [];
        if (!skipSlabs) {
          for (const slabEl of slabs) {
            const attrs = state.charpenteAttributes?.[slabEl.id] || {};
            const m2 = getCharpenteMassPerM2(attrs);
            const sens = attrs.sens || "";
            const L = toNumberMaybe(slabEl.length) || 0;
            const P = toNumberMaybe(slabEl.width) || 0;
            const demiPorteeBase = getSlabDemiPorteeM(slabEl, sens);
            const bearing = isWallBearingSlab(murEl, slabEl, sens);
            const demiPortee = bearing ? demiPorteeBase : 0.5;
            const m = m2.total * 1 * demiPortee;
            mDalles += m;
            slabDetails.push({
              id: slabEl.id,
              sens,
              L,
              P,
              bearing,
              demiPortee,
              G: m2.G,
              Q: m2.Q,
              m2: m2.total,
              m,
            });
          }
        }

        // Chaînage rampant requis si :
        //  (1) réf. haute = réf. basse = "Pointe de pignon" (pignon pointe/pointe), OU
        //  (2) au moins une dalle du stack est géométriquement rampante.
        // ATTENTION : un mur classé "Rive" (ou non classé) reste toujours sur le chaînage
        // horizontal, même si la dalle associée est géométriquement rampante.
        const refHauteKey = sr ? String(sr.refHaute || "").trim() : "";
        const refBasseKey = sr ? String(sr.refBasse || "").trim() : "";
        const wallKind = classifyWallRoofFromProfiles(murEl).kind;
        const wallAllowsRampant = wallKind === "Pignon" || wallKind === "Rampant";
        const hasRampanteSlabGeo = slabs.some((s) => isSlabRampanteGeo(s));
        const isPignonPointePointe =
          refHauteKey === WALL_REF_PIGNON_POINTE && refBasseKey === WALL_REF_PIGNON_POINTE;
        const useRampantChainage = wallAllowsRampant && (isPignonPointePointe || hasRampanteSlabGeo);

        cases.push({
          kind: "Mur",
          murId,
          araseIndex,
          H_arase,
          stack,
          slabIds,
          slabY,
          hCalc,
          densKey,
          dens,
          thickness: t,
          mMur,
          mDalles,
          mPoutre: 0,
          total: mMur + mDalles,
          slabDetails,
          pignonEffortPointe: massDetail?.effortPointeDaN ?? null,
          pignonATriM2: massDetail?.ATriM2 ?? null,
          skipSlabMass: skipSlabs,
          refHauteKey,
          refBasseKey,
          useRampantChainage,
        });
      }
    }
  }

  // --- POUTRES ---
  const poutresCfg = state.poutreStackConfig || {};
  for (const [poutreIdStr, bySlab] of Object.entries(poutresCfg)) {
    const poutreId = Number(poutreIdStr);
    const poutreEl = state.importedElements.find((e) => e.id === poutreId);
    if (!poutreEl) continue;
    const densBA = 2500; // daN/m3 (BA)
    const sec3d = getBeamSectionDims(poutreEl);
    if (!sec3d) continue;
    const Lp = sec3d.span || 0;
    const Hp3d = sec3d.height || 0;      // hauteur
    const Tp3d = sec3d.thickness || 0;   // épaisseur

    const poutreAttrs = state.poutresAttributes?.[poutreId] || {};
    const ov = poutreAttrs.sectionOverride || {};
    const hasOverride =
      !!ov.enabled &&
      Number.isFinite(Number(ov.b_cm)) &&
      Number.isFinite(Number(ov.h_cm));
    const bDef_m = hasOverride ? Number(ov.b_cm) / 100 : null; // épaisseur (m)
    const hDef_m = hasOverride ? Number(ov.h_cm) / 100 : null; // hauteur (m)

    // Masse poutre utilisée pour le calcul (par mètre linéaire = 1 ml)
    // Unités : densBA en daN/m3, dimensions en m => masse en daN/ml
    const mPoutre = hasOverride
      ? densBA * 1 * bDef_m * hDef_m
      : densBA * 1 * Hp3d * Tp3d;

    // Masse du mur au-dessus dans le volume 3D (si section définie)
    let mMurAuDessus = 0;
    if (hasOverride) {
      const densMurKey = ov.typeMurKey || "";
      const densMur = densMurKey ? getMaterialValue(densMurKey) : 0;
      const hMur_m = Math.max(0, Hp3d - hDef_m);
      // Ep du volume 3D = Tp3d (épaisseur), 1 ml
      mMurAuDessus = densMur * hMur_m * 1 * Tp3d;
    }

    for (let stack = 1; stack <= 3; stack++) {
      const slabIds = [];
      for (const [slabIdStr, info] of Object.entries(bySlab || {})) {
        const slabId = Number(slabIdStr);
        if (!Number.isFinite(slabId)) continue;
        if (!info?.enabled) continue;
        if (!info.stacks?.[stack - 1]) continue;
        slabIds.push(slabId);
      }
      if (!slabIds.length) continue;

      // Masse des dalles associées à la poutre pour ce stack (même logique que pour les murs)
      let mDalles = 0;
      const slabDetails = [];
      for (const slabId of slabIds) {
        const slabEl = state.importedElements.find((e) => e.id === slabId);
        if (!slabEl) continue;
        const attrs = state.charpenteAttributes?.[slabEl.id] || {};
        const m2 = getCharpenteMassPerM2(attrs);
        const sens = attrs.sens || "";
        const L = toNumberMaybe(slabEl.length) || 0;
        const P = toNumberMaybe(slabEl.width) || 0;
        const demiPorteeBase = getSlabDemiPorteeM(slabEl, sens);
        const bearing = isWallBearingSlab(poutreEl, slabEl, sens);
        const demiPortee = bearing ? demiPorteeBase : 0.5;
        const m = m2.total * 1 * demiPortee;
        mDalles += m;
        const topY = getSlabTopY(slabEl);
        slabDetails.push({
          id: slabEl.id,
          sens,
          L,
          P,
          bearing,
          demiPortee,
          G: m2.G,
          Q: m2.Q,
          m2: m2.total,
          m,
          slabTopY: topY, // interface supérieure de la dalle
        });
      }

      // Si section définie : on choisit la vérification par proximité d'interfaces (pas par centres).
      // - Poutre: comparaison avec l'interface haute de la section définie
      // - Chaînage: comparaison avec l'interface basse du chaînage (ht = 20cm par défaut)
      if (!hasOverride || hDef_m == null) {
        cases.push({
          kind: "Poutre",
          poutreId,
          stack,
          slabIds,
          mMur: mMurAuDessus,
          mDalles,
          mPoutre,
          total: mPoutre + mMurAuDessus + mDalles,
          slabDetails,
          hasOverride,
          checkMode: "poutre",
          ov,
        });
      } else {
        const yCenter = toNumberMaybe(poutreEl.y);
        const bottomY = yCenter != null ? yCenter - Hp3d / 2 : null;
        const topY3d = yCenter != null ? yCenter + Hp3d / 2 : null;

        const chainageHeight = 0.20; // m (interface basse à topY3d - 0.20)
        const beamTopSurface = bottomY != null ? bottomY + hDef_m : null;
        const chainageBottomSurface = topY3d != null ? topY3d - chainageHeight : null;

        // Fallback : si on n'a pas de surfaces cohérentes, on conserve l'ancien comportement
        if (beamTopSurface == null || chainageBottomSurface == null) {
          cases.push({
            kind: "Poutre",
            poutreId,
            stack,
            slabIds,
            mMur: mMurAuDessus,
            mDalles,
            mPoutre,
            total: mPoutre + mMurAuDessus + mDalles,
            slabDetails,
            hasOverride,
            checkMode: "poutre",
            ov,
          });
        } else {
          const partition = {
            poutre: { ids: [], mDalles: 0, slabDetails: [] },
            chainage: { ids: [], mDalles: 0, slabDetails: [] },
          };

          for (const sd of slabDetails) {
            // Si on ne sait pas l'interface, on affecte par défaut à la vérification "poutre"
            const sY = sd.slabTopY;
            const mode =
              sY == null
                ? "poutre"
                : Math.abs(sY - beamTopSurface) <= Math.abs(sY - chainageBottomSurface)
                  ? "poutre"
                  : "chainage";

            partition[mode].ids.push(sd.id);
            partition[mode].mDalles += sd.m;
            partition[mode].slabDetails.push(sd);
          }

          const hasP = partition.poutre.ids.length > 0;
          const hasC = partition.chainage.ids.length > 0;

          // Si tout tombe sur une seule interface -> un seul cas
          if (hasP && !hasC) {
            const part = partition.poutre;
            cases.push({
              kind: "Poutre",
              poutreId,
              stack,
              slabIds: part.ids,
              mMur: mMurAuDessus,
              mDalles: part.mDalles,
              mPoutre,
              total: mPoutre + mMurAuDessus + part.mDalles,
              slabDetails: part.slabDetails,
              hasOverride,
              checkMode: "poutre",
              ov,
            });
          } else if (!hasP && hasC) {
            const part = partition.chainage;
            cases.push({
              kind: "Poutre",
              poutreId,
              stack,
              slabIds: part.ids,
              mMur: mMurAuDessus,
              mDalles: part.mDalles,
              mPoutre,
              total: mPoutre + mMurAuDessus + part.mDalles,
              slabDetails: part.slabDetails,
              hasOverride,
              checkMode: "chainage",
              ov,
            });
          } else {
            // Deux interfaces -> deux vérifications (si deux niveaux de dalles interagissent)
            if (hasP) {
              const part = partition.poutre;
              cases.push({
                kind: "Poutre",
                poutreId,
                stack,
                slabIds: part.ids,
                mMur: mMurAuDessus,
                mDalles: part.mDalles,
                mPoutre,
                total: mPoutre + mMurAuDessus + part.mDalles,
                slabDetails: part.slabDetails,
                hasOverride,
                checkMode: "poutre",
                ov,
              });
            }
            if (hasC) {
              const part = partition.chainage;
              cases.push({
                kind: "Poutre",
                poutreId,
                stack,
                slabIds: part.ids,
                mMur: mMurAuDessus,
                mDalles: part.mDalles,
                mPoutre,
                total: mPoutre + mMurAuDessus + part.mDalles,
                slabDetails: part.slabDetails,
                hasOverride,
                checkMode: "chainage",
                ov,
              });
            }
          }
        }
      }
    }
  }

  return cases;
}

function renderMassResults() {
  if (!massesResultsDiv) return;
  const cases = buildMassCases();
  const { sdT, g } = getSdTandG();
  if (!cases.length) {
    massesResultsDiv.innerHTML =
      "<p style=\"font-size:0.75rem; color:#f97316;\">Aucun cas de calcul détecté (vérifie que des arases/dalles/stacks sont cochés).</p>";
    return;
  }

  // Préparer un statut global par mur :
  // - si au moins un cas est "Non" => mur instable
  // - sinon si au moins un cas est "Oui" => mur stable
  const stabilityAgg = {};
  // Préparer un statut global par poutre :
  // - si au moins un cas est "Non" => poutre instable
  // - sinon si au moins un cas est "Oui" => poutre stable
  const stabilityAggPoutre = {};
  cases.forEach((c) => {
    const Ftete = g ? (c.total * sdT) / g : 0;
    if (c.kind === "Mur") {
      const murEl = state.importedElements.find((e) => e.id === c.murId);
      const stab = computeAutoStability(murEl, c.murId, Ftete, { useRampant: c.useRampantChainage });
      if (!stab) return;
      const prev = stabilityAgg[c.murId];
      const now = stab.stable ? "stable" : "unstable";
      if (!prev) stabilityAgg[c.murId] = now;
      else if (prev === "stable" && now === "unstable") stabilityAgg[c.murId] = "unstable";
      return;
    }
    if (c.kind === "Poutre") {
      const poutreEl = state.importedElements.find((e) => e.id === c.poutreId);
      if (!poutreEl) return;
      let stab = null;
      if (c.hasOverride && c.checkMode === "chainage") {
        const typeStructKey = c.ov?.typeStructKey || "";
        const L = getBeamSpanLength(poutreEl);
        stab = computeAutoStabilityForLength(typeStructKey, L, Ftete);
      } else {
        const poutreId = c.poutreId;
        const Ast_cm2 = Number(state.poutresAttributes?.[poutreId]?.Ast || 0);
        const b = c.hasOverride ? Number(c.ov?.h_cm) / 100 : toNumberMaybe(poutreEl.height);
        const h = c.hasOverride ? Number(c.ov?.b_cm) / 100 : toNumberMaybe(poutreEl.width);
        const L = getBeamSpanLength(poutreEl);
        stab = computeBeamAutoStability(poutreEl, poutreId, Ftete, { b, h, Ast_cm2, L });
      }
      if (!stab) return;
      const prev = stabilityAggPoutre[c.poutreId];
      const now = stab.stable ? "stable" : "unstable";
      if (!prev) stabilityAggPoutre[c.poutreId] = now;
      else if (prev === "stable" && now === "unstable") stabilityAggPoutre[c.poutreId] = "unstable";
    }
  });
  state.massStabilityByMur = {};
  Object.entries(stabilityAgg).forEach(([id, st]) => {
    state.massStabilityByMur[id] = { stable: st === "stable" };
  });

  state.massStabilityByPoutre = {};
  Object.entries(stabilityAggPoutre).forEach(([id, st]) => {
    state.massStabilityByPoutre[id] = { stable: st === "stable" };
  });

  const dataRows = buildMassTableRows(cases, sdT, g);
  const rowsHtml = dataRows
    .map((r) => `<tr>
      <td>${r.type}</td>
      <td class="num">${escapeHtml(r.id)}</td>
      <td class="num">${r.arase ?? "—"}</td>
      <td class="num">${formatNum(r.hArase)}</td>
      <td class="num">${r.stack ?? "—"}</td>
      <td>${escapeHtml(r.dalles)}</td>
      <td class="num">${formatNum(r.hDalleTop)}</td>
      <td class="num">${formatNum(r.hCalcMur)}</td>
      <td>${escapeHtml(r.mat)}</td>
      <td class="num">${formatDaN(r.masseMur)}</td>
      <td class="num">${formatDaN(r.masseDalles)}</td>
      <td class="num">${formatDaN(r.massePoutre)}</td>
      <td class="num"><b>${formatDaN(r.total)}</b></td>
      <td class="num"><b>${formatDaN(r.effortTete)}</b></td>
      <td class="num">${r.pignonATriM2 != null ? formatNum(r.pignonATriM2) : "—"}</td>
      <td class="num">${r.pignonEffortPointe != null ? formatDaN(r.pignonEffortPointe) : "—"}</td>
      <td class="num"><b>${escapeHtml(r.verifieSur)}</b></td>
      <td class="num"><b>${escapeHtml(r.autoStab)}</b></td>
      <td class="num"><b>${escapeHtml(r.nbAncrage)}</b></td>
    </tr>`)
    .join("");

  massesResultsDiv.innerHTML = `
    <div style="overflow:auto; border:1px solid rgba(148,163,184,0.35); border-radius:0.6rem;">
      <table class="elements-table" style="min-width: 1120px;">
        <thead>
          <tr>
            <th>Type</th>
            <th class="num">ID</th>
            <th class="num">Arase</th>
            <th class="num">H arase [m]</th>
            <th class="num">Stack</th>
            <th>Dalles</th>
            <th class="num">H dalle (top) [m]</th>
            <th class="num">H calc mur [m]</th>
            <th>Mat / densité</th>
            <th class="num">Masse mur [daN/ml]</th>
            <th class="num">Masse dalles [daN/ml]</th>
            <th class="num">Masse poutre [daN/ml]</th>
            <th class="num">Total [daN/ml]</th>
            <th class="num">Effort en tête [daN/ml]</th>
            <th class="num">A<sub>tri</sub> pignon [m²]</th>
            <th class="num">Eff. pointe 65&nbsp;% [daN]</th>
            <th class="num">Vérifié sur</th>
            <th class="num">Auto-stabilité</th>
            <th class="num">Nb. ancrage</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    <p style="margin-top:0.5rem; font-size:0.72rem; color:#9ca3af;">
      Note: masses charpente = \(G + \\psi \\cdot Q\) (\\(\\psi\\) = facteur charges d’exploitation), demi-portée selon le sens porteur (X ou Y en plan).
    </p>
    <p style="margin-top:0.25rem; font-size:0.72rem; color:#9ca3af;">
      Effort en tête = Total × S_d(T) / g_r (avec S_d(T)=${sdT.toFixed(2)} m/s², g_r=${g.toFixed(2)} m/s²).
    </p>
  `;

  // Appliquer la surbrillance si on est déjà sur l'onglet masses
  applyMassStabilityHighlight();
  updateMassWallLabels();
  updateMassBeamLabels();
}

function saveMaterialsToStorage(map) {
  try {
    localStorage.setItem(MATERIALS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // stockage désactivé ou quota dépassé : on ignore
  }
}

function loadMaterialsLabelsFromStorage() {
  try {
    const raw = localStorage.getItem(MATERIALS_LABELS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) || {} : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function updateMaterialLabelsInSelectors(labelMap) {
  if (!labelMap || typeof labelMap !== "object") return;
  // Met à jour le texte des <option> dont value correspond à une clé matériau
  document.querySelectorAll("select option[value]").forEach((opt) => {
    const key = opt.value;
    if (!key) return;
    const lbl = labelMap[key];
    if (typeof lbl === "string" && lbl.length) {
      opt.textContent = lbl;
    }
  });
}

function initMaterialsLibrary() {
  const stored = loadMaterialsFromStorage();
  const inputs = document.querySelectorAll('input[data-material-key]');
  inputs.forEach((input) => {
    const key = input.dataset.materialKey;
    if (!key) return;
    const def = MATERIALS_DEFAULTS[key] ?? 0;
    const current = stored[key];
    const value = Number.isFinite(current) ? current : def;
    input.value = String(value);

    input.addEventListener("change", () => {
      const n = Number(input.value);
      if (Number.isFinite(n)) {
        stored[key] = n;
        saveMaterialsToStorage(stored);
      }
    });
  });

  // Libellés éditables
  const labelDefaults = {};
  document.querySelectorAll('input[data-material-label-key]').forEach((input) => {
    const key = input.dataset.materialLabelKey;
    if (!key) return;
    labelDefaults[key] = input.value;
  });

  let storedLabels = loadMaterialsLabelsFromStorage();

  const saveLabels = () => {
    try {
      localStorage.setItem(MATERIALS_LABELS_STORAGE_KEY, JSON.stringify(storedLabels));
    } catch {
      // ignore
    }
  };

  document.querySelectorAll('input[data-material-label-key]').forEach((input) => {
    const key = input.dataset.materialLabelKey;
    if (!key) return;
    const def = labelDefaults[key] ?? "";
    const current = storedLabels[key];
    input.value = typeof current === "string" && current.length ? current : def;
    input.addEventListener("change", () => {
      storedLabels[key] = input.value || def;
      saveLabels();
      updateMaterialLabelsInSelectors({ ...labelDefaults, ...storedLabels });
    });
  });

  // Mise à jour initiale des libellés dans les listes déroulantes ("Définir modèle", etc.)
  updateMaterialLabelsInSelectors({ ...labelDefaults, ...storedLabels });
}

initMaterialsLibrary();

// Regroupe dynamiquement les lignes de chaque bloc matériaux derrière un titre repliable
function initMaterialsCollapsibles() {
  const groups = document.querySelectorAll(".materials-group");
  groups.forEach((group) => {
    const title = group.querySelector("h3");
    if (!title) return;

    let body = group.querySelector(".materials-group-body");
    if (!body) {
      body = document.createElement("div");
      body.className = "materials-group-body";
      const nodesToMove = [];
      let node = title.nextSibling;
      while (node) {
        const next = node.nextSibling;
        nodesToMove.push(node);
        node = next;
      }
      nodesToMove.forEach((n) => body.appendChild(n));
      group.appendChild(body);
    }

    group.classList.add("collapsed");
    title.addEventListener("click", () => {
      group.classList.toggle("collapsed");
    });
  });
}

initMaterialsCollapsibles();

// --- INITIALISATION DE LA VUE 3D (IfcViewerAPI) -----------------------------

function initIfcViewer() {
  const viewer = new IfcViewerAPI({
    container: viewerContainer,
    backgroundColor: 0x020617,
  });

  // Chemin des fichiers WASM de web-ifc (compatible local + GitHub Pages)
  // GitHub les fournira via ce CDN, ce qui évite les soucis de chemin relatif.
  viewer.IFC.setWasmPath("https://cdn.jsdelivr.net/npm/web-ifc@0.0.47/");

  viewer.axes.setAxes();
  viewer.grid.setGrid();

   // Ramène le modèle proche de l'origine pour que la grille soit pertinente
   if (viewer.IFC.loader && viewer.IFC.loader.ifcManager) {
     viewer.IFC.loader.ifcManager.applyWebIfcConfig({
       COORDINATE_TO_ORIGIN: true,
       USE_FAST_BOOLS: true,
     });
   }

  state.viewer = viewer;
}

initIfcViewer();
// Maintenant que la vue 3D est créée, on peut masquer les panneaux d'analyse
// tant que l'onglet "Analyse" n'est pas actif.
setActiveMainTab("seismic");

// --- GESTION DU FICHIER IFC ------------------------------------------------

// Étape 1 : l’utilisateur choisit un fichier (mais on ne charge pas encore le modèle)
fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0] || null;
  state.selectedFile = file;

  if (!file) {
    updateTagEtEtat("IFC non chargé", "ko");
    if (viewerOverlay) {
      const span = viewerOverlay.querySelector("span");
      if (span) {
        span.textContent =
          "Sélectionne un fichier IFC puis clique sur « Charger le modèle ».";
      }
      viewerOverlay.style.display = "";
    }
    return;
  }

  updateTagEtEtat(`Fichier sélectionné : ${file.name}`, "loading");
  if (viewerOverlay) {
    const span = viewerOverlay.querySelector("span");
    if (span) {
      span.textContent =
        "Fichier sélectionné. Clique sur « Charger le modèle » pour l’afficher.";
    }
    viewerOverlay.style.display = "";
  }
});

// Charge un fichier IFC et extrait les éléments. Retourne true si OK.
// Réutilisé par le bouton "Charger le modèle" ET par l'import d'étude.
async function performIfcLoad(file) {
  if (!file) {
    alert("Aucun fichier IFC sélectionné. Choisis un fichier avant de charger.");
    return false;
  }

  updateTagEtEtat("Chargement IFC…", "loading");
  if (viewerOverlay) {
    const sp = viewerOverlay.querySelector("span");
    if (sp) sp.textContent = "Chargement du fichier IFC…";
  }

  try {
    if (!state.viewer) {
      initIfcViewer();
    }

    if (state.ifcModelID !== null) {
      await state.viewer.IFC.loader.ifcManager.close(state.ifcModelID);
      state.ifcModelID = null;
    }

    const url = URL.createObjectURL(file);
    const model = await state.viewer.IFC.loadIfcUrl(url, true);

    state.ifcLoaded = true;
    state.ifcModelID = model.modelID;

    state.loadedModel = model ?? null;
    state.modelOffsetY = 0;
    if (model && model.geometry) {
      model.geometry.computeBoundingBox();
      const box = model.geometry.boundingBox;
      if (box) {
        const deltaY = -box.min.y;
        model.position.y += deltaY;
        state.modelOffsetY = deltaY;
      }
    }

    state.niveaux = [{ id: 1, z: 0.0, masseApprox: 200 }];
    state.mursPorteurs = [
      { id: 1, nom: "Mur longitudinal 1", longueur: 8.0, niveau: 1, directionPortance: "x" },
      { id: 2, nom: "Mur longitudinal 2", longueur: 8.0, niveau: 1, directionPortance: "x" },
      { id: 3, nom: "Mur pignon", longueur: 6.0, niveau: 1, directionPortance: "y" },
    ];

    updateTagEtEtat(`IFC chargé : ${file.name}`, "ok");
    if (viewerOverlay) {
      const sp = viewerOverlay.querySelector("span");
      if (sp) sp.textContent = "Modèle affiché.";
      viewerOverlay.style.display = "none";
    }

    if (btnCalcul) btnCalcul.disabled = false;
    await extractAndDisplayElements();
    renderResumeInitial();
    return true;
  } catch (e) {
    console.error(e);
    alert("Erreur lors du chargement de l'IFC. Consulte la console du navigateur pour le détail.");
    updateTagEtEtat("Erreur de chargement IFC", "ko");
    if (viewerOverlay) {
      const sp = viewerOverlay.querySelector("span");
      if (sp) sp.textContent = "Échec du chargement.";
    }
    return false;
  }
}

// Étape 2 : clic sur le bouton pour réellement charger et afficher le modèle
btnLoadIfc.addEventListener("click", async () => {
  await performIfcLoad(state.selectedFile);
});

// =============================================================================
// SAUVEGARDE / CHARGEMENT D'UNE ÉTUDE COMPLÈTE
// =============================================================================
// Format du fichier .json exporté :
// {
//   format: "effort-en-tete-mur-study",
//   version: "Vx.x.x",
//   exportedAt: "ISO8601",
//   ifc: { name, base64 },
//   seismic: { ag, q, gammaI, psiExploit, coeffSol, psiAlt, sdT, gravite,
//              zoneSismique, categorieBatiment, classeSol, coeffComportement,
//              categorieCharges, altimetrie },
//   state: { charpenteAttributes, mursAttributes, poutresAttributes,
//            associationMask, associationCounters, wallAraseConfig,
//            poutreStackConfig, selectedWallSegments },
//   materials: { values, labels }   // copies des entrées localStorage
// }

const STUDY_FORMAT_ID = "effort-en-tete-mur-study";

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8Array(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsText(file);
  });
}

function getSeismicValues() {
  const readVal = (el) => (el ? el.value : "");
  return {
    ag: readVal(agInput),
    q: readVal(qInput),
    gammaI: readVal(gammaIInput),
    psiExploit: readVal(psiExploitInput),
    coeffSol: readVal(coeffSolInput),
    psiAlt: readVal(psiAltInput),
    sdT: readVal(sdTInput),
    gravite: readVal(graviteInput),
    zoneSismique: readVal(zoneSismiqueSelect),
    categorieBatiment: readVal(categorieBatimentSelect),
    classeSol: readVal(classeSolSelect),
    coeffComportement: readVal(coeffComportementSelect),
    categorieCharges: readVal(categorieChargesSelect),
    altimetrie: readVal(altimetrieSelect),
  };
}

function applySeismicValues(values) {
  if (!values || typeof values !== "object") return;
  const setVal = (el, v) => {
    if (!el || v == null) return;
    el.value = String(v);
    // Déclenche les change handlers (pour mettre à jour des dépendances éventuelles)
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  // On applique d'abord les sélecteurs (qui peuvent recalculer ag, etc.),
  // puis on écrase avec les valeurs numériques explicites.
  setVal(zoneSismiqueSelect, values.zoneSismique);
  setVal(categorieBatimentSelect, values.categorieBatiment);
  setVal(classeSolSelect, values.classeSol);
  setVal(coeffComportementSelect, values.coeffComportement);
  setVal(categorieChargesSelect, values.categorieCharges);
  setVal(altimetrieSelect, values.altimetrie);
  setVal(agInput, values.ag);
  setVal(qInput, values.q);
  setVal(gammaIInput, values.gammaI);
  setVal(psiExploitInput, values.psiExploit);
  setVal(coeffSolInput, values.coeffSol);
  setVal(psiAltInput, values.psiAlt);
  setVal(sdTInput, values.sdT);
  setVal(graviteInput, values.gravite);
}

function getMaterialsSnapshot() {
  let values = {};
  let labels = {};
  try {
    const raw = localStorage.getItem(MATERIALS_STORAGE_KEY);
    if (raw) values = JSON.parse(raw) || {};
  } catch { values = {}; }
  try {
    const raw = localStorage.getItem(MATERIALS_LABELS_STORAGE_KEY);
    if (raw) labels = JSON.parse(raw) || {};
  } catch { labels = {}; }
  return { values, labels };
}

function applyMaterialsSnapshot(mats) {
  if (!mats || typeof mats !== "object") return;
  try {
    if (mats.values && typeof mats.values === "object") {
      localStorage.setItem(MATERIALS_STORAGE_KEY, JSON.stringify(mats.values));
    }
    if (mats.labels && typeof mats.labels === "object") {
      localStorage.setItem(MATERIALS_LABELS_STORAGE_KEY, JSON.stringify(mats.labels));
    }
  } catch {
    // ignore
  }
  // Met à jour les champs d'édition + les libellés dans les listes déroulantes.
  try { initMaterialsLibrary(); } catch {}
}

async function buildStudyExportData() {
  if (!state.selectedFile) {
    throw new Error("Aucun fichier IFC chargé : sélectionne et charge un IFC avant d'exporter.");
  }
  const ifcBuf = await readFileAsArrayBuffer(state.selectedFile);
  const ifcBase64 = arrayBufferToBase64(ifcBuf);

  // Sérialisation : on ne sauvegarde QUE les structures contenant des choix utilisateur.
  // Les éléments importés / résultats de calcul sont reconstruits au chargement.
  const cleanState = {
    charpenteAttributes: state.charpenteAttributes || {},
    mursAttributes: state.mursAttributes || {},
    poutresAttributes: state.poutresAttributes || {},
    associationMask: state.associationMask || { murs: {}, poutres: {} },
    associationCounters: state.associationCounters || { murs: {}, poutres: {} },
    wallAraseConfig: state.wallAraseConfig || { murs: {} },
    poutreStackConfig: state.poutreStackConfig || {},
    selectedWallSegments: state.selectedWallSegments || {},
    effortsTopViewLabelPositions: state.effortsTopViewLabelPositions || {},
  };

  return {
    format: STUDY_FORMAT_ID,
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    ifc: {
      name: state.selectedFile.name || "model.ifc",
      base64: ifcBase64,
    },
    seismic: getSeismicValues(),
    state: cleanState,
    materials: getMaterialsSnapshot(),
  };
}

btnExportStudy?.addEventListener("click", async () => {
  try {
    const data = await buildStudyExportData();
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: "application/json" });
    const baseName = (state.selectedFile?.name || "etude").replace(/\.ifc$/i, "");
    downloadBlob(`${baseName}_etude_${APP_VERSION}.json`, blob);
  } catch (e) {
    console.error(e);
    alert(e?.message || "Échec de la sauvegarde de l'étude.");
  }
});

/**
 * Applique un objet étude (déjà parsé) : restaure matériaux, sismique,
 * charge l'IFC, puis restaure les configurations / associations / attributs.
 */
async function applyStudyData(study) {
  if (!study || study.format !== STUDY_FORMAT_ID) {
    throw new Error("Fichier d'étude invalide ou non reconnu.");
  }

  // 1) Matériaux (localStorage) — avant tout, pour que la lib soit prête.
  applyMaterialsSnapshot(study.materials);

  // 2) Paramètres sismiques.
  applySeismicValues(study.seismic);

  // 3) IFC : on reconstruit un File à partir du base64 et on lance le chargement.
  if (!study.ifc || !study.ifc.base64) {
    throw new Error("Fichier d'étude incomplet : IFC manquant.");
  }
  const ifcBytes = base64ToUint8Array(study.ifc.base64);
  const ifcBlob = new Blob([ifcBytes], { type: "application/octet-stream" });
  const ifcName = study.ifc.name || "model.ifc";
  const ifcFile = new File([ifcBlob], ifcName, { type: "application/octet-stream" });
  state.selectedFile = ifcFile;

  // Reflète la sélection dans le file input pour cohérence visuelle si supporté
  try {
    if (fileInput) {
      const dt = new DataTransfer();
      dt.items.add(ifcFile);
      fileInput.files = dt.files;
    }
  } catch { /* navigateur ne supporte pas DataTransfer.items.add → on ignore */ }

  updateTagEtEtat(`Chargement de l'étude (${ifcName})…`, "loading");

  const ok = await performIfcLoad(ifcFile);
  if (!ok) {
    throw new Error("Échec du chargement du modèle IFC contenu dans l'étude.");
  }

  // 4) Une fois l'IFC chargé ET les éléments extraits, on restaure les
  //    structures qui utilisent les expressID comme clés.
  const s = study.state || {};
  state.charpenteAttributes = s.charpenteAttributes && typeof s.charpenteAttributes === "object" ? s.charpenteAttributes : {};
  state.mursAttributes = s.mursAttributes && typeof s.mursAttributes === "object" ? s.mursAttributes : {};
  state.poutresAttributes = s.poutresAttributes && typeof s.poutresAttributes === "object" ? s.poutresAttributes : {};
  state.associationMask = s.associationMask && typeof s.associationMask === "object"
    ? { murs: s.associationMask.murs || {}, poutres: s.associationMask.poutres || {} }
    : { murs: {}, poutres: {} };
  state.associationCounters = s.associationCounters && typeof s.associationCounters === "object"
    ? { murs: s.associationCounters.murs || {}, poutres: s.associationCounters.poutres || {} }
    : { murs: {}, poutres: {} };
  state.wallAraseConfig = s.wallAraseConfig && typeof s.wallAraseConfig === "object"
    ? { murs: s.wallAraseConfig.murs || {} }
    : { murs: {} };
  state.poutreStackConfig = s.poutreStackConfig && typeof s.poutreStackConfig === "object" ? s.poutreStackConfig : {};
  state.selectedWallSegments = s.selectedWallSegments && typeof s.selectedWallSegments === "object" ? s.selectedWallSegments : {};
  state.effortsTopViewLabelPositions = s.effortsTopViewLabelPositions && typeof s.effortsTopViewLabelPositions === "object" ? s.effortsTopViewLabelPositions : {};

  // 5) Rafraîchissements UI : recalculer les voisinages, ré-afficher les
  //    tableaux et panneaux d'attributs avec les nouvelles valeurs.
  try { renderElementsTables(); } catch (e) { console.warn("renderElementsTables", e); }
  try { updateAllAttributePanels?.(); } catch (e) { console.warn("updateAllAttributePanels", e); }
  try { updateSlabLabels?.(); } catch (e) { console.warn("updateSlabLabels", e); }
  try { updateMassWallLabels?.(); } catch (e) { console.warn("updateMassWallLabels", e); }
  try { updateMassBeamLabels?.(); } catch (e) { console.warn("updateMassBeamLabels", e); }

  updateTagEtEtat(`Étude chargée : ${ifcName}`, "ok");

  alert(
    "Étude chargée avec succès.\n\n" +
    "Pense à ouvrir l'onglet « Résultats masses » et cliquer sur « Calculer les masses » pour recalculer les efforts " +
    "(les associations et configurations ont été restaurées telles que sauvegardées)."
  );
}

btnImportStudy?.addEventListener("click", () => {
  studyImportInput?.click();
});

studyImportInput?.addEventListener("change", async (event) => {
  const file = event.target?.files?.[0];
  if (!file) return;
  try {
    const text = await readFileAsText(file);
    const study = JSON.parse(text);
    await applyStudyData(study);
  } catch (e) {
    console.error(e);
    alert(`Échec du chargement de l'étude : ${e?.message || e}`);
  } finally {
    // Vide le file input pour permettre de recharger le même fichier successivement
    if (studyImportInput) studyImportInput.value = "";
  }
});

function updateTagEtEtat(texte, etat) {
  const dot = tagEtat.querySelector(".tag-dot");
  const spanTexte = document.getElementById("tag-label");

  if (spanTexte) {
    spanTexte.textContent = texte;
  }

  if (etat === "ok") {
    dot.style.background =
      "radial-gradient(circle at 30% 20%, #22c55e, #16a34a)";
    dot.style.boxShadow = "0 0 10px rgba(34,197,94,0.9)";
  } else if (etat === "loading") {
    dot.style.background =
      "radial-gradient(circle at 30% 20%, #facc15, #eab308)";
    dot.style.boxShadow = "0 0 10px rgba(250,204,21,0.9)";
  } else {
    dot.style.background =
      "radial-gradient(circle at 30% 20%, #ef4444, #b91c1c)";
    dot.style.boxShadow = "0 0 10px rgba(239,68,68,0.9)";
  }
}

// --- EXTRACTION ET AFFICHAGE DES ÉLÉMENTS IFC --------------------------------

function unwrapIfcValue(v) {
  if (v == null) return v;
  if (typeof v !== "object") return v;
  if ("value" in v) return unwrapIfcValue(v.value);
  if ("Value" in v) return unwrapIfcValue(v.Value);
  if ("NominalValue" in v) return unwrapIfcValue(v.NominalValue);
  return v;
}

function toNumberMaybe(v) {
  const u = unwrapIfcValue(v);
  if (typeof u === "number" && isFinite(u)) return u;
  if (typeof u === "string") {
    const n = Number(u);
    if (!Number.isNaN(n) && isFinite(n)) return n;
  }
  return null;
}

function getViewerScene() {
  return state.viewer?.context?.getScene?.() ?? state.viewer?.context?.scene ?? null;
}

function getViewerCamera() {
  if (!state.viewer || !state.viewer.context) return null;
  const ctx = state.viewer.context;
  if (typeof ctx.getCamera === "function") return ctx.getCamera();
  return ctx.camera ?? null;
}

function resizeViewerAndLabels() {
  if (!state.viewer || !viewerContainer) return;
  const doResize = () => {
    try {
      const w = viewerContainer.clientWidth || viewerContainer.offsetWidth || 400;
      const h = viewerContainer.clientHeight || viewerContainer.offsetHeight || 400;

      const ctx = state.viewer.context || {};
      const renderer =
        typeof ctx.getRenderer === "function" ? ctx.getRenderer() : ctx.renderer;
      const camera = getViewerCamera();

      if (renderer && typeof renderer.setSize === "function") {
        // true = met aussi à jour la taille CSS du canvas, pour qu'elle colle au conteneur
        renderer.setSize(w, h, true);
      }

      if (camera && typeof camera.aspect === "number") {
        camera.aspect = w / h;
        if (typeof camera.updateProjectionMatrix === "function") {
          camera.updateProjectionMatrix();
        }
      }

      if (slabLabelRenderer) {
        slabLabelRenderer.setSize(w, h);
      }
    } catch (_) {
      // best effort uniquement
    }
  };
  requestAnimationFrame(doResize);
}

function removeObjectByNameFromScene(name) {
  const scene = getViewerScene();
  if (!scene || !name) return;
  const obj = scene.getObjectByName?.(name);
  if (obj && obj.parent) {
    obj.parent.remove(obj);
  }
}

function safeRemoveSubset(ifcManager, modelID, customID) {
  try {
    // (modelID, customID)
    ifcManager.removeSubset(modelID, customID);
    return;
  } catch (_) {}
  try {
    // (modelID, customID, scene)
    const scene = getViewerScene();
    ifcManager.removeSubset(modelID, customID, scene);
  } catch (_) {}
}

function computeIndexedLocalBox3(geometry) {
  const pos = geometry?.attributes?.position;
  const index = geometry?.index;
  if (!pos) return null;

  const arr = pos.array;
  const getXYZ = (vi) => {
    const i3 = vi * 3;
    return [arr[i3], arr[i3 + 1], arr[i3 + 2]];
  };

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  if (index?.array && index.array.length) {
    const idx = index.array;
    for (let i = 0; i < idx.length; i++) {
      const vi = idx[i];
      const [x, y, z] = getXYZ(vi);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
  } else {
    // Fallback: bbox sur toutes les positions (moins précis pour les subsets)
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i], y = arr[i + 1], z = arr[i + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
  }

  if (!isFinite(minX) || !isFinite(maxX)) return null;
  return new THREE.Box3(
    new THREE.Vector3(minX, minY, minZ),
    new THREE.Vector3(maxX, maxY, maxZ)
  );
}

const HEIGHT_SEGMENT_TOLERANCE = 0.02; // m — fusion des niveaux proches
const HEIGHT_SEGMENT_MIN = 0.05;       // m — hauteur min d'un segment retenu

const WALL_SLOPE_BINS = 18;            // nb de bandes pour profiler l'arase (par axe)
const WALL_SLOPE_MIN_DH = 0.20;        // m — seuil "réel" de variation d'arase (>= 20cm)

/**
 * À partir de la géométrie d'un mesh et de sa matrice monde, extrait les niveaux Y (verticaux)
 * et retourne :
 *  - les segments de hauteur (entre niveaux successifs),
 *  - les hauteurs cumulées d'arase (somme des segments depuis la base).
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Matrix4} matrixWorld
 * @returns {{
 *   totalHeight: number,
 *   heights: number[],
 *   segments: Array<{ minY: number, maxY: number, height: number }>,
 *   baseY: number,
 *   levels: number[],
 *   araseHeights: number[]
 * }}
 */
function computeHeightSegmentsFromGeometry(geometry, matrixWorld) {
  const pos = geometry?.attributes?.position;
  const index = geometry?.index;
  if (!pos || !matrixWorld) return null;

  const arr = pos.array;
  const v = new THREE.Vector3();
  const ys = new Set();

  const pushY = (vi) => {
    const i3 = vi * 3;
    v.set(arr[i3], arr[i3 + 1], arr[i3 + 2]);
    v.applyMatrix4(matrixWorld);
    ys.add(v.y);
  };

  if (index?.array && index.array.length) {
    const idx = index.array;
    for (let i = 0; i < idx.length; i++) pushY(idx[i]);
  } else {
    for (let i = 0; i < arr.length / 3; i++) pushY(i);
  }

  if (ys.size === 0) return null;
  let sorted = Array.from(ys).sort((a, b) => a - b);
  // Fusion des Y trop proches (tolérance)
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - merged[merged.length - 1] > HEIGHT_SEGMENT_TOLERANCE) {
      merged.push(sorted[i]);
    }
  }
  if (merged.length < 2) return null;

  const baseY = merged[0];
  const segments = [];
  for (let i = 0; i < merged.length - 1; i++) {
    const minY = merged[i];
    const maxY = merged[i + 1];
    const height = maxY - minY;
    if (height >= HEIGHT_SEGMENT_MIN) {
      segments.push({ minY, maxY, height });
    }
  }
  const totalHeight = merged[merged.length - 1] - merged[0];
  const heights = segments.map((s) => s.height);

  // Hauteurs cumulées d'arase depuis la base (somme des segments successifs)
  const araseHeights = [];
  let acc = 0;
  for (let i = 0; i < heights.length; i++) {
    acc += heights[i];
    araseHeights.push(acc);
  }

  return {
    totalHeight,
    heights,
    segments,
    baseY,
    levels: merged,
    araseHeights,
  };
}

/**
 * Profile "hauteur d'arase" le long des axes X et Z à partir de la géométrie.
 * On calcule, par bandes (bins), le Y max rencontré.
 *
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Matrix4} matrixWorld
 * @param {number} [bins]
 * @returns {{
 *   maxYByXBin: number[],
 *   maxYByZBin: number[],
 *   deltaX: number,
 *   deltaZ: number
 * } | null}
 */
/**
 * Analyse géométrique des faces du mur pour distinguer un VRAI rampant
 * (face supérieure inclinée DANS LE SENS DE LA LONGUEUR du mur) d'un mur
 * à arases multiples (faces supérieures horizontales à des niveaux différents)
 * ou d'un mur dont la face supérieure n'est qu'un chanfrein perpendiculaire
 * à son axe (cas d'un mur "rive" sous long-pan : la pente du toit traverse
 * juste la faible épaisseur du mur).
 *
 * Pour chaque triangle de la géométrie :
 *  - on calcule la normale dans le repère MONDE ;
 *  - si ny > 0.92 → face quasi-horizontale (dessus plat) ;
 *  - si 0.18 < ny ≤ 0.92 → face supérieure inclinée. On projette alors la
 *    composante horizontale de la normale (nx, nz) et on classe l'aire :
 *      • inclinedAlongXArea : pente dont le sens descendant est plutôt selon
 *        l'axe monde X ;
 *      • inclinedAlongZArea : pente dont le sens descendant est plutôt selon
 *        l'axe monde Z.
 *
 * Le `classifyWallRoofFromProfiles` combinera ensuite ces aires avec l'axe
 * dominant du mur pour ne retenir comme Rampant/Pignon que les pentes
 * effectivement orientées dans la longueur du mur.
 */
function computeWallTopFaceInfo(geometry, matrixWorld) {
  const pos = geometry?.attributes?.position;
  const index = geometry?.index;
  if (!pos || !matrixWorld) return null;
  const arr = pos.array;
  if (!index?.array || !index.array.length) return null;
  const idx = index.array;

  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();

  let inclinedTopArea = 0;
  let inclinedAlongXArea = 0;
  let inclinedAlongZArea = 0;
  let flatTopArea = 0;
  let totalArea = 0;
  let maxInclineAngleDeg = 0;

  for (let i = 0; i + 2 < idx.length; i += 3) {
    const ia = idx[i] * 3;
    const ib = idx[i + 1] * 3;
    const ic = idx[i + 2] * 3;
    va.set(arr[ia], arr[ia + 1], arr[ia + 2]).applyMatrix4(matrixWorld);
    vb.set(arr[ib], arr[ib + 1], arr[ib + 2]).applyMatrix4(matrixWorld);
    vc.set(arr[ic], arr[ic + 1], arr[ic + 2]).applyMatrix4(matrixWorld);
    ab.subVectors(vb, va);
    ac.subVectors(vc, va);
    n.crossVectors(ab, ac);
    const len = n.length();
    if (len < 1e-9) continue;
    const area = len * 0.5;
    if (!Number.isFinite(area) || area <= 0) continue;
    n.divideScalar(len);
    totalArea += area;
    const ny = n.y;
    // Seuil "plat" : ny > 0.985 ≈ pente < 10° (tolérance numérique uniquement).
    // Les toitures de 12° à 30° (typiques) doivent être considérées "inclinées".
    if (ny > 0.985) {
      flatTopArea += area;
    } else if (ny > 0.18) {
      // Face supérieure réellement inclinée
      inclinedTopArea += area;
      const angleDeg = Math.acos(Math.min(1, Math.max(-1, ny))) * 180 / Math.PI;
      if (angleDeg > maxInclineAngleDeg) maxInclineAngleDeg = angleDeg;
      // Décomposition de la direction de pente (sens descendant projeté à l'horizontale)
      const nxAbs = Math.abs(n.x);
      const nzAbs = Math.abs(n.z);
      const horizMag = Math.sqrt(nxAbs * nxAbs + nzAbs * nzAbs);
      if (horizMag > 1e-6) {
        if (nxAbs >= nzAbs) inclinedAlongXArea += area;
        else inclinedAlongZArea += area;
      }
    }
  }

  if (totalArea <= 0) return null;
  return {
    inclinedTopArea,
    inclinedAlongXArea,
    inclinedAlongZArea,
    flatTopArea,
    totalArea,
    inclinedRatio: inclinedTopArea / totalArea,
    flatTopRatio: flatTopArea / totalArea,
    maxInclineAngleDeg,
  };
}

function computeWallTopProfilesFromGeometry(geometry, matrixWorld, bins = WALL_SLOPE_BINS) {
  const pos = geometry?.attributes?.position;
  const index = geometry?.index;
  if (!pos || !matrixWorld) return null;
  const b = Math.max(6, Math.min(48, Math.floor(bins)));
  const arr = pos.array;
  const v = new THREE.Vector3();

  // bbox monde (sur indices si possible)
  let minX = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxZ = -Infinity;
  const consumeXZ = (vi) => {
    const i3 = vi * 3;
    v.set(arr[i3], arr[i3 + 1], arr[i3 + 2]).applyMatrix4(matrixWorld);
    if (v.x < minX) minX = v.x;
    if (v.z < minZ) minZ = v.z;
    if (v.x > maxX) maxX = v.x;
    if (v.z > maxZ) maxZ = v.z;
  };
  if (index?.array && index.array.length) {
    const idx = index.array;
    for (let i = 0; i < idx.length; i++) consumeXZ(idx[i]);
  } else {
    for (let i = 0; i < arr.length / 3; i++) consumeXZ(i);
  }
  if (!isFinite(minX) || !isFinite(maxX) || maxX === minX || maxZ === minZ) return null;

  const maxYByXBin = Array.from({ length: b }, () => -Infinity);
  const maxYByZBin = Array.from({ length: b }, () => -Infinity);

  const push = (vi) => {
    const i3 = vi * 3;
    v.set(arr[i3], arr[i3 + 1], arr[i3 + 2]).applyMatrix4(matrixWorld);
    const tx = (v.x - minX) / (maxX - minX);
    const tz = (v.z - minZ) / (maxZ - minZ);
    const ix = Math.min(b - 1, Math.max(0, Math.floor(tx * b)));
    const iz = Math.min(b - 1, Math.max(0, Math.floor(tz * b)));
    if (v.y > maxYByXBin[ix]) maxYByXBin[ix] = v.y;
    if (v.y > maxYByZBin[iz]) maxYByZBin[iz] = v.y;
  };

  if (index?.array && index.array.length) {
    const idx = index.array;
    for (let i = 0; i < idx.length; i++) push(idx[i]);
  } else {
    for (let i = 0; i < arr.length / 3; i++) push(i);
  }

  const finiteX = maxYByXBin.filter((n) => Number.isFinite(n));
  const finiteZ = maxYByZBin.filter((n) => Number.isFinite(n));
  if (finiteX.length < 2 || finiteZ.length < 2) return null;
  const deltaX = Math.max(...finiteX) - Math.min(...finiteX);
  const deltaZ = Math.max(...finiteZ) - Math.min(...finiteZ);
  return { maxYByXBin, maxYByZBin, deltaX, deltaZ };
}

function isMostlyMonotone(values, tol = 0.03) {
  const v = (values || []).filter((n) => Number.isFinite(n));
  if (v.length < 4) return true;
  let incViol = 0;
  for (let i = 1; i < v.length; i++) {
    if (v[i] + tol < v[i - 1]) incViol++;
  }
  let decViol = 0;
  for (let i = 1; i < v.length; i++) {
    if (v[i] > v[i - 1] + tol) decViol++;
  }
  const maxAllowed = Math.max(1, Math.floor(v.length * 0.15));
  return incViol <= maxAllowed || decViol <= maxAllowed;
}

function fillMissingBins(values) {
  const v = Array.isArray(values) ? values.slice() : [];
  if (!v.length) return v;
  // Repère des indices finis
  const finiteIdx = [];
  for (let i = 0; i < v.length; i++) if (Number.isFinite(v[i])) finiteIdx.push(i);
  if (finiteIdx.length === 0) return v;
  // Remplir en avant/arrière avec le plus proche voisin fini
  for (let i = 0; i < v.length; i++) {
    if (Number.isFinite(v[i])) continue;
    // cherche à gauche
    let L = i - 1;
    while (L >= 0 && !Number.isFinite(v[L])) L--;
    // cherche à droite
    let R = i + 1;
    while (R < v.length && !Number.isFinite(v[R])) R++;
    if (L >= 0 && Number.isFinite(v[L]) && R < v.length && Number.isFinite(v[R])) {
      // interpolation linéaire
      const t = (i - L) / (R - L);
      v[i] = v[L] * (1 - t) + v[R] * t;
    } else if (L >= 0 && Number.isFinite(v[L])) {
      v[i] = v[L];
    } else if (R < v.length && Number.isFinite(v[R])) {
      v[i] = v[R];
    }
  }
  return v;
}

function isPeakInMiddle(values, tol = 0.03) {
  const vv = fillMissingBins(values);
  const v = (vv || []).filter((n) => Number.isFinite(n));
  if (v.length < 6) return false;
  let maxVal = -Infinity;
  for (let i = 0; i < v.length; i++) if (v[i] > maxVal) maxVal = v[i];
  // plateau: plusieurs indices au max
  const maxIdxs = [];
  for (let i = 0; i < v.length; i++) if (Math.abs(v[i] - maxVal) <= tol) maxIdxs.push(i);
  const maxIdx = maxIdxs.length ? maxIdxs[Math.floor(maxIdxs.length / 2)] : -1;
  if (maxIdx <= 1 || maxIdx >= v.length - 2) return false; // pic/plateau en bout => pas pignon
  const leftMin = Math.min(...v.slice(0, maxIdx));
  const rightMin = Math.min(...v.slice(maxIdx + 1));
  if (maxVal - leftMin < WALL_SLOPE_MIN_DH / 2) return false;
  if (maxVal - rightMin < WALL_SLOPE_MIN_DH / 2) return false;
  const left = v.slice(0, maxIdx + 1);
  const right = v.slice(maxIdx);
  const leftOk = isMostlyMonotone(left, tol);
  const rightOk = isMostlyMonotone(right.slice().reverse(), tol);
  return leftOk && rightOk;
}

function classifyWallRoofFromProfiles(el) {
  const prof = el?.wallTopProfile;
  if (!prof || !Number.isFinite(prof.deltaX) || !Number.isFinite(prof.deltaZ)) {
    return { kind: "Mur", araseCount: null, araseHeight: null };
  }
  const wallAxis = getDominantPlanAxis(el);
  if (!wallAxis) return { kind: "Mur", araseCount: null, araseHeight: null };
  const along = wallAxis;
  const deltaAlong = along === "X" ? prof.deltaX : prof.deltaZ;

  const araseHeight =
    Array.isArray(el?.araseHeights) && el.araseHeights.length
      ? toNumberMaybe(el.araseHeights[el.araseHeights.length - 1])
      : toNumberMaybe(el?.height);

  // ────────────────────────────────────────────────────────────────────────
  // CRITÈRE GÉOMÉTRIQUE PRIMAIRE : présence de faces inclinées dans la
  // direction de la LONGUEUR du mur.
  //   - Un VRAI rampant/pignon a sa pente le long de l'axe du mur.
  //   - Un mur "rive" sous long-pan peut avoir un petit chanfrein de toiture
  //     perpendiculaire à son axe (chanfrein dans l'épaisseur) : on ne doit
  //     PAS le classer rampant.
  //   - Un mur à plusieurs arases en gradin n'a aucune face supérieure
  //     inclinée significative : il reste Rive.
  // ────────────────────────────────────────────────────────────────────────
  const faceInfo = el?.wallTopFaceInfo;
  if (faceInfo) {
    const alongAxisInclinedArea = along === "X" ? faceInfo.inclinedAlongXArea : faceInfo.inclinedAlongZArea;
    const perpAxisInclinedArea  = along === "X" ? faceInfo.inclinedAlongZArea : faceInfo.inclinedAlongXArea;
    // Seuils : au moins 0.50 m² de pente effective DANS LE SENS DE LA LONGUEUR
    // et cette pente doit dominer (≥ 2×) une éventuelle pente perpendiculaire
    // (chanfrein de toiture).
    const hasRealLongitudinalSlope = alongAxisInclinedArea >= 0.50
      && alongAxisInclinedArea >= perpAxisInclinedArea * 2;
    if (!hasRealLongitudinalSlope) {
      const araseCount = Array.isArray(el?.araseHeights) ? el.araseHeights.length : 1;
      return { kind: "Rive", araseCount, araseHeight };
    }
    // Pente significative le long du mur → Rampant ou Pignon
    const profileRaw = along === "X" ? prof.maxYByXBin : prof.maxYByZBin;
    const profile = fillMissingBins(profileRaw);
    const kind = isPeakInMiddle(profile) ? "Pignon" : "Rampant";
    return { kind, araseCount: 2, araseHeight };
  }

  // ────────────────────────────────────────────────────────────────────────
  // FALLBACK : ancienne logique basée uniquement sur les profils d'altitude
  // (utile si l'analyse géométrique n'est pas disponible).
  // ────────────────────────────────────────────────────────────────────────
  const hasRealSlopeAlong = Number.isFinite(deltaAlong) && deltaAlong > WALL_SLOPE_MIN_DH;
  if (!hasRealSlopeAlong) {
    return { kind: "Rive", araseCount: 1, araseHeight };
  }
  const profileRaw = along === "X" ? prof.maxYByXBin : prof.maxYByZBin;
  const profile = fillMissingBins(profileRaw);
  const kind = isPeakInMiddle(profile) ? "Pignon" : "Rampant";
  return { kind, araseCount: 2, araseHeight };
}

/** Cote monde Y max du faîtage (profil haut du mur, axe du mur). */
function getWallPignonPointeWorldY(murEl) {
  const prof = murEl?.wallTopProfile;
  if (!prof) return null;
  const axis = getDominantPlanAxis(murEl);
  if (!axis) return null;
  const raw = axis === "X" ? prof.maxYByXBin : prof.maxYByZBin;
  const arr = fillMissingBins(raw || []).filter((n) => Number.isFinite(n));
  if (!arr.length) return null;
  return Math.max(...arr);
}

/** Cote monde Y min du bas de pente (profil haut du mur le long de l’axe du mur). */
function getWallPignonBasWorldY(murEl) {
  const prof = murEl?.wallTopProfile;
  if (!prof) return null;
  const axis = getDominantPlanAxis(murEl);
  if (!axis) return null;
  const raw = axis === "X" ? prof.maxYByXBin : prof.maxYByZBin;
  const arr = fillMissingBins(raw || []).filter((n) => Number.isFinite(n));
  if (!arr.length) return null;
  return Math.min(...arr);
}

/** Convertit un objet Coordinates IFC en { x, y, z } (plusieurs formats possibles) */
function parseCoordinates(coords) {
  if (coords == null) return { x: null, y: null, z: null };
  if (typeof coords.x === "number" && typeof coords.y === "number" && typeof coords.z === "number") {
    return { x: coords.x, y: coords.y, z: coords.z };
  }
  const arr = coords.value ?? coords.Coordinates ?? (Array.isArray(coords) ? coords : null);
  if (Array.isArray(arr) && arr.length >= 3) {
    return { x: toNumberMaybe(arr[0]), y: toNumberMaybe(arr[1]), z: toNumberMaybe(arr[2]) };
  }
  return { x: null, y: null, z: null };
}

/** Extrait les coordonnées X,Y,Z d'un placement IFC (objet ou expressID à résoudre) */
async function getPlacementCoordinates(ifcManager, modelID, placement) {
  if (placement == null) return { x: null, y: null, z: null };
  let pl = placement;
  if (typeof placement === "number" && ifcManager.getItemProperties) {
    try {
      pl = await ifcManager.getItemProperties(modelID, placement, true);
    } catch (_) {
      return { x: null, y: null, z: null };
    }
  }
  if (!pl || typeof pl !== "object") return { x: null, y: null, z: null };
  const rel = pl.RelativePlacement || pl.relativePlacement;
  const loc = pl.Location || pl.location || (rel && (rel.Location || rel.location));
  const coords = loc && (loc.Coordinates || loc.coordinates || loc);
  return parseCoordinates(coords);
}

/**
 * @param {number} expressID
 * @param {{ includeHeightSegments?: boolean, includeWallSlopeInfo?: boolean }} [options]
 * @returns {Promise<{ center: { x,y,z }, size: { x,y,z }, heightSegments?: { totalHeight, heights, segments, baseY, levels, araseHeights }, wallTopProfile?: { maxYByXBin:number[], maxYByZBin:number[], deltaX:number, deltaZ:number } } | null>}
 */
async function getBboxFromSubset(expressID, options = {}) {
  const ifcManager = state.viewer?.IFC?.loader?.ifcManager;
  const modelID = state.ifcModelID;
  const scene = getViewerScene();

  if (!ifcManager || modelID == null) return null;
  if (typeof ifcManager.createSubset !== "function" || typeof ifcManager.removeSubset !== "function") {
    return null;
  }
  if (!scene) return null;

  const customID = `__bbox_${expressID}_${Math.random().toString(16).slice(2)}`;
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  let subset = null;
  try {
    subset = ifcManager.createSubset({
      modelID,
      ids: [expressID],
      scene,
      removePrevious: true,
      customID,
      material,
    });

    if (!subset?.geometry) return null;
    subset.name = customID;

    // Aligne le subset avec le modèle remonté sur la grille
    if (state.modelOffsetY != null && state.modelOffsetY !== 0) {
      subset.position.y = state.modelOffsetY;
    }
    subset.updateMatrixWorld(true);

    // IMPORTANT: la bbox native d'un subset peut correspondre au modèle complet (positions partagées).
    // On calcule donc une bbox locale en utilisant UNIQUEMENT les indices du subset.
    const localBox = computeIndexedLocalBox3(subset.geometry);
    if (!localBox) return null;
    const worldBox = localBox.clone().applyMatrix4(subset.matrixWorld);

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    worldBox.getSize(size);
    worldBox.getCenter(center);
    const result = {
      center: { x: center.x, y: center.y, z: center.z },
      size: { x: size.x, y: size.y, z: size.z },
    };
    if (options.includeHeightSegments && subset.geometry) {
      const heightSegments = computeHeightSegmentsFromGeometry(subset.geometry, subset.matrixWorld);
      if (heightSegments && heightSegments.heights.length > 0) {
        result.heightSegments = heightSegments;
      }
    }
    if (options.includeWallSlopeInfo && subset.geometry) {
      const prof = computeWallTopProfilesFromGeometry(subset.geometry, subset.matrixWorld, WALL_SLOPE_BINS);
      if (prof) result.wallTopProfile = prof;
      const faceInfo = computeWallTopFaceInfo(subset.geometry, subset.matrixWorld);
      if (faceInfo) result.wallTopFaceInfo = faceInfo;
    }
    return result;
  } catch (_) {
    return null;
  } finally {
    safeRemoveSubset(ifcManager, modelID, customID);
    removeObjectByNameFromScene(customID);
    try {
      material.dispose();
    } catch (_) {}
  }
}

function ensureSelectionMaterial() {
  if (selectionMaterial) return selectionMaterial;
  selectionMaterial = new THREE.MeshLambertMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.55,
    depthTest: true,
  });
  return selectionMaterial;
}

function clearHighlight() {
  const ifcManager = state.viewer?.IFC?.loader?.ifcManager;
  const modelID = state.ifcModelID;
  if (ifcManager && modelID != null) safeRemoveSubset(ifcManager, modelID, "__selection_highlight");
  removeObjectByNameFromScene("__selection_highlight");
}

function ensureHoverMaterial() {
  if (hoverMaterial) return hoverMaterial;
  hoverMaterial = new THREE.MeshLambertMaterial({
    color: 0xfacc15, // jaune
    transparent: true,
    opacity: 0.7,
    depthTest: true,
  });
  return hoverMaterial;
}

function clearHoverHighlight() {
  const ifcManager = state.viewer?.IFC?.loader?.ifcManager;
  const modelID = state.ifcModelID;
  if (ifcManager && modelID != null) safeRemoveSubset(ifcManager, modelID, "__hover_highlight");
  removeObjectByNameFromScene("__hover_highlight");
  removeObjectByNameFromScene("__arase_hover_box");
}

async function updateHoverHighlight(expressID) {
  const ifcManager = state.viewer?.IFC?.loader?.ifcManager;
  const modelID = state.ifcModelID;
  const scene = getViewerScene();
  if (!ifcManager || modelID == null || !scene) return;
  if (typeof ifcManager.createSubset !== "function") return;

  clearHoverHighlight();
  if (!Number.isFinite(expressID)) return;

  const mat = ensureHoverMaterial();
  try {
    const subset = ifcManager.createSubset({
      modelID,
      ids: [expressID],
      scene,
      removePrevious: true,
      customID: "__hover_highlight",
      material: mat,
    });
    if (subset) subset.name = "__hover_highlight";
    if (subset && (state.modelOffsetY != null && state.modelOffsetY !== 0)) {
      subset.position.y = state.modelOffsetY;
      subset.updateMatrixWorld(true);
    }
  } catch (_) {
    // ignore hover errors
  }
}

function showAraseHoverBox(el, segIndex) {
  const scene = getViewerScene();
  if (!scene || !el) return;
  removeObjectByNameFromScene("__arase_hover_box");
  const seg =
    el.heightSegmentsDetail &&
    Array.isArray(el.heightSegmentsDetail) &&
    el.heightSegmentsDetail[segIndex]
      ? el.heightSegmentsDetail[segIndex]
      : null;
  if (!seg) return;

  const length = toNumberMaybe(el.length);
  const width = toNumberMaybe(el.width);
  const minY = toNumberMaybe(seg.minY);
  const maxY = toNumberMaybe(seg.maxY);
  const x = toNumberMaybe(el.x);
  const z = toNumberMaybe(el.z);
  if (
    length == null ||
    width == null ||
    x == null ||
    z == null ||
    minY == null ||
    maxY == null
  ) {
    return;
  }
  const height = maxY - minY;
  if (height <= 0) return;

  const geom = new THREE.BoxGeometry(length, height, width);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff4444, // rouge vif
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = "__arase_hover_box";
  mesh.position.set(x, minY + height / 2, z);
  scene.add(mesh);
}

let massStableMaterial = null;
let massUnstableMaterial = null;

function ensureMassStableMaterial() {
  if (massStableMaterial) return massStableMaterial;
  massStableMaterial = new THREE.MeshLambertMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.55,
    depthTest: true,
  });
  return massStableMaterial;
}

function ensureMassUnstableMaterial() {
  if (massUnstableMaterial) return massUnstableMaterial;
  massUnstableMaterial = new THREE.MeshLambertMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.60,
    depthTest: true,
  });
  return massUnstableMaterial;
}

function clearMassStabilityHighlight() {
  const ifcManager = state.viewer?.IFC?.loader?.ifcManager;
  const modelID = state.ifcModelID;
  if (ifcManager && modelID != null) {
    safeRemoveSubset(ifcManager, modelID, "__mass_stable");
    safeRemoveSubset(ifcManager, modelID, "__mass_unstable");
    safeRemoveSubset(ifcManager, modelID, "__mass_stable_poutres");
    safeRemoveSubset(ifcManager, modelID, "__mass_unstable_poutres");
  }
  removeObjectByNameFromScene("__mass_stable");
  removeObjectByNameFromScene("__mass_unstable");
  removeObjectByNameFromScene("__mass_stable_poutres");
  removeObjectByNameFromScene("__mass_unstable_poutres");
}

function applyMassStabilityHighlight() {
  if (currentMainTab !== "masses") return;
  if (!state.viewer || state.ifcModelID == null) return;
  const ifcManager = state.viewer?.IFC?.loader?.ifcManager;
  const modelID = state.ifcModelID;
  const scene = getViewerScene();
  if (!ifcManager || modelID == null || !scene) return;
  if (typeof ifcManager.createSubset !== "function") return;

  clearMassStabilityHighlight();

  const stableIds = [];
  const unstableIds = [];
  for (const [murIdStr, info] of Object.entries(state.massStabilityByMur || {})) {
    const murId = Number(murIdStr);
    if (!Number.isFinite(murId)) continue;
    if (info && info.stable === true) stableIds.push(murId);
    else if (info && info.stable === false) unstableIds.push(murId);
  }

  const stableBeamIds = [];
  const unstableBeamIds = [];
  for (const [poutreIdStr, info] of Object.entries(state.massStabilityByPoutre || {})) {
    const poutreId = Number(poutreIdStr);
    if (!Number.isFinite(poutreId)) continue;
    if (info && info.stable === true) stableBeamIds.push(poutreId);
    else if (info && info.stable === false) unstableBeamIds.push(poutreId);
  }

  try {
    if (stableIds.length) {
      const subset = ifcManager.createSubset({
        modelID,
        ids: stableIds,
        scene,
        removePrevious: true,
        customID: "__mass_stable",
        material: ensureMassStableMaterial(),
      });
      if (subset) subset.name = "__mass_stable";
      if (subset && (state.modelOffsetY != null && state.modelOffsetY !== 0)) {
        subset.position.y = state.modelOffsetY;
        subset.updateMatrixWorld(true);
      }
    }
    if (unstableIds.length) {
      const subset = ifcManager.createSubset({
        modelID,
        ids: unstableIds,
        scene,
        removePrevious: true,
        customID: "__mass_unstable",
        material: ensureMassUnstableMaterial(),
      });
      if (subset) subset.name = "__mass_unstable";
      if (subset && (state.modelOffsetY != null && state.modelOffsetY !== 0)) {
        subset.position.y = state.modelOffsetY;
        subset.updateMatrixWorld(true);
      }
    }

    if (stableBeamIds.length) {
      const subset = ifcManager.createSubset({
        modelID,
        ids: stableBeamIds,
        scene,
        removePrevious: true,
        customID: "__mass_stable_poutres",
        material: ensureMassStableMaterial(),
      });
      if (subset) subset.name = "__mass_stable_poutres";
      if (subset && (state.modelOffsetY != null && state.modelOffsetY !== 0)) {
        subset.position.y = state.modelOffsetY;
        subset.updateMatrixWorld(true);
      }
    }
    if (unstableBeamIds.length) {
      const subset = ifcManager.createSubset({
        modelID,
        ids: unstableBeamIds,
        scene,
        removePrevious: true,
        customID: "__mass_unstable_poutres",
        material: ensureMassUnstableMaterial(),
      });
      if (subset) subset.name = "__mass_unstable_poutres";
      if (subset && (state.modelOffsetY != null && state.modelOffsetY !== 0)) {
        subset.position.y = state.modelOffsetY;
        subset.updateMatrixWorld(true);
      }
    }
  } catch (_) {
    // best effort
  }
}

async function updateHighlight() {
  const ifcManager = state.viewer?.IFC?.loader?.ifcManager;
  const modelID = state.ifcModelID;
  const scene = getViewerScene();
  if (!ifcManager || modelID == null || !scene) return;
  if (typeof ifcManager.createSubset !== "function") return;

  const customID = "__selection_highlight";
  clearHighlight();

  const ids = [...selectedExpressIDs].filter((n) => Number.isFinite(n));
  if (!ids.length) return;

  const mat = ensureSelectionMaterial();
  try {
    const subset = ifcManager.createSubset({
      modelID,
      ids,
      scene,
      removePrevious: true,
      customID,
      material: mat,
    });
    if (subset) subset.name = customID;
    if (subset && (state.modelOffsetY != null && state.modelOffsetY !== 0)) {
      subset.position.y = state.modelOffsetY;
      subset.updateMatrixWorld(true);
    }
  } catch (_) {}
  updateCharpenteBearingArrows();
}

function ensureSlabLabelRenderer() {
  if (slabLabelRenderer || !viewerContainer) return slabLabelRenderer;
  slabLabelRenderer = new CSS2DRenderer();
  try {
    const w = viewerContainer.clientWidth || viewerContainer.offsetWidth || 400;
    const h = viewerContainer.clientHeight || viewerContainer.offsetHeight || 400;
    slabLabelRenderer.setSize(w, h);
  } catch (_) {}
  slabLabelRenderer.domElement.style.position = "absolute";
  slabLabelRenderer.domElement.style.top = "0";
  slabLabelRenderer.domElement.style.left = "0";
  slabLabelRenderer.domElement.style.pointerEvents = "none";
  viewerContainer.appendChild(slabLabelRenderer.domElement);

  const animate = () => {
    if (!slabLabelRenderer) return;
    const scene = getViewerScene();
    const camera = getViewerCamera();
    if (scene && camera) {
      slabLabelRenderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);

  window.addEventListener("resize", () => {
    resizeViewerAndLabels();
  });

  return slabLabelRenderer;
}

function clearAllSlabLabels() {
  const scene = getViewerScene();
  if (!scene) {
    slabLabelObjects.clear();
    massWallLabelObjects.clear();
    massBeamLabelObjects.clear();
    return;
  }
  slabLabelObjects.forEach((obj) => {
    if (obj && obj.parent === scene) {
      scene.remove(obj);
    }
  });
  slabLabelObjects.clear();

  massWallLabelObjects.forEach((obj) => {
    if (obj && obj.parent === scene) {
      scene.remove(obj);
    }
  });
  massWallLabelObjects.clear();

  massBeamLabelObjects.forEach((obj) => {
    if (obj && obj.parent === scene) {
      scene.remove(obj);
    }
  });
  massBeamLabelObjects.clear();
}

function updateMassWallLabels() {
  if (currentMainTab !== "masses") {
    // on supprime uniquement les labels de masse si on quitte l'onglet
    const scene = getViewerScene();
    if (!scene) {
      massWallLabelObjects.clear();
      return;
    }
    massWallLabelObjects.forEach((obj) => {
      if (obj && obj.parent === scene) scene.remove(obj);
    });
    massWallLabelObjects.clear();
    return;
  }
  if (!state.viewer || state.ifcModelID == null) return;
  const scene = getViewerScene();
  if (!scene) return;
  const renderer = ensureSlabLabelRenderer();
  if (!renderer) return;

  // N'afficher des étiquettes que pour les murs effectivement calculés (rouge/vert)
  const desired = new Set(
    Object.entries(state.massStabilityByMur || {})
      .map(([idStr, info]) => ({ id: Number(idStr), info }))
      .filter((x) => Number.isFinite(x.id) && (x.info?.stable === true || x.info?.stable === false))
      .map((x) => x.id)
  );

  // retirer ceux non désirés
  massWallLabelObjects.forEach((obj, id) => {
    if (!desired.has(id)) {
      if (obj && obj.parent === scene) scene.remove(obj);
      massWallLabelObjects.delete(id);
    }
  });

  desired.forEach((id) => {
    const el = state.importedElements.find((e) => e.id === id);
    if (!el) return;
    const x = toNumberMaybe(el.x);
    const y = toNumberMaybe(el.y);
    const z = toNumberMaybe(el.z);
    if (x == null || y == null || z == null) return;
    const height = toNumberMaybe(el.height) || 0;

    const st = state.massStabilityByMur?.[id];
    const isStable = st && st.stable === true;
    const isUnstable = st && st.stable === false;

    const info = classifyWallRoofFromProfiles(el);
    const araseTxt =
      info.araseCount && Number.isFinite(info.araseHeight)
        ? ` (arase ${info.araseCount} : ${formatNum(info.araseHeight)} m)`
        : "";
    const labelText = `Mur ${id} "${info.kind}"${araseTxt}`;

    const existing = massWallLabelObjects.get(id);
    if (existing) {
      try {
        if (existing.element) existing.element.textContent = labelText;
        if (existing.position) existing.position.set(x, y + height * 0.6, z);
      } catch (_) {}
      const elDiv = existing.element;
      if (elDiv) {
        if (isStable) {
          elDiv.style.background = "rgba(34,197,94,0.95)";
          elDiv.style.border = "1px solid rgba(34,197,94,0.9)";
        } else if (isUnstable) {
          elDiv.style.background = "rgba(239,68,68,0.95)";
          elDiv.style.border = "1px solid rgba(239,68,68,0.9)";
        }
      }
      return;
    }

    const div = document.createElement("div");
    div.textContent = labelText;
    div.style.padding = "0.15rem 0.4rem";
    div.style.borderRadius = "999px";
    div.style.fontSize = "0.7rem";
    div.style.whiteSpace = "nowrap";
    div.style.color = "#0b1220";
    if (isStable) {
      div.style.background = "rgba(34,197,94,0.95)";
      div.style.border = "1px solid rgba(34,197,94,0.9)";
    } else if (isUnstable) {
      div.style.background = "rgba(239,68,68,0.95)";
      div.style.border = "1px solid rgba(239,68,68,0.9)";
    }

    const obj = new CSS2DObject(div);
    obj.position.set(x, y + height * 0.6, z);
    scene.add(obj);
    massWallLabelObjects.set(id, obj);
  });
}

function updateMassBeamLabels() {
  if (currentMainTab !== "masses") {
    // on supprime uniquement les labels de masse si on quitte l'onglet
    const scene = getViewerScene();
    if (!scene) {
      massBeamLabelObjects.clear();
      return;
    }
    massBeamLabelObjects.forEach((obj) => {
      if (obj && obj.parent === scene) scene.remove(obj);
    });
    massBeamLabelObjects.clear();
    return;
  }
  if (!state.viewer || state.ifcModelID == null) return;
  const scene = getViewerScene();
  if (!scene) return;
  const renderer = ensureSlabLabelRenderer();
  if (!renderer) return;

  // N'afficher des étiquettes que pour les poutres effectivement calculées (rouge/vert)
  const desired = new Set(
    Object.entries(state.massStabilityByPoutre || {})
      .map(([idStr, info]) => ({ id: Number(idStr), info }))
      .filter((x) => Number.isFinite(x.id) && (x.info?.stable === true || x.info?.stable === false))
      .map((x) => x.id)
  );

  massBeamLabelObjects.forEach((obj, id) => {
    if (!desired.has(id)) {
      if (obj && obj.parent === scene) scene.remove(obj);
      massBeamLabelObjects.delete(id);
    }
  });

  desired.forEach((id) => {
    if (massBeamLabelObjects.has(id)) return;
    const el = state.importedElements.find((e) => e.id === id);
    if (!el) return;
    const x = toNumberMaybe(el.x);
    const y = toNumberMaybe(el.y);
    const z = toNumberMaybe(el.z);
    if (x == null || y == null || z == null) return;
    const height = toNumberMaybe(el.height) || 0;

    const st = state.massStabilityByPoutre?.[id];
    const isStable = st && st.stable === true;
    const isUnstable = st && st.stable === false;

    const div = document.createElement("div");
    div.textContent = `Poutre ${id}`;
    div.style.padding = "0.15rem 0.4rem";
    div.style.borderRadius = "999px";
    div.style.fontSize = "0.7rem";
    div.style.whiteSpace = "nowrap";
    div.style.color = "#0b1220";

    if (isStable) {
      div.style.background = "rgba(34,197,94,0.95)";
      div.style.border = "1px solid rgba(34,197,94,0.9)";
    } else if (isUnstable) {
      div.style.background = "rgba(239,68,68,0.95)";
      div.style.border = "1px solid rgba(239,68,68,0.9)";
    }

    const obj = new CSS2DObject(div);
    obj.position.set(x, y + height * 0.6, z);
    scene.add(obj);
    massBeamLabelObjects.set(id, obj);
  });
}

function updateSlabLabels() {
  if (currentMainTab !== "resultats") {
    clearAllSlabLabels();
    return;
  }
  if (!state.viewer || state.ifcModelID == null) return;
  const scene = getViewerScene();
  if (!scene) return;
  const renderer = ensureSlabLabelRenderer();
  if (!renderer) return;

  const desired = new Set();
  for (const id of selectedExpressIDs) {
    const el = state.importedElements.find((e) => e.id === id);
    if (!el) continue;
    // En onglet Association, on affiche un label pour dalles, murs et poutres sélectionnés
    if (
      matchesCategory(el, "charpente") ||
      matchesCategory(el, "murs") ||
      matchesCategory(el, "poutres")
    ) {
      desired.add(id);
    }
  }

  // Retirer les labels des dalles non désirées
  slabLabelObjects.forEach((obj, id) => {
    if (!desired.has(id)) {
      if (obj && obj.parent === scene) {
        scene.remove(obj);
      }
      slabLabelObjects.delete(id);
    }
  });

  // Ajouter / mettre à jour les labels pour les éléments désirés
  desired.forEach((id) => {
    const el = state.importedElements.find((e) => e.id === id);
    if (!el) return;
    const x = toNumberMaybe(el.x);
    const y = toNumberMaybe(el.y);
    const z = toNumberMaybe(el.z);
    if (x == null || y == null || z == null) return;

    let prefix = "Élément";
    if (matchesCategory(el, "charpente")) prefix = "Dalle";
    else if (matchesCategory(el, "murs")) prefix = "Mur";
    else if (matchesCategory(el, "poutres")) prefix = "Poutre";

    let labelText = `${prefix} ${id}`;
    let labelY = y;
    const height = toNumberMaybe(el.height) || 0;

    // Si un segment / une arase de mur est sélectionné, positionner l’étiquette à cette hauteur
    if (matchesCategory(el, "murs")) {
      const segIndex = state.selectedWallSegments[id];
      const wk = classifyWallRoofFromProfiles(el).kind;
      const wallRoofSuffix = wk && wk !== "Mur" ? ` "${wk}"` : "";
      const hasArases = Array.isArray(el.araseHeights) && el.araseHeights.length > 0;
      if (Number.isInteger(segIndex)) {
        if (hasArases && el.heightBaseY != null && el.araseHeights[segIndex] != null) {
          const hArase = toNumberMaybe(el.araseHeights[segIndex]);
          const baseY = toNumberMaybe(el.heightBaseY);
          if (Number.isFinite(hArase) && Number.isFinite(baseY)) {
            labelY = baseY + hArase;
            labelText = `${prefix} ${id}${wallRoofSuffix} (arase ${segIndex + 1} : ${formatNum(hArase)} m)`;
          }
        } else if (el.heightSegmentsDetail && Array.isArray(el.heightSegmentsDetail) && el.heightSegmentsDetail[segIndex]) {
          const seg = el.heightSegmentsDetail[segIndex];
          const segMidY = (toNumberMaybe(seg.minY) + toNumberMaybe(seg.maxY)) / 2;
          if (Number.isFinite(segMidY)) {
            labelY = segMidY + 0.05;
          }
          const hSeg = toNumberMaybe(seg.height);
          if (Number.isFinite(hSeg)) {
            labelText = `${prefix} ${id}${wallRoofSuffix} (seg ${segIndex + 1} : ${formatNum(hSeg)} m)`;
          } else {
            labelText = `${prefix} ${id}${wallRoofSuffix} (seg ${segIndex + 1})`;
          }
        }
      }

      // Si aucune arase/seg spécifique n'est ciblé : afficher type + arase "globale"
      if (labelText === `${prefix} ${id}`) {
        const info = classifyWallRoofFromProfiles(el);
        const araseTxt =
          info.araseCount && Number.isFinite(info.araseHeight)
            ? ` (arase ${info.araseCount} : ${formatNum(info.araseHeight)} m)`
            : "";
        labelText = `Mur ${id} "${info.kind}"${araseTxt}`;
      }
    }

    // Mise à jour si existe déjà (important: le profil peut arriver après le 1er clic)
    const existing = slabLabelObjects.get(id);
    if (existing) {
      try {
        if (existing.element) existing.element.textContent = labelText;
      } catch (_) {}
      existing.position.set(x, labelY + (height ? height * 0.1 : 0), z);
      return;
    }

    const div = document.createElement("div");
    div.textContent = labelText;
    div.style.padding = "0.15rem 0.4rem";
    div.style.borderRadius = "999px";
    div.style.fontSize = "0.7rem";
    div.style.color = "#e5e7eb";
    div.style.background = "rgba(15,23,42,0.9)";
    div.style.border = "1px solid rgba(148,163,184,0.8)";
    div.style.whiteSpace = "nowrap";

    const obj = new CSS2DObject(div);
    obj.position.set(x, labelY + (height ? height * 0.1 : 0), z);
    scene.add(obj);
    slabLabelObjects.set(id, obj);
  });
}

async function highlightExpressID(expressID) {
  const ifcManager = state.viewer?.IFC?.loader?.ifcManager;
  const modelID = state.ifcModelID;
  const scene = getViewerScene();
  if (!ifcManager || modelID == null || !scene) return;
  if (typeof ifcManager.createSubset !== "function") return;

  // compat: utilisé ailleurs; désormais on passe par la multi-sélection
  selectedExpressIDs.clear();
  selectedExpressIDs.add(Number(expressID));
  await updateHighlight();
}

/** Extrait L, H, P des propriétés IFC (Quantities, Qto, champs directs, etc.) */
function getDimensionsFromProps(props) {
  let length = null, height = null, width = null;
  const set = (name, val) => {
    if (typeof val !== "number" || !isFinite(val)) return;
    const n = (name || "").toLowerCase();
    if (n.includes("length") || n.includes("longueur")) length = val;
    else if (n.includes("height") || n.includes("hauteur")) height = val;
    else if (n.includes("width") || n.includes("depth") || n.includes("épaisseur") || n.includes("thickness")) width = val;
  };
  const qto = props.Quantities || props.quantities || props.Qto || [];
  const arr = Array.isArray(qto) ? qto : (qto && typeof qto === "object" ? [qto] : []);
  for (const q of arr) {
    if (q && typeof q === "object") {
      const name = q.name ?? q.Name ?? q.type ?? "";
      const val = q.value ?? q.Value ?? q.LengthValue ?? q.lengthValue ?? q.length ?? q.Length;
      if (typeof val === "number") set(name, val);
    }
  }
  if (props.Length !== undefined) length = props.Length;
  if (props.Height !== undefined) height = props.Height;
  if (props.Width !== undefined) width = props.Width;
  if (props.LengthValue !== undefined) length = props.LengthValue;
  if (props.HeightValue !== undefined) height = props.HeightValue;
  if (props.WidthValue !== undefined) width = props.WidthValue;
  return { length, height, width };
}

/** Aplatit la structure spatiale IFC en liste d'éléments avec propriétés */
async function flattenSpatialStructure(ifcManager, modelID, node, out) {
  if (!node) return;
  const id = toNumberMaybe(node.expressID ?? node.expressId);
  const typeName = (node.type ?? node.TYPE ?? (node.constructor && node.constructor.name)) || "IfcProduct";
  let name = unwrapIfcValue(node.name ?? node.Name) ?? "";
  let x = null, y = null, z = null;
  let length = null, height = null, width = null;
  let rawProps = {};

  if (id && ifcManager.getItemProperties) {
    try {
      const props = await ifcManager.getItemProperties(modelID, id, true);
      if (props) {
        rawProps = props;
        if (props.Name !== undefined) name = unwrapIfcValue(props.Name);
        if (props.name !== undefined) name = unwrapIfcValue(props.name);
        const coords = await getPlacementCoordinates(ifcManager, modelID, props.ObjectPlacement || props.objectPlacement);
        x = coords.x; y = coords.y; z = coords.z;
        const dims = getDimensionsFromProps(props);
        length = dims.length; height = dims.height; width = dims.width;
      }
    } catch (_) { /* ignorer si propriétés inaccessibles */ }
  } else if (node.name !== undefined) {
    name = unwrapIfcValue(node.name);
  }

  out.push({
    id,
    name: (name != null && name !== "") ? name : `#${id}`,
    type: unwrapIfcValue(typeName),
    x, y, z,
    length, height, width,
    rawProps,
  });

  const children = node.children || node.Contains || [];
  const list = Array.isArray(children) ? children : (children ? [children] : []);
  for (const child of list) {
    await flattenSpatialStructure(ifcManager, modelID, child, out);
  }
}

async function extractAndDisplayElements() {
  state.importedElements = [];
  if (!elementsPanel || !state.viewer || state.ifcModelID == null) return;

  const ifcManager = state.viewer.IFC?.loader?.ifcManager;
  if (!ifcManager) {
    elementsPanel.style.display = "block";
    elementsCount.textContent = "Impossible d’accéder au gestionnaire IFC.";
    return;
  }

  try {
    let root = null;
    if (typeof ifcManager.getSpatialStructure === "function") {
      root = await ifcManager.getSpatialStructure(state.ifcModelID, true);
    }
    if (root) {
      await flattenSpatialStructure(ifcManager, state.ifcModelID, root, state.importedElements);
    }

    // Dédoublonnage (certains arbres peuvent référencer plusieurs fois le même expressID)
    const byId = new Map();
    for (const el of state.importedElements) {
      if (el?.id != null) byId.set(el.id, el);
    }
    state.importedElements = [...byId.values()];

    // Calcul des coordonnées et dimensions par expressID (une fois par élément, aligné sur la grille)
    for (const el of state.importedElements) {
      const id = typeof el.id === "number" ? el.id : null;
      if (id == null) continue;
      const isWall = el.type && /WALL/i.test(String(el.type));
      const isSlab = el.type && /SLAB/i.test(String(el.type));
      const bbox = await getBboxFromSubset(id, {
        includeHeightSegments: isWall,
        includeWallSlopeInfo: isWall || isSlab,
      });
      if (bbox) {
        el.x = bbox.center.x;
        el.y = bbox.center.y;
        el.z = bbox.center.z;
        el.length = bbox.size.x;
        el.height = bbox.size.y;
        el.width = bbox.size.z;
        if (bbox.heightSegments && bbox.heightSegments.heights.length > 0) {
          el.heightSegments = bbox.heightSegments.heights;
          el.heightSegmentsDetail = bbox.heightSegments.segments;
          el.heightBaseY = bbox.heightSegments.baseY;
          el.araseHeights = bbox.heightSegments.araseHeights;
        }
        if (bbox.wallTopProfile) {
          if (isWall) el.wallTopProfile = bbox.wallTopProfile;
          if (isSlab) el.slabTopProfile = bbox.wallTopProfile;
        }
        if (bbox.wallTopFaceInfo && isWall) {
          el.wallTopFaceInfo = bbox.wallTopFaceInfo;
        }
      }
    }

    if (state.importedElements.length === 0 && typeof ifcManager.getAllItemsOfType === "function") {
      try {
        const IFC = await import("web-ifc");
        const typeList = [
          IFC.IFCWALLSTANDARDCASE, IFC.IFCWALL, IFC.IFCSLAB, IFC.IFCCOLUMN,
          IFC.IFCDOOR, IFC.IFCWINDOW, IFC.IFCBEAM, IFC.IFCBUILDINGELEMENTPROXY,
        ].filter((t) => t != null);
        for (const type of typeList) {
          try {
            const ids = await ifcManager.getAllItemsOfType(state.ifcModelID, type, false);
            const arr = Array.isArray(ids) ? ids : (ids != null ? [ids] : []);
            for (const id of arr) {
              let name = `#${id}`, x = null, y = null, z = null, length = null, height = null, width = null, heightSegments = null, heightSegmentsDetail = null, heightBaseY = null, araseHeights = null;
              if (ifcManager.getItemProperties) {
                try {
                  const props = await ifcManager.getItemProperties(state.ifcModelID, id, true);
                  if (props) {
                    name = unwrapIfcValue(props.Name ?? props.name) ?? name;
                    const isWall = type === IFC.IFCWALL || type === IFC.IFCWALLSTANDARDCASE;
                    const bbox = typeof id === "number" ? await getBboxFromSubset(id, { includeHeightSegments: isWall }) : null;
                    if (bbox) {
                      x = bbox.center.x; y = bbox.center.y; z = bbox.center.z;
                      length = bbox.size.x; height = bbox.size.y; width = bbox.size.z;
                      if (bbox.heightSegments && bbox.heightSegments.heights.length > 0) {
                        heightSegments = bbox.heightSegments.heights;
                        heightSegmentsDetail = bbox.heightSegments.segments;
                        heightBaseY = bbox.heightSegments.baseY;
                        araseHeights = bbox.heightSegments.araseHeights;
                      }
                    } else {
                      const c = await getPlacementCoordinates(ifcManager, state.ifcModelID, props.ObjectPlacement || props.objectPlacement);
                      x = c.x; y = c.y; z = c.z;
                      const d = getDimensionsFromProps(props);
                      length = d.length; height = d.height; width = d.width;
                    }
                  }
                } catch (_) {}
              }
              state.importedElements.push({
                id,
                name,
                type: `Type_${type}`,
                x, y, z,
                length, height, width,
                heightSegments: heightSegments || undefined,
                heightSegmentsDetail: heightSegmentsDetail || undefined,
                heightBaseY: heightBaseY != null ? heightBaseY : undefined,
                araseHeights: araseHeights || undefined,
                rawProps: {},
              });
            }
          } catch (_) { /* type non supporté */ }
        }
      } catch (_) {
        console.warn("Fallback getAllItemsOfType non disponible (web-ifc).");
      }
    }

  } catch (e) {
    console.warn("Extraction structure spatiale IFC:", e);
  }

  elementsPanel.style.display = "block";
  renderElementsTables();
  bindElementsFilters();
}

function formatNum(v) {
  const n = toNumberMaybe(v);
  if (n == null) return "—";
  return n.toFixed(2);
}

function getFilteredElementsByCategory(category) {
  const search = (filterSearchInput?.value ?? "").trim().toLowerCase();
  return state.importedElements.filter((e) => {
    const typeStrRaw = String(unwrapIfcValue(e.type) ?? "");
    const typeStr = typeStrRaw.toUpperCase();
    if (category === "charpente") {
      if (!typeStr.includes("IFCSLAB")) return false;
    } else if (category === "murs") {
      if (!typeStr.includes("IFCWALL")) return false;
    } else if (category === "poutres") {
      if (!typeStr.includes("IFCBEAM")) return false;
    }
    if (search) {
      const idStr = e.id != null ? String(e.id) : "";
      const nameStr = String(unwrapIfcValue(e.name) ?? "");
      if (!nameStr.toLowerCase().includes(search) && !typeStrRaw.toLowerCase().includes(search) && !idStr.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

function matchesCategory(el, category) {
  const typeStr = String(unwrapIfcValue(el.type) ?? "").toUpperCase();
  if (category === "charpente") return typeStr.includes("IFCSLAB");
  if (category === "murs") return typeStr.includes("IFCWALL");
  if (category === "poutres") return typeStr.includes("IFCBEAM");
  return false;
}

async function handleExpressIdSelectionFrom3D(expressID) {
  if (!Number.isFinite(expressID)) return;
  const id = Number(expressID);
  const el = state.importedElements.find((e) => e.id === id);
  if (!el) return;

  const ifcManager = state.viewer?.IFC?.loader?.ifcManager;
  const modelID = state.ifcModelID;
  const category = matchesCategory(el, "charpente")
    ? "charpente"
    : matchesCategory(el, "murs")
    ? "murs"
    : matchesCategory(el, "poutres")
    ? "poutres"
    : null;

  if (!category) return;

  if (currentMainTab === "resultats" && (category === "murs" || category === "poutres")) {
    // En Association : clic sur un mur/poutre déjà seul sélectionné => tout désélectionner
    if (selectedExpressIDs.size === 1 && selectedExpressIDs.has(id)) {
      selectedExpressIDs.clear();
      renderElementsTables();
      if (ifcManager && modelID != null) {
        clearHighlight();
      }
      updateAllAttributePanels();
      updateSlabLabels();
      return;
    }

    selectedExpressIDs.clear();
    selectedExpressIDs.add(id);
    if (category === "murs" || category === "poutres") {
      recomputeSlabSelectionFromWalls();
    }
    renderElementsTables();
    if (ifcManager && modelID != null) {
      await updateHighlight();
    }
    updateAllAttributePanels();
    updateSlabLabels();
    updateAssociationPanelHighlight();
    return;
  }

  if (selectedExpressIDs.has(id)) {
    selectedExpressIDs.delete(id);
  } else {
    selectedExpressIDs.add(id);
  }

  renderElementsTables();
  if (ifcManager && modelID != null) {
    if (selectedExpressIDs.size === 0) {
      clearHighlight();
    } else {
      await updateHighlight();
    }
  }
  updateAllAttributePanels();
  updateSlabLabels();
  updateAssociationPanelHighlight();
}

function renderElementsTables() {
  if (!elementsTbodyCharpente || !elementsTbodyMurs || !elementsTbodyPoutres) return;

  const listCharpente = getFilteredElementsByCategory("charpente");
  const listMurs = getFilteredElementsByCategory("murs");
  const listPoutres = getFilteredElementsByCategory("poutres");

  if (elementsCountCharpente) {
    elementsCountCharpente.textContent = `${listCharpente.length} élément(s) de type charpente (IFCSLAB)`;
  }
  if (elementsCountMurs) {
    elementsCountMurs.textContent = `${listMurs.length} mur(s) (IFCWALL / IFCWALLSTANDARDCASE)`;
  }
  if (elementsCountPoutres) {
    elementsCountPoutres.textContent = `${listPoutres.length} poutre(s) (IFCBEAM)`;
  }

  const fillBody = (tbody, list, category) => {
    tbody.innerHTML = "";
    for (const e of list) {
      const safeName = String(unwrapIfcValue(e.name) ?? "");
      const safeType = String(unwrapIfcValue(e.type) ?? "");
      const tr = document.createElement("tr");
      tr.dataset.expressId = String(e.id ?? "");
      if (e.id != null && selectedExpressIDs.has(Number(e.id))) tr.classList.add("selected");
      const heightSegmentsStr = Array.isArray(e.heightSegments) && e.heightSegments.length
        ? e.heightSegments.map((h) => formatNum(h)).join(" ; ")
        : "";
      const heightTitle = heightSegmentsStr ? `Hauteurs par segment (pour calcul) : ${heightSegmentsStr} m` : "";
      const heightCell = heightSegmentsStr
        ? `<td class="num" title="${escapeHtml(heightTitle)}">${formatNum(e.height)} <small>(${e.heightSegments.length} seg.)</small></td>`
        : `<td class="num">${formatNum(e.height)}</td>`;
      let formeCell = "";
      if (category === "charpente") {
        const forme = getSlabFormeKind(e);
        const prof = e.slabTopProfile;
        const deltaTxt = prof
          ? `ΔX=${formatNum(prof.deltaX)} m · ΔZ=${formatNum(prof.deltaZ)} m`
          : "Profil non calculé";
        const cls = forme === "Rampante" ? "forme-rampante" : "forme-horiz";
        formeCell = `<td title="${escapeHtml(deltaTxt)}" style="font-weight:600;${forme === "Rampante" ? "color:#fb923c;" : "color:#cbd5f5;"}" class="${cls}">${forme}</td>`;
      } else if (category === "murs") {
        const info = classifyWallRoofFromProfiles(e);
        const kind = info?.kind || "Mur";
        const display = kind === "Mur" ? "—" : kind;
        let color = "#cbd5f5";
        if (kind === "Pignon") color = "#f87171";   // rouge clair
        else if (kind === "Rampant") color = "#fb923c"; // orange
        else if (kind === "Rive") color = "#86efac"; // vert clair
        const prof = e.wallTopProfile;
        const faceInfo = e.wallTopFaceInfo;
        const titleParts = [];
        if (prof) titleParts.push(`ΔX=${formatNum(prof.deltaX)} m · ΔZ=${formatNum(prof.deltaZ)} m`);
        else titleParts.push("Profil haut non calculé");
        if (info?.araseCount) titleParts.push(`${info.araseCount} arase(s)`);
        if (faceInfo) {
          titleParts.push(`Pente sup. selon X = ${formatNum(faceInfo.inclinedAlongXArea ?? 0)} m²`);
          titleParts.push(`Pente sup. selon Z = ${formatNum(faceInfo.inclinedAlongZArea ?? 0)} m²`);
          titleParts.push(`Faces plates sup. = ${formatNum(faceInfo.flatTopArea)} m²`);
          if (faceInfo.maxInclineAngleDeg > 0) titleParts.push(`Pente max ≈ ${formatNum(faceInfo.maxInclineAngleDeg)}°`);
        }
        formeCell = `<td title="${escapeHtml(titleParts.join(" · "))}" style="font-weight:600; color:${color};">${escapeHtml(display)}</td>`;
      }
      tr.innerHTML = `
        <td class="num">${escapeHtml(String(e.id ?? "—"))}</td>
        <td>${escapeHtml(safeType)}</td>
        <td class="num">${formatNum(e.x)}</td>
        <td class="num">${formatNum(e.y)}</td>
        <td class="num">${formatNum(e.z)}</td>
        <td class="num">${formatNum(e.length)}</td>
        ${heightCell}
        <td class="num">${formatNum(e.width)}</td>
        <td title="Propriétés brutes">${Object.keys(e.rawProps || {}).length ? "Oui" : "—"}</td>
        ${formeCell}
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll("tr").forEach((row) => {
      row.addEventListener("click", async () => {
        const id = Number(row.dataset.expressId);
        if (!Number.isFinite(id)) return;
        await handleExpressIdSelectionFrom3D(id);
      });

      row.addEventListener("mouseenter", async () => {
        const id = Number(row.dataset.expressId);
        if (!Number.isFinite(id)) return;
        await updateHoverHighlight(id);
      });

      row.addEventListener("mouseleave", () => {
        clearHoverHighlight();
      });
    });
  };

  fillBody(elementsTbodyCharpente, listCharpente, "charpente");
  fillBody(elementsTbodyMurs, listMurs, "murs");
  fillBody(elementsTbodyPoutres, listPoutres, "poutres");
}

function readCharpenteAttrsFromPanel() {
  return {
    sens: charpenteSensSelect?.value || "",
    matCharpente: charpenteMatCharpente?.value || "",
    matVolige: charpenteMatVolige?.value || "",
    matCouverture: charpenteMatCouverture?.value || "",
    matIsolant: charpenteMatIsolant?.value || "",
    matPlafond: charpenteMatPlafond?.value || "",
    matPlancher: charpenteMatPlancher?.value || "",
    matCloisons: charpenteMatCloisons?.value || "",
    matAutres: charpenteMatAutres?.value || "",
    Qexp: charpenteQexpInput?.value ? Number(charpenteQexpInput.value) : null,
    Gml: charpenteGmlInput?.value ? Number(charpenteGmlInput.value) : null,
    Qml: charpenteQmlInput?.value ? Number(charpenteQmlInput.value) : null,
  };
}

function updateCharpenteGqSummaryPreview() {
  if (!charpenteGqSummary) return;
  const m2 = getCharpenteMassPerM2(readCharpenteAttrsFromPanel());
  charpenteGqSummary.textContent =
    `G = ${formatNum(m2.G)} daN/m² · Q = ${formatNum(m2.Q0)} daN/m² (Qexp + Qml) · ψ = ${formatNum(m2.psi)} → Q retenu = ${formatNum(m2.Q)} daN/m² · Total = ${formatNum(m2.total)} daN/m²`;
}

function disposeBearingArrowGroup(group) {
  if (!group) return;
  group.traverse((obj) => {
    if (obj.isArrowHelper) {
      obj.line?.geometry?.dispose();
      obj.cone?.geometry?.dispose();
    }
  });
}

function clearCharpenteBearingArrows() {
  const scene = getViewerScene();
  slabBearingArrowObjects.forEach((obj) => {
    if (scene && obj?.parent === scene) scene.remove(obj);
    disposeBearingArrowGroup(obj);
  });
  slabBearingArrowObjects.clear();
}

function updateCharpenteBearingArrows() {
  clearCharpenteBearingArrows();
  if (currentMainTab !== "definir") return;
  if (!state.viewer || state.ifcModelID == null) return;
  const scene = getViewerScene();
  if (!scene) return;

  const ids = getSelectedCharpenteIds();
  ids.forEach((id) => {
    const slabEl = state.importedElements.find((e) => e.id === id);
    if (!slabEl) return;
    const sensRaw = state.charpenteAttributes?.[id]?.sens || charpenteSensSelect?.value || "";
    const sens = normalizeCharpenteSens(slabEl, sensRaw);
    if (!sens) return;
    const dir = getSlabBearingDirUnitXZ(slabEl, sens);
    if (!dir) return;
    const span = getSlabBearingSpanM(slabEl, sens);
    const topY = getSlabTopY(slabEl);
    const cx = toNumberMaybe(slabEl.x);
    const cz = toNumberMaybe(slabEl.z);
    if (topY == null || cx == null || cz == null || span <= 0) return;

    const center = new THREE.Vector3(cx, topY + 0.08, cz);
    const half = Math.min(span * 0.42, 2.8) / 2;
    const group = new THREE.Group();
    const color = 0x4c1d95;
    const headLen = Math.max(0.12, half * 0.18);
    const headW = headLen * 0.55;
    group.add(new THREE.ArrowHelper(dir, center, half, color, headLen, headW));
    group.add(new THREE.ArrowHelper(dir.clone().negate(), center, half, color, headLen, headW));
    scene.add(group);
    slabBearingArrowObjects.set(id, group);
  });
}

function getSelectedCharpenteIds() {
  const ids = [];
  for (const id of selectedExpressIDs) {
    const el = state.importedElements.find((e) => e.id === id);
    if (!el) continue;
    const typeStr = String(unwrapIfcValue(el.type) ?? "").toUpperCase();
    if (typeStr.includes("IFCSLAB")) ids.push(id);
  }
  return ids;
}

function updateCharpenteAttributesPanel() {
  if (!charpenteAttrsPanel || !charpenteSelectedInfo) return;
  if (currentMainTab === "resultats") {
    charpenteAttrsPanel.style.display = "none";
    clearCharpenteBearingArrows();
    return;
  }
  const ids = getSelectedCharpenteIds();
  if (!ids.length) {
    charpenteAttrsPanel.style.display = "none";
    clearCharpenteBearingArrows();
    return;
  }

  charpenteAttrsPanel.style.display = "block";
  charpenteSelectedInfo.textContent = `${ids.length} élément(s) de charpente sélectionné(s) : ${ids.join(", ")}`;

  const ref = state.charpenteAttributes[ids[0]] || {};
  const slabRef = state.importedElements.find((e) => e.id === ids[0]);
  if (charpenteSensSelect) {
    charpenteSensSelect.value = slabRef
      ? normalizeCharpenteSens(slabRef, ref.sens)
      : (ref.sens ?? "");
  }
  if (charpenteMatCharpente) charpenteMatCharpente.value = ref.matCharpente ?? "";
  if (charpenteMatVolige) charpenteMatVolige.value = ref.matVolige ?? "";
  if (charpenteMatCouverture) charpenteMatCouverture.value = ref.matCouverture ?? "";
  if (charpenteMatIsolant) charpenteMatIsolant.value = ref.matIsolant ?? "";
  if (charpenteMatPlafond) charpenteMatPlafond.value = ref.matPlafond ?? "";
  if (charpenteMatPlancher) charpenteMatPlancher.value = ref.matPlancher ?? "";
  if (charpenteMatCloisons) charpenteMatCloisons.value = ref.matCloisons ?? "";
  if (charpenteMatAutres) charpenteMatAutres.value = ref.matAutres ?? "";
  if (charpenteQexpInput) charpenteQexpInput.value = ref.Qexp != null ? String(ref.Qexp) : "";
  if (charpenteGmlInput) charpenteGmlInput.value = ref.Gml != null ? String(ref.Gml) : "";
  if (charpenteQmlInput) charpenteQmlInput.value = ref.Qml != null ? String(ref.Qml) : "";
  updateCharpenteGqSummaryPreview();
  updateCharpenteBearingArrows();
}

charpenteAttrsApplyBtn?.addEventListener("click", () => {
  const ids = getSelectedCharpenteIds();
  if (!ids.length) {
    alert("Aucun élément de charpente sélectionné dans la liste.");
    return;
  }
  const sensLabel = charpenteSensSelect?.value || "";
  const attrs = {
    matCharpente: charpenteMatCharpente?.value || "",
    matVolige: charpenteMatVolige?.value || "",
    matCouverture: charpenteMatCouverture?.value || "",
    matIsolant: charpenteMatIsolant?.value || "",
    matPlafond: charpenteMatPlafond?.value || "",
    matPlancher: charpenteMatPlancher?.value || "",
    matCloisons: charpenteMatCloisons?.value || "",
    matAutres: charpenteMatAutres?.value || "",
    Qexp: charpenteQexpInput?.value ? Number(charpenteQexpInput.value) : null,
    Gml: charpenteGmlInput?.value ? Number(charpenteGmlInput.value) : null,
    Qml: charpenteQmlInput?.value ? Number(charpenteQmlInput.value) : null,
  };
  if (!state.charpenteAttributes) state.charpenteAttributes = {};
  ids.forEach((id) => {
    const slabEl = state.importedElements.find((e) => e.id === id);
    const sens = slabEl ? normalizeCharpenteSens(slabEl, sensLabel) : sensLabel;
    state.charpenteAttributes[id] = { ...attrs, sens };
  });
  updateCharpenteBearingArrows();
  alert(`Paramètres appliqués à ${ids.length} élément(s) de charpente.`);
});

[
  charpenteSensSelect,
  charpenteMatCharpente,
  charpenteMatVolige,
  charpenteMatCouverture,
  charpenteMatIsolant,
  charpenteMatPlafond,
  charpenteMatPlancher,
  charpenteMatCloisons,
  charpenteMatAutres,
  charpenteQexpInput,
  charpenteGmlInput,
  charpenteQmlInput,
].forEach((el) => {
  el?.addEventListener("input", () => updateCharpenteGqSummaryPreview());
  el?.addEventListener("change", () => {
    updateCharpenteGqSummaryPreview();
    if (el === charpenteSensSelect) updateCharpenteBearingArrows();
  });
});

function getSelectedIdsByCategory(category) {
  const ids = [];
  for (const id of selectedExpressIDs) {
    const el = state.importedElements.find((e) => e.id === id);
    if (!el) continue;
    if (matchesCategory(el, category)) ids.push(id);
  }
  return ids;
}

function updateMurAttributesPanel() {
  if (!murAttrsPanel || !murSelectedInfo) return;
  if (currentMainTab === "resultats") {
    murAttrsPanel.style.display = "none";
    return;
  }
  const ids = getSelectedIdsByCategory("murs");
  if (!ids.length) {
    murAttrsPanel.style.display = "none";
    return;
  }
  murAttrsPanel.style.display = "block";
  murSelectedInfo.textContent = `${ids.length} mur(s) sélectionné(s) : ${ids.join(", ")}`;
  const ref = state.mursAttributes[ids[0]] || {};
  if (murTypeSelect) murTypeSelect.value = ref.typeMurKey ?? "";
  if (murTypeStructSelect) murTypeStructSelect.value = ref.typeStructKey ?? "";
  if (murTypeStructRampantSelect) murTypeStructRampantSelect.value = ref.typeStructKeyRampant ?? "";
  const murHeightSegmentsEl = document.getElementById("mur-height-segments-info");
  if (murHeightSegmentsEl) {
    const el = state.importedElements.find((e) => e.id === ids[0]);
    if (el && Array.isArray(el.heightSegments) && el.heightSegments.length > 0) {
      const segStr = el.heightSegments.map((h) => formatNum(h)).join(" ; ");
      const araseStr =
        el.araseHeights && el.araseHeights.length
          ? el.araseHeights.map((h) => formatNum(h)).join(" ; ")
          : null;
      let txt = `Hauteurs par segment : ${segStr} m`;
      if (araseStr) {
        txt += ` | Arases (depuis base) : ${araseStr} m`;
      }
      murHeightSegmentsEl.textContent = txt;
      murHeightSegmentsEl.style.display = "";
    } else {
      murHeightSegmentsEl.textContent = "Une seule hauteur (ou non calculée).";
      murHeightSegmentsEl.style.display = el && el.height != null ? "" : "none";
    }
  }
}

murAttrsApplyBtn?.addEventListener("click", () => {
  const ids = getSelectedIdsByCategory("murs");
  if (!ids.length) {
    alert("Aucun mur sélectionné dans la liste.");
    return;
  }
  const attrs = {
    typeMurKey: murTypeSelect?.value || "",
    typeStructKey: murTypeStructSelect?.value || "",
    typeStructKeyRampant: murTypeStructRampantSelect?.value || "",
  };
  if (!state.mursAttributes) state.mursAttributes = {};
  ids.forEach((id) => {
    state.mursAttributes[id] = { ...attrs };
  });
  alert(`Paramètres appliqués à ${ids.length} mur(s).`);
});

function updatePoutreAttributesPanel() {
  if (!poutreAttrsPanel || !poutreSelectedInfo) return;
  if (currentMainTab === "resultats") {
    poutreAttrsPanel.style.display = "none";
    return;
  }
  const ids = getSelectedIdsByCategory("poutres");
  if (!ids.length) {
    poutreAttrsPanel.style.display = "none";
    return;
  }
  poutreAttrsPanel.style.display = "block";
  poutreSelectedInfo.textContent = `${ids.length} poutre(s) sélectionnée(s) : ${ids.join(", ")}`;
  const ref = state.poutresAttributes[ids[0]] || {};
  const bars = Array.isArray(ref.haLaterales) && ref.haLaterales.length
    ? ref.haLaterales
    : [
        { n: 2, d: 10 },
        { n: 0, d: 14 },
        { n: 0, d: 16 },
        { n: 0, d: 20 },
      ];
  const setRow = (i, nEl, dEl) => {
    const b = bars[i] || { n: 0, d: 0 };
    if (nEl) nEl.value = String(b.n ?? 0);
    if (dEl) dEl.value = String(b.d ?? 0);
  };
  setRow(0, poutreHaN0, poutreHaD0);
  setRow(1, poutreHaN1, poutreHaD1);
  setRow(2, poutreHaN2, poutreHaD2);
  setRow(3, poutreHaN3, poutreHaD3);

  const ov = ref.sectionOverride || {};
  if (poutreSectionOverrideCb) poutreSectionOverrideCb.checked = !!ov.enabled;
  if (poutreSectionFields) poutreSectionFields.style.display = (poutreSectionOverrideCb?.checked ? "" : "none");
  if (poutreSectionB) poutreSectionB.value = ov.b_cm != null ? String(ov.b_cm) : (poutreSectionB.value || "");
  if (poutreSectionH) poutreSectionH.value = ov.h_cm != null ? String(ov.h_cm) : (poutreSectionH.value || "");
  if (poutreTypeMurSelect) poutreTypeMurSelect.value = ov.typeMurKey ?? "";
  if (poutreTypeStructSelect) poutreTypeStructSelect.value = ov.typeStructKey ?? "";

  updatePoutreAstPreview();
}

function computeAstFromBars(bars) {
  // bars: [{n, d(mm)}...] -> Ast en cm² (un côté)
  let Ast = 0;
  (bars || []).forEach((b) => {
    const n = Number(b?.n);
    const dmm = Number(b?.d);
    if (!Number.isFinite(n) || !Number.isFinite(dmm) || n <= 0 || dmm <= 0) return;
    const dcm = dmm / 10;
    const area = (Math.PI * dcm * dcm) / 4;
    Ast += n * area;
  });
  return Ast;
}

function readPoutreBarsFromInputs() {
  const rows = [
    { n: Number(poutreHaN0?.value), d: Number(poutreHaD0?.value) },
    { n: Number(poutreHaN1?.value), d: Number(poutreHaD1?.value) },
    { n: Number(poutreHaN2?.value), d: Number(poutreHaD2?.value) },
    { n: Number(poutreHaN3?.value), d: Number(poutreHaD3?.value) },
  ].map((r) => ({
    n: Number.isFinite(r.n) && r.n > 0 ? Math.round(r.n) : 0,
    d: Number.isFinite(r.d) && r.d > 0 ? Math.round(r.d) : 0,
  }));
  return rows;
}

function updatePoutreAstPreview() {
  if (!poutreAstPreview) return;
  const bars = readPoutreBarsFromInputs();
  const Ast = computeAstFromBars(bars);
  poutreAstPreview.textContent = `Ast latéral calculé : ${Ast.toFixed(2)} cm²`;
}

poutreSectionOverrideCb?.addEventListener("change", () => {
  if (poutreSectionFields) {
    poutreSectionFields.style.display = poutreSectionOverrideCb.checked ? "" : "none";
  }
});

[poutreHaN0, poutreHaD0, poutreHaN1, poutreHaD1, poutreHaN2, poutreHaD2, poutreHaN3, poutreHaD3].forEach((el) => {
  el?.addEventListener("change", () => updatePoutreAstPreview());
});

poutreAttrsApplyBtn?.addEventListener("click", () => {
  const ids = getSelectedIdsByCategory("poutres");
  if (!ids.length) {
    alert("Aucune poutre sélectionnée dans la liste.");
    return;
  }
  const haLaterales = readPoutreBarsFromInputs();
  const Ast = computeAstFromBars(haLaterales);
  const sectionOverride = {
    enabled: !!poutreSectionOverrideCb?.checked,
    b_cm: poutreSectionB?.value ? Number(poutreSectionB.value) : null,
    h_cm: poutreSectionH?.value ? Number(poutreSectionH.value) : null,
    typeMurKey: poutreTypeMurSelect?.value || "",
    typeStructKey: poutreTypeStructSelect?.value || "",
  };
  const attrs = {
    Ast, // cm² (un côté) dérivé des HA
    haLaterales,
    sectionOverride,
  };
  if (!state.poutresAttributes) state.poutresAttributes = {};
  ids.forEach((id) => {
    state.poutresAttributes[id] = { ...attrs };
  });
  alert(`Paramètres appliqués à ${ids.length} poutre(s).`);
});

function updateAllAttributePanels() {
  updateCharpenteAttributesPanel();
  updateMurAttributesPanel();
  updatePoutreAttributesPanel();
}

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function onElementsFilterChange() {
  renderElementsTables();
}

function bindElementsFilters() {
  filterSearchInput?.removeEventListener("input", onElementsFilterChange);
  filterSearchInput?.addEventListener("input", onElementsFilterChange);
}

async function handleViewerClick3D() {
  if (!state.viewer || state.ifcModelID == null) return;
  // En onglet "Résultats masses" : pas de sélection dans la 3D
  if (currentMainTab === "masses") return;

  let picked = null;
  const selector = state.viewer.IFC?.selector;
  try {
    if (selector && typeof selector.pickIfcItem === "function") {
      picked = await selector.pickIfcItem(true);
    } else if (typeof state.viewer.IFC?.pickIfcItem === "function") {
      picked = await state.viewer.IFC.pickIfcItem(true);
    } else if (typeof state.viewer.IFC?.pick === "function") {
      picked = await state.viewer.IFC.pick(true);
    }
  } catch (_) {
    picked = null;
  }

  const expressID =
    picked && typeof picked === "object"
      ? picked.id ?? picked.expressID ?? picked.expressId
      : null;

  // Supprime la surbrillance interne du viewer (rose/violet) si elle est utilisée
  try {
    if (selector && typeof selector.unpickIfcItems === "function") {
      selector.unpickIfcItems();
    }
  } catch (_) {}

  if (!Number.isFinite(expressID)) return;
  await handleExpressIdSelectionFrom3D(Number(expressID));
}

viewerContainer?.addEventListener("click", () => {
  handleViewerClick3D();
});

// --- CALCUL SISMlQUE SIMPLIFIÉ ---------------------------------------------
// Modèle : méthode statique équivalente TRÈS simplifiée.
// - F_base = (a_g * gamma_I / q) * m_totale
// - Répartition uniforme par niveau
// - Répartition par mur selon la longueur totale de murs dans la direction étudiée.

btnCalcul.addEventListener("click", () => {
  if (!state.ifcLoaded) return;

  const ag = parseFloat(agInput.value || "0");
  const q = parseFloat(qInput.value || "1");
  const gammaI = parseFloat(gammaIInput.value || "1");
  const mTot = 200;
  const nbNiveaux = Math.max(1, state.niveaux.length || 1);
  const dirSeisme = "x"; // direction par défaut pour le prototype

  if (!ag || !q || !mTot) {
    alert(
      "Merci de renseigner au minimum a_g, q et la masse totale pour lancer le calcul."
    );
    return;
  }

  // Effort de base global (en kN si m_tot en tonnes et a_g en m/s² approximée /g)
  const Fbase = (ag * gammaI * mTot) / q;

  // Répartition par niveau (ici uniforme)
  const FparNiveau = [];
  for (let i = 0; i < nbNiveaux; i++) {
    FparNiveau.push({
      niveau: i + 1,
      F: Fbase / nbNiveaux,
    });
  }

  // Répartition par mur dans la direction étudiée
  const mursDansDirection = state.mursPorteurs.filter(
    (m) => m.directionPortance === dirSeisme
  );

  const longueurTotale = mursDansDirection.reduce(
    (acc, m) => acc + (m.longueur || 0),
    0
  );

  const effortsParMur = mursDansDirection.map((m) => {
    const ratio = longueurTotale > 0 ? m.longueur / longueurTotale : 0;
    // On suppose que tous les niveaux ont des murs alignés pour simplifier :
    const Fmur = Fbase * ratio;
    return {
      ...m,
      F_tete: Fmur,
      ratio,
    };
  });

  const { murDallePairs, poutreDallePairs } = computeAdjacencesMurDalle();

  renderResultats({
    ag,
    q,
    gammaI,
    mTot,
    nbNiveaux,
    dirSeisme,
    Fbase,
    FparNiveau,
    effortsParMur,
    murDallePairs,
    poutreDallePairs,
  });
});

function getElementAabb(el) {
  const cx = toNumberMaybe(el.x);
  const cy = toNumberMaybe(el.y);
  const cz = toNumberMaybe(el.z);
  const lx = toNumberMaybe(el.length);
  const hy = toNumberMaybe(el.height);
  const wz = toNumberMaybe(el.width);
  if (cx == null || cy == null || cz == null || lx == null || hy == null || wz == null) return null;
  const halfX = lx / 2;
  const halfY = hy / 2;
  const halfZ = wz / 2;
  return {
    minX: cx - halfX,
    maxX: cx + halfX,
    minY: cy - halfY,
    maxY: cy + halfY,
    minZ: cz - halfZ,
    maxZ: cz + halfZ,
  };
}

function aabbOverlap2DXY(a, b) {
  if (!a || !b) return false;
  // Dans la scène Three.js du viewer, Y est vertical, le plan au sol est XZ.
  // On ajoute une petite tolérance en plan pour rattraper les décalages numériques.
  const eps = 0.05; // 5 cm
  const overlapX = !(a.maxX < b.minX - eps || a.minX > b.maxX + eps);
  const overlapZ = !(a.maxZ < b.minZ - eps || a.minZ > b.maxZ + eps);
  return overlapX && overlapZ;
}

function aabbOverlapVertical(a, b) {
  if (!a || !b) return false;
  const eps = 0.05; // 5 cm de tolérance verticale
  return !(a.maxY < b.minY - eps || a.minY > b.maxY + eps);
}

function computeAdjacencesMurDalle() {
  const murs = state.importedElements.filter((e) => matchesCategory(e, "murs"));
  const dalles = state.importedElements.filter((e) => matchesCategory(e, "charpente"));
  const poutres = state.importedElements.filter((e) => matchesCategory(e, "poutres"));

  const murDallePairs = [];
  const poutreDallePairs = [];

  state.murToSlabs = {};
  state.slabToMurs = {};
  state.poutreToSlabs = {};

  const dallesWithBox = dalles
    .map((slab) => ({ slab, box: getElementAabb(slab) }))
    .filter((x) => x.box);

  murs.forEach((mur) => {
    const boxMur = getElementAabb(mur);
    if (!boxMur) return;
    dallesWithBox.forEach(({ slab, box: boxSlab }) => {
      if (aabbOverlap2DXY(boxMur, boxSlab) && aabbOverlapVertical(boxMur, boxSlab)) {
        murDallePairs.push({ murId: mur.id, dalleId: slab.id });
        if (!state.murToSlabs[mur.id]) state.murToSlabs[mur.id] = [];
        state.murToSlabs[mur.id].push(slab.id);
        if (!state.slabToMurs[slab.id]) state.slabToMurs[slab.id] = [];
        state.slabToMurs[slab.id].push(mur.id);
      }
    });
  });

  poutres.forEach((poutre) => {
    const boxP = getElementAabb(poutre);
    if (!boxP) return;
    dallesWithBox.forEach(({ slab, box: boxSlab }) => {
      if (aabbOverlap2DXY(boxP, boxSlab) && aabbOverlapVertical(boxP, boxSlab)) {
        poutreDallePairs.push({
          poutreId: poutre.id,
          dalleId: slab.id,
        });
        if (!state.poutreToSlabs[poutre.id]) state.poutreToSlabs[poutre.id] = [];
        state.poutreToSlabs[poutre.id].push(slab.id);
      }
    });
  });

  return { murDallePairs, poutreDallePairs };
}

function recomputeSlabSelectionFromWalls() {
  if (!state.murToSlabs && !state.poutreToSlabs) return;
  // Retire toutes les dalles connues de la sélection
  const slabIdsToClear = new Set();
  for (const slabIdStr of Object.keys(state.slabToMurs || {})) {
    slabIdsToClear.add(Number(slabIdStr));
  }
  slabIdsToClear.forEach((sid) => selectedExpressIDs.delete(sid));

  // Ajoute les dalles associées aux murs actuellement sélectionnés
  for (const [murIdStr, slabIds] of Object.entries(state.murToSlabs || {})) {
    const murId = Number(murIdStr);
    if (!selectedExpressIDs.has(murId)) continue;
    const maskForMur = state.associationMask?.murs?.[murId] || null;
    slabIds.forEach((sid) => {
      if (maskForMur && maskForMur instanceof Set && !maskForMur.has(sid)) return;
      selectedExpressIDs.add(sid);
    });
  }

  // Ajoute les dalles associées aux poutres actuellement sélectionnées
  for (const [poutreIdStr, slabIds] of Object.entries(state.poutreToSlabs || {})) {
    const poutreId = Number(poutreIdStr);
    if (!selectedExpressIDs.has(poutreId)) continue;
    const maskForPoutre = state.associationMask?.poutres?.[poutreId] || null;
    slabIds.forEach((sid) => {
      if (maskForPoutre && maskForPoutre instanceof Set && !maskForPoutre.has(sid)) return;
      selectedExpressIDs.add(sid);
    });
  }
}

function renderResumeInitial() {
  resultsDiv.innerHTML = `
    <h3>Modèle IFC chargé (donnée fictive pour l’instant)</h3>
    <p>Nombre de murs porteurs identifiés (placeholder) : <strong>${
      state.mursPorteurs.length
    }</strong></p>
    <p style="margin-top: 0.25rem; font-size: 0.72rem; color: #9ca3af;">
      Le calcul utilisera pour l’instant une répartition uniforme de la masse et
      des efforts. L’étape suivante consistera à remplacer ces données par
      l’extraction réelle depuis l’IFC (longueurs, niveaux, directions porteuses).
    </p>
  `;
}

function renderResultats(data) {
  const {
    ag,
    q,
    gammaI,
    mTot,
    nbNiveaux,
    dirSeisme,
    Fbase,
    FparNiveau,
    effortsParMur,
    murDallePairs = [],
    poutreDallePairs = [],
  } = data;

  const directionLabel =
    dirSeisme === "x" ? "X (longitudinale)" : "Y (transversale)";

  let tableNiveaux = "";
  if (FparNiveau.length) {
    tableNiveaux = `
      <table>
        <thead>
          <tr>
            <th>Niveau</th>
            <th>Effort sismique \(F\) [kN]</th>
          </tr>
        </thead>
        <tbody>
          ${FparNiveau
            .map(
              (niv) => `
            <tr>
              <td>${niv.niveau}</td>
              <td>${niv.F.toFixed(1)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  let tableMurs = "";
  if (effortsParMur.length) {
    tableMurs = `
      <table style="margin-top: 0.7rem;">
        <thead>
          <tr>
            <th>Mur porteur</th>
            <th>Longueur [m]</th>
            <th>Part de rigidité approx.</th>
            <th>Effort en tête \(F_{tête}\) [kN]</th>
          </tr>
        </thead>
        <tbody>
          ${effortsParMur
            .map(
              (m) => `
            <tr>
              <td>${m.nom}</td>
              <td>${m.longueur.toFixed(2)}</td>
              <td>${(m.ratio * 100).toFixed(1)} %</td>
              <td>${m.F_tete.toFixed(1)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  } else {
    tableMurs = `
      <p style="margin-top: 0.4rem; font-size: 0.72rem; color: #f97316;">
        Aucun mur porteur n’est encore défini dans la direction étudiée.
        Dès que l’IFC sera réellement parsé, cette liste sera remplie automatiquement
        (longueurs, niveaux, sens porteur).
      </p>
    `;
  }

  if (resultsDiv) {
    resultsDiv.innerHTML = `
      <h3>Association murs / poutres / dalles</h3>
      <p style="margin-top:0.25rem; font-size:0.75rem; color:#9ca3af;">
        Sélectionne un mur ou une poutre pour visualiser les dalles associées. Utilise les cases à cocher pour
        choisir quelles dalles seront prises en compte lors du calcul final.
      </p>
      <div id="association-list" style="margin-top:0.6rem;"></div>
    `;

    const associationListDiv = document.getElementById("association-list");
    const btnCalculFinal = document.getElementById("btn-calcul-final");
    renderAssociationList(murDallePairs, poutreDallePairs, associationListDiv, btnCalculFinal);
  }

  // Rendre l'onglet "Association" visible après le premier calcul et l'activer
  if (resultsTabBtn) {
    resultsTabBtn.style.display = "";
  }
  if (massesTabBtn) {
    massesTabBtn.style.display = "";
  }
  setActiveMainTab("resultats");
}

function renderAssociationList(murDallePairs, poutreDallePairs, associationListDiv, btnCalculFinal) {
  if (!associationListDiv) return;
  associationListDiv.innerHTML = "";

  const murMap = new Map();
  murDallePairs.forEach(({ murId, dalleId }) => {
    if (!murMap.has(murId)) murMap.set(murId, new Set());
    murMap.get(murId).add(dalleId);
  });

  const poutreMap = new Map();
  poutreDallePairs.forEach(({ poutreId, dalleId }) => {
    if (!poutreMap.has(poutreId)) poutreMap.set(poutreId, new Set());
    poutreMap.get(poutreId).add(dalleId);
  });

  // Initialiser le masque d'association par défaut (toutes les dalles incluses)
  state.associationMask.murs = {};
  state.associationMask.poutres = {};
  state.associationCounters.murs = {};
  state.associationCounters.poutres = {};
  // IMPORTANT: on NE réinitialise PAS les configs (arases/dalles/stacks) ici,
  // afin qu'elles restent cochées quand on navigue entre onglets.
  if (!state.wallAraseConfig || !state.wallAraseConfig.murs) {
    state.wallAraseConfig = { murs: {} };
  }
  if (!state.poutreStackConfig) {
    state.poutreStackConfig = {};
  }

  const ensureWallAraseConfig = (murId, araseCount, slabIds) => {
    if (!state.wallAraseConfig.murs[murId]) {
      state.wallAraseConfig.murs[murId] = [];
    }
    const arr = state.wallAraseConfig.murs[murId];
    for (let i = 0; i < araseCount; i++) {
      if (!arr[i]) {
        arr[i] = { enabled: false, slabs: {}, stackRefs: {} };
      }
      ensureWallStackRefs(arr[i]);
      const slabsCfg = arr[i].slabs;
      slabIds.forEach((sid) => {
        if (!slabsCfg[sid]) {
          slabsCfg[sid] = { enabled: false, stacks: [false, false, false] };
        }
      });
    }
  };

  const recomputeWallMaskFromConfig = (murId) => {
    const cfgArr = state.wallAraseConfig.murs[murId];
    const set = new Set();
    if (cfgArr && Array.isArray(cfgArr)) {
      cfgArr.forEach((cfg) => {
        if (!cfg || !cfg.enabled) return;
        Object.entries(cfg.slabs || {}).forEach(([sidStr, info]) => {
          const sid = Number(sidStr);
          if (!Number.isFinite(sid)) return;
          if (info && info.enabled) set.add(sid);
        });
      });
    }
    state.associationMask.murs[murId] = set;
  };

  const createCarrierBlock = (typeLabel, id, slabSet, category) => {
    const container = document.createElement("div");
    container.className = "assoc-carrier";
    container.dataset.carrierId = String(id);
    container.dataset.category = category;
    container.style.marginBottom = "0.45rem";
    container.style.padding = "0.35rem 0.5rem";
    container.style.borderRadius = "0.45rem";
    container.style.border = "1px solid rgba(148,163,184,0.6)";
    container.style.background = "rgba(15,23,42,0.9)";

    const header = document.createElement("div");
    header.className = "assoc-carrier-header";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "0.35rem";
    header.style.fontSize = "0.78rem";
    header.style.fontWeight = "500";
    header.style.cursor = "pointer";
    header.style.marginBottom = "0.25rem";

    const toggleArrow = document.createElement("span");
    toggleArrow.textContent = "▼";
    toggleArrow.style.display = "inline-block";
    toggleArrow.style.width = "0.8rem";
    toggleArrow.style.textAlign = "center";
    toggleArrow.style.cursor = "pointer";

    const headerLabel = document.createElement("span");
    headerLabel.textContent = `${typeLabel} ${id}`;

    header.appendChild(toggleArrow);
    header.appendChild(headerLabel);
    container.appendChild(header);

    // Contenu rétractable (arases + dalles)
    const content = document.createElement("div");
    content.className = "assoc-carrier-content";
    content.style.display = "block";
    container.appendChild(content);

    // Pour les murs, afficher la liste des arases avec configuration par dalle / stack
    if (category === "mur") {
      const el = state.importedElements.find((e) => e.id === id);
      const arases = el && Array.isArray(el.araseHeights) ? el.araseHeights : null;
      const segHeights =
        el && Array.isArray(el.heightSegments) && el.heightSegments.length > 0
          ? el.heightSegments
          : null;
      const sourceHeights = arases || segHeights;
      const slabIds = Array.from(slabSet);
      const araseCount = sourceHeights ? sourceHeights.length : 0;
      if (el && sourceHeights && araseCount > 0) {
        ensureWallAraseConfig(id, araseCount, slabIds);

        sourceHeights.forEach((h, index) => {
          const cfgArr = state.wallAraseConfig.murs[id];
          const cfg = cfgArr[index];

          const araseBlock = document.createElement("div");
          araseBlock.className = "assoc-arase-block";
          araseBlock.style.borderTop = "1px solid rgba(55,65,81,0.6)";
          araseBlock.style.marginTop = "0.25rem";
          araseBlock.style.paddingTop = "0.25rem";

          const araseHeader = document.createElement("div");
          araseHeader.style.display = "flex";
          araseHeader.style.alignItems = "center";
          araseHeader.style.justifyContent = "space-between";
          araseHeader.style.fontSize = "0.7rem";

          const araseLeft = document.createElement("label");
          araseLeft.style.display = "flex";
          araseLeft.style.alignItems = "center";
          araseLeft.style.gap = "0.35rem";

          const araseCb = document.createElement("input");
          araseCb.type = "checkbox";
          araseCb.checked = !!cfg.enabled;

          const labelPrefix = arases ? "Arase" : "Segment";
          const araseText = document.createElement("span");
          araseText.textContent = `${labelPrefix} ${index + 1} (${formatNum(h)} m)`;

          araseLeft.appendChild(araseCb);
          araseLeft.appendChild(araseText);
          araseHeader.appendChild(araseLeft);

          const stacksInfo = document.createElement("span");
          stacksInfo.textContent = "Stacks 1 / 2 / 3";
          stacksInfo.style.fontSize = "0.65rem";
          stacksInfo.style.color = "#9ca3af";
          araseHeader.appendChild(stacksInfo);

          araseBlock.appendChild(araseHeader);

          // Survol de l'arase : volume jaune approximatif du tronçon de mur correspondant
          araseHeader.addEventListener("mouseenter", () => {
            const prevIndex = state.selectedWallSegments[id];
            state.selectedWallSegments[id] = index;
            const elHover = state.importedElements.find((e) => e.id === id);
            showAraseHoverBox(elHover, index);
            updateSlabLabels();
            state.selectedWallSegments[id] = prevIndex ?? index;
          });
          araseHeader.addEventListener("mouseleave", () => {
            clearHoverHighlight();
            updateSlabLabels();
          });

          const araseBody = document.createElement("div");
          araseBody.style.marginTop = "0.25rem";
          araseBody.style.marginLeft = "1.25rem"; // retrait visuel des dalles vs l’arase
          araseBody.style.display = cfg.enabled ? "block" : "none";

          slabIds.forEach((slabId) => {
            const slabCfg = cfg.slabs[slabId];
            const row = document.createElement("div");
            row.dataset.slabRow = String(slabId);
            row.style.display = "grid";
            row.style.gridTemplateColumns = "minmax(0, 1.2fr) repeat(3, 1.1rem)";
            row.style.alignItems = "center";
            row.style.columnGap = "0.25rem";
            row.style.fontSize = "0.7rem";
            row.style.color = "#e5e7eb";
            row.style.marginBottom = "0.15rem";

            const slabLabel = document.createElement("label");
            slabLabel.style.display = "flex";
            slabLabel.style.alignItems = "center";
            slabLabel.style.gap = "0.3rem";

            const slabCb = document.createElement("input");
            slabCb.type = "checkbox";
            slabCb.checked = !!slabCfg.enabled;

            const slabRowEl = state.importedElements.find((e) => e.id === slabId);
            const sens = state.charpenteAttributes?.[slabId]?.sens || "";
            const rampante = el && slabRowEl && isSlabRampantePourMurPignon(el, slabRowEl, sens);

            const slabText = document.createElement("span");
            slabText.textContent = `Dalle ${slabId}`;
            slabLabel.appendChild(slabCb);
            slabLabel.appendChild(slabText);
            if (rampante) {
              const tag = document.createElement("span");
              tag.textContent = "rampante";
              tag.style.fontSize = "0.62rem";
              tag.style.color = "#a5b4fc";
              tag.style.marginLeft = "0.28rem";
              tag.style.fontStyle = "italic";
              slabLabel.appendChild(tag);
            }
            row.appendChild(slabLabel);

            const stackChecks = [];
            for (let si = 0; si < 3; si++) {
              const scb = document.createElement("input");
              scb.type = "checkbox";
              scb.checked = !!slabCfg.stacks[si];
              scb.title = `Stack ${si + 1}`;
              scb.addEventListener("change", () => {
                slabCfg.stacks[si] = scb.checked;
                renderWallAraseStackRefSection(id, index, cfg, slabIds, araseBody);
              });
              scb.disabled = !slabCb.checked || !cfg.enabled;
              stackChecks.push(scb);
              row.appendChild(scb);
            }

            slabCb.addEventListener("change", () => {
              slabCfg.enabled = slabCb.checked;
              stackChecks.forEach((scb, si) => {
                if (slabCb.checked && !slabCfg.stacks.some(Boolean)) {
                  // Par défaut, coche le stack 1 si aucun n'est encore choisi
                  if (si === 0) {
                    slabCfg.stacks[0] = true;
                    scb.checked = true;
                  }
                }
                scb.disabled = !slabCb.checked || !cfg.enabled;
              });
              recomputeWallMaskFromConfig(id);
              renderWallAraseStackRefSection(id, index, cfg, slabIds, araseBody);
              if (currentMainTab === "resultats") {
                recomputeSlabSelectionFromWalls();
                renderElementsTables();
                updateHighlight();
                updateSlabLabels();
              }
            });

            araseBody.appendChild(row);
          });

          renderWallAraseStackRefSection(id, index, cfg, slabIds, araseBody);

          araseCb.addEventListener("change", () => {
            cfg.enabled = araseCb.checked;
            araseBody.style.display = cfg.enabled ? "block" : "none";
            if (!cfg.enabled) {
              Object.values(cfg.slabs).forEach((slabCfg) => {
                slabCfg.enabled = false;
                slabCfg.stacks = [false, false, false];
              });
              araseBody.querySelectorAll("input[type=\"checkbox\"]").forEach((input) => {
                input.checked = false;
                input.disabled = true;
              });
            } else {
              const slabRows = araseBody.querySelectorAll("div[data-slab-row]");
              slabRows.forEach((row) => {
                const inputs = row.querySelectorAll("input[type=\"checkbox\"]");
                if (!inputs.length) return;
                const slabCb2 = inputs[0];
                slabCb2.checked = true;
                slabCb2.disabled = false;
                inputs.forEach((scb2, idx2) => {
                  if (idx2 === 0) return;
                  const stackIndex2 = idx2 - 1;
                  scb2.disabled = false;
                  if (stackIndex2 === 0) scb2.checked = true;
                });
              });
              Object.values(cfg.slabs).forEach((slabCfg) => {
                slabCfg.enabled = true;
                slabCfg.stacks = [true, false, false];
              });
            }
            recomputeWallMaskFromConfig(id);
            renderWallAraseStackRefSection(id, index, cfg, slabIds, araseBody);
            if (currentMainTab === "resultats") {
              recomputeSlabSelectionFromWalls();
              renderElementsTables();
              updateHighlight();
              updateSlabLabels();
            }
          });

          araseBlock.appendChild(araseBody);
          content.appendChild(araseBlock);
        });
      }
    }

    // Pour les poutres, appliquer un principe similaire de stacks par dalle
    if (category === "poutre") {
      const slabContainer = document.createElement("div");
      slabContainer.className = "assoc-carrier-slabs";
      slabContainer.style.display = "grid";
      slabContainer.style.gridTemplateColumns = "minmax(0, 1fr)";
      slabContainer.style.gap = "0.15rem";

      const ids = Array.from(slabSet);
      if (!state.poutreStackConfig[id]) {
        state.poutreStackConfig[id] = {};
      }
      const cfgBySlab = state.poutreStackConfig[id];
      ids.forEach((slabId) => {
        if (!cfgBySlab[slabId]) {
          cfgBySlab[slabId] = { enabled: true, stacks: [true, false, false] };
        }
      });

      const maskSet = new Set();
      ids.forEach((slabId) => {
        if (cfgBySlab[slabId].enabled) maskSet.add(slabId);
      });
      state.associationMask.poutres[id] = maskSet;
      state.associationCounters.poutres[id] =
        state.associationCounters.poutres[id] || {};

      ids.forEach((slabId) => {
        const slabCfg = cfgBySlab[slabId];
        const label = document.createElement("label");
        label.style.display = "flex";
        label.style.alignItems = "center";
        label.style.gap = "0.3rem";
        label.style.justifyContent = "space-between";
        label.style.fontSize = "0.72rem";
        label.style.color = "#e5e7eb";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!slabCfg.enabled;
        cb.dataset.slabId = String(slabId);
        cb.dataset.carrierId = String(id);
        cb.dataset.category = category;

        const stackWrapper = document.createElement("div");
        stackWrapper.style.display = "flex";
        stackWrapper.style.gap = "0.2rem";
        stackWrapper.style.marginLeft = "0.5rem";

        const stackChecks = [];
        for (let si = 0; si < 3; si++) {
          const scb = document.createElement("input");
          scb.type = "checkbox";
          scb.checked = !!slabCfg.stacks[si];
          scb.title = `Stack ${si + 1}`;
          scb.disabled = !cb.checked;
          scb.addEventListener("change", () => {
            slabCfg.stacks[si] = scb.checked;
          });
          stackChecks.push(scb);
          stackWrapper.appendChild(scb);
        }

        cb.addEventListener("change", () => {
          const sid = Number(cb.dataset.slabId);
          if (!Number.isFinite(sid)) return;
          slabCfg.enabled = cb.checked;
          const set = state.associationMask.poutres[id];
          if (cb.checked) {
            set.add(sid);
            // si aucun stack n'est actif, activer le 1 par défaut
            if (!slabCfg.stacks.some(Boolean)) {
              slabCfg.stacks[0] = true;
              stackChecks[0].checked = true;
            }
          } else {
            set.delete(sid);
          }
          stackChecks.forEach((scb) => {
            scb.disabled = !cb.checked;
          });
          if (currentMainTab === "resultats") {
            recomputeSlabSelectionFromWalls();
            renderElementsTables();
            updateHighlight();
            updateSlabLabels();
          }
        });

        const span = document.createElement("span");
        span.textContent = `Dalle ${slabId}`;
        span.style.flex = "1";
        span.style.marginLeft = "0.3rem";

        label.appendChild(cb);
        label.appendChild(span);
        label.appendChild(stackWrapper);
        slabContainer.appendChild(label);
      });

      content.appendChild(slabContainer);
    }

    // Clic sur l'étiquette texte du header -> sélection dans la 3D, mais pas rétractation
    headerLabel.addEventListener("click", async () => {
      const carrierId = id;
      selectedExpressIDs.clear();
      selectedExpressIDs.add(carrierId);
      if (category === "mur" || category === "poutre") {
        recomputeSlabSelectionFromWalls();
      }
      renderElementsTables();
      await updateHighlight();
      updateSlabLabels();
    });

    // Clic sur la flèche -> rétracte / déploie le contenu sans changer la sélection
    toggleArrow.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (content.style.display === "none") {
        content.style.display = "block";
        toggleArrow.textContent = "▼";
      } else {
        content.style.display = "none";
        toggleArrow.textContent = "▶";
      }
    });

    return container;
  };

  if (!murMap.size && !poutreMap.size) {
    const p = document.createElement("p");
    p.textContent =
      "Aucune interaction mur/dalle ou poutre/dalle détectée avec le critère actuel (chevauchement en plan).";
    p.style.marginTop = "0.4rem";
    p.style.fontSize = "0.72rem";
    p.style.color = "#f97316";
    associationListDiv.appendChild(p);
  } else {
    murMap.forEach((slabSet, murId) => {
      associationListDiv.appendChild(createCarrierBlock("Mur", murId, slabSet, "mur"));
    });
    poutreMap.forEach((slabSet, poutreId) => {
      associationListDiv.appendChild(createCarrierBlock("Poutre", poutreId, slabSet, "poutre"));
    });
  }

  if (btnCalculFinal) {
    btnCalculFinal.disabled = !murMap.size && !poutreMap.size;
  }
}

function updateAssociationPanelHighlight() {
  if (!associationPanel) return;
  if (currentMainTab !== "resultats") {
    associationPanel.classList.remove("has-carrier-selected");
    return;
  }
  let hasCarrier = false;
  for (const id of selectedExpressIDs) {
    const el = state.importedElements.find((e) => e.id === id);
    if (!el) continue;
    if (matchesCategory(el, "murs") || matchesCategory(el, "poutres")) {
      hasCarrier = true;
      break;
    }
  }
  if (hasCarrier) {
    associationPanel.classList.add("has-carrier-selected");
  } else {
    associationPanel.classList.remove("has-carrier-selected");
  }
}

// --- RÉINITIALISATION ------------------------------------------------------

btnReset.addEventListener("click", () => {
  zoneSismiqueSelect.value = "Z3";
  categorieBatimentSelect.value = "II";
  classeSolSelect.value = "A";
  coeffComportementSelect.value = "regulier";
  categorieChargesSelect.value = "A";
  altimetrieSelect.value = "<1000";

  updateSeismicFactorsFromSelectors();

  state.ifcLoaded = false;
  state.loadedModel = null;
  state.modelOffsetY = 0;
  state.mursPorteurs = [];
  state.niveaux = [];
  state.importedElements = [];
  btnCalcul.disabled = true;

  if (elementsPanel) elementsPanel.style.display = "none";
  // retire surbrillance si présente
  try {
    clearHighlight();
  } catch (_) {}
  selectedExpressIDs.clear();
  if (selectionMaterial) {
    try { selectionMaterial.dispose(); } catch (_) {}
    selectionMaterial = null;
  }
  clearAllSlabLabels();
  if (filterSearchInput) filterSearchInput.value = "";

  fileInput.value = "";
  updateTagEtEtat("IFC non chargé", "ko");
  if (viewerOverlay) {
    const span = viewerOverlay.querySelector("span");
    if (span) {
      span.textContent =
        "Sélectionne un fichier IFC pour initialiser la vue 3D et les calculs.";
    }
    viewerOverlay.style.display = "";
  }
  renderResultatsInitial();
  updateAssociationPanelHighlight();
});

function renderResultatsInitial() {
  resultsDiv.innerHTML = `
    <h3>En attente de modèle IFC…</h3>
    <p>
      Une fois l’IFC chargé, cette zone affichera :
    </p>
    <ul style="margin: 0.35rem 0 0.1rem; padding-left: 1.1rem; font-size: 0.72rem; color: #9ca3af;">
      <li>l’effort sismique global \(F_{base}\)</li>
      <li>la répartition simplifiée par niveau</li>
      <li>un tableau d’efforts en tête de mur (par mur porteur identifié)</li>
    </ul>
    <p style="margin-top: 0.35rem; font-size: 0.7rem; color: #6b7280;">
      Pour l’instant, la répartition se fait avec un modèle très simplifié
      (masse globale + répartition uniforme). On pourra ensuite brancher
      l’extraction réelle des longueurs de murs et des directions porteuses
      à partir de l’IFC, ainsi qu’une méthode sismique conforme à l’Eurocode 8
      ou à la réglementation locale.
    </p>
  `;
}

// Affichage initial au chargement de la page
renderResultatsInitial();

