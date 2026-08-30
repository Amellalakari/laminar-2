import React, { useState, useMemo, useRef, useEffect } from "react";

/* ============================================================
   LAMINAR — organ-chip fault finder
   Deterministic hydrodynamics + rule engine + grounded chat.
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.lam { --ground:#E9EBE4; --paper:#FDFDFB; --ink:#12191C; --ink2:#5A6668;
  --line:#CBD0C4; --line2:#E2E5DC; --flow:#17595F; --dye:#A32A5E;
  --alert:#A8322A; --warn:#9C6B0B; --ok:#2E6B4F;
  background:var(--ground); color:var(--ink); min-height:100vh;
  font-family:'IBM Plex Sans',system-ui,sans-serif; -webkit-font-smoothing:antialiased; }
.lam *{box-sizing:border-box}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.disp{font-family:'Space Grotesk','IBM Plex Sans',sans-serif;letter-spacing:-0.02em}
.eyebrow{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink2)}
.card{background:var(--paper);border:1px solid var(--line);border-radius:2px}
.lam input,.lam select,.lam textarea{width:100%;background:var(--paper);border:1px solid var(--line);
  border-radius:2px;padding:7px 9px;font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--ink);outline:none}
.lam input:focus,.lam select:focus,.lam textarea:focus{border-color:var(--flow);box-shadow:0 0 0 2px rgba(23,89,95,.15)}
.lam label{display:block;font-size:11.5px;letter-spacing:0;color:var(--ink);margin-bottom:5px;
  font-family:'IBM Plex Sans',sans-serif;font-weight:500}
.lam label .unit{font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:400;color:var(--ink2)}
.lam label .hint{display:block;font-family:'IBM Plex Sans',sans-serif;font-size:10.5px;
  font-weight:400;color:var(--ink2);margin-top:2px;line-height:1.35}
.btn{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.06em;text-transform:uppercase;
  border:1px solid var(--ink);background:var(--ink);color:var(--ground);padding:9px 14px;border-radius:2px;cursor:pointer}
.btn:hover{background:var(--flow);border-color:var(--flow)}
.btn.ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.btn.ghost:hover{background:var(--paper);color:var(--flow);border-color:var(--flow)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.lam :focus-visible{outline:2px solid var(--flow);outline-offset:2px}
.rule{height:1px;background:var(--line2);border:0;margin:0}
.tag{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;padding:3px 7px;border-radius:2px;border:1px solid currentColor}
.scroll::-webkit-scrollbar{width:8px}
.scroll::-webkit-scrollbar-thumb{background:var(--line);border-radius:4px}
.minibtn{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;
  border:1px solid var(--line);background:transparent;color:var(--ink2);padding:4px 8px;border-radius:2px;cursor:pointer}
.minibtn:hover{border-color:var(--flow);color:var(--flow)}
.minibtn[data-on="yes"]{background:var(--ok);border-color:var(--ok);color:var(--paper)}
.minibtn[data-on="no"]{background:var(--ink2);border-color:var(--ink2);color:var(--paper)}
.lam table{width:100%;border-collapse:collapse;font-size:12px}
.lam th{text-align:left;font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink2);font-weight:500;padding:6px 8px 6px 0;border-bottom:1px solid var(--line)}
.lam td{padding:7px 8px 7px 0;border-bottom:1px solid var(--line2);vertical-align:top}
@media (max-width:820px){.grid-wrap{grid-template-columns:1fr !important}}
.printonly{display:none}
@media print{
  .lam{background:#fff;color:#000}
  .noprint{display:none !important}
  .printonly{display:block !important}
  .grid-wrap{grid-template-columns:1fr !important}
  .card{border:1px solid #999;break-inside:avoid;page-break-inside:avoid;margin-bottom:10px}
  .lam pre{white-space:pre-wrap;font-size:10px;line-height:1.45}
  a[href]:after{content:""}
}
`;

/* ---------- reference data ---------- */

const CELLS = {
  huvec:   { n: "Endothelial — vascular (HUVEC/HAEC)", deform: 1.5, d: 15, rho: 1060, lo: 5,    hi: 20,  acute: 60, seedH: 2,  coat: "0.1% gelatin, or fibronectin 10–50 µg/mL, 1 h 37 °C" },
  lec:     { n: "Endothelial — lymphatic / microvascular", deform: 1.5, d: 14, rho: 1060, lo: 0.5, hi: 5,  acute: 20, seedH: 2,  coat: "fibronectin 20 µg/mL + collagen I" },
  caco2:   { n: "Gut epithelium (Caco-2 / organoid-derived)", deform: 1.3, d: 18, rho: 1060, lo: 0.01, hi: 0.2, acute: 2, seedH: 4, coat: "collagen I 50 µg/mL + Matrigel 1–3%" },
  alveolar:{ n: "Alveolar epithelium (A549 / primary AEC)", deform: 1.3, d: 15, rho: 1060, lo: 0.02, hi: 0.5, acute: 3, seedH: 4, coat: "collagen IV + fibronectin, or 5% Matrigel" },
  ptec:    { n: "Kidney proximal tubule (RPTEC/HK-2)", deform: 1.3, d: 16, rho: 1060, lo: 0.2, hi: 1.0, acute: 5, seedH: 4, coat: "collagen IV 30 µg/mL" },
  hepato:  { n: "Hepatocyte / HepG2", deform: 1.2, d: 20, rho: 1070, lo: 0.01, hi: 0.5, acute: 2, seedH: 4, coat: "collagen I sandwich, or Matrigel" },
  ipsccm:  { n: "Cardiomyocyte (iPSC-CM)", deform: 1.2, d: 20, rho: 1060, lo: 0.05, hi: 0.5, acute: 2, seedH: 6, coat: "Matrigel / laminin-521" },
  neuron:  { n: "Neuron / NPC", deform: 1.6, d: 12, rho: 1050, lo: 0.005, hi: 0.1, acute: 0.5, seedH: 12, coat: "PLO + laminin, overnight" },
  msc:     { n: "MSC / fibroblast", deform: 2.0, d: 18, rho: 1060, lo: 0.5, hi: 5, acute: 20, seedH: 2, coat: "none needed on TCP; fibronectin on PDMS" },
  tumor:   { n: "Tumour line (generic adherent)", deform: 1.6, d: 17, rho: 1060, lo: 0.1, hi: 2, acute: 10, seedH: 3, coat: "fibronectin or collagen I" },
  rbc:     { n: "Red blood cell / whole blood", deform: 8.0, d: 8, rho: 1100, lo: 1, hi: 40, acute: 150, seedH: 0, coat: "BSA 1% passivation" },
};

const MATERIALS = {
  pdms:  { n: "PDMS", o2: true,  absorbs: true,  evap: true,  bond: "plasma–glass, ~2–5 bar" },
  cocp:  { n: "COC / COP", o2: false, absorbs: false, evap: false, bond: "thermal / solvent, high" },
  pmma:  { n: "PMMA", o2: false, absorbs: false, evap: false, bond: "solvent / laser weld" },
  glass: { n: "Glass", o2: false, absorbs: false, evap: false, bond: "anodic / adhesive, very high" },
  tape:  { n: "Thermoplastic + adhesive tape", o2: false, absorbs: true, evap: false, bond: "PSA, ~0.5–1 bar" },
};

const MEMBRANES = {
  pet:  { n: "PET track-etched", note: "stiff, autofluorescent at 488, poor optical clarity" },
  pc:   { n: "Polycarbonate track-etched", note: "opaque, worst for imaging, cheap and reliable" },
  pdmsm:{ n: "PDMS, lithographically porous", note: "compliant, stretchable, gas permeable" },
  pcl:  { n: "Electrospun PCL / PLGA", note: "fibrous, no defined pore size — use fibre spacing" },
};

const DRIVES = {
  syringe:    "Syringe pump (push)",
  withdraw:   "Syringe pump (withdraw)",
  pressure:   "Pressure controller",
  peristaltic:"Peristaltic pump",
  gravity:    "Gravity / hydrostatic head",
  rocker:     "Rocker / tilting platform",
};



/* ---------- reference cases ----------
   Defined once. The Validation tab computes these live and the test suite
   imports this same array, so the published table can never drift away from
   what the code actually does.                                             */

const REFERENCE_CASES = [
  {
    id: "ibidi-vi04",
    device: "ibidi µ-Slide VI 0.4",
    source: "Manufacturer constant: τ = η × 176.1 × Φ",
    inputs: { w: 3800, h: 400, L: 17, Q: 1000, fluid: "custom", mu: 0.72 },
    field: "tau", expected: 1.268, unit: "dyn/cm²", tolPct: 1,
    note: "Tests the (1 − 0.63 h/w) correction; omitting it gives 1.18.",
  },
  {
    id: "ibidi-i08",
    device: "ibidi µ-Slide I 0.8 Luer",
    source: "Manufacturer constant: τ = η × 34.7 × Φ",
    inputs: { w: 5000, h: 800, L: 50, Q: 1000, fluid: "custom", mu: 0.72 },
    field: "tau", expected: 0.2498, unit: "dyn/cm²", tolPct: 1.5,
  },
  {
    id: "gut-chip",
    device: "Gut-on-a-chip (Kim & Ingber, Lab Chip 2012)",
    source: "Paper states 0.02 dyn/cm² at 30 µL/h",
    inputs: { w: 1000, h: 150, L: 20, Q: 0.5, fluid: "custom", mu: 0.78, cellType: "caco2" },
    field: "tau", expected: 0.02, unit: "dyn/cm²", tolPct: 10,
    note: "Viscosity is not stated in the paper; 0.815 mPa·s lands exactly on their figure.",
  },
  {
    id: "blood-100um",
    device: "Whole blood in a 100 µm channel, Hct 45 %",
    source: "Pries et al. 1992 in vitro relation",
    inputs: { w: 100, h: 100, L: 10, Q: 1, fluid: "blood", hct: 45 },
    field: "muMPas", expected: 2.93, unit: "mPa·s", tolPct: 6,
    note: "Apparent viscosity, not plasma viscosity.",
  },
  {
    id: "blood-fl",
    device: "Fåhræus–Lindqvist minimum, ~10 µm channel",
    source: "Pries et al. 1992 — apparent viscosity falls in small bores",
    inputs: { w: 10, h: 10, L: 1, Q: 0.01, fluid: "blood", hct: 45 },
    field: "muMPas", expected: 1.59, unit: "mPa·s", tolPct: 8,
    note: "Below ~300 µm blood thins; a fixed 3.5 mPa·s would be 120 % out here.",
  },
];

/* ---------- fluids ----------
   Whole blood is not a fixed viscosity. Below roughly 300 µm the apparent
   viscosity falls with the channel dimension (Fåhræus–Lindqvist), so the
   number depends on the geometry you are in. Pries et al. (1992) in vitro
   relation, evaluated at the hydraulic diameter.                          */

const PLASMA_MPAS = 1.2;          // 37 °C

function priesRelative(Dum, H) {
  const D = Math.max(Dum, 3.3);   // correlation is not meant below ~3 µm
  const e45 = 220 * Math.exp(-1.3 * D) + 3.2 - 2.44 * Math.exp(-0.06 * Math.pow(D, 0.645));
  const g = 1 / (1 + 1e-11 * Math.pow(D, 12));
  const C = (0.8 + Math.exp(-0.075 * D)) * (-1 + g) + g;
  return 1 + (e45 - 1) * (Math.pow(1 - H, C) - 1) / (Math.pow(1 - 0.45, C) - 1);
}

const FLUIDS = {
  custom: { n: "Custom — enter viscosity" },
  media:  { n: "Culture medium (37 °C)", mu: 0.78 },
  water:  { n: "Water (37 °C)", mu: 0.69 },
  pbs:    { n: "PBS / buffer (37 °C)", mu: 0.72 },
  blood:  { n: "Whole blood", mu: null },
};

/* Diffusivities at 37 °C in aqueous medium, m²/s. A Péclet number without a
   named species is meaningless — oxygen and IgG differ seventyfold.        */
const SPECIES = {
  o2:      { n: "Oxygen", D: 3.0e-9 },
  glucose: { n: "Glucose", D: 6.7e-10 },
  dex10:   { n: "10 kDa dextran", D: 1.2e-10 },
  albumin: { n: "Albumin, 66 kDa", D: 6.1e-11 },
  igg:     { n: "IgG, 150 kDa", D: 4.0e-11 },
};

/* Residence time distribution for fully developed laminar flow.
   Parallel plates: the fastest streamline leaves at 2/3 of the mean
   residence time and the slowest never quite arrives. F is the fraction of
   VOLUMETRIC FLOW that has left by time t.                                 */
function rtdQuantile(tMean, frac, round) {
  if (round) return tMean / (2 * Math.sqrt(1 - frac));      // circular, exact
  const tMin = (2 / 3) * tMean;
  const F = (t) => {
    if (t <= tMin) return 0;
    const y = Math.sqrt(Math.max(0, 1 - (2 * tMean) / (3 * t)));
    return 1.5 * (y - (y * y * y) / 3);
  };
  let lo = tMin, hi = tMean * 500;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    F(mid) < frac ? (lo = mid) : (hi = mid);
  }
  return (lo + hi) / 2;
}

/* ---------- physics ---------- */

const PA_TO_DYN = 10;      // 1 Pa = 10 dyn/cm²
const G = 9.81;
const RHO_M = 1000;
const GAMMA = 0.045;       // N/m, serum-containing medium
const D_GAS = 0.0035;      // mL air released per mL medium, 22 → 37 °C

