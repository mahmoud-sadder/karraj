# Karraj (كراج)

A browser-based car configurator. One car under showroom lighting, real-time 3D at 60fps,
paint / rims / tint / stance driven live — plus a **Jordanian modification-compliance layer**
that tells you which choices are street-legal and which must be registered with the DVLD.

Bilingual English / Arabic with genuine RTL.

**Status:** day 2 of 10. Scene, material driver and config store are in; paint colour
changes live. No finishes, wheels, glass or real UI yet.

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

```bash
npm run prepare:car
```

`tools/prepare-car.mjs` turns the upstream Khronos **CarConcept** GLB into the runtime
asset. It is deterministic, network-cached, and self-verifying — it re-reads what it wrote
and exits non-zero rather than ship a quietly-broken model.

|  | before | after | |
|---|---:|---:|---:|
| **bytes** | 11.78 MB | **2.40 MB** | −79.7% |
| triangles | 213,347 | 176,322 | −17.4% |
| draw calls | 109 | 107 | −1.8% |
| materials | 29 | 22 | −24.1% |
| textures | 14 (2.84 MB PNG) | 12 (0.34 MB WebP) | −88% |
| nodes | 101 | 99 | −2 (both deleted deliberately) |

Draw calls and node count barely move **on purpose**. The configurator addresses geometry by
node name (`WheelFrontLRim`) and materials by slug (`paint1`, `rim_lip`), so anything that
merges meshes or materials to save bytes destroys the thing being built.

### The chain

`hoist pearl thickness → strip variants → strip transmission → strip trade marks →
slug materials → FrontSide paint → name textures → dedup → prune → weld →
targeted simplify → drop TANGENT → WebP → reorder → quantize → repair → meshopt → verify`

### Three things worth knowing

**`gltf-transform optimize` is never called, and neither is `meshopt()`.** `optimize`
defaults to `--palette --join --join-named --flatten`, which merges materials into palette
textures and merges named meshes — it would delete the addressability the whole project
rests on. `meshopt()` is subtler: it drops `pattern` from its options, and `pattern` is the
only lever that controls whether `quantize` rewrites the scene graph. Both are written out
by hand instead.

**Quantization silently hollows out six nodes, and the pipeline puts them back.** `quantize`
gives quantized positions a corrective node transform. A node with *both* a mesh and
children can't hold that transform without scaling its children, so `quantize` moves the
mesh onto a new anonymous child. `BodyHood`, `BodyRearPanelsColor1`, `BodyDoorLColor1`,
`BodyDoorRColor1`, `BodyUnderside` and `InteriorSteeringCylinder` are all that shape — each
would keep its name, lose its geometry, and make `getObjectByName('BodyHood').material = …`
a silent no-op. Since the corrective transform is a uniform scale plus a translation, it
inverts exactly: push it back onto the parent, push its inverse onto the parent's other
children. Every node's world matrix is compared before and after; max drift is `1e-9`.

**Simplification is targeted, never global.** The top 8 nodes hold 52.8% of all geometry, so
a global ratio is the wrong instrument. Windscreen wipers (24,336 tris — 11.4% of the entire
model), under-hood structure, the engine, the axles and the interior are decimated. The four
rims (12,176 tris each) and every exterior body panel are left alone: thin spokes crack, and
body silhouette and reflection quality are the product.

### Runtime notes for `useCarModel.ts`

- **Multi-primitive nodes arrive as `Group`, not `Mesh`.** `WheelFrontLRim` is a `Group` of
  two meshes (`rim_lip`, `rim_spoke`). Traverse; don't assume `.isMesh`.
- The **four tyre nodes are unnamed** in the source and were left that way, since the brief
  forbids touching node names. Reach them through the `tire_side` / `tire_tread` material
  slugs. The pipeline asserts the anonymous-node count is exactly 4.
- **Glass renders opaque** until the runtime builds it. `KHR_materials_transmission` is
  stripped on purpose; the two-layer treatment is BRIEF §6, day 4.
- `EXT_meshopt_compression` needs a decoder. drei's `useGLTF` wires `MeshoptDecoder` in by
  default, so this costs nothing — but plain `GLTFLoader` needs `.setMeshoptDecoder()`.

### Corrections to `KARRAJ-BRIEF.md` §4

Verified against the real file; see the header comment in `tools/prepare-car.mjs`.

1. §4.2 says to *"delete image `Khronos_C.png`"*. In the **glTF-Binary** variant every image
   is an anonymous `bufferView` — no `name`, no `uri`. The logo is identified by SHA-256 of
   its decoded bytes instead, and §5's proposed assertion (*"no texture URI contains
   Khronos"*) is **vacuously true** in a GLB. It was replaced with the content-hash check.
2. **§4.2's inventory of the trade marks is incomplete.** The Khronos word mark is also on
   the tyre sidewall, twice: painted into the `Tireside` base colour (next to a 3DCommerce
   logo) and *embossed into the `Tireside` normal map*. Found by auditing all 14 images, not
   by trusting the list. Both are removed.
3. §4.3 puts the textures at 2.3 MB; they are **2.92 MB**. The 8.67 MB `.bin` figure and
   every triangle count in §4.7 are exactly right.

---

## Deployment

Cloudflare Pages. See [`docs/DEPLOY.md`](docs/DEPLOY.md).

There is deliberately **no `_redirects` file**: Cloudflare rejects the usual
`/* /index.html 200` SPA rule as an infinite loop, the Workers-only replacement
(`not_found_handling`) is unavailable to Pages configs, and this app has no client-side
router anyway. The practical consequence is a constraint on the day-8 URL codec — encode
the build into the **query string or hash**, never a path segment. Details in
[`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Licence

Source code: MIT — see [`LICENSE`](LICENSE).
3D assets: CC BY 4.0 and **require attribution** — see [`ATTRIBUTION.md`](ATTRIBUTION.md).
