# Karraj (كراج)

A browser-based car configurator. One car under showroom lighting, real-time 3D at 60fps,
paint / rims / tint / stance driven live — plus a **Jordanian modification-compliance layer**
that tells you which choices are street-legal and which must be registered with the DVLD.

Bilingual English / Arabic with genuine RTL.

**Status:** day 1 of 10. Scaffold and asset pipeline only — no scene yet.

**Live:** _pending first deploy — see [Deployment](#deployment)._

---

## Stack

| | |
|---|---|
| Build | Vite 8.2.2 · TypeScript 6 · React 19.2.8 |
| Styling | Tailwind CSS 4.3.3 (`@tailwindcss/vite`) |
| 3D | three 0.185.1 · @react-three/fiber 9.7.0 · @react-three/drei 10.7.8 |
| Post | @react-three/postprocessing 3.1.0 (postprocessing 6.39.4) |
| State | zustand 5.0.15 · leva 0.10.1 (debug only) |
| Assets | @gltf-transform/{core,extensions,functions} 4.4.2 · meshoptimizer 1.2.0 · sharp 0.35.4 |

Every version is pinned exactly, because two peer ranges are tight and both bite silently:

- `postprocessing@6.39.4` peers `three >= 0.168.0 < 0.186.0`
- `@react-three/fiber@9.7.0` peers `react >= 19 < 19.3`

`three@0.185.1` and `react@19.2.8` sit inside both. A caret range on either would drift out.

---

## Scripts

```bash
npm run dev        # vite dev server
npm run build      # tsc -b && vite build
npm run preview    # serve dist/
npm run lint       # oxlint
npm run prepare:car  # rebuild public/models/car.glb from the Khronos source
```

---

## Asset pipeline

`tools/prepare-car.mjs` turns the upstream Khronos **CarConcept** GLB into the runtime asset.
It is deterministic, network-cached, and self-verifying.

_Numbers land here once the pipeline has run._

---

## Deployment

Cloudflare Pages. See [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Licence

Source code: MIT — see [`LICENSE`](LICENSE).
3D assets: CC BY 4.0 and **require attribution** — see [`ATTRIBUTION.md`](ATTRIBUTION.md).