function compute(i) {
  const cell = CELLS[i.cellType];
  const mat = MATERIALS[i.material];
  const twoCh = i.format === "membrane";
  const act = twoCh && i.probChan === "bot" ? "b" : "t";
  const w = (act === "b" ? i.w2 : i.w) / 1e6;
  const h = (act === "b" ? i.h2 : i.h) / 1e6;
  const L = i.L / 1e3;                                  // m
  const Qact = act === "b" ? i.Q2 : i.Q;
  const nCh = Math.max(i.nChannels || 1, 1);            // identical channels in parallel
  /* Bifurcation tree: each generation doubles the branch count and halves the
     flow. Whether shear survives that depends entirely on how width scales —
     halving the width each split holds shear constant, keeping it constant
     halves shear per generation.                                             */
  const gen = Math.max(i.treeGen || 0, 0);
  const nTerm = Math.pow(2, gen);
  const wRatio = i.taper === "shear" ? 0.5 : i.taper === "custom" ? Math.max(i.taperR || 0.7, 0.05) : 1;
  const Qtot = (Qact * 1e-9) / 60;                      // m³/s, entered by the user
  const Q = Qtot / (nCh * nTerm);                       // per terminal branch
  // viscosity depends on the fluid, and for blood on the channel itself
  const DhGuess = (2 * w * h) / (w + h) * 1e6;          // µm, for the blood law
  const hct = Math.min(Math.max(i.hct ?? 45, 0), 75) / 100;
  const muMPas = i.fluid === "blood"
    ? PLASMA_MPAS * priesRelative(DhGuess, hct)
    : (FLUIDS[i.fluid] && FLUIDS[i.fluid].mu) || i.mu;
  const mu = muMPas / 1000;                             // Pa·s

  /* ---- cross-section shape ----
     Rectangular is exact. A trapezoid (isotropic wet etch, laser ablation) is
     reduced to an equal-area rectangle of the same height — good to a few
     percent while the side walls are not too steep. Circular is exact.       */
  const circular = i.xsec === "circular";
  const trap = i.xsec === "trapezoid";
  const R0 = (i.dia || 0) / 2 / 1e6;
  const wTop = (i.wTop || i.w) / 1e6;
  const wRaw = trap ? (w + wTop) / 2 : w;               // equal-area width at generation 0
  const wEq = wRaw * Math.pow(wRatio, gen);            // width of a terminal branch
  const b = Math.max(wEq, h), a = Math.min(wEq, h);     // b = wide, a = short
  const corr = 1 / (1 - 0.63 * (a / b));

  const A = circular ? Math.PI * R0 * R0 : wEq * h;
  const U = A > 0 ? Q / A : 0;
  const Dh = circular ? 2 * R0 : (2 * wEq * h) / (wEq + h);
  const Re = (RHO_M * U * Dh) / mu;

  /* ---- path shape ----
     Serpentine adds arc length and curvature. The Dean number says whether
     the bends matter: below ~10 the secondary flow is negligible and the
     straight-channel result stands; above that the outer wall runs hotter
     than the number this app reports.                                        */
  const serp = i.path === "serpentine";
  const grooved = i.path === "herringbone";
  const nBend = serp ? Math.max(i.bends, 0) : 0;
  const Rc = Math.max((i.bendR || 500) / 1e6, 1e-9);
  const Lpath = L + nBend * ((Math.PI * Rc) / 2);       // quarter-turn arc per bend
  const De = serp ? Re * Math.sqrt(Dh / (2 * Rc)) : 0;

  const tauPa = circular
    ? (4 * mu * Q) / (Math.PI * Math.pow(R0, 3))
    : ((6 * mu * Q) / (b * a * a)) * corr;
  const tau = tauPa * PA_TO_DYN;                        // dyn/cm²
  const dPchip = circular
    ? (128 * mu * Lpath * Q) / (Math.PI * Math.pow(2 * R0, 4))
    : ((12 * mu * Lpath * Q) / (b * Math.pow(a, 3))) * corr;

  /* Herringbone grooves: the ridge between grooves runs shallower than the
     nominal channel and the groove floor much deeper, so wall shear spans a
     band rather than sitting at one value. Order-of-magnitude only.          */
  const gD = grooved ? i.grooveD / 1e6 : 0;
  const tauRidge = grooved ? tau * Math.pow(h / Math.max(h - gD * 0.35, h * 0.4), 2) : tau;
  const tauGroove = grooved ? tau * Math.pow(h / (h + gD), 2) : tau;
  const uniformShear = !grooved && De < 10;

  const Dt = i.tubID / 1000;                            // m
  const Lt = i.tubL / 100;                              // m
  const At = (Math.PI * Dt * Dt) / 4;
  const Ut = At > 0 ? Q / At : 0;
  const dPtube = (128 * mu * Lt * Q) / (Math.PI * Math.pow(Dt, 4));
  const tTransit = Ut > 0 ? Lt / Ut : Infinity;         // s

  const dCell = (i.cellD || cell.d) / 1e6;
  const dRho = Math.max(cell.rho - RHO_M, 1);
  const vSed = (dCell * dCell * dRho * G) / (18 * mu);  // m/s
  const tSedTube = Dt / 2 / vSed;
  const tSedChan = h / vSed;
  const xSettle = U * tSedChan;                         // m — how far a ceiling cell travels before landing
  const settleFrac = Math.min(tTransit / tSedTube, 1);

  const Vch = A * L;                                    // m³
  const tRes = Q > 0 ? Vch / Q : Infinity;
  const exch = (Q * 3600) / Vch;                        // channel volumes per hour
  const floorCm2 = (circular ? Math.PI * 2 * R0 : wEq) * L * 1e4;
  const seedN = i.seedDens * floorCm2;                  // cells needed
  const seedConc = Vch > 0 ? seedN / (Vch * 1e6) : 0;   // cells per mL (1 m³ = 1e6 mL)

  const dPcap = circular ? (4 * GAMMA) / (2 * R0) : 2 * GAMMA * (1 / w + 1 / h);  // Pa, bubble pinning
  const head = (i.headMM / 1000) * RHO_M * G;           // Pa
  const drivenBy = i.drive === "gravity" || i.drive === "rocker";
  const dPavail = drivenBy ? head : Infinity;
  const gasRate = D_GAS * Q * 1e9 * 3600;               // µL gas / hour if RT-saturated

  const genRows = [];
  for (let g = 0; g <= gen; g++) {
    const wg = wRaw * Math.pow(wRatio, g);
    const qg = Qtot / (nCh * Math.pow(2, g));
    const bg = Math.max(wg, h), ag = Math.min(wg, h);
    genRows.push({
      g, n: Math.pow(2, g), w: wg * 1e6, q: qg * 6e10,
      tau: ((6 * mu * qg) / (bg * ag * ag)) / (1 - 0.63 * (ag / bg)) * PA_TO_DYN,
    });
  }

  /* ---- dimensionless groups and exposure spread ---- */
  const spec = SPECIES[i.species] || SPECIES.o2;
  const Pe = (U * h) / spec.D;                          // transverse: across the channel
  const tDiff = (h * h) / (2 * spec.D);                 // time to diffuse the gap
  const pulsatile = i.drive === "peristaltic";
  const omega = 2 * Math.PI * Math.max(i.pulseHz || 1, 0.01);
  const womersley = pulsatile ? (h / 2) * Math.sqrt((omega * RHO_M) / mu) : 0;

  const tMeanRes = Q > 0 ? (wEq * h * L) / Q : Infinity;
  const t10 = rtdQuantile(tMeanRes, 0.1, circular);
  const t50 = rtdQuantile(tMeanRes, 0.5, circular);
  const t90 = rtdQuantile(tMeanRes, 0.9, circular);

  /* ---- inverse: flow rate that would hit a target wall shear ---- */
  const tgt = Math.max(i.targetTau || 0, 0);
  const Qtarget = circular
    ? (tgt / PA_TO_DYN) * Math.PI * Math.pow(R0, 3) / (4 * mu)
    : (tgt / PA_TO_DYN) * (b * a * a) / (6 * mu * corr);
  const QtargetUL = Qtarget * 6e10 * nCh * nTerm;       // back to total, µL/min

  const Le = 0.05 * Re * Dh;                            // entrance length, m
  const uCellTop = 6 * U * (dCell / h) * (1 - dCell / h);

  /* ---- constrictions: slits, pillar gaps, necks ----
     A slit is short and narrow, so entrance and exit losses are comparable to
     or larger than the Poiseuille term inside it. Both are included: the
     viscous term for the bore, plus a Sampson entrance correction using the
     equivalent radius of the aperture. Everything here is per channel.       */
  const featOn = i.feature !== "none";
  const nF = Math.max(i.featN || 1, 1);
  const wS = (i.featW || 1) / 1e6, hS = (i.featH || 1) / 1e6, lS = (i.featL || 1) / 1e6;
  const bS = Math.max(wS, hS), aS = Math.min(wS, hS);
  const Rvisc = (12 * mu * lS) / (bS * Math.pow(aS, 3) * (1 - 0.63 * (aS / bS)));
  const rEq = Math.sqrt((wS * hS) / Math.PI);           // equal-area circular aperture
  const Rent = (3 * mu) / Math.pow(rEq, 3);             // Sampson, entrance + exit
  const Rfeat = Rvisc + Rent;
  const Rarray = Rfeat / nF;                            // features sit in parallel
  const dPfeat = featOn ? Q * Rarray : 0;
  const Qfeat = Q / nF;
  const Ufeat = wS * hS > 0 ? Qfeat / (wS * hS) : 0;
  const tauFeat = featOn
    ? ((6 * mu * Qfeat) / (bS * aS * aS)) / (1 - 0.63 * (aS / bS)) * PA_TO_DYN
    : 0;
  const tFeat = Ufeat > 0 ? lS / Ufeat : 0;             // residence inside the aperture
  const strainRate = lS > 0 ? Ufeat / lS : 0;           // elongational, entering the slit
  const squeeze = dCell * 1e6 / Math.min(i.featW || 1, i.featH || 1);
  const featShare = featOn && dPchip + dPfeat > 0 ? dPfeat / (dPchip + dPfeat) : 0;

  /* Fabrication tolerance across parallel channels. Resistance goes as 1/h³,
     so a small height spread becomes a large flow spread.                    */
  const tol = (i.chTol || 0) / 100;
  const flowSpread = nCh > 1 ? (Math.pow(1 + tol, 3) - Math.pow(1 - tol, 3)) / 2 : 0;

  /* ---- two-channel + porous membrane ---- */
  // hydraulic resistance per unit length of a rectangular duct
  const Rper = (ww, hh) => {
    const B = Math.max(ww, hh), s = Math.min(ww, hh);
    return (12 * mu) / (B * Math.pow(s, 3) * (1 - 0.63 * (s / B)));
  };
  const tauOf = (ww, hh, QQ) => {
    const B = Math.max(ww, hh), s = Math.min(ww, hh);
    return ((6 * mu * QQ) / (B * s * s)) / (1 - 0.63 * (s / B)) * PA_TO_DYN;
  };
  const wT = i.w / 1e6, hT = i.h / 1e6, wB = i.w2 / 1e6, hB = i.h2 / 1e6;
  const QT = (i.Q * 1e-9) / 60, QB = (i.Q2 * 1e-9) / 60;
  const RT = Rper(wT, hT) * L, RB = Rper(wB, hB) * L;
  const dPT = RT * QT, dPB = RB * QB;
  const tauT = tauOf(wT, hT, QT), tauB = tauOf(wB, hB, QB);
  const counter = i.flowDir === "counter";
  // outlets at atmosphere; co-flow both exit at x=L, counter-flow bottom exits at x=0
  const tmpIn = counter ? dPT : dPT - dPB;              // apical minus basal at the top inlet
  const tmpOut = counter ? -dPB : 0;                    // at the top outlet
  const tmpMean = (Math.abs(tmpIn) + Math.abs(tmpOut)) / 2;
  const tmpMax = Math.max(Math.abs(tmpIn), Math.abs(tmpOut));
  const headOffset = (i.outletOffsetMM / 1000) * RHO_M * G;  // hydrostatic offset between outlets

  const rP = i.poreD / 2 / 1e6, tMem = i.memT / 1e6, eps = i.poreEps / 100;
  const Rpore = (8 * mu * tMem) / (Math.PI * Math.pow(rP, 4)) + (3 * mu) / Math.pow(rP, 3);
  const nPore = eps / (Math.PI * rP * rP);              // pores per m²
  const Lp = nPore / Rpore;                             // m/s per Pa
  const Amem = Math.max(wT, wB) * L;
  const Rmem = 1 / (Lp * Amem);
  const memRatio = Rmem / RT;                           // <1 → membrane is the easier path
  const Jleak = Lp * (tmpMean + headOffset);            // m/s
  const Qleak = Jleak * Amem;
  const leakFrac = QT > 0 ? Qleak / QT : 0;
  const vPore = eps > 0 ? Jleak / eps : 0;
  const poreVsCell = i.poreD / (dCell * 1e6);
  const openFrac = eps;

  return {
    twoCh, act, wT, hT, wB, hB, QT, QB, RT, RB, dPT, dPB, tauT, tauB, counter,
    tmpIn, tmpOut, tmpMean, tmpMax, headOffset, Lp, Rmem, memRatio, nPore,
    Jleak, Qleak, leakFrac, vPore, poreVsCell, openFrac, Amem,
    cell, mat, w, h, L, Q, mu, A, U, Dh, Re, tau, tauPa, dPchip, dPtube,
    Dt, Lt, Ut, tTransit, vSed, tSedTube, tSedChan, xSettle, settleFrac,
    Vch, tRes, exch, floorCm2, seedN, seedConc, dPcap, head, dPavail, gasRate,
    Le, uCellTop, dCell, ar: b / a, muMPas, hct, spec, Pe, tDiff, pulsatile,
    womersley, t10, t50, t90, Qtarget, QtargetUL,
    circular, trap, serp, grooved, wEq, R0, Lpath, De, nBend, Rc,
    nCh, Qtot, gen, nTerm, wRatio, genRows, wRaw, featOn, nF, wS, hS, lS, Rfeat, Rarray, dPfeat, Qfeat, Ufeat,
    tauFeat, tFeat, strainRate, squeeze, featShare, flowSpread, tol,
    tauRidge, tauGroove, uniformShear, gD,
  };
}

/* ---------- formatting ---------- */

const sig = (x, n = 3) => {
  if (!isFinite(x)) return "∞";
  if (x === 0) return "0";
  const ax = Math.abs(x);
  if (ax >= 1e5 || ax < 1e-3) return x.toExponential(1).replace("e", "e");
  return Number(x.toPrecision(n)).toString();
};
const dur = (s) => {
  if (!isFinite(s)) return "∞";
  if (s < 1) return `${sig(s * 1000)} ms`;
  if (s < 90) return `${sig(s)} s`;
  if (s < 5400) return `${sig(s / 60)} min`;
  return `${sig(s / 3600)} h`;
};
const mbar = (pa) => `${sig(pa / 100)} mbar`;

/* ---------- rule engine ---------- */

const L_LIKELY = "likely", L_MAYBE = "possible", L_NO = "unlikely";

