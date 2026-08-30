/* Physics regression tests.
 *
 *   npm test
 *
 * Two kinds of check, deliberately:
 *
 *   REFERENCE  — compared against a number produced outside this codebase
 *                (a manufacturer's published constant, a paper's stated value).
 *                These are the ones that mean something. Re-implementing a
 *                formula in the test and comparing it to itself proves nothing.
 *
 *   INVARIANT  — a relationship that must hold whatever the numbers are
 *                (shear does not depend on channel length; pressure scales
 *                with it). These catch refactors that quietly break wiring.
 *
 * Add a case here every time a bug is found. Both bugs caught so far —
 * seeding concentration off by 1000, and units mangled by CSS — would have
 * been caught by a test that took two minutes to write.
 */

import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "laminar-test-"));
const out = join(dir, "physics.mjs");

await build({
  entryPoints: ["src/Laminar.jsx"],
  bundle: true,
  format: "esm",
  outfile: out,
  loader: { ".jsx": "jsx" },
  logLevel: "error",
});

const { compute, DEFAULTS, REFERENCE_CASES } = await import(pathToFileURL(out).href);

/* ------------------------------------------------------------------ */

let pass = 0, fail = 0;
const rows = [];

const near = (got, want, tolPct) => Math.abs(got - want) <= Math.abs(want) * (tolPct / 100);

function check(kind, name, got, want, tolPct, note = "") {
  const ok = typeof want === "boolean" ? got === want : near(got, want, tolPct);
  ok ? pass++ : fail++;
  rows.push({ kind, name, got, want, tolPct, ok, note });
}

const dev = (over) => compute({ ...DEFAULTS, ...over });

/* ---------- REFERENCE ----------
   Driven by the same REFERENCE_CASES the Validation tab renders, so the
   published table and the test suite can never disagree. */

for (const rc of REFERENCE_CASES) {
  const got = compute({ ...DEFAULTS, ...rc.inputs })[rc.field];
  check("REF", `${rc.device} — ${rc.field}`, got, rc.expected, rc.tolPct, rc.source);
}

/* ---------- INVARIANT ---------- */

{
  const a = dev({ w: 3800, h: 400, L: 17, Q: 1000, mu: 0.72 });
  const b = dev({ w: 3800, h: 400, L: 170, Q: 1000, mu: 0.72 });
  check("INV", "shear does not depend on channel length", b.tau, a.tau, 0.001);
  check("INV", "pressure drop scales with length", b.dPchip, a.dPchip * 10, 1);
}

{
  const a = dev({ Q: 10 });
  const b = dev({ Q: 20 });
  check("INV", "shear is linear in flow rate", b.tau, a.tau * 2, 0.001);
}

{
  const a = dev({ w: 4000, h: 100 });
  const b = dev({ w: 4000, h: 200 });
  check("INV", "shear goes as 1/h^2 in a wide slot", b.tau, a.tau / 4, 5);
}

// Regression: seeding concentration was once wrong by a factor of 1000.
// 1e5 cells/cm2 over 0.646 cm2 of floor in 25.84 uL is 2.5e6 cells/mL.
{
  const m = dev({ w: 3800, h: 400, L: 17, seedDens: 1e5 });
  check("INV", "seeding suspension concentration", m.seedConc, 2.5e6, 2,
    "regression: was 1000x too high");
}

// Stokes settling, 15 um cell, delta-rho 60 kg/m3, 0.72 mPa.s
{
  const m = dev({ cellD: 15, mu: 0.72, cellType: "huvec" });
  check("INV", "Stokes sedimentation velocity", m.vSed * 1e6, 10.2, 2);
  check("INV", "landing distance = U x h / vSed", m.xSettle, m.U * (m.h / m.vSed), 0.5);
}

{
  const m = dev({ Q: 30, w: 1000, h: 200, L: 20 });
  check("INV", "exchange rate = Q / channel volume", m.exch, (m.Q * 3600) / m.Vch, 0.001);
  check("INV", "residence time = volume / Q", m.tRes, m.Vch / m.Q, 0.001);
}

// Two identical channels co-current must have zero transmembrane pressure.
{
  const m = dev({ format: "membrane", w: 1000, h: 200, w2: 1000, h2: 200, Q: 30, Q2: 30, flowDir: "co" });
  check("INV", "matched co-current channels give zero TMP", Math.abs(m.tmpIn) < 1e-9, true);
}

// Counter-current reverses sign end to end.
{
  const m = dev({ format: "membrane", w: 1000, h: 200, w2: 1000, h2: 200, Q: 30, Q2: 30, flowDir: "counter" });
  check("INV", "counter-current TMP flips sign", Math.sign(m.tmpIn) !== Math.sign(m.tmpOut), true);
}

// Constant-width bifurcation halves shear per generation.
{
  const m = dev({ treeGen: 3, taper: "none", w: 1000, h: 200, Q: 80 });
  const r = m.genRows;
  check("INV", "constant-width tree halves shear per split", r[1].tau, r[0].tau / 2, 1);
  check("INV", "branch count doubles per generation", r[3].n, 8, 0);
}

// Twice as many parallel apertures, half the pressure across the array.
{
  const a = dev({ feature: "slit", featN: 100, featW: 5, featH: 1.2, featL: 2 });
  const b = dev({ feature: "slit", featN: 200, featW: 5, featH: 1.2, featL: 2 });
  check("INV", "parallel apertures halve array pressure", b.dPfeat, a.dPfeat / 2, 0.5);
}

// Nothing should come back NaN or infinite, with one deliberate exception:
// a displacement pump has no pressure ceiling, so dPavail is Infinity by
// design. Any OTHER non-finite value is a bug.
{
  const m = dev({});
  const allowed = new Set(["dPavail"]);
  const bad = Object.entries(m)
    .filter(([k, v]) => typeof v === "number" && !Number.isFinite(v) && !allowed.has(k));
  check("INV", "no unexpected NaN or Infinity", bad.length, 0, 0,
    bad.map(([k]) => k).join(", "));
  check("INV", "syringe pump has no pressure ceiling", m.dPavail === Infinity, true);
}

// A gravity head is finite and must equal rho.g.h.
{
  const m = dev({ drive: "gravity", headMM: 20 });
  check("INV", "gravity head = rho g h", m.dPavail, 1000 * 9.81 * 0.02, 0.1);
}

/* ------------------------------------------------------------------ */

const fmt = (x) => (typeof x === "boolean" ? String(x) : Number(x.toPrecision(5)));
console.log("");
for (const r of rows) {
  const mark = r.ok ? "  pass" : "  FAIL";
  const detail = r.ok ? "" : `  got ${fmt(r.got)}, expected ${fmt(r.want)} ±${r.tolPct}%`;
  console.log(`${mark}  [${r.kind}] ${r.name}${detail}`);
  if (r.note && !r.ok) console.log(`        ${r.note}`);
}
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
