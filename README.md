# Laminar

An organ-on-chip fault finder. You enter channel geometry, flow conditions, tubing,
material and cell type; it computes the hydrodynamics and ranks the failure modes
your numbers actually support.

The reasoning is deterministic. Every verdict traces to a formula you can check —
the language model argues about the result, it does not produce it.

---

## Running it locally

You need [Node.js](https://nodejs.org) 18 or newer. Check with `node -v`.

```bash
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173).

The calculator, the cross-section, the rules engine and the case log all work
immediately. The Brainstorm tab needs the API proxy below.

## The API proxy

**Never put an Anthropic API key in frontend code.** Anyone can read it from the
browser and spend your credits. `api/chat.js` exists so the key stays on a server.

For local development with the proxy running:

```bash
npm i -g vercel
cp .env.example .env.local     # then paste your real key into it
vercel dev
```

`src/Laminar.jsx` posts to `/api/chat` first and falls back to the direct endpoint
only if that route is missing — so the app degrades gracefully during development.
Remove the fallback before going public if you want to be strict about it.

## Deploying

1. `git init && git add . && git commit -m "first"` then push to a new GitHub repo.
2. Go to vercel.com, import the repo, deploy. It detects Vite automatically.
3. In Project Settings → Environment Variables, add `ANTHROPIC_API_KEY`.
4. Redeploy so the variable takes effect.
5. **Set a spend limit in the Anthropic console before sharing the link.**

Netlify works the same way; move `api/chat.js` to `netlify/functions/chat.js` and
adjust the handler signature.

---

## Where the data lives

The case log writes to browser localStorage (`persist` prop in `src/main.jsx`).
That means it is per-device and per-browser, and it is gone if the user clears
their site data. Fine for one lab. Not fine for a shared dataset.

When you want cases pooled across users, add a `POST /api/cases` route writing to
Postgres (Vercel Postgres, Supabase, Neon — any of them). The record shape is
already fixed by `CSV_COLS` in `src/Laminar.jsx`, so the schema is a direct
translation. Handle consent and anonymity before you collect anything from
outside your own group.

## What the physics assumes

- Straight rectangular ducts, fully developed laminar flow
- Newtonian fluid, steady flow
- Cells not modelled as flow obstacles
- Membrane: Poiseuille flow through cylindrical pores with Sampson correction,
  both outlets at atmosphere, no monolayer resistance

Serpentines, pillar arrays, hydrogel regions, droplet flow and non-Newtonian media
are all outside the model. It will still return numbers for those geometries; the
numbers will be wrong.

## Before showing it to other researchers

Reproduce three published organ-chip shear values from their stated geometry and
flow rate. Any discrepancy is a bug or an assumption worth surfacing in the UI.
This is the step that makes it credible.

## Structure

```
src/Laminar.jsx   everything: physics, rules engine, UI, case log
src/main.jsx      mounts it with persist=true
api/chat.js       serverless proxy holding the API key
```

One file is the wrong long-term shape. Split it when it starts to hurt — the
natural seams are `compute()`, the `SYMPTOMS` array, and the components.

## Licence

MIT — see LICENSE. Use it, change it, build on it. Attribution appreciated but
not required.

If you use Laminar in published work, please state which version, since the
computed values are tied to the build. `npm test` prints the reference cases
that version reproduces.