const SYMPTOMS = [
  {
    id: "bubbles",
    label: "Bubbles in the channel",
    causes: [
      {
        t: "Dissolved gas coming out of solution on warming",
        check: (m, i) => ({
          lvl: i.preWarm ? L_MAYBE : L_LIKELY,
          why: `Medium saturated at room temperature releases ~0.35 % of its volume as gas when it reaches 37 °C. At ${i.Q} µL/min that is about ${sig(m.gasRate)} µL of gas per hour arriving in a ${sig(m.Vch * 1e9)} µL channel — ${sig(m.gasRate / (m.Vch * 1e9), 2)} channel volumes of air per hour.${i.preWarm ? " You already pre-warm, so this should be partly handled — check that the syringe and tubing are warm too, not just the reservoir." : ""}`,
        }),
        fix: [
          "Degas medium: vacuum in a filter flask 20–30 min, or leave loosely capped in the incubator overnight, then keep it at 37 °C.",
          "Bring the whole fluidic path to 37 °C before connecting — syringe body included. A cold syringe feeding a warm chip is a gas generator.",
          "Put an in-line bubble trap or a short PDMS degassing membrane segment upstream of the chip.",
          "If the chip is PDMS, dead-end prime: block the outlet and let trapped air escape through the bulk.",
        ],
      },
      {
        t: "Bubble is pinned — driving pressure below capillary pressure",
        check: (m, i) => {
          const cap = m.dPcap;
          if (m.dPavail === Infinity)
            return { lvl: L_MAYBE, why: `A bubble spanning ${sig(i.w)}×${sig(i.h)} µm needs ${mbar(cap)} to be pushed out. A syringe/pressure pump can deliver that, so a stuck bubble usually means it has parked in a dead volume or expansion where the local capillary pressure is higher, not in the main channel.` };
          const stuck = m.dPavail < cap;
          return {
            lvl: stuck ? L_LIKELY : L_MAYBE,
            why: `Capillary pressure holding a bubble in a ${sig(i.w)}×${sig(i.h)} µm channel is ${mbar(cap)}. Your ${DRIVES[i.drive].toLowerCase()} delivers ${mbar(m.dPavail)} of head. ${stuck ? "That is not enough to move it — the bubble is mechanically stuck and no amount of waiting will clear it." : "You have enough head, so look at dead volumes and connectors instead."}`,
          };
        },
        fix: [
          "Prime at 10–50× the working flow rate to blow bubbles through, then step down to setpoint.",
          "For gravity/rocker systems, raise the reservoir height or reduce the smallest channel dimension penalty — capillary pressure scales as 1/h, so shallow channels are the worst.",
          "Make every connection wet-to-wet: leave a standing droplet on the port and on the tubing end before mating.",
          "Add a surfactant-free hydrophilic treatment (plasma + immediate wetting, or Pluronic F-127 1 % for 30 min) so the bubble does not anchor to a dry PDMS wall.",
        ],
      },
      {
        t: "Air drawn in on the suction side",
        check: (m, i) => ({
          lvl: i.drive === "withdraw" || i.drive === "peristaltic" ? L_LIKELY : L_NO,
          why: i.drive === "withdraw" || i.drive === "peristaltic"
            ? "Anything upstream of the pump sits below atmospheric pressure. Silicone tubing is gas permeable and luer joints leak air inward long before they leak liquid outward."
            : "You are pushing, so the fluidic path is above atmospheric pressure and air ingress through joints is not the mechanism.",
        }),
        fix: [
          "Switch to push mode if the experiment allows it.",
          "Use PTFE or FEP on any segment under suction; keep silicone only for peristaltic head sections.",
          "Barb + shrink or ferrule fittings rather than push-fit luers on suction lines.",
        ],
      },
      {
        t: "Geometry traps air at expansions and corners",
        check: (m) => ({
          lvl: m.ar > 12 ? L_LIKELY : L_MAYBE,
          why: `Aspect ratio is ${sig(m.ar, 2)}:1. Wide shallow chambers pin bubbles at the corners because the meniscus can sit in the corner at lower energy than in the bulk. Abrupt inlet expansions and any 90° step do the same.`,
        }),
        fix: [
          "Taper inlet expansions over at least 5× the channel width instead of stepping out abruptly.",
          "Round internal corners; a 100 µm fillet removes most pinning sites.",
          "Prime the chip with 70 % ethanol or CO₂ first, then displace with medium — CO₂ dissolves away, air does not.",
        ],
      },
    ],
  },
  {
    id: "washout",
    label: "Cells wash away when flow starts",
    causes: [
      {
        t: "Shear at flow onset exceeds what an unspread cell can hold",
        check: (m) => ({
          lvl: m.tau > 0.5 ? L_LIKELY : m.tau > 0.2 ? L_MAYBE : L_NO,
          why: `Wall shear is ${sig(m.tau)} dyn/cm². A cell that has attached but not yet spread detaches somewhere around 0.5–1 dyn/cm²; a fully spread ${m.cell.n.split(" —")[0].toLowerCase()} monolayer tolerates up to about ${m.cell.acute} dyn/cm². ${m.tau > 0.5 ? "You are starting above the unspread threshold." : "You are below the unspread threshold, so onset shear alone is probably not it."}`,
        }),
        fix: [
          "Ramp flow: start at 5–10 % of setpoint, double every 30 min over 2–4 h.",
          "Give the full static attachment time for this cell type in the incubator before any flow at all — the value in the Biology panel is a floor, not a target.",
          "Check for a pressure spike at start: turning a stopcock or connecting a primed syringe can deliver a transient many times the steady-state shear.",
        ],
      },
      {
        t: "Not enough static attachment time",
        check: (m, i) => ({
          lvl: i.attachH < m.cell.seedH ? L_LIKELY : L_NO,
          why: `You allow ${i.attachH} h static. ${m.cell.n} typically needs ${m.cell.seedH} h before flow — focal adhesion maturation, not just contact, is what resists shear.`,
        }),
        fix: [
          "Extend static culture, and keep the chip in a humidified incubator during it, not on the bench.",
          "Refresh medium statically once before starting flow to clear unattached cells rather than letting flow do it.",
        ],
      },
      {
        t: "Coating failed or reverted",
        check: (m, i) => ({
          lvl: i.material === "pdms" && i.coatDelay > 4 ? L_LIKELY : i.coating === "none" ? L_LIKELY : L_MAYBE,
          why: `${i.material === "pdms" ? `Plasma-treated PDMS recovers hydrophobicity within hours; you coated ${i.coatDelay} h after bonding/treatment. ` : ""}${i.coating === "none" ? "No coating is listed — most anchorage-dependent cells will not hold on bare polymer under flow. " : ""}Recommended for this cell type: ${m.cell.coat}.`,
        }),
        fix: [
          "Coat immediately after plasma treatment, or store the bonded chip filled with water/PBS until coating.",
          "Follow the cell-specific coating shown in the cause text above rather than a generic gelatin coat.",
          "Verify the coating: a fluorescent-conjugated fibronectin batch once, to confirm coverage rather than assuming it.",
          "Incubate coating at 37 °C for at least 1 h, and do not let the channel dry between coating and seeding.",
        ],
      },
      {
        t: "Cells never reached the floor before leaving the channel",
        check: (m) => ({
          lvl: m.xSettle > m.L ? L_LIKELY : L_NO,
          why: `A ${sig(m.dCell * 1e6)} µm cell sediments at ${sig(m.vSed * 1e6)} µm/s, so crossing the full ${sig(m.h * 1e6)} µm channel height takes ${dur(m.tSedChan)}. At the seeding flow you have entered, a cell starting at the ceiling travels ${sig(m.xSettle * 1000)} mm before landing — the channel is only ${sig(m.L * 1000)} mm long. ${m.xSettle > m.L ? "Most of the suspension exits before touching the surface." : ""}`,
        }),
        fix: [
          "Seed with the pump stopped: fill the channel, then park it in the incubator so gravity does the work.",
          "Seed in two or three pulses, letting cells settle between each, to build density without raising concentration.",
          "Invert or flip the chip halfway if you want cells on both surfaces.",
        ],
      },
      {
        t: "Seeding density too low to form a holding monolayer",
        check: (m, i) => ({
          lvl: i.seedDens < 5e4 ? L_MAYBE : L_NO,
          why: `Target ${sig(i.seedDens)} cells/cm² over ${sig(m.floorCm2, 2)} cm² of channel floor means ${sig(m.seedN)} cells in ${sig(m.Vch * 1e9)} µL — a suspension at ${sig(m.seedConc / 1e6, 2)} × 10⁶ cells/mL. Sparse cells detach far more readily than confluent ones because cell–cell junctions carry part of the load.`,
        }),
        fix: [
          "Seed to near-confluence in one go rather than letting cells proliferate into confluence under flow.",
          "Count after loading: image the channel at t = 0 and t = 2 h to separate 'never attached' from 'attached then washed'.",
        ],
      },
    ],
  },
  {
    id: "attach",
    label: "Poor attachment / cells stay rounded",
    causes: [
      {
        t: "PDMS hydrophobic recovery",
        check: (m, i) => ({
          lvl: i.material === "pdms" ? (i.coatDelay > 4 ? L_LIKELY : L_MAYBE) : L_NO,
          why: i.material === "pdms"
            ? `Surface silanols reorganise within hours of plasma treatment; by ${i.coatDelay} h the channel is substantially hydrophobic again and protein adsorbs in a denatured, non-adhesive conformation.`
            : `${MATERIALS[i.material].n} does not undergo hydrophobic recovery in the PDMS sense, though it may still need surface activation.`,
        }),
        fix: [
          "Coat within 30 min of plasma, or keep channels water-filled until coating.",
          "Consider covalent coupling — APTES/GA or sulfo-SANPAH + protein — instead of physisorption for long runs.",
        ],
      },
      {
        t: "Uncured oligomers or sterilisation residue",
        check: (m, i) => ({
          lvl: i.material === "pdms" || i.material === "tape" ? L_MAYBE : L_NO,
          why: "Low molecular weight PDMS oligomers and residual isopropanol/ethanol leach into medium and inhibit spreading, most visibly on primary cells and iPSC derivatives.",
        }),
        fix: [
          "Solvent-extract PDMS: soak in hexane or ethanol 24 h, then bake 80 °C overnight to drive off solvent.",
          "Extend the post-cure bake (80 °C, 12–24 h) to complete crosslinking.",
          "After ethanol sterilisation, flush with at least 20 channel volumes of PBS, then medium, and pre-condition with complete medium for 2–12 h before seeding.",
        ],
      },
      {
        t: "Coating chemistry mismatched to the cell",
        check: (m) => ({ lvl: L_MAYBE, why: `${m.cell.n} normally needs: ${m.cell.coat}. Gelatin is fine for HUVEC on glass but often too weak on PDMS; Matrigel-dependent lines will not spread on fibronectin alone.` }),
        fix: [
          "Match the coating to the native basement membrane rather than to lab habit.",
          "Try a double coat: collagen or PLL as an anchoring layer, then the ligand your integrins actually need.",
        ],
      },
      {
        t: "pH drift outside the incubator",
        check: (m, i) => ({ lvl: L_MAYBE, why: "Bicarbonate-buffered medium loses CO₂ within minutes on the bench; pH climbs past 8 and attachment stalls. This is invisible unless you watch the phenol red closely." }),
        fix: [
          "Add 10–25 mM HEPES for any step performed outside 5 % CO₂.",
          "Do all connection and imaging steps in a stage-top incubator or as fast as possible.",
        ],
      },
    ],
  },
  {
    id: "tubing",
    label: "Cells or medium settling in the tubing",
    causes: [
      {
        t: "Transit time longer than sedimentation time",
        check: (m) => ({
          lvl: m.settleFrac > 0.5 ? L_LIKELY : m.settleFrac > 0.2 ? L_MAYBE : L_NO,
          why: `Cells cross half the ${sig(m.Dt * 1000)} mm bore in ${dur(m.tSedTube)} but take ${dur(m.tTransit)} to travel the ${sig(m.Lt * 100)} cm of tubing. Roughly ${Math.round(m.settleFrac * 100)} % of a mid-bore cell's fall is completed in transit. Anything above ~20 % shows up as a delivery gradient.`,
        }),
        fix: [
          "Go to smaller bore: 0.01\" (0.25 mm) ID instead of 0.03\" (0.76 mm) cuts settling distance and raises velocity by ~9×.",
          "Shorten the run. Every extra 10 cm is transit time you are paying for in lost cells.",
          "Route the seeding line steeply downward so gravity works along the flow, not across it.",
          "Load the cell suspension into a short segment right at the inlet rather than pushing it the length of the line.",
        ],
      },
      {
        t: "Flow rate too low for the bore chosen",
        check: (m) => ({
          lvl: m.Ut < 1e-3 ? L_LIKELY : L_MAYBE,
          why: `Velocity in the tubing is ${sig(m.Ut * 1000)} mm/s. Below about 1 mm/s, sedimentation dominates transport in horizontal runs regardless of length.`,
        }),
        fix: [
          "Decouple seeding from perfusion: seed fast through a small-bore line, then swap to the perfusion line for the slow chronic flow.",
          "Keep the reservoir stirred or rocked; a static reservoir sheds cells before they ever enter the line.",
        ],
      },
      {
        t: "Aggregation in suspension",
        check: (m, i) => ({
          lvl: i.seedDens > 3e5 ? L_MAYBE : L_NO,
          why: "Dense suspensions clump, and clumps sediment as the square of the effective diameter — a 3-cell aggregate falls ~4× faster than a single cell and lodges in the smallest constriction.",
        }),
        fix: [
          "Strain through 40 µm mesh immediately before loading.",
          "Add DNase I 10 µg/mL if there is any lysis in the prep.",
          "Keep the suspension on ice only if the cell tolerates it — cold slows metabolism but promotes some clumping.",
        ],
      },
    ],
  },
  {
    id: "detach",
    label: "Monolayer lifts after days under flow",
    causes: [
      {
        t: "Chronic shear above the cell's tolerated band",
        check: (m) => {
          const over = m.tau > m.cell.hi;
          return {
            lvl: over ? L_LIKELY : m.tau > m.cell.hi * 0.7 ? L_MAYBE : L_NO,
            why: `${sig(m.tau)} dyn/cm² against a physiological band of ${m.cell.lo}–${m.cell.hi} dyn/cm² for ${m.cell.n}. ${over ? "You are above it. Days-long exposure above the band drives remodelling then delamination even when the first 24 h look fine." : "Within band."}`,
          };
        },
        fix: [
          "Reduce flow, or widen/deepen the channel — shear scales as 1/h², so a 1.4× deeper channel halves it.",
          "Adapt the cells: ramp over 24–48 h so they align and reinforce junctions before full load.",
        ],
      },
      {
        t: "A bubble passed through",
        check: (m) => ({
          lvl: L_LIKELY,
          why: `A gas–liquid interface sweeping the channel applies a transient stress orders of magnitude above steady shear and strips cells in a clean stripe. If the damage has a sharp edge or a track, this is what happened, not gradual shear.`,
        }),
        fix: [
          "Look at the pattern: bubble damage is a stripe with intact cells either side; shear damage is diffuse and starts at the highest-shear region.",
          "Install a bubble trap and degas as in the bubble workflow.",
        ],
      },
      {
        t: "Nutrient depletion or waste accumulation",
        check: (m) => ({
          lvl: m.exch < 1 ? L_LIKELY : m.exch < 5 ? L_MAYBE : L_NO,
          why: `You exchange ${sig(m.exch, 2)} channel volumes per hour (residence time ${dur(m.tRes)}). Below ~1 vol/h, glucose and lactate gradients along the channel become the dominant variable and distal cells starve first.`,
        }),
        fix: [
          "Raise flow, or recirculate through a larger reservoir if shear is the constraint.",
          "Check for a gradient: if cells die from the outlet end backwards, it is depletion, not shear.",
        ],
      },
      {
        t: "ECM remodelling / coating turnover",
        check: () => ({ lvl: L_MAYBE, why: "Adsorbed coatings are degraded and replaced by cell-secreted matrix over 3–7 days. If the cells cannot deposit their own matrix fast enough — common in serum-reduced medium — adhesion has a trough around day 3–5." }),
        fix: [
          "Supplement ascorbic acid (50 µg/mL) to support collagen deposition.",
          "Use covalently coupled ligand for runs beyond 5 days.",
        ],
      },
      {
        t: "Evaporation and osmolality drift",
        check: (m, i) => ({
          lvl: MATERIALS[i.material].evap ? L_MAYBE : L_NO,
          why: MATERIALS[i.material].evap
            ? "PDMS loses water vapour through the bulk. In a small-volume closed loop this concentrates the medium measurably within 48 h."
            : "This material is not water permeable, so bulk evaporation is not a factor.",
        }),
        fix: [
          "Keep a water-filled sacrificial channel or a wet chamber around the chip.",
          "Measure osmolality of spent medium at endpoint once — it settles the question.",
        ],
      },
    ],
  },
  {
    id: "uneven",
    label: "Uneven seeding along the channel",
    causes: [
      {
        t: "Sedimentation gradient — cells land near the inlet",
        check: (m) => ({
          lvl: m.xSettle < m.L * 0.5 ? L_LIKELY : L_MAYBE,
          why: `Landing distance for a ceiling-height cell is ${sig(m.xSettle * 1000)} mm in a ${sig(m.L * 1000)} mm channel. ${m.xSettle < m.L * 0.5 ? "Everything lands in the first half and the outlet end stays sparse." : "Landing distance exceeds the channel, so the opposite problem applies — the whole channel underloads."}`,
        }),
        fix: [
          "Fill fast, then stop the pump and let the entire channel settle at once — this decouples landing position from flow.",
          "Load from both ports alternately.",
        ],
      },
      {
        t: "Entrance length — velocity profile not yet developed",
        check: (m) => ({
          lvl: m.Le > m.L * 0.1 ? L_MAYBE : L_NO,
          why: `Entrance length is ${sig(m.Le * 1000, 2)} mm at Re = ${sig(m.Re, 2)}; the channel is ${sig(m.L * 1000)} mm. Shear near the inlet differs from the fully developed value over that distance.`,
        }),
        fix: ["Quantify only in the central region, at least 10 Dh from the inlet.", "Add a straight entry section if you have layout room."],
      },
      {
        t: "Unbalanced bifurcations",
        check: () => ({ lvl: L_MAYBE, why: "Parallel branches split flow by hydraulic resistance. A 10 % height difference between branches — well within soft-lithography tolerance — gives a 30 % flow difference, since R scales as 1/h³." }),
        fix: [
          "Measure channel heights with a profilometer or confocal rather than trusting the mask.",
          "Design a high-resistance common inlet so branch differences matter less.",
        ],
      },
    ],
  },
  {
    id: "clog",
    label: "Channel clogging",
    causes: [
      {
        t: "Aggregates larger than the smallest dimension",
        check: (m) => ({
          lvl: m.h * 1e6 < m.dCell * 1e6 * 4 ? L_LIKELY : L_MAYBE,
          why: `Channel height ${sig(m.h * 1e6)} µm against a ${sig(m.dCell * 1e6)} µm cell — ${sig((m.h / m.dCell), 2)} cell diameters. Below about 4 diameters, doublets and triplets bridge and arrest.`,
        }),
        fix: ["Strain at 40 µm right before loading.", "Add an on-chip pillar filter upstream with gaps ~3× the cell diameter, so it catches clumps rather than cells."],
      },
      {
        t: "Matrigel or protein gelation in the line",
        check: () => ({ lvl: L_MAYBE, why: "Matrigel gels above ~10 °C. Any warm segment — including the part of the line sitting inside the incubator — gels before it reaches the chip." }),
        fix: ["Keep tips, tubing and chip on ice until loading, then move to 37 °C in one step.", "Use a pre-chilled chip and load in a cold room if the protocol allows."],
      },
      {
        t: "Precipitates",
        check: () => ({ lvl: L_MAYBE, why: "Calcium phosphate precipitates form when medium sits warm and CO₂-depleted; they nucleate on channel walls and seed further blockage." }),
        fix: ["Filter medium at 0.22 µm after any supplementation.", "Avoid leaving prepared medium warm for hours before use."],
      },
    ],
  },
  {
    id: "leak",
    label: "Leaks or delamination",
    causes: [
      {
        t: "Pressure at the inlet against bond strength",
        check: (m, i) => {
          const tot = m.dPchip + m.dPtube;
          return {
            lvl: tot > 5e4 ? L_LIKELY : L_MAYBE,
            why: `Inlet pressure is about ${mbar(tot)} (${mbar(m.dPchip)} across the chip, ${mbar(m.dPtube)} across the tubing). ${MATERIALS[i.material].n} bonding: ${MATERIALS[i.material].bond}. ${tot > 5e4 ? "You are in the range where marginal bonds fail." : "This is far below a good bond's limit — so a leak here means the bond itself is defective, not overloaded."}`,
          };
        },
        fix: [
          "Note that tubing usually dominates system pressure. If you need lower inlet pressure, shorten or widen the tubing before touching the chip.",
          "Check the outlet is actually open — a kinked or capped outlet turns any pump into a bond-breaker.",
        ],
      },
      {
        t: "Incomplete plasma bond",
        check: (m, i) => ({
          lvl: i.material === "pdms" ? L_MAYBE : L_NO,
          why: "Dust, an over-long delay between plasma and contact, incompletely cured PDMS, or too high a plasma power (which ashes the surface) all give a bond that looks fine and fails under pressure.",
        }),
        fix: [
          "Tape-clean both surfaces immediately before plasma; contact within 60 s.",
          "Post-bake bonded chips at 80 °C for at least 2 h — bond strength roughly doubles.",
          "Test with dye at 2× working pressure before you put cells in.",
        ],
      },
      {
        t: "Port damage",
        check: () => ({ lvl: L_MAYBE, why: "Repeated needle or barb insertion tears the PDMS around the port; the leak appears at the interface and looks like delamination." }),
        fix: ["Use a fresh biopsy punch — a dull punch tears rather than cuts.", "Bond a thicker PDMS collar around ports, or switch to a clamped manifold."],
      },
    ],
  },
  {
    id: "viability",
    label: "Low viability under perfusion",
    causes: [
      {
        t: "Shear",
        check: (m) => ({
          lvl: m.tau > m.cell.hi ? L_LIKELY : L_NO,
          why: `${sig(m.tau)} dyn/cm² vs a tolerated band of ${m.cell.lo}–${m.cell.hi}.`,
        }),
        fix: ["Reduce flow or increase channel height."],
      },
      {
        t: "Oxygen limitation",
        check: (m, i) => ({
          lvl: !MATERIALS[i.material].o2 && m.exch < 5 ? L_LIKELY : L_MAYBE,
          why: `${MATERIALS[i.material].n} is ${MATERIALS[i.material].o2 ? "gas permeable, so oxygen also arrives through the bulk" : "not gas permeable, so all oxygen must arrive by convection"}. Exchange rate is ${sig(m.exch, 2)} channel volumes/h.`,
        }),
        fix: [
          "Raise flow or recirculate through an oxygenator segment.",
          "For high-consumption cells (hepatocytes, cardiomyocytes) calculate delivery against known OCR rather than guessing.",
        ],
      },
      {
        t: "Small molecule absorption into the polymer",
        check: (m, i) => ({
          lvl: MATERIALS[i.material].absorbs ? L_MAYBE : L_NO,
          why: MATERIALS[i.material].absorbs
            ? "PDMS absorbs hydrophobic small molecules — steroids, many drugs, some lipids — depleting them from the medium within hours. If viability depends on a supplement, the cells may simply not be receiving it."
            : "This material does not absorb small molecules appreciably.",
        }),
        fix: ["Sol-gel or parylene coat the channel for drug studies.", "Measure the compound at the outlet rather than assuming the inlet concentration holds."],
      },
      {
        t: "Uncured oligomers / residue",
        check: (m, i) => ({ lvl: i.material === "pdms" ? L_MAYBE : L_NO, why: "See the attachment workflow — the same leachables that block spreading also reduce viability at higher exposure." }),
        fix: ["Extract and re-bake; pre-condition with medium before seeding."],
      },
    ],
  },
  {
    id: "flow",
    label: "Unstable or pulsatile flow",
    causes: [
      {
        t: "Peristaltic pulsation",
        check: (m, i) => ({
          lvl: i.drive === "peristaltic" ? L_LIKELY : L_NO,
          why: i.drive === "peristaltic" ? "Roller passage gives peak-to-mean flow ratios of 1.3–2 depending on head design — so your peak shear is well above the mean you calculated." : "Not applicable to this drive.",
        }),
        fix: [
          "Add a compliance chamber (a short air-filled dead-end branch) plus a resistance downstream — an RC low-pass for fluid.",
          "More rollers, or two heads out of phase.",
        ],
      },
      {
        t: "Compliance–resistance lag",
        check: (m, i) => ({
          lvl: i.drive.startsWith("syringe") ? L_MAYBE : L_NO,
          why: `Syringe compliance plus PDMS compliance plus tubing compliance means a step change in pump rate takes minutes to appear at the chip. At ${i.Q} µL/min in a ${i.syringeML} mL syringe, plunger stiction also produces stepwise delivery.`,
        }),
        fix: [
          "Use the smallest syringe that holds the run volume — a 1 mL glass syringe at 1 µL/min behaves far better than a 20 mL plastic one.",
          "Glass barrel with PTFE plunger for low flow rates.",
          "Wait 15–30 min after any change before recording.",
        ],
      },
      {
        t: "A bubble acting as a capacitor",
        check: () => ({ lvl: L_MAYBE, why: "A trapped bubble is compressible. It stores and releases volume, converting steady pump delivery into oscillating chip flow, and it makes flow appear to lag or surge with no other explanation." }),
        fix: ["Clear the bubble before attributing anything to the pump."],
      },
    ],
  },
  {
    id: "barrier",
    label: "Barrier will not form / TEER stays low",
    mem: true,
    causes: [
      {
        t: "Convective flux through the monolayer from transmembrane pressure",
        check: (m) => ({
          lvl: m.tmpMax > 50 ? L_LIKELY : m.tmpMax > 10 ? L_MAYBE : L_NO,
          why: `Transmembrane pressure is ${mbar(m.tmpIn)} at the apical inlet and ${mbar(m.tmpOut)} at the outlet (${m.counter ? "counter-current, so it reverses sign along the channel" : "co-current"}). Pressure-driven convection through a forming junction network prevents it from ever sealing — the cells are being perfused, not just bathed. Anything above roughly 0.5 mbar sustained is worth removing before blaming biology.`,
        }),
        fix: [
          "Match hydraulic resistance, not flow rate. Your channels are R_top and R_bottom; equal Q through unequal channels always leaves a residual ΔP.",
          "Add a matched length of resistive tubing to the lower-resistance outlet to balance the two arms.",
          "Level the two outlet reservoirs. A 10 mm height difference is about 1 mbar — often larger than the channel pressure drop itself.",
          "Establish the barrier under equal static conditions first, then introduce flow once TEER has plateaued.",
        ],
      },
      {
        t: "Outlet height mismatch dominating the pressure balance",
        check: (m, i) => ({
          lvl: m.headOffset > Math.max(m.dPT, m.dPB) ? L_LIKELY : L_MAYBE,
          why: `You have entered a ${i.outletOffsetMM} mm outlet height offset, worth ${mbar(m.headOffset)}. Channel pressure drops are ${mbar(m.dPT)} apical and ${mbar(m.dPB)} basal. ${m.headOffset > Math.max(m.dPT, m.dPB) ? "The hydrostatics are larger than the hydrodynamics — the tubing layout is setting your transmembrane pressure, not your pump." : "Hydrostatics are the smaller term here."}`,
        }),
        fix: [
          "Fix outlet tubing at a defined, equal height on a rack rather than letting it hang.",
          "Use the same tubing ID and length on both outlets — resistance mismatch on the outlet side is just as effective at creating TMP as a height difference.",
        ],
      },
      {
        t: "No mechanical cue — shear too low to drive maturation",
        check: (m) => ({
          lvl: m.tau < m.cell.lo * 0.5 ? L_LIKELY : L_NO,
          why: `Shear on the ${m.act === "b" ? "basal" : "apical"} side is ${sig(m.tau)} dyn/cm² against a physiological ${m.cell.lo}–${m.cell.hi}. Epithelial barrier genes and tight junction assembly respond to flow; static or near-static culture in a chip often gives worse TEER than a Transwell, not better.`,
        }),
        fix: [
          "Bring shear into the physiological band and hold it for 3–5 days before measuring.",
          "For gut and lung models, add cyclic strain if the device supports it — flow alone under-performs.",
        ],
      },
      {
        t: "Pores too large for the cells to bridge",
        check: (m, i) => ({
          lvl: m.poreVsCell > 0.35 ? L_LIKELY : L_MAYBE,
          why: `Pore diameter ${i.poreD} µm against a ${sig(m.dCell * 1e6)} µm cell — ${sig(m.poreVsCell * 100, 2)} % of a cell diameter, with ${sig(m.openFrac * 100, 2)} % of the surface open. Above about a third of a cell diameter, cells drape into pores instead of spanning them and the junctional belt is discontinuous.`,
        }),
        fix: [
          "Use 0.4 µm pores unless the experiment requires migration; 3 µm and above trades barrier quality for transmigration.",
          "Coat the membrane heavily enough to bridge pores — collagen or Matrigel at the upper end of the range, not a thin fibronectin film.",
        ],
      },
      {
        t: "TEER measurement geometry, not the barrier",
        check: () => ({
          lvl: L_MAYBE,
          why: "Chip TEER is not comparable to Transwell TEER. Current density is non-uniform when electrodes are small relative to the membrane, and the measured resistance includes medium, membrane and any leak path around the gasket. A low number can be an electrode artefact with a perfectly good barrier.",
        }),
        fix: [
          "Run a blank chip — coated membrane, no cells — and subtract it. Report the difference, not the raw value.",
          "Cross-check with a permeability tracer: 4 kDa FITC-dextran apparent permeability is geometry-independent in a way TEER is not.",
          "Check for a leak path at the membrane bond line; a 50 µm gap at the edge short-circuits the whole measurement.",
        ],
      },
      {
        t: "Not confluent yet",
        check: (m, i) => ({
          lvl: i.seedDens < 1e5 ? L_LIKELY : L_MAYBE,
          why: `Seeding at ${sig(i.seedDens)} cells/cm² over ${sig(m.floorCm2, 2)} cm² of membrane means ${sig(m.seedN)} cells. Barrier resistance is dominated by the worst-sealed region, so a 95 % confluent monolayer reads close to a 0 % one.`,
        }),
        fix: ["Image before measuring. TEER without a confluence check is uninterpretable.", "Seed to confluence directly rather than relying on proliferation on the membrane."],
      },
    ],
  },
  {
    id: "crossover",
    label: "Medium crossing between the two channels",
    mem: true,
    causes: [
      {
        t: "The membrane is the path of least resistance",
        check: (m) => ({
          lvl: m.memRatio < 1 ? L_LIKELY : m.memRatio < 5 ? L_MAYBE : L_NO,
          why: `Membrane hydraulic resistance is ${sig(m.memRatio, 2)}× the apical channel resistance (${sig(m.nPore / 1e8, 2)} × 10⁸ pores/m², ${sig(m.openFrac * 100, 2)} % open). ${m.memRatio < 1 ? "It is easier for fluid to cross the membrane than to travel the length of the channel. Before a confluent barrier forms, the two channels are effectively one." : "The membrane is the harder path, so crossover needs a real pressure imbalance to appear."}`,
        }),
        fix: [
          "Remember that the monolayer, not the membrane, is what makes independent perfusion possible. Do not expect channel independence on a bare membrane.",
          "If you need hydraulic separation before the barrier forms, drop to 0.4 µm pores or lower porosity — resistance scales as 1/r⁴ per pore.",
        ],
      },
      {
        t: "Estimated crossflow at your current settings",
        check: (m) => ({
          lvl: m.leakFrac > 0.2 ? L_LIKELY : m.leakFrac > 0.05 ? L_MAYBE : L_NO,
          why: `Mean transmembrane pressure ${mbar(m.tmpMean + m.headOffset)} across a ${sig(m.Amem * 1e6, 2)} mm² membrane gives a flux of ${sig(m.Jleak * 1e6)} µm/s — about ${sig(m.leakFrac * 100, 2)} % of your apical flow rate crossing sideways. Pore velocity is ${sig(m.vPore * 1e6)} µm/s. This is an upper bound: it assumes a bare membrane with no cells.`,
        }),
        fix: [
          "Balance the arms before adding cells and verify with a dye — apical blue, basal clear, and look for bleed at the ends.",
          "If crossflow is intended (a filtration or reabsorption model), set it deliberately with a defined TMP rather than letting it fall out of a resistance mismatch.",
        ],
      },
      {
        t: "Counter-current configuration reverses the sign along the channel",
        check: (m) => ({
          lvl: m.counter ? L_LIKELY : L_NO,
          why: m.counter
            ? `Counter-flow puts the apical inlet next to the basal outlet, so TMP runs from ${mbar(m.tmpIn)} at one end to ${mbar(m.tmpOut)} at the other and passes through zero in between. You get filtration at one end and reabsorption at the other, which reads as unexplained volume shift rather than a clean leak.`
            : "Co-current flow, so TMP has a single sign along the channel.",
        }),
        fix: [
          "Switch to co-current unless the biology needs a counter-current gradient.",
          "If you keep counter-flow, place the outlets so the two pressure drops cancel at mid-channel and accept the ends as compromised.",
        ],
      },
      {
        t: "Unequal channel heights",
        check: (m, i) => ({
          lvl: Math.abs(i.h - i.h2) / Math.max(i.h, i.h2) > 0.15 ? L_LIKELY : L_NO,
          why: `Apical ${i.h} µm, basal ${i.h2} µm. Resistance scales as 1/h³, so that geometry alone gives R_apical/R_basal = ${sig(m.RT / m.RB, 2)}. Equal flow rates through unequal channels guarantee a pressure difference.`,
        }),
        fix: [
          "Set flow rates by resistance ratio, not by equality: Q_apical/Q_basal = R_basal/R_apical gives zero TMP in co-flow.",
          "Or design the two channels to the same cross-section and vary flow rate instead.",
        ],
      },
    ],
  },
  {
    id: "pores",
    label: "Cells entering or crossing the membrane pores",
    mem: true,
    causes: [
      {
        t: "Pore size permits migration",
        check: (m, i) => ({
          lvl: i.poreD >= 3 ? L_LIKELY : i.poreD >= 1 ? L_MAYBE : L_NO,
          why: `${i.poreD} µm pores against a ${sig(m.dCell * 1e6)} µm cell. Below about 1 µm cells cannot deform enough to enter; 3 µm permits protrusion and slow transmigration; 5–8 µm allows free passage of most cell types. Nuclear diameter, not cell diameter, sets the real limit — around 5–6 µm.`,
        }),
        fix: [
          "Drop to 0.4 µm if migration is not the readout.",
          "If you need both barrier and migration in one device, use two membrane regions rather than one compromise pore size.",
        ],
      },
      {
        t: "Transmembrane pressure pulling cells into pores",
        check: (m) => ({
          lvl: m.vPore * 1e6 > 5 ? L_LIKELY : L_MAYBE,
          why: `Pore velocity is ${sig(m.vPore * 1e6)} µm/s under the current pressure balance. Sustained suction into a pore deforms the cell and, over hours, commits it to entering.`,
        }),
        fix: ["Balance the two arms as in the crossover workflow.", "Seed on the side that is at the higher pressure so flux pushes cells onto the membrane rather than into it."],
      },
      {
        t: "Chemotactic or serum gradient across the membrane",
        check: () => ({ lvl: L_MAYBE, why: "A serum or growth factor difference between the two channels is a migration assay whether or not you designed one. Even matched media drift apart once each compartment is conditioned by different cells." }),
        fix: ["Match serum concentration on both sides during establishment.", "If co-culturing, expect paracrine gradients and treat crossing as a result rather than an artefact."],
      },
    ],
  },
];

