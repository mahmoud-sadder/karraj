# Deploying Karraj to Cloudflare Pages

Everything in this repo is already configured for Cloudflare Pages. What is missing is
**account access** — Wrangler authenticates through an interactive browser OAuth flow that
cannot be completed from a non-interactive shell, and there is no `CLOUDFLARE_API_TOKEN`
on this machine.

So the three steps below are yours to run. Pick **A** for a URL in the next five minutes;
**B** is what the committed workflow does once you add two secrets.

Project name is `karraj` throughout, which yields **`https://karraj.pages.dev`**.
If that name is taken, change it in three places: `wrangler.jsonc`,
`.github/workflows/deploy.yml`, and the `deploy` script in `package.json`.

---

## A — Direct upload (fastest path to a live URL)

```bash
cd karraj
npx wrangler login          # opens a browser, one time
npm run build
npx wrangler pages project create karraj --production-branch main
npm run deploy
```

`pages project create` is only needed once. After that, `npm run deploy` is the whole loop.

Wrangler prints the deployment URL. Production lands on `https://karraj.pages.dev`;
every non-production branch also gets its own permanent preview URL.

---

## B — GitHub Actions (already committed)

`.github/workflows/deploy.yml` builds and deploys on every push to `main`, and puts every
pull request on a preview URL. It needs two repository secrets.

### 1. Create a scoped API token

Cloudflare dashboard → **My Profile → API Tokens → Create Token → Create Custom Token**.

| | |
|---|---|
| Permission | **Account · Cloudflare Pages · Edit** |
| Account resources | Include → your account |
| TTL | leave open, or set one and diarise the rotation |

Do not use the Global API Key. It authorises everything on the account and cannot be
scoped or revoked independently.

### 2. Find your account ID

Cloudflare dashboard → **Workers & Pages** → the account ID is in the right-hand sidebar,
and it is also the 32-hex string in the dashboard URL.

### 3. Add both as repository secrets

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from step 1 |
| `CLOUDFLARE_ACCOUNT_ID` | the ID from step 2 |

Then push to `main`, or trigger the workflow by hand from the Actions tab.

> The workflow deploys the **committed** `public/models/car.glb`. It does not run
> `tools/prepare-car.mjs`. That is deliberate — a deploy should not depend on
> `raw.githubusercontent.com` being up, and the bytes that ship should be the bytes that
> passed verification locally.

---

## C — Cloudflare's own Git integration (alternative to B)

If you would rather not manage a token, connect the repository in the dashboard instead:

**Workers & Pages → Create → Pages → Connect to Git**, then:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `karraj` — **only if** you push the parent `Carseer` folder rather than `karraj` itself |

Cloudflare then builds on every push with no secrets to rotate. Delete
`.github/workflows/deploy.yml` if you take this route, or the two systems will race each
other for the same deployment slot.

---

## What the config files do

| file | |
|---|---|
| `wrangler.jsonc` | Points Wrangler at `dist`. Static only — no Pages Function, no `_worker.js` |
| `public/_headers` | Immutable caching for Vite's content-hashed `/assets/*`; a softer 24h + stale-while-revalidate for `/models/*`, which is **not** hashed |
| `public/_redirects` | SPA fallback, so the share-a-build URL survives a hard refresh |

### On the model cache header

`/models/car.glb` is served from a stable path, so it must not be marked `immutable` —
a re-run of the pipeline would never reach anyone who had already loaded the page.
If you later hash the filename (`car.<contenthash>.glb`), move it under `/assets/` and
it inherits the one-year immutable rule for free.