/* ---------- case log ----------
   Outcomes are the only thing here that cannot be re-derived from physics.
   Every confirmed or ruled-out cause is a labelled example: it tells you
   whether the ranking this app produced was actually right.               */

const STORE_KEY = "laminar.cases.v1";
let memCases = [];

const makeStore = (persist) => ({
  read() {
    if (!persist) return memCases;
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return memCases; }
  },
  write(list) {
    memCases = list;
    if (!persist) return;
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch {}
  },
});

const CSV_COLS = [
  "id", "timestamp", "symptom", "cause", "predicted", "outcome", "fix",
  "format", "w_um", "h_um", "L_mm", "Q_ul_min", "material", "drive",
  "w2_um", "h2_um", "Q2_ul_min", "flowDir", "poreD_um", "poreEps_pct",
  "cellType", "coating", "coatDelay_h", "attachH_h", "seedDens_cm2",
  "tau_dyn", "Re", "dPchip_Pa", "dPtube_Pa", "xSettle_mm", "exch_volh",
  "tmpIn_Pa", "leakFrac", "memRatio",
];

const toCSV = (cases) => {
  const esc = (v) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [CSV_COLS.join(","), ...cases.map((c) => CSV_COLS.map((k) => esc(c[k])).join(","))].join("\n");
};

const download = (name, text, type) => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};


/* ============================================================
   FlowSim — longitudinal view of the channel, integrated from the
   same numbers the rest of the app reports.

   Cells advect at the local Poiseuille velocity u(z) and sediment at
   the Stokes velocity, both in real units. Time is compressed by a
   single factor, so the RATIO of advection to sedimentation stays
   physically correct: if the app says cells wash out before landing,
   you watch them do exactly that.
   ============================================================ */

const RAMP = [
  [0.0, [11, 29, 81]],
  [0.25, [30, 96, 145]],
  [0.5, [42, 157, 143]],
  [0.75, [233, 196, 106]],
  [1.0, [231, 111, 81]],
];

function rampColor(t) {
  const x = Math.max(0, Math.min(1, t));
  for (let k = 1; k < RAMP.length; k++) {
    if (x <= RAMP[k][0]) {
      const [t0, c0] = RAMP[k - 1], [t1, c1] = RAMP[k];
      const f = (x - t0) / (t1 - t0);
      return `rgb(${c0.map((v, j) => Math.round(v + f * (c1[j] - v))).join(",")})`;
    }
  }
  return `rgb(${RAMP[RAMP.length - 1][1].join(",")})`;
}

function FlowSim({ m, i }) {
  const cv = useRef(null);
  const live = useRef({ m, i });
  const ctl = useRef({ playing: true, speed: 1, mode: "seed" });
  const sim = useRef({ tracers: [], cells: [], t: 0, attached: 0, washed: 0, seeded: 0 });
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState("seed");
  const [stats, setStats] = useState({ a: 0, w: 0, s: 0, t: 0 });

  live.current = { m, i };
  ctl.current = { playing, speed, mode };

  const reset = () => {
    const { m: mm } = live.current;
    const S = sim.current;
    S.tracers = Array.from({ length: 150 }, () => ({ x: Math.random(), z: 0.02 + Math.random() * 0.96 }));
    S.cells = [];
    S.t = 0; S.attached = 0; S.washed = 0; S.seeded = 0;
    if (ctl.current.mode === "perfuse") {
      // floor already confluent — watch what shear does to it
      for (let k = 0; k < 60; k++) {
        S.cells.push({ x: 0.02 + (k / 60) * 0.96, z: 1, stuck: true, spread: true, gone: false });
      }
      S.attached = 60;
    }
  };

  useEffect(() => { reset(); }, [mode]);

  useEffect(() => {
    let raf, last = performance.now(), lastReport = 0;

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const c = cv.current;
      if (!c) return;
      const dtReal = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { m: mm, i: ii } = live.current;
      const { playing: play, speed: sp, mode: md } = ctl.current;
      const S = sim.current;

      const L = mm.L, h = mm.h;                    // metres
      const U = mm.U, vS = mm.vSed;
      const uAt = (z) => 6 * U * z * (1 - z);      // z normalised 0..1
      const dt = play ? dtReal * sp : 0;           // seconds of simulated time
      S.t += dt;

      if (dt > 0) {
        for (const p of S.tracers) {
          p.x += (uAt(p.z) * dt) / L;
          if (p.x > 1) { p.x -= 1; p.z = 0.02 + Math.random() * 0.96; }
        }
        if (md === "seed" && S.seeded < 220 && Math.random() < dt * 40) {
          S.cells.push({ x: 0, z: 0.05 + Math.random() * 0.75, stuck: false, spread: false, gone: false });
          S.seeded += 1;
        }
        for (const q of S.cells) {
          if (q.gone) continue;
          if (!q.stuck) {
            q.x += (uAt(q.z) * dt) / L;
            q.z += (vS * dt) / h;
            if (q.z >= 1) { q.z = 1; q.stuck = true; S.attached += 1; }
            if (q.x > 1) { q.gone = true; S.washed += 1; }
          } else {
            // an unspread cell lets go above ~0.5 dyn/cm²; a spread one holds to its acute limit
            const limit = q.spread ? mm.cell.acute : 0.5;
            if (mm.tau > limit && Math.random() < dt * 0.25 * (mm.tau / limit - 1)) {
              q.stuck = false; q.spread = false; S.attached -= 1;
              q.z = 0.985;
            }
          }
        }
        if (S.cells.length > 400) S.cells = S.cells.filter((q) => !q.gone);
      }

      /* ---- draw ---- */
      const W = c.width, H = c.height;
      const PL = 8, PR = 76, PT = 20, PB = 30;
      const pw = W - PL - PR, ph = H - PT - PB;
      const g = c.getContext("2d");
      g.clearRect(0, 0, W, H);

      const uMax = 1.5 * U || 1;
      for (let k = 0; k < ph; k += 2) {
        const z = k / ph;
        g.fillStyle = rampColor(uAt(z) / uMax);
        g.fillRect(PL, PT + k, pw, 2);
      }

      // walls
      g.strokeStyle = "#12191C"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(PL, PT); g.lineTo(PL + pw, PT);
      g.moveTo(PL, PT + ph); g.lineTo(PL + pw, PT + ph); g.stroke();

      // predicted landing distance, straight from the app's own arithmetic
      const xs = mm.xSettle / L;
      if (xs > 0.02 && xs < 1) {
        g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 1;
        g.setLineDash([5, 4]);
        g.beginPath(); g.moveTo(PL + xs * pw, PT); g.lineTo(PL + xs * pw, PT + ph); g.stroke();
        g.setLineDash([]);
        g.fillStyle = "rgba(255,255,255,.9)"; g.font = "10px 'IBM Plex Mono', monospace";
        g.fillText(`landing ${sig(mm.xSettle * 1000, 2)} mm`, PL + xs * pw + 4, PT + 12);
      }

      // media tracers
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.2;
      g.beginPath();
      for (const p of S.tracers) {
        const len = (uAt(p.z) / uMax) * 22;
        const x = PL + p.x * pw, y = PT + p.z * ph;
        g.moveTo(x - len, y); g.lineTo(x, y);
      }
      g.stroke();

      // velocity profile inset
      g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 1.6;
      g.beginPath();
      for (let k = 0; k <= 30; k++) {
        const z = k / 30;
        const x = PL + 14 + (uAt(z) / uMax) * 66;
        const y = PT + z * ph;
        k === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();

      // cells
      const r = Math.max(2.6, Math.min(7, (mm.dCell / h) * ph * 0.5));
      for (const q of S.cells) {
        if (q.gone) continue;
        const x = PL + q.x * pw, y = PT + q.z * ph - (q.stuck ? r * 0.6 : 0);
        g.beginPath();
        if (q.stuck) {
          g.ellipse(x, PT + ph - r * 0.55, r * 1.5, r * 0.6, 0, 0, Math.PI * 2);
          g.fillStyle = "rgba(255,255,255,.92)";
        } else {
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fillStyle = "rgba(255,255,255,.72)";
        }
        g.fill();
        g.strokeStyle = "rgba(18,25,28,.7)"; g.lineWidth = 0.8; g.stroke();
      }

      // colour bar
      const bx = W - PR + 16, bw = 12;
      for (let k = 0; k < ph; k++) {
        g.fillStyle = rampColor(1 - k / ph);
        g.fillRect(bx, PT + k, bw, 1);
      }
      g.strokeStyle = "#12191C"; g.lineWidth = 1; g.strokeRect(bx, PT, bw, ph);
      g.fillStyle = "#12191C"; g.font = "9px 'IBM Plex Mono', monospace";
      g.fillText(`${sig(uMax * 1000, 3)}`, bx + bw + 3, PT + 8);
      g.fillText("0", bx + bw + 3, PT + ph);
      g.fillText("mm/s", bx + bw + 3, PT - 8);

      // axis labels
      g.fillStyle = "#5A6668"; g.font = "10px 'IBM Plex Mono', monospace";
      g.fillText("inlet", PL, H - 10);
      g.fillText(`${sig(L * 1000, 3)} mm`, PL + pw / 2 - 20, H - 10);
      g.fillText("outlet", PL + pw - 34, H - 10);
      g.fillText(`channel height ${sig(h * 1e6, 3)} µm`, PL, PT - 7);

      // throttle the React update; the closure's `stats` is stale by design
      const susp = S.cells.filter((q) => !q.gone && !q.stuck).length;
      if (now - lastReport > 200) {
        lastReport = now;
        setStats({ a: S.attached, w: S.washed, s: susp, t: S.t });
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exag = (m.L / m.h) / 3.2;
  const total = stats.a + stats.w + stats.s;

  return (
    <section className="card" style={{ padding: "14px 16px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <div className="eyebrow">Flow &amp; cell behaviour · side view along the channel</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink2)" }}>
          t = {sig(stats.t, 3)} s simulated
        </div>
      </div>

      <canvas className="noprint" ref={cv} width={900} height={250}
        style={{ width: "100%", height: "auto", display: "block", background: "var(--ground)", borderRadius: 2 }} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
        <button className="minibtn" data-on={mode === "seed" ? "yes" : undefined} onClick={() => setMode("seed")}>Seeding</button>
        <button className="minibtn" data-on={mode === "perfuse" ? "yes" : undefined} onClick={() => setMode("perfuse")}>Perfusing a monolayer</button>
        <span style={{ width: 10 }} />
        <button className="minibtn" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
        <button className="minibtn" onClick={reset}>Reset</button>
        <select value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}
          style={{ width: "auto", padding: "3px 6px", fontSize: 11 }}>
          <option value={0.1}>0.1× time</option>
          <option value={1}>1× real time</option>
          <option value={10}>10×</option>
          <option value={100}>100×</option>
          <option value={1000}>1000×</option>
        </select>
      </div>

      <div className="mono" style={{ fontSize: 11.5, marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span style={{ color: "var(--ok)" }}>attached {stats.a}</span>
        <span style={{ color: "var(--ink2)" }}>in suspension {stats.s}</span>
        <span style={{ color: "var(--alert)" }}>washed out {stats.w}</span>
        {total > 0 && mode === "seed" && (
          <span style={{ fontWeight: 600 }}>seeding efficiency {Math.round((stats.a / total) * 100)} %</span>
        )}
      </div>

      <p style={{ fontSize: 11.5, lineHeight: 1.55, color: "var(--ink2)", margin: "8px 0 0" }}>
        Looking at the channel from the side, inlet on the left. Colour is flow speed — fastest mid-height, zero at
        both walls — and the white curve is that profile drawn out. Cells travel at the speed of whatever streamline
        they are on while sinking at {sig(m.vSed * 1e6)} µm/s, so the height is stretched about ×{sig(exag, 2)} to make
        the sinking visible. Advection and sedimentation keep their true ratio, which is why the dashed line marks
        where the arithmetic says a ceiling-height cell should touch down — watch whether they get there before the outlet.
      </p>
    </section>
  );
}


/* ============================================================
   SlitSim — cells arriving at an aperture array, folding through,
   or lodging in it.

   A cell passes if the squeeze it needs is within what that cell type
   can do. When one lodges, that aperture is out: the same total flow
   redistributes over fewer openings, so shear in the survivors rises
   as 1/(open fraction) and the next cell has a harder time. That
   cascade is the behaviour a static number cannot show.
   ============================================================ */

function SlitSim({ m, i }) {
  const cv = useRef(null);
  const live = useRef({ m, i });
  const ctl = useRef({ playing: true, speed: 1 });
  const S = useRef({ cells: [], blocked: [], t: 0, passed: 0, held: 0, spawn: 0 });
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [rigid, setRigid] = useState(0);
  const [stats, setStats] = useState({ p: 0, h: 0, open: 12, t: 0 });
  const NSLIT = 12;                       // apertures drawn; the real count is m.nF

  live.current = { m, i };
  ctl.current = { playing, speed, rigid };

  const reset = () => {
    S.current = { cells: [], blocked: Array(NSLIT).fill(false), t: 0, passed: 0, held: 0, spawn: 0 };
  };
  useEffect(() => { reset(); }, []);

  useEffect(() => {
    let raf, last = performance.now(), report = 0;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const c = cv.current; if (!c) return;
      const dtR = Math.min((now - last) / 1000, 0.05); last = now;
      const { m: mm, i: ii } = live.current;
      const { playing: play, speed: sp, rigid: rg } = ctl.current;
      const st = S.current;
      const dt = play ? dtR * sp : 0;
      st.t += dt;

      const W = c.width, H = c.height;
      const g = c.getContext("2d");
      const wallX = W * 0.46, wallW = Math.max(14, W * 0.05);
      const openN = st.blocked.filter((b) => !b).length || 1;
      const boost = NSLIT / openN;                     // flow concentrates in what is left
      const slitY = (k) => H * (0.09 + (k * 0.82) / (NSLIT - 1));
      const vApproach = 0.13, vThrough = 0.85;

      if (dt > 0) {
        st.spawn += dt * 9;
        while (st.spawn > 1 && st.cells.length < 90) {
          st.spawn -= 1;
          const target = Math.floor(Math.random() * NSLIT);
          st.cells.push({
            x: -0.02, y: 0.06 + Math.random() * 0.88, slit: target,
            phase: "approach", prog: 0, stiff: Math.random() < rg / 100, done: false,
          });
        }
        for (const q of st.cells) {
          if (q.done) continue;
          const ty = slitY(q.slit) / H;
          if (q.phase === "approach") {
            q.x += vApproach * dt * boost;
            q.y += (ty - q.y) * Math.min(1, dt * 2.2);
            if (q.x >= 0.46) {
              // can this cell fold enough to get through?
              const need = mm.squeeze;
              const can = (q.stiff ? 1.15 : (mm.cell.deform || 1.5));
              if (st.blocked[q.slit]) {
                q.slit = st.blocked.findIndex((b) => !b);
                if (q.slit < 0) { q.phase = "stuck"; q.x = 0.45; }
              } else if (need > can) {
                q.phase = "lodged"; st.blocked[q.slit] = true; st.held += 1; q.x = 0.47;
              } else {
                q.phase = "through"; q.prog = 0;
              }
            }
          } else if (q.phase === "through") {
            q.prog += dt * 1.6 * boost;
            q.x = 0.46 + q.prog * 0.06;
            if (q.prog >= 1) { q.phase = "relax"; }
          } else if (q.phase === "relax") {
            q.x += vApproach * 1.5 * dt;
            if (q.x > 1.02) { q.done = true; st.passed += 1; }
          }
        }
        if (st.cells.length > 140) st.cells = st.cells.filter((q) => !q.done);
      }

      /* ---- draw ---- */
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#E3E7DE"; g.fillRect(0, 0, W, H);

      // upstream and downstream chambers, tinted by pressure
      g.fillStyle = "rgba(167,50,42,.10)"; g.fillRect(0, 0, wallX, H);
      g.fillStyle = "rgba(23,89,95,.08)"; g.fillRect(wallX + wallW, 0, W - wallX - wallW, H);

      // the wall with its apertures
      g.fillStyle = "#12191C"; g.fillRect(wallX, 0, wallW, H);
      for (let k = 0; k < NSLIT; k++) {
        const y = slitY(k), sh = Math.max(4, H * 0.028);
        g.fillStyle = st.blocked[k] ? "#A8322A" : "#FDFDFB";
        g.fillRect(wallX, y - sh / 2, wallW, sh);
      }

      // streamlines converging on the open apertures
      g.strokeStyle = "rgba(23,89,95,.35)"; g.lineWidth = 1;
      for (let k = 0; k < NSLIT; k++) {
        if (st.blocked[k]) continue;
        const y = slitY(k);
        for (const off of [-1, 0, 1]) {
          g.beginPath();
          g.moveTo(0, y + off * H * 0.035);
          g.bezierCurveTo(wallX * 0.6, y + off * H * 0.035, wallX * 0.9, y, wallX, y);
          g.stroke();
        }
      }

      // cells
      const r = Math.max(4, H * 0.026);
      for (const q of st.cells) {
        if (q.done) continue;
        const x = q.x * W, y = q.y * H;
        g.save(); g.translate(x, y);
        if (q.phase === "through") {
          g.scale(1 + 2.2 * Math.sin(Math.PI * Math.min(q.prog, 1)), 1 / (1 + 2.2 * Math.sin(Math.PI * Math.min(q.prog, 1))));
        }
        g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
        g.fillStyle = q.phase === "lodged" ? "#A8322A" : q.stiff ? "#9C6B0B" : "#A32A5E";
        g.globalAlpha = 0.85; g.fill();
        g.globalAlpha = 1; g.strokeStyle = "rgba(18,25,28,.6)"; g.lineWidth = 0.9; g.stroke();
        g.restore();
      }

      // labels
      g.fillStyle = "#12191C"; g.font = "11px 'IBM Plex Mono', monospace";
      g.fillText("upstream", 8, 16);
      g.fillText("downstream", wallX + wallW + 8, 16);
      g.font = "10px 'IBM Plex Mono', monospace"; g.fillStyle = "#5A6668";
      g.fillText(`${sig(mm.dPfeat / 100, 3)} mbar across the array`, 8, H - 10);
      if (boost > 1.02) {
        g.fillStyle = "#A8322A";
        g.fillText(`shear in open apertures ×${sig(boost, 3)} → ${sig(mm.tauFeat * boost)} dyn/cm²`, wallX + wallW + 8, H - 10);
      }

      if (now - report > 200) {
        report = now;
        setStats({ p: st.passed, h: st.held, open: openN, t: st.t });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boost = NSLIT / (stats.open || 1);

  return (
    <section className="card" style={{ padding: "14px 16px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <div className="eyebrow">Cells traversing the aperture array</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink2)" }}>
          {m.nF} apertures · {sig(m.wS * 1e6, 3)} × {sig(m.hS * 1e6, 3)} µm · squeeze {sig(m.squeeze, 2)}×
        </div>
      </div>

      <canvas className="noprint" ref={cv} width={900} height={280}
        style={{ width: "100%", height: "auto", display: "block", borderRadius: 2 }} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
        <button className="minibtn" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
        <button className="minibtn" onClick={reset}>Reset</button>
        <select value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}
          style={{ width: "auto", padding: "3px 6px", fontSize: 11 }}>
          <option value={0.25}>0.25×</option><option value={1}>1×</option><option value={3}>3×</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, margin: 0 }}>
          stiffened fraction
          <input type="range" min="0" max="60" value={rigid} onChange={(e) => setRigid(parseInt(e.target.value, 10))}
            style={{ width: 110 }} />
          <span className="mono" style={{ fontSize: 11 }}>{rigid}%</span>
        </label>
      </div>

      <div className="mono" style={{ fontSize: 11.5, marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span style={{ color: "var(--ok)" }}>passed {stats.p}</span>
        <span style={{ color: "var(--alert)" }}>lodged {stats.h}</span>
        <span>apertures open {stats.open}/{NSLIT}</span>
        {boost > 1.02 && <span style={{ color: "var(--alert)", fontWeight: 600 }}>shear ×{sig(boost, 3)}</span>}
      </div>

      <p style={{ fontSize: 11.5, lineHeight: 1.55, color: "var(--ink2)", margin: "8px 0 0" }}>
        A cell needs to fold to {sig(m.squeeze, 2)}× to clear these apertures; this cell type manages about{" "}
        {sig(m.cell.deform || 1.5, 2)}×, and the stiffened fraction can only do ~1.15×. Twelve apertures stand in for
        the {m.nF} in your device, so read the counts as proportions. Watch what happens after the first few lodge:
        the same flow crosses fewer openings, shear in the survivors climbs, and retention accelerates. That positive
        feedback is why a retention curve is never linear in stiffened fraction.
      </p>
    </section>
  );
}

/* ---------- UI ---------- */

const DEFAULTS = {
  fluid: "custom", hct: 45, species: "o2", pulseHz: 1, targetTau: 1,
  nChannels: 1, chTol: 5, treeGen: 0, taper: "shear", taperR: 0.7,
  feature: "none", featN: 100, featW: 2, featH: 4, featL: 5,
  xsec: "rect", dia: 400, wTop: 1200,
  path: "straight", bends: 8, bendR: 500, grooveD: 60,
  format: "single", w2: 1000, h2: 200, Q2: 30, flowDir: "co", probChan: "top",
  memMat: "pet", poreD: 3, poreEps: 14, memT: 10, outletOffsetMM: 0,
  w: 1000, h: 200, L: 20, Q: 30, mu: 0.78,
  tubID: 0.5, tubL: 50, drive: "syringe", headMM: 20, syringeML: 5,
  material: "pdms", cellType: "huvec", cellD: 15,
  coating: "fibronectin", coatDelay: 1, coatDelayU: "h", attachH: 2, attachU: "h", seedDens: 100000,
  preWarm: false, symptom: "bubbles", notes: "",
};

/* Components live at module scope. Defining them inside Laminar() creates a new
   component type on every render, which remounts the inputs and steals focus
   mid-typing. Units are never uppercased: mPa·s → MPA·S reads as megapascals,
   and µm → ΜM is indistinguishable from millimetres.                        */

const Field = ({ label, unit, hint, children }) => (
  <div style={{ marginBottom: 11 }}>
    <label>
      {label}{unit ? <span className="unit"> {unit}</span> : null}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
    {children}
  </div>
);

const Metric = ({ k, v, u, flag }) => (
  <div style={{ padding: "9px 0", borderBottom: "1px solid var(--line2)" }}>
    <div className="eyebrow">{k}</div>
    <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: flag || "var(--ink)", marginTop: 2 }}>
      {v} <span style={{ fontSize: 10, fontWeight: 400, color: "var(--ink2)" }}>{u}</span>
    </div>
  </div>
);

/* Stores hours internally; lets the user work in minutes or hours. */
const TimeField = ({ label, hint, hours, unit, onHours, onUnit }) => (
  <div style={{ marginBottom: 11 }}>
    <label>{label}{hint ? <span className="hint">{hint}</span> : null}</label>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 82px", gap: 6 }}>
      <input
        type="number"
        step={unit === "min" ? 5 : 0.5}
        value={unit === "min" ? Math.round(hours * 60) : hours}
        onChange={(e) => {
          const v = parseFloat(e.target.value) || 0;
          onHours(unit === "min" ? v / 60 : v);
        }}
      />
      <select value={unit} onChange={(e) => onUnit(e.target.value)}>
        <option value="min">minutes</option>
        <option value="h">hours</option>
      </select>
    </div>
  </div>
);

export default function Laminar({ persist = false }) {
  const store = useMemo(() => makeStore(persist), [persist]);
  const [i, setI] = useState(DEFAULTS);
  const [tab, setTab] = useState("diagnose");
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const [cases, setCases] = useState(() => store.read());
  const [logging, setLogging] = useState(null);   // index of cause being confirmed
  const [fixNote, setFixNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pend, setPend] = useState([]);
  const endRef = useRef(null);
  const fileRef = useRef(null);

  const addFiles = async (list) => {
    const ok = Array.from(list || []).filter((f) => /^image\/(png|jpeg|jpg|webp|gif)$/.test(f.type)).slice(0, 4);
    const read = await Promise.all(ok.map((f) => new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res({ mt: f.type === "image/jpg" ? "image/jpeg" : f.type, b64: r.result.split(",")[1], url: r.result, name: f.name });
      r.onerror = () => rej(new Error("read failed"));
      r.readAsDataURL(f);
    })));
    setPend((p) => [...p, ...read].slice(0, 4));
  };

  const m = useMemo(() => compute(i), [i]);
  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked
      : e.target.type === "number" ? parseFloat(e.target.value) || 0
      : e.target.value;
    setI((p) => ({ ...p, [k]: v }));
  };

  const avail = SYMPTOMS.filter((s) => !s.mem || i.format === "membrane");
  const symptom = avail.find((s) => s.id === i.symptom) || avail[0];
  const ranked = useMemo(() => {
    const order = { [L_LIKELY]: 0, [L_MAYBE]: 1, [L_NO]: 2 };
    return symptom.causes
      .map((c) => ({ ...c, ...c.check(m, i) }))
      .sort((a, b) => order[a.lvl] - order[b.lvl]);
  }, [symptom, m, i]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const logOutcome = (cause, outcome, fix = "") => {
    const rec = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      symptom: symptom.label, cause: cause.t, predicted: cause.lvl, outcome, fix,
      format: i.format, w_um: i.w, h_um: i.h, L_mm: i.L, Q_ul_min: i.Q,
      material: i.material, drive: i.drive,
      w2_um: i.format === "membrane" ? i.w2 : "", h2_um: i.format === "membrane" ? i.h2 : "",
      Q2_ul_min: i.format === "membrane" ? i.Q2 : "", flowDir: i.format === "membrane" ? i.flowDir : "",
      poreD_um: i.format === "membrane" ? i.poreD : "", poreEps_pct: i.format === "membrane" ? i.poreEps : "",
      cellType: i.cellType, coating: i.coating, coatDelay_h: i.coatDelay,
      attachH_h: i.attachH, seedDens_cm2: i.seedDens,
      tau_dyn: +m.tau.toFixed(4), Re: +m.Re.toFixed(4),
      dPchip_Pa: +m.dPchip.toFixed(2), dPtube_Pa: +m.dPtube.toFixed(2),
      xSettle_mm: +(m.xSettle * 1000).toFixed(2), exch_volh: +m.exch.toFixed(3),
      tmpIn_Pa: i.format === "membrane" ? +m.tmpIn.toFixed(2) : "",
      leakFrac: i.format === "membrane" ? +m.leakFrac.toFixed(4) : "",
      memRatio: i.format === "membrane" ? +m.memRatio.toFixed(3) : "",
      notes: i.notes,
    };
    const next = [rec, ...cases];
    setCases(next); store.write(next);
    setLogging(null); setFixNote("");
  };

  const outcomeFor = (causeTitle) =>
    cases.find((c) => c.cause === causeTitle && c.symptom === symptom.label &&
      c.w_um === i.w && c.h_um === i.h && c.Q_ul_min === i.Q)?.outcome;

  // calibration: when the engine said "likely", how often was it right?
  const calib = useMemo(() => {
    const rows = {};
    for (const lvl of [L_LIKELY, L_MAYBE, L_NO]) rows[lvl] = { yes: 0, no: 0 };
    for (const c of cases) {
      if (!rows[c.predicted]) continue;
      rows[c.predicted][c.outcome === "confirmed" ? "yes" : "no"] += 1;
    }
    return rows;
  }, [cases]);

  const byCause = useMemo(() => {
    const map = new Map();
    for (const c of cases) {
      const k = `${c.symptom} ▸ ${c.cause}`;
      const e = map.get(k) || { k, yes: 0, no: 0 };
      e[c.outcome === "confirmed" ? "yes" : "no"] += 1;
      map.set(k, e);
    }
    return [...map.values()].sort((a, b) => b.yes + b.no - (a.yes + a.no));
  }, [cases]);

  const contextBlock = () => `DEVICE
  channel ${i.w} × ${i.h} µm, ${i.L} mm long, aspect ${sig(m.ar, 2)}:1, ${MATERIALS[i.material].n}
  volume ${sig(m.Vch * 1e9)} µL, floor area ${sig(m.floorCm2, 2)} cm²
  tubing ${i.tubID} mm ID × ${i.tubL} cm, drive: ${DRIVES[i.drive]}${i.drive === "gravity" || i.drive === "rocker" ? ` (${i.headMM} mm head)` : ""}
GEOMETRY
  cross-section: ${m.circular ? "circular" : m.trap ? "trapezoidal (reduced to an equal-area rectangle)" : "rectangular"}
  path: ${m.serp ? `serpentine, ${m.nBend} bends of radius ${i.bendR} µm, developed length ${sig(m.Lpath * 1000, 3)} mm, Dean number ${sig(m.De, 2)}` : m.grooved ? `herringbone grooves ${i.grooveD} µm deep — wall shear spans roughly ${sig(m.tauGroove, 2)}–${sig(m.tauRidge, 2)} dyn/cm² and the reported figure is a mean` : "straight"}
${m.gen > 0 ? `BIFURCATION TREE
  ${m.gen} generations → ${m.nTerm} terminal branches; daughter/parent width ratio ${sig(m.wRatio, 2)}
${m.genRows.map((r) => `  gen ${r.g}: ${r.n} branches, ${sig(r.w, 4)} µm wide, ${sig(r.q, 3)} µL/min each, shear ${sig(r.tau)} dyn/cm²`).join("\n")}
` : ""}FLOW
  Q = ${i.Q} µL/min, µ = ${i.mu} mPa·s
  mean velocity ${sig(m.U * 1000)} mm/s, Re = ${sig(m.Re, 2)}, Dh = ${sig(m.Dh * 1e6)} µm
  wall shear ${sig(m.tau)} dyn/cm² (${sig(m.tauPa)} Pa)
  ΔP chip ${mbar(m.dPchip)}, ΔP tubing ${mbar(m.dPtube)}
  residence time ${dur(m.tRes)}, exchange ${sig(m.exch, 2)} channel vol/h
  entrance length ${sig(m.Le * 1000, 2)} mm
${i.format === "membrane" ? `MEMBRANE DEVICE (${m.counter ? "counter-current" : "co-current"}, problem side: ${i.probChan === "bot" ? "basal" : "apical"})
  apical ${i.w}×${i.h} µm at ${i.Q} µL/min → shear ${sig(m.tauT)} dyn/cm², ΔP ${mbar(m.dPT)}
  basal ${i.w2}×${i.h2} µm at ${i.Q2} µL/min → shear ${sig(m.tauB)} dyn/cm², ΔP ${mbar(m.dPB)}
  ${MEMBRANES[i.memMat].n}, ${i.poreD} µm pores, ${i.poreEps}% open, ${i.memT} µm thick
  TMP ${mbar(m.tmpIn)} at apical inlet → ${mbar(m.tmpOut)} at apical outlet; outlet height offset ${mbar(m.headOffset)}
  R_membrane / R_apical = ${sig(m.memRatio, 2)}; estimated bare-membrane crossflow ${sig(m.leakFrac * 100, 2)}% of apical Q
  pore velocity ${sig(m.vPore * 1e6)} µm/s; pore is ${sig(m.poreVsCell * 100, 2)}% of a cell diameter
` : ""}CELLS
  ${m.cell.n}, d = ${sig(m.dCell * 1e6)} µm, physiological band ${m.cell.lo}–${m.cell.hi} dyn/cm²
  sedimentation ${sig(m.vSed * 1e6)} µm/s; full channel height in ${dur(m.tSedChan)}; landing distance ${sig(m.xSettle * 1000)} mm
  tubing: transit ${dur(m.tTransit)} vs half-bore settling ${dur(m.tSedTube)}
  coating ${i.coating}, applied ${i.coatDelay} h after treatment, ${i.attachH} h static attachment
  seeding target ${sig(i.seedDens)} cells/cm² → ${sig(m.seedN)} cells → ${sig(m.seedConc / 1e6, 2)}e6 cells/mL
BUBBLE PHYSICS
  capillary pressure to unpin ${mbar(m.dPcap)}; available head ${m.dPavail === Infinity ? "pump-limited (high)" : mbar(m.dPavail)}
  gas released on warming ${sig(m.gasRate)} µL/h at this flow
SYMPTOM: ${symptom.label}
RANKED CAUSES
${ranked.map((c) => `  [${c.lvl}] ${c.t} — ${c.why}`).join("\n")}
${i.notes ? `USER NOTES: ${i.notes}` : ""}`;

  const send = async (text) => {
    const q = (text ?? draft).trim();
    const files = pend;
    if ((!q && !files.length) || busy) return;
    const next = [...msgs, { role: "user", text: q || "What do you see here?", imgs: files }];
    setMsgs(next); setDraft(""); setPend([]); setBusy(true);
    try {
      const payload = {
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: `You are a microfluidics and organ-on-chip troubleshooting collaborator talking to an experienced device engineer. Be concrete and quantitative. Use the computed numbers below rather than inventing your own, and say so when a number is doing the work in your argument. Challenge the user's framing when the physics does not support it. Offer the single cheapest diagnostic experiment that would discriminate between the remaining candidate causes. No preamble, no bullet-point dumps unless asked, no restating the question. Keep it under 200 words unless the user asks for depth.

If the user attaches a micrograph, read the spatial pattern before anything else, because the pattern discriminates between causes that the numbers alone cannot separate: a sharp-edged stripe or track of missing cells means a bubble passed; diffuse thinning that is worst where shear is highest means shear; loss increasing from the outlet end backwards means nutrient depletion; rounded refractile cells that are still present mean an attachment or leachable problem, not a mechanical one; a gradient of density from inlet to outlet means sedimentation during seeding. Say which pattern you see and what it rules out.

CURRENT SETUP AND COMPUTED STATE
${contextBlock()}`,
          messages: next.map((x) =>
            x.role === "user" && x.imgs?.length
              ? { role: "user", content: [
                  ...x.imgs.map((f) => ({ type: "image", source: { type: "base64", media_type: f.mt, data: f.b64 } })),
                  { type: "text", text: x.text },
                ] }
              : { role: x.role, content: x.text }
          ),
      };

      // Deployed: hits your own /api/chat, which holds the key server-side.
      // Preview: that route does not exist, so fall back to the direct endpoint.
      const post = (url) => fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let r = await post("/api/chat").catch(() => null);
      // Only fall back to the direct endpoint if the proxy route is genuinely absent.
      if (!r || r.status === 404) {
        r = await post("https://api.anthropic.com/v1/messages").catch(() => null);
      }
      if (!r) throw new Error("no response from /api/chat — is the dev server still running?");

      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) {
        const msg = typeof d.error === "string" ? d.error : (d.error?.message || `HTTP ${r.status}`);
        setMsgs([...next, { role: "assistant", text: `Server said: ${msg}` }]);
        return;
      }
      const t = (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
      setMsgs([...next, { role: "assistant", text: t || "No text came back. Send it again." }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", text: `Could not reach the model — ${e.message || e}` }]);
    } finally { setBusy(false); }
  };

  const copyReport = async () => {
    try { await navigator.clipboard.writeText(contextBlock()); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  const lvlColor = (l) => (l === L_LIKELY ? "var(--alert)" : l === L_MAYBE ? "var(--warn)" : "var(--ink2)");

  const inBand = m.tau >= m.cell.lo && m.tau <= m.cell.hi;
  const tauColor = m.tau > m.cell.acute ? "var(--alert)" : inBand ? "var(--ok)" : "var(--warn)";

  return (
    <div className="lam">
      <style>{CSS}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 16px 60px" }}>

        {/* masthead */}
        <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14, marginBottom: 18 }}>
          <div>
            <div className="disp" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>LAMINAR</div>
            <div className="eyebrow" style={{ marginTop: 6 }}>Organ-chip fault finder · hydrodynamics first</div>
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn ghost noprint" onClick={copyReport}>{copied ? "Copied" : "Copy report"}</button>
          <button className="btn ghost noprint" onClick={() => window.print()}>Print / save PDF</button>
        </header>
        <hr className="rule" style={{ background: "var(--ink)", height: 2, marginBottom: 18 }} />

        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) 1fr", gap: 18, alignItems: "start" }} className="grid-wrap">

          {/* ---- inputs ---- */}
          <aside className="card" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>01 — Device</div>
            <Field label="Format">
              <select value={i.format} onChange={set("format")}>
                <option value="single">Single channel</option>
                <option value="membrane">Two channels + porous membrane</option>
              </select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Cross-section">
                <select value={i.xsec} onChange={set("xsec")}>
                  <option value="rect">Rectangular</option>
                  <option value="circular">Circular / round lumen</option>
                </select>
              </Field>
              <Field label="Channel path">
                <select value={i.path} onChange={set("path")}>
                  <option value="straight">Straight</option>
                  <option value="serpentine">Serpentine</option>
                  <option value="herringbone">Herringbone grooves</option>
                </select>
              </Field>
            </div>
            {i.path === "serpentine" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Number of bends"><input type="number" value={i.bends} onChange={set("bends")} /></Field>
                <Field label="Bend radius" unit="µm"><input type="number" value={i.bendR} onChange={set("bendR")} /></Field>
              </div>
            )}
            <Field label="Channels in parallel"
              hint={i.nChannels > 1 ? "Flow rate below is the total into the manifold; every result is per channel." : undefined}>
              <input type="number" min="1" value={i.nChannels} onChange={set("nChannels")} />
            </Field>
            {i.nChannels > 1 && (
              <Field label="Height tolerance" unit="± %" hint="Channel-to-channel spread from fabrication. Resistance goes as 1/h³, so small height errors become large flow errors.">
                <input type="number" step="1" value={i.chTol} onChange={set("chTol")} />
              </Field>
            )}
            <Field label="Bifurcation generations"
              hint={i.treeGen > 0 ? `1 inlet splitting into ${Math.pow(2, i.treeGen)} terminal branches. Widths below are generation 0; results are for a terminal branch.` : "0 = a single channel, no splitting."}>
              <select value={i.treeGen} onChange={(e) => setI((p) => ({ ...p, treeGen: parseInt(e.target.value, 10) }))}>
                {[0, 1, 2, 3, 4, 5].map((g) => (
                  <option key={g} value={g}>{g} — {Math.pow(2, g)} branch{g ? "es" : ""}</option>
                ))}
              </select>
            </Field>
            {i.treeGen > 0 && (
              <Field label="Daughter width scaling">
                <select value={i.taper} onChange={set("taper")}>
                  <option value="shear">Halve each split — holds shear constant</option>
                  <option value="none">Keep width — shear halves each split</option>
                  <option value="custom">Custom ratio</option>
                </select>
              </Field>
            )}
            {i.treeGen > 0 && i.taper === "custom" && (
              <Field label="Daughter / parent width" hint="0.5 preserves shear; 1.0 keeps width.">
                <input type="number" step="0.05" value={i.taperR} onChange={set("taperR")} />
              </Field>
            )}
            <Field label="In-channel features">
              <select value={i.feature} onChange={set("feature")}>
                <option value="none">None — open channel</option>
                <option value="slit">Slit array</option>
                <option value="pillar">Pillar array (gaps)</option>
                <option value="neck">Single constriction / neck</option>
              </select>
            </Field>
            {i.feature !== "none" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label={i.feature === "pillar" ? "Gap width" : "Slit width"} unit="µm">
                    <input type="number" step="0.1" value={i.featW} onChange={set("featW")} />
                  </Field>
                  <Field label={i.feature === "pillar" ? "Pillar height" : "Slit depth"} unit="µm">
                    <input type="number" step="0.1" value={i.featH} onChange={set("featH")} />
                  </Field>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Length along flow" unit="µm"><input type="number" step="0.1" value={i.featL} onChange={set("featL")} /></Field>
                  <Field label="Number in parallel"><input type="number" value={i.featN} onChange={set("featN")} /></Field>
                </div>
              </>
            )}
            {i.path === "herringbone" && (
              <Field label="Groove depth" unit="µm" hint="Depth of the herringbone ridges below the channel ceiling or floor.">
                <input type="number" value={i.grooveD} onChange={set("grooveD")} />
              </Field>
            )}
            {i.format === "membrane" && (
              <div className="eyebrow" style={{ margin: "4px 0 8px", color: "var(--flow)" }}>Apical channel</div>
            )}
            {i.xsec === "circular" ? (
              <Field label="Lumen diameter" unit="µm"><input type="number" value={i.dia} onChange={set("dia")} /></Field>
            ) : (
              <>
                {i.xsec === "trapezoid" && (
                  <Field label="Top width" unit="µm" hint="Wider opening, e.g. from an isotropic etch or laser cut.">
                    <input type="number" value={i.wTop} onChange={set("wTop")} />
                  </Field>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label={i.xsec === "trapezoid" ? "Base width" : "Channel width"} unit="µm">
                    <input type="number" value={i.w} onChange={set("w")} />
                  </Field>
                  <Field label="Channel height" unit="µm"><input type="number" value={i.h} onChange={set("h")} /></Field>
                </div>
              </>
            )}
            <Field label="Channel length" unit="mm"
              hint={i.path === "serpentine" ? "End-to-end straight length; bend arcs are added on top." : undefined}>
              <input type="number" value={i.L} onChange={set("L")} />
            </Field>
            {i.format === "membrane" && (
              <>
                <div className="eyebrow" style={{ margin: "14px 0 8px", color: "var(--flow)" }}>Basal channel</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Channel width" unit="µm"><input type="number" value={i.w2} onChange={set("w2")} /></Field>
                  <Field label="Channel height" unit="µm"><input type="number" value={i.h2} onChange={set("h2")} /></Field>
                </div>
                <Field label="Basal flow rate" unit="µL/min"><input type="number" step="0.1" value={i.Q2} onChange={set("Q2")} /></Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Flow direction">
                    <select value={i.flowDir} onChange={set("flowDir")}>
                      <option value="co">Co-current</option>
                      <option value="counter">Counter-current</option>
                    </select>
                  </Field>
                  <Field label="Problem side">
                    <select value={i.probChan} onChange={set("probChan")}>
                      <option value="top">Apical</option>
                      <option value="bot">Basal</option>
                    </select>
                  </Field>
                </div>
                <Field label="Membrane type">
                  <select value={i.memMat} onChange={set("memMat")}>
                    {Object.entries(MEMBRANES).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
                  </select>
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <Field label="Pore ⌀" unit="µm"><input type="number" step="0.1" value={i.poreD} onChange={set("poreD")} /></Field>
                  <Field label="Open area" unit="%"><input type="number" step="1" value={i.poreEps} onChange={set("poreEps")} /></Field>
                  <Field label="Thickness" unit="µm"><input type="number" value={i.memT} onChange={set("memT")} /></Field>
                </div>
                <Field label="Outlet height offset" unit="mm" hint="Apical outlet minus basal outlet. 10 mm ≈ 1 mbar of transmembrane pressure.">
                  <input type="number" step="1" value={i.outletOffsetMM} onChange={set("outletOffsetMM")} />
                </Field>
              </>
            )}
            <Field label="Chip material">
              <select value={i.material} onChange={set("material")}>
                {Object.entries(MATERIALS).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
              </select>
            </Field>

            <hr className="rule" style={{ margin: "14px 0" }} />
            <div className="eyebrow" style={{ marginBottom: 10 }}>02 — Flow</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label={i.format === "membrane" ? "Apical flow rate" : "Flow rate"} unit="µL/min">
                <input type="number" step="0.1" value={i.Q} onChange={set("Q")} />
              </Field>
              <Field label="Fluid">
                <select value={i.fluid} onChange={set("fluid")}>
                  {Object.entries(FLUIDS).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
                </select>
              </Field>
            </div>
            {i.fluid === "custom" && (
              <Field label="Viscosity" unit="mPa·s"><input type="number" step="0.01" value={i.mu} onChange={set("mu")} /></Field>
            )}
            {i.fluid === "blood" && (
              <Field label="Haematocrit" unit="%"
                hint={`Apparent viscosity ${sig(m.muMPas, 3)} mPa·s at this channel size — blood thins below ~300 µm, so the number is geometry-dependent.`}>
                <input type="number" step="1" value={i.hct} onChange={set("hct")} />
              </Field>
            )}
            {i.drive === "peristaltic" && (
              <Field label="Pulse frequency" unit="Hz"><input type="number" step="0.1" value={i.pulseHz} onChange={set("pulseHz")} /></Field>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Diffusing species" hint="Sets the Péclet number.">
                <select value={i.species} onChange={set("species")}>
                  {Object.entries(SPECIES).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Pump type">
              <select value={i.drive} onChange={set("drive")}>
                {Object.entries(DRIVES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            {(i.drive === "gravity" || i.drive === "rocker") && (
              <Field label="Head height" unit="mm" hint="Vertical drop from reservoir surface to outlet.">
                <input type="number" value={i.headMM} onChange={set("headMM")} />
              </Field>
            )}
            {i.drive.startsWith("syringe") && (
              <Field label="Syringe size" unit="mL"><input type="number" value={i.syringeML} onChange={set("syringeML")} /></Field>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Tubing bore" unit="mm ID"><input type="number" step="0.05" value={i.tubID} onChange={set("tubID")} /></Field>
              <Field label="Tubing length" unit="cm"><input type="number" value={i.tubL} onChange={set("tubL")} /></Field>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
              <input type="checkbox" checked={i.preWarm} onChange={set("preWarm")} style={{ width: "auto" }} />
              Whole fluidic path pre-warmed to 37 °C
            </label>

            <hr className="rule" style={{ margin: "14px 0" }} />
            <div className="eyebrow" style={{ marginBottom: 10 }}>03 — Biology</div>
            <Field label="Cell type">
              <select value={i.cellType} onChange={(e) => setI((p) => ({ ...p, cellType: e.target.value, cellD: CELLS[e.target.value].d }))}>
                {Object.entries(CELLS).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
              </select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Cell diameter" unit="µm"><input type="number" value={i.cellD} onChange={set("cellD")} /></Field>
              <Field label="Seeding density" unit="cells/cm²"><input type="number" step="10000" value={i.seedDens} onChange={set("seedDens")} /></Field>
            </div>
            <Field label="Surface coating">
              <select value={i.coating} onChange={set("coating")}>
                {["none", "gelatin", "fibronectin", "collagen I", "collagen IV", "Matrigel", "laminin", "PLL/PLO", "custom"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <TimeField
              label="Delay before coating"
              hint="Time between plasma treatment or bonding and applying the coating. PDMS turns hydrophobic again within hours, so a long delay means the protein adsorbs in a non-adhesive state."
              hours={i.coatDelay} unit={i.coatDelayU}
              onHours={(v) => setI((p) => ({ ...p, coatDelay: v }))}
              onUnit={(u) => setI((p) => ({ ...p, coatDelayU: u }))}
            />
            <TimeField
              label="Static time before flow"
              hint="How long cells sit in the incubator with the pump off after seeding, before perfusion starts."
              hours={i.attachH} unit={i.attachU}
              onHours={(v) => setI((p) => ({ ...p, attachH: v }))}
              onUnit={(u) => setI((p) => ({ ...p, attachU: u }))}
            />
          </aside>

          {/* ---- main ---- */}
          <main style={{ display: "grid", gap: 18 }}>

            <FlowSim m={m} i={i} />
            {m.featOn && <SlitSim m={m} i={i} />}

            {m.gen > 0 && (
              <section className="card" style={{ padding: 16 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  Bifurcation tree · {m.nTerm} terminal branches
                </div>
                <table>
                  <thead>
                    <tr><th>Gen</th><th>Branches</th><th>Width µm</th><th>Q per branch µL/min</th><th>Shear dyn/cm²</th></tr>
                  </thead>
                  <tbody>
                    {m.genRows.map((r) => (
                      <tr key={r.g}>
                        <td className="mono">{r.g}</td>
                        <td className="mono">{r.n}</td>
                        <td className="mono">{sig(r.w, 4)}</td>
                        <td className="mono">{sig(r.q, 3)}</td>
                        <td className="mono" style={{ fontWeight: 600, color: r.tau > m.cell.hi ? "var(--warn)" : "var(--ink)" }}>
                          {sig(r.tau)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink2)", margin: "10px 0 0" }}>
                  {m.wRatio === 0.5
                    ? "Halving the width at each split keeps shear identical in every generation — flow per branch and channel width fall together."
                    : m.wRatio === 1
                    ? `Constant width means shear falls by half at every split: ${sig(m.genRows[0].tau)} at the inlet down to ${sig(m.genRows[m.genRows.length - 1].tau)} in the terminal branches. Cells in different generations are not experiencing the same experiment.`
                    : `At a ratio of ${sig(m.wRatio, 2)}, shear goes from ${sig(m.genRows[0].tau)} to ${sig(m.genRows[m.genRows.length - 1].tau)} dyn/cm² across the tree.`}
                  {" "}A ±{i.chTol}% height tolerance splits flow unevenly at every junction, and the errors compound down the tree.
                </p>
              </section>
            )}

            <section className="card" style={{ padding: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Transport regime</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))", gap: "0 22px" }}>
                <Metric k="Reynolds" v={sig(m.Re, 2)} u="" />
                {m.pulsatile && <Metric k="Womersley" v={sig(m.womersley, 2)} u="" />}
              </div>
              <table style={{ marginTop: 10 }}>
                <thead><tr><th>Species</th><th>Péclet</th><th>Crosses the gap in</th><th>Verdict</th></tr></thead>
                <tbody>
                  {Object.entries(SPECIES).map(([k, sp]) => {
                    const pe = (m.U * m.h) / sp.D;
                    const td = (m.h * m.h) / (2 * sp.D);
                    const wins = td < m.t50;
                    return (
                      <tr key={k}>
                        <td>{sp.n}</td>
                        <td className="mono" style={{ fontWeight: 600 }}>{sig(pe, 3)}</td>
                        <td className="mono">{dur(td)}</td>
                        <td style={{ color: wins ? "var(--ok)" : "var(--warn)", fontSize: 11.5 }}>
                          {wins ? "equilibrates before leaving" : "swept out before it crosses"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink2)", margin: "10px 0 0" }}>
                {m.Re < 1 ? "Re below 1 — viscosity dominates completely; flow is reversible and mixing happens only by diffusion." :
                 m.Re < 100 ? "Firmly laminar. No turbulence, no inertial mixing." :
                 "Re is high for a microchannel — check for recirculation at expansions."}
                {" "}Péclet {sig(m.Pe, 3)} compares sweeping to diffusing across the channel:{" "}
                {m.Pe < 1
                  ? `${m.spec.n.toLowerCase()} crosses the gap far faster than flow carries it along, so the channel is well mixed in the transverse direction.`
                  : `${m.spec.n.toLowerCase()} takes ${dur(m.tDiff)} to diffuse the ${sig(m.h * 1e6, 3)} µm gap while the median cell-free path through the channel takes ${dur(m.t50)}. ${m.tDiff > m.t50 ? "It leaves before it can cross — expect a concentration gradient from wall to wall." : "There is time to cross, so the transverse gradient stays shallow."}`}
                {m.pulsatile && ` Womersley ${sig(m.womersley, 2)} — ${m.womersley < 1 ? "the profile stays quasi-steady through each pulse, so peak shear tracks peak flow." : "the profile cannot keep up with the pulse; peak shear lags and flattens."}`}
              </p>

              <hr className="rule" style={{ margin: "14px 0" }} />
              <div className="eyebrow" style={{ marginBottom: 10 }}>Exposure spread · residence time distribution</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: "0 22px" }}>
                <Metric k="First 10 % out by" v={dur(m.t10)} u="" />
                <Metric k="Half out by" v={dur(m.t50)} u="" />
                <Metric k="90 % out by" v={dur(m.t90)} u="" />
              </div>
              <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink2)", margin: "10px 0 0" }}>
                Laminar flow does not give every cell the same exposure. The fastest streamline leaves in{" "}
                {dur(m.t10)} while the slowest tenth is still inside at {dur(m.t90)} — a{" "}
                {sig(m.t90 / m.t10, 2)}-fold spread on a mean of {dur(m.tRes)}. For a drug or cytokine dose, that
                spread is the dose, not the average.
              </p>

              <hr className="rule" style={{ margin: "14px 0" }} />
              <div className="eyebrow" style={{ marginBottom: 10 }}>Design for a target</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "end" }}>
                <Field label="Target wall shear" unit="dyn/cm²">
                  <input type="number" step="0.1" value={i.targetTau} onChange={set("targetTau")} />
                </Field>
                <div style={{ marginBottom: 11 }}>
                  <div className="eyebrow">Required flow rate</div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: "var(--flow)" }}>
                    {sig(m.QtargetUL, 3)} <span style={{ fontSize: 11, color: "var(--ink2)" }}>µL/min</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["physiological low", m.cell.lo], ["physiological high", m.cell.hi]].map(([lbl, v]) => (
                  <button key={lbl} className="minibtn" onClick={() => setI((p) => ({ ...p, targetTau: v }))}>
                    {lbl} · {v}
                  </button>
                ))}
                <button className="minibtn" onClick={() => setI((p) => ({ ...p, Q: parseFloat(sig(m.QtargetUL, 3)) }))}>
                  Apply to flow rate
                </button>
              </div>
              <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink2)", margin: "10px 0 0" }}>
                At this geometry, {sig(m.QtargetUL, 3)} µL/min gives {sig(i.targetTau, 3)} dyn/cm². Median residence
                would be {dur((m.wEq * m.h * m.L) / Math.max(m.Qtarget, 1e-30) * 0.85)} — check that against how long
                your cells need to see whatever is in the medium.
              </p>
            </section>

            {/* shear gauge */}
            <section className="card" style={{ padding: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Wall shear against {m.cell.n}</div>
              <ShearGauge tau={m.tau} lo={m.cell.lo} hi={m.cell.hi} acute={m.cell.acute} color={tauColor} />
              {!m.uniformShear && (
                <div style={{ marginTop: 12, padding: "10px 12px", border: "1px solid var(--warn)", borderRadius: 2 }}>
                  <div className="eyebrow" style={{ color: "var(--warn)", marginBottom: 4 }}>Shear is not uniform here</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink2)" }}>
                    {m.grooved
                      ? `Herringbone grooves make wall shear vary across the surface — roughly ${sig(m.tauGroove, 2)} dyn/cm² on a groove floor up to about ${sig(m.tauRidge, 2)} on a ridge, against the ${sig(m.tau)} nominal. Cells sitting in grooves are in a different mechanical world from cells on ridges. Treat the single figure as a mean, and do not use a grooved channel when the experiment needs a defined shear.`
                      : `Dean number is ${sig(m.De, 2)} at these bends. Above about 10, secondary flow develops in the curve and the outer wall of each bend runs higher than the ${sig(m.tau)} dyn/cm² reported here, which is the straight-section value. Quantify in a straight run, not in a bend.`}
                  </div>
                </div>
              )}
            </section>

            {/* metrics */}
            <section className="card" style={{ padding: "6px 16px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0 22px" }}>
                <Metric k="Wall shear" v={sig(m.tau)} u="dyn/cm²" flag={tauColor} />
                <Metric k="ΔP total" v={sig((m.dPchip + m.dPtube + m.dPfeat) / 100)} u="mbar" />
                <Metric k="Residence, median" v={dur(m.t50)} u="" />
                <Metric k="Reynolds" v={sig(m.Re, 2)} u="" />
                <Metric k="Viscosity in use" v={sig(m.muMPas, 3)} u="mPa·s" />
              </div>
              <details style={{ marginTop: 6 }}>
                <summary className="eyebrow" style={{ cursor: "pointer", padding: "8px 0" }}>Advanced metrics</summary>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0 22px" }}>
                <Metric k="Mean velocity" v={sig(m.U * 1000)} u="mm/s" />
                <Metric k="ΔP chip" v={sig(m.dPchip / 100)} u="mbar" />
                <Metric k="ΔP tubing" v={sig(m.dPtube / 100)} u="mbar" flag={m.dPtube > m.dPchip * 3 ? "var(--warn)" : null} />
                <Metric k="Channel volume" v={sig(m.Vch * 1e9)} u="µL" />
                <Metric k="Residence time" v={dur(m.tRes)} u="" />
                <Metric k="Exchange" v={sig(m.exch, 2)} u="vol/h" flag={m.exch < 1 ? "var(--warn)" : null} />
                <Metric k="Sedimentation" v={sig(m.vSed * 1e6)} u="µm/s" />
                <Metric k="Landing distance" v={sig(m.xSettle * 1000)} u="mm" flag={m.xSettle > m.L * 1000 ? "var(--warn)" : null} />
                <Metric k="Bubble unpinning ΔP" v={sig(m.dPcap / 100)} u="mbar" />
                <Metric k="Seeding suspension" v={sig(m.seedConc / 1e6, 2)} u="×10⁶ /mL" />
                {m.serp && <Metric k="Developed length" v={sig(m.Lpath * 1000, 3)} u="mm" />}
                {m.serp && <Metric k="Dean number" v={sig(m.De, 2)} u="" flag={m.De > 10 ? "var(--warn)" : null} />}
                {m.grooved && <Metric k="Shear range" v={`${sig(m.tauGroove, 2)}–${sig(m.tauRidge, 2)}`} u="dyn/cm²" flag="var(--warn)" />}
                {m.nCh > 1 && <Metric k="Flow per channel" v={sig((m.Qtot / m.nCh) * 6e10, 3)} u="µL/min" />}
                {m.nCh > 1 && <Metric k="Flow spread" v={`±${sig(m.flowSpread * 100, 2)}`} u="% between channels" flag={m.flowSpread > 0.2 ? "var(--warn)" : null} />}
              </div>
              {m.featOn && (
                <>
                  <hr className="rule" style={{ margin: "12px 0 0" }} />
                  <div className="eyebrow" style={{ padding: "12px 0 2px" }}>
                    Inside the {i.feature === "pillar" ? "pillar gaps" : i.feature === "neck" ? "neck" : "slits"} · {m.nF} in parallel · this is where the peak stress lives
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0 22px" }}>
                    <Metric k="Shear in feature" v={sig(m.tauFeat)} u="dyn/cm²" flag={m.tauFeat > m.tau * 5 ? "var(--warn)" : null} />
                    <Metric k="Velocity in feature" v={sig(m.Ufeat * 1000)} u="mm/s" />
                    <Metric k="ΔP across array" v={sig(m.dPfeat)} u="Pa" />
                    <Metric k="Share of chip ΔP" v={sig(m.featShare * 100, 2)} u="%" flag={m.featShare > 0.8 ? "var(--warn)" : null} />
                    <Metric k="Transit through" v={dur(m.tFeat)} u="" />
                    <Metric k="Elongation rate" v={sig(m.strainRate, 3)} u="s⁻¹" />
                    <Metric k="Squeeze ratio" v={sig(m.squeeze, 2)} u="cell ⌀ / gap" flag={m.squeeze > 1 ? "var(--warn)" : null} />
                    <Metric k="Resistance per feature" v={sig(m.Rfeat, 3)} u="Pa·s/m³" />
                  </div>
                </>
              )}
              </details>
              {i.format === "membrane" && (
                <>
                  <hr className="rule" style={{ margin: "12px 0 0" }} />
                  <div className="eyebrow" style={{ padding: "12px 0 2px" }}>
                    Across the membrane · {MEMBRANES[i.memMat].n} · {MEMBRANES[i.memMat].note}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0 22px" }}>
                    <Metric k="Shear apical" v={sig(m.tauT)} u="dyn/cm²" />
                    <Metric k="Shear basal" v={sig(m.tauB)} u="dyn/cm²" />
                    <Metric k="TMP at inlet" v={sig(m.tmpIn / 100)} u="mbar" flag={Math.abs(m.tmpIn) > 50 ? "var(--warn)" : null} />
                    <Metric k="TMP at outlet" v={sig(m.tmpOut / 100)} u="mbar" flag={Math.abs(m.tmpOut) > 50 ? "var(--warn)" : null} />
                    <Metric k="Outlet head offset" v={sig(m.headOffset / 100)} u="mbar" flag={m.headOffset > Math.max(m.dPT, m.dPB) ? "var(--warn)" : null} />
                    <Metric k="R membrane / R channel" v={sig(m.memRatio, 2)} u="" flag={m.memRatio < 1 ? "var(--warn)" : null} />
                    <Metric k="Crossflow" v={sig(m.leakFrac * 100, 2)} u="% of apical Q" flag={m.leakFrac > 0.2 ? "var(--alert)" : null} />
                    <Metric k="Pore velocity" v={sig(m.vPore * 1e6)} u="µm/s" />
                    <Metric k="Pore vs cell" v={sig(m.poreVsCell * 100, 2)} u="% of cell ⌀" flag={m.poreVsCell > 0.35 ? "var(--warn)" : null} />
                  </div>
                </>
              )}
            </section>

            {/* tabs */}
            <section className="card">
              <div className="noprint" style={{ display: "flex", borderBottom: "1px solid var(--line)" }}>
                {[["diagnose", "Diagnose"], ["chat", "Brainstorm"], ["log", `Case log${cases.length ? ` · ${cases.length}` : ""}`], ["valid", "Validation"]].map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} className="mono"
                    style={{
                      flex: 1, padding: "12px 8px", border: 0, cursor: "pointer", fontSize: 12, letterSpacing: ".1em",
                      textTransform: "uppercase", background: tab === k ? "var(--ink)" : "transparent",
                      color: tab === k ? "var(--ground)" : "var(--ink2)",
                    }}>{l}</button>
                ))}
              </div>

              {tab === "diagnose" && (
                <div style={{ padding: 16 }}>
                  <Field label="What is going wrong">
                    <select value={i.symptom} onChange={set("symptom")}>
                      {avail.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Anything else you have observed (optional)">
                    <textarea rows={2} value={i.notes} onChange={set("notes")} placeholder="e.g. only happens after the second day, always at the outlet end" />
                  </Field>

                  <div style={{ marginTop: 14 }}>
                    {ranked.map((c, k) => (
                      <article key={k} style={{ borderTop: "1px solid var(--line2)", padding: "14px 0" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                          <span className="tag" style={{ color: lvlColor(c.lvl) }}>{c.lvl}</span>
                          <h3 className="disp" style={{ margin: 0, fontSize: 16, fontWeight: 500, flex: 1, minWidth: 200 }}>{c.t}</h3>
                        </div>
                        <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--ink2)" }}>{c.why}</p>
                        {c.lvl !== L_NO && (
                          <ul style={{ margin: "10px 0 0", paddingLeft: 16, fontSize: 13.5, lineHeight: 1.6 }}>
                            {c.fix.filter((f) => f.trim().length > 12).map((f, q) => <li key={q} style={{ marginBottom: 4 }}>{f}</li>)}
                          </ul>
                        )}
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                          <span className="eyebrow" style={{ marginRight: 2 }}>Was it this?</span>
                          <button className="minibtn" data-on={outcomeFor(c.t) === "confirmed" ? "yes" : undefined}
                            onClick={() => { setLogging(logging === k ? null : k); setFixNote(""); }}>
                            This was it
                          </button>
                          <button className="minibtn" data-on={outcomeFor(c.t) === "ruled_out" ? "no" : undefined}
                            onClick={() => logOutcome(c, "ruled_out")}>
                            Ruled out
                          </button>
                        </div>
                        {logging === k && (
                          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                            <input value={fixNote} onChange={(e) => setFixNote(e.target.value)}
                              placeholder="What actually fixed it?"
                              onKeyDown={(e) => { if (e.key === "Enter") logOutcome(c, "confirmed", fixNote); }} />
                            <button className="btn" onClick={() => logOutcome(c, "confirmed", fixNote)}>Log</button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>

                  <button className="btn" style={{ marginTop: 16 }}
                    onClick={() => { setTab("chat"); send(`Here is my setup and the ranked causes for "${symptom.label}". Tell me which one you would chase first and what single experiment separates it from the others.`); }}>
                    Ask for a second opinion
                  </button>
                </div>
              )}

              {tab === "chat" && (
                <div style={{ padding: 16 }}>
                  <div className="scroll" style={{ maxHeight: 420, overflowY: "auto", marginBottom: 12 }}>
                    {msgs.length === 0 && (
                      <div style={{ padding: "18px 0", color: "var(--ink2)", fontSize: 13.5, lineHeight: 1.6 }}>
                        The model sees every number on this page. Ask it to argue with your diagnosis, propose a redesign, or read a micrograph against the physics.
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                          {[
                            `What flow rate gives me ${m.cell.lo}–${m.cell.hi} dyn/cm² here?`,
                            "Redesign the channel to halve shear without changing flow rate.",
                            ...(i.format === "membrane"
                              ? ["Set both flow rates so transmembrane pressure is zero along the whole channel."]
                              : ["Why is my tubing pressure drop larger than my chip's?"]),
                          ].map((p) => (
                            <button key={p} className="btn ghost" style={{ fontSize: 11, textTransform: "none", letterSpacing: 0 }}
                              onClick={() => send(p)}>{p}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {msgs.map((x, k) => (
                      <div key={k} style={{ marginBottom: 14 }}>
                        <div className="eyebrow" style={{ color: x.role === "user" ? "var(--dye)" : "var(--flow)", marginBottom: 4 }}>
                          {x.role === "user" ? "You" : "Laminar"}
                        </div>
                        {x.imgs?.length > 0 && (
                          <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                            {x.imgs.map((f, q) => (
                              <img key={q} src={f.url} alt={f.name} style={{ height: 74, border: "1px solid var(--line)", borderRadius: 2 }} />
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: 13.5, lineHeight: 1.62, whiteSpace: "pre-wrap" }}>{x.text}</div>
                      </div>
                    ))}
                    {busy && <div className="mono" style={{ fontSize: 12, color: "var(--ink2)" }}>thinking…</div>}
                    <div ref={endRef} />
                  </div>
                  {pend.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                      {pend.map((f, q) => (
                        <div key={q} style={{ position: "relative" }}>
                          <img src={f.url} alt={f.name} style={{ height: 60, border: "1px solid var(--line)", borderRadius: 2, display: "block" }} />
                          <button onClick={() => setPend((p) => p.filter((_, z) => z !== q))} aria-label="Remove image"
                            style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 9, border: "1px solid var(--line)", background: "var(--paper)", cursor: "pointer", fontSize: 11, lineHeight: 1, padding: 0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                    style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder="Describe what you are seeing, or drop a micrograph here…" />
                    <div style={{ display: "grid", gap: 6 }}>
                      <button className="btn ghost" onClick={() => fileRef.current?.click()} title="Attach a micrograph">Image</button>
                      <button className="btn" onClick={() => send()} disabled={busy || (!draft.trim() && !pend.length)}>Send</button>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                      onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink2)", marginTop: 6 }}>
                    Brightfield or fluorescence, whole channel if you have it — the pattern of loss matters more than the magnification.
                  </div>
                </div>
              )}

              {tab === "valid" && (
                <div style={{ padding: 16 }}>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink2)", margin: "0 0 14px" }}>
                    Every row is recomputed by this build, right now, from the same case definitions the
                    test suite uses. Nothing here is typed in by hand, so the table cannot drift away
                    from what the code does.
                  </p>
                  <table>
                    <thead>
                      <tr><th>Device</th><th>Reference</th><th>Laminar</th><th>Error</th><th></th></tr>
                    </thead>
                    <tbody>
                      {REFERENCE_CASES.map((rc) => {
                        const got = compute({ ...DEFAULTS, ...rc.inputs })[rc.field];
                        const err = ((got - rc.expected) / rc.expected) * 100;
                        const ok = Math.abs(err) <= rc.tolPct;
                        return (
                          <tr key={rc.id}>
                            <td style={{ maxWidth: 230 }}>
                              {rc.device}
                              <div style={{ fontSize: 10.5, color: "var(--ink2)", marginTop: 2 }}>{rc.source}</div>
                            </td>
                            <td className="mono">{sig(rc.expected, 4)} {rc.unit}</td>
                            <td className="mono" style={{ fontWeight: 600 }}>{sig(got, 4)}</td>
                            <td className="mono" style={{ color: ok ? "var(--ok)" : "var(--alert)" }}>
                              {err >= 0 ? "+" : ""}{sig(err, 2)} %
                            </td>
                            <td className="mono" style={{ color: ok ? "var(--ok)" : "var(--alert)" }}>
                              {ok ? "pass" : "FAIL"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 14 }}>
                    {REFERENCE_CASES.filter((rc) => rc.note).map((rc) => (
                      <p key={rc.id} style={{ fontSize: 12, lineHeight: 1.55, color: "var(--ink2)", margin: "0 0 7px" }}>
                        <strong style={{ fontWeight: 600 }}>{rc.device}.</strong> {rc.note}
                      </p>
                    ))}
                  </div>
                  <hr className="rule" style={{ margin: "16px 0" }} />
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Where confidence ends</div>
                  {[
                    ["Checked against an external reference", "var(--ok)", [
                      "Wall shear in rectangular and circular channels",
                      "Pressure drop in channels and tubing",
                      "Apparent blood viscosity vs channel size and haematocrit",
                      "Stokes sedimentation and landing distance",
                    ]],
                    ["Computed from standard theory, not independently checked", "var(--warn)", [
                      "Transmembrane pressure and bare-membrane crossflow",
                      "Aperture-array resistance including entrance losses",
                      "Residence time distribution and Péclet transport",
                      "Bifurcation flow splitting",
                      "Dean number at bends; herringbone shear is a range, not a value",
                    ]],
                    ["Not modelled — these are judgement, not calculation", "var(--alert)", [
                      "Bubble nucleation and where a bubble will lodge",
                      "Cell adhesion kinetics and detachment probability",
                      "Protein fouling and coating degradation over days",
                      "Long-term clogging beyond the occlusion cascade",
                      "Cell tolerance bands, coating recommendations, deformability limits — literature-typical defaults, not measurements",
                    ]],
                  ].map(([title, colour, items]) => (
                    <div key={title} style={{ marginBottom: 12 }}>
                      <div className="mono" style={{ fontSize: 11, color: colour, fontWeight: 600, marginBottom: 4 }}>{title}</div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.55, color: "var(--ink2)" }}>
                        {items.map((x) => <li key={x} style={{ marginBottom: 2 }}>{x}</li>)}
                      </ul>
                    </div>
                  ))}
                  <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink2)", margin: 0 }}>
                    The third list is not a roadmap. Some of it — adhesion kinetics, fouling — is not reducible to a
                    closed-form number at all, and a tool that pretended otherwise would be worse than one that says so.
                  </p>
                </div>
              )}
              {tab === "log" && (
                <div style={{ padding: 16 }}>
                  {cases.length === 0 ? (
                    <div style={{ color: "var(--ink2)", fontSize: 13.5, lineHeight: 1.65 }}>
                      Nothing logged yet. Every time you confirm or rule out a cause on the Diagnose tab, the full device
                      configuration is recorded alongside the verdict this app gave.
                      <div style={{ marginTop: 10 }}>
                        The physics anyone can recompute. Whether the ranking was right, across hundreds of real chips,
                        has to be measured — and it is the only thing here that improves with use.
                      </div>
                      {!persist && (
                        <div className="mono" style={{ fontSize: 11, marginTop: 12, color: "var(--warn)" }}>
                          Preview mode: entries live in memory and vanish on reload. Export before you close the tab.
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="eyebrow" style={{ marginBottom: 8 }}>Calibration — was the ranking right?</div>
                      <table>
                        <thead>
                          <tr><th>Engine said</th><th>Confirmed</th><th>Ruled out</th><th>Hit rate</th></tr>
                        </thead>
                        <tbody>
                          {[L_LIKELY, L_MAYBE, L_NO].map((lvl) => {
                            const r = calib[lvl], n = r.yes + r.no;
                            return (
                              <tr key={lvl}>
                                <td><span className="tag" style={{ color: lvlColor(lvl) }}>{lvl}</span></td>
                                <td className="mono">{r.yes}</td>
                                <td className="mono">{r.no}</td>
                                <td className="mono" style={{ fontWeight: 600 }}>{n ? `${Math.round((r.yes / n) * 100)} %` : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink2)", margin: "10px 0 18px" }}>
                        A well-calibrated engine has a high hit rate on the top row and a low one on the bottom. If
                        "unlikely" causes keep turning out to be the answer, the check for that cause is wrong.
                      </p>

                      <div className="eyebrow" style={{ marginBottom: 8 }}>By cause</div>
                      <table>
                        <thead><tr><th>Symptom ▸ cause</th><th>Confirmed</th><th>Ruled out</th></tr></thead>
                        <tbody>
                          {byCause.slice(0, 12).map((r) => (
                            <tr key={r.k}><td>{r.k}</td><td className="mono">{r.yes}</td><td className="mono">{r.no}</td></tr>
                          ))}
                        </tbody>
                      </table>

                      <div className="eyebrow" style={{ margin: "18px 0 8px" }}>Recent entries</div>
                      <div className="scroll" style={{ maxHeight: 220, overflowY: "auto" }}>
                        <table>
                          <thead><tr><th>When</th><th>Cause</th><th>Said</th><th>Outcome</th><th>Fix</th></tr></thead>
                          <tbody>
                            {cases.slice(0, 40).map((c) => (
                              <tr key={c.id}>
                                <td className="mono" style={{ whiteSpace: "nowrap" }}>{c.timestamp.slice(0, 10)}</td>
                                <td>{c.cause}</td>
                                <td style={{ color: lvlColor(c.predicted) }}>{c.predicted}</td>
                                <td style={{ color: c.outcome === "confirmed" ? "var(--ok)" : "var(--ink2)" }}>
                                  {c.outcome === "confirmed" ? "confirmed" : "ruled out"}
                                </td>
                                <td>{c.fix}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                        <button className="btn ghost" onClick={() => download("laminar-cases.csv", toCSV(cases), "text/csv")}>Export CSV</button>
                        <button className="btn ghost" onClick={() => download("laminar-cases.json", JSON.stringify(cases, null, 2), "application/json")}>Export JSON</button>
                        <button className="btn ghost" onClick={() => { if (window.confirm(`Delete all ${cases.length} logged cases?`)) { setCases([]); store.write([]); } }}>Clear log</button>
                      </div>
                      {!persist && (
                        <div className="mono" style={{ fontSize: 10.5, marginTop: 10, color: "var(--warn)" }}>
                          Preview mode: in-memory only. Export before reloading.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>

            <section className="printonly card" style={{ padding: 16 }}>
              <h2 className="disp" style={{ margin: "0 0 4px", fontSize: 18 }}>Laminar — device report</h2>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink2)", marginBottom: 10 }}>
                Generated {new Date().toLocaleString()} · symptom under review: {symptom.label}
              </div>
              <pre style={{ margin: 0, fontFamily: "'IBM Plex Mono', monospace" }}>{contextBlock()}</pre>
              <h3 className="disp" style={{ fontSize: 14, margin: "14px 0 6px" }}>Ranked causes</h3>
              {ranked.map((c, k) => (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>[{c.lvl}] {c.t}</div>
                  <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--ink2)" }}>{c.why}</div>
                </div>
              ))}
              <h3 className="disp" style={{ fontSize: 14, margin: "14px 0 6px" }}>Validation of this build</h3>
              <table>
                <thead><tr><th>Device</th><th>Reference</th><th>Laminar</th><th>Error</th></tr></thead>
                <tbody>
                  {REFERENCE_CASES.map((rc) => {
                    const got = compute({ ...DEFAULTS, ...rc.inputs })[rc.field];
                    const err = ((got - rc.expected) / rc.expected) * 100;
                    return (
                      <tr key={rc.id}>
                        <td style={{ fontSize: 11 }}>{rc.device}</td>
                        <td className="mono">{sig(rc.expected, 4)} {rc.unit}</td>
                        <td className="mono">{sig(got, 4)}</td>
                        <td className="mono">{err >= 0 ? "+" : ""}{sig(err, 2)} %</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <p className="mono" style={{ fontSize: 10.5, color: "var(--ink2)", lineHeight: 1.7, margin: 0 }}>
              Shear uses τ = 6µQ/wh² with the (1 − 0.63 h/w) rectangular-duct correction for rectangular channels, and τ = 4µQ/πR³ for round ones; both assume fully developed laminar flow. A trapezoid is reduced to an equal-area rectangle. Bends and grooves are reported as a range or a caveat, never as a precise single value — for those, the honest answer is CFD.
              Sedimentation is Stokes with Δρ = {sig(m.cell.rho - RHO_M)} kg/m³. Capillary pressure assumes γ = 45 mN/m for serum-containing medium.
              Shear tolerance bands are literature typical values, not a substitute for your own dose–response.
              Membrane permeability uses Poiseuille flow through cylindrical pores with the Sampson entrance correction, both outlets at atmosphere.
              Crossflow is an upper bound for a bare membrane — a confluent monolayer adds resistance this model does not include.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}

/* log-scale shear gauge with the cell's tolerated band */
function ShearGauge({ tau, lo, hi, acute, color }) {
  const min = 0.001, max = 200;
  const pos = (v) => {
    const c = Math.min(Math.max(v, min), max);
    return (Math.log10(c / min) / Math.log10(max / min)) * 100;
  };
  const ticks = [0.001, 0.01, 0.1, 1, 10, 100];
  return (
    <div>
      <div style={{ position: "relative", height: 40 }}>
        <div style={{ position: "absolute", top: 14, left: 0, right: 0, height: 10, background: "var(--line2)", borderRadius: 1 }} />
        <div style={{ position: "absolute", top: 14, left: `${pos(lo)}%`, width: `${pos(hi) - pos(lo)}%`, height: 10, background: "var(--ok)", opacity: 0.35 }} />
        <div style={{ position: "absolute", top: 14, left: `${pos(acute)}%`, right: 0, height: 10, background: "var(--alert)", opacity: 0.22 }} />
        <div style={{ position: "absolute", top: 6, left: `${pos(tau)}%`, width: 2, height: 26, background: color, transform: "translateX(-1px)" }} />
        <div className="mono" style={{ position: "absolute", top: 0, left: `${pos(tau)}%`, transform: "translateX(-50%)", fontSize: 11, fontWeight: 600, color, whiteSpace: "nowrap" }}>
          {sig(tau)}
        </div>
      </div>
      <div style={{ position: "relative", height: 14 }}>
        {ticks.map((t) => (
          <span key={t} className="mono" style={{ position: "absolute", left: `${pos(t)}%`, transform: "translateX(-50%)", fontSize: 9.5, color: "var(--ink2)" }}>{t}</span>
        ))}
      </div>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--ink2)", marginTop: 8 }}>
        dyn/cm², log scale · green = physiological band {lo}–{hi} · red = acute detachment above {acute}
      </div>
    </div>
  );
}

/* Named exports so the physics can be tested without a browser. */
export { compute, CELLS, MATERIALS, MEMBRANES, FLUIDS, SPECIES, DEFAULTS, REFERENCE_CASES, sig };
