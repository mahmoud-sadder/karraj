# Karraj (كراج)

A browser-based car configurator. One car under showroom lighting, real-time 3D at 60fps,
paint / rims / tint / stance driven live — plus a **Jordanian modification-compliance layer**
that tells you which choices are street-legal and which must be registered with the DVLD.

Bilingual English / Arabic with genuine RTL.

**Status:** day 7 of 10. Paint, wheels, glass, lights, ride height, underglow, three
scene presets, adaptive quality, a schema-driven UI, and a dialled look. Share URLs,
Arabic and the DVLD layer still to come.

**Live:** <https://karraj.pages.dev>

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

## Look-dev

LOOKDEV §13 ranks the work by look-per-hour, and day 7 spent it in that order. The
Lightformer rig, the two-pass contact shadow, Neutral tone mapping, the finish tables
and the camera discipline were already in from earlier days. Day 7 added:

**Post-processing** (§10). Bloom at `luminanceThreshold: 1.0` in a linear workspace, so
only the emissive lights bloom and paint highlights stay crisp — §10 is blunt that
low-threshold bloom is the classic amateur haze. Vignette, SMAA on the weakest tier,
and no SSAO at all, because the asset already ships a 2048² baked AO map and SSAO on
top of a good bake adds noise for 3-6 ms.

Tone mapping now happens **only** in the composer. §4: doing it in both the Canvas and
the composer is the classic "why is everything washed out" bug. `NoToneMapping` on the
Canvas also disables `toneMappingExposure`, so exposure folds into environment
intensity — equivalent here because every light is image-based, and it has the useful
side effect that emissive lights are no longer scaled down with exposure.

**A concrete floor** (§7). Semi-reflective, short-range, heavily blurred, and broken up
by a procedurally generated roughness map — §7 is right that a perfectly uniform floor
is the giveaway. The calibration is that you should see the car's colour smeared
beneath it but never the shape of the wheels.

**A garage set** (§8). Six low-poly props at mid-distance that exist to appear in
reflections. Two lessons landed here: `Lightformer` only lights anything when it is a
child of `<Environment>` — in the main scene it is just a glowing rectangle that pulls
the eye off the car — and a four-high tyre stack projected clean over the roofline and
read as fins growing out of the roof.

### Calibration

Both of §13's tests pass:

- **At 25% size** the silhouette, specular streak and grounding all survive.
- **Six finishes across red, white and dark.** Red gloss reads `(87,39,50)` — blue above
  green, so crimson rather than orange, which is the tone-mapping check. White holds a
  mean near 100 against a peak of 245-252, so it is not flat. Dark still varies 50 → 76
  across finishes, so it keeps its form.

Measured against §8's exposure rule: car peak luminance **96%**, environment mean
**2.8%**. The car is the only bright thing in frame.

## The UI is data

BRIEF §6: 11 features across two languages and two form factors is roughly 40 controls,
and hand-writing each panel is two days of work and inconsistent spacing. So the whole
configurator is a declarative array in `src/ui/schema.ts`, rendered by one component
that knows nothing about paint or wheels:

```ts
{ row: { kind: 'toggle', path: 'twoTone', labelKey: 'paint.twoTone' } },
{ row: { kind: 'color', path: 'paint2.color', labelKey: 'paint.secondary' },
  when: (c) => c.twoTone },
```

Five primitives — Slider, Swatches, Segmented, Toggle, ColorField — and adding a feature
is three lines. `path` is a typed union of every setting, so referencing one that does
not exist is a compile error rather than a control that silently does nothing. It also
becomes the field list for the day-8 URL codec.

Panels use progressive disclosure, one open at a time (§12 rule 7). Everything is laid
out with CSS **logical properties**, and `dir="rtl"` is verified to mirror the rail, the
toggle knobs and the camera's framing offset — day 9 adds the Arabic strings, not the
layout work.

## Three scene presets

LOOKDEV §2 argues for three looks rather than one, and Studio is the load-bearing one:
*a very dark scene makes every paint colour look expensive and every paint colour look
similar.* If someone is choosing paint they need somewhere to actually see it, so this
is a functional requirement rather than a nicety.

| preset | for |
|---|---|
| **Garage** | The hero look. Dark, tight, warm practicals. Where screenshots happen |
| **Studio** | Judging paint honestly. Neutral, even, low contrast |
| **Night** | Car meet. Near-black with cyan and magenta edge light |

Night obeys §11's hard rule: accent colour may light the room but must never be the
primary source on the paint, or the paint colour becomes a lie and the configurator
stops working. The key stays white and dominant; the neon sits behind the car.

Underglow is **off by default** and is a soft floor pool, never a ring — §11 puts a
glowing under-car ring in the forbidden list as the classic gaming-peripheral signifier.

## Ride height

The body drops while the wheels stay on the ground. Each wheel group is pushed back up
in its own local space, which is not a simple axis flip: this asset is authored Z-up and
the wheel parents are scaled, so the compensation goes through the inverse of the
parent's basis **without normalising** — a unit local step is not a unit world step, and
normalising made the wheels rise 54 mm for a 45 mm drop.

Verified vertex-accurately: tyres stay pinned at y = -0.0001 at every ride height while
the body drops by exactly the requested amount. Travel is clamped at 85 mm, because at
90 mm the lowest body vertex reaches y = -0.0014 and clips the floor.

## Adaptive quality

`PerformanceMonitor` watches the real frame rate and steps a tier between 0 and 2,
driving device pixel ratio and shadow/environment resolution. BRIEF §7's third risk is
"mid-range mobile perf discovered on day 9"; measuring beats guessing from a device
string, which ages badly.

## Layout, and why the camera knows about it

KARRAJ-LOOKDEV.md §12 is specific: one edge, never two opposing anchors, keep >=65% of
the viewport as unbroken canvas, and offset the car when the UI is asymmetric. All the
chrome lives in a single `Rail` — a right rail above `md`, a bottom sheet below it.

The camera has to know where that UI is, or it frames the car into space the panel is
covering. `src/ui/layout.ts` owns the constants and the projection maths, and both the
Rail and the Scene read from it. Measured coverage of the car went **46.7% → 0%**.

Two things here are easy to get wrong and were, in turn:

- **Both axes matter.** The rail reduces width on desktop; the sheet reduces height on
  mobile. Fixing only the horizontal case left the car 100% hidden behind the sheet.
- **`setViewOffset` needs the camera aspect changed too.** three builds the base frustum
  from `camera.aspect` and then scales it by `view.width / view.fullWidth`, so leaving
  R3F's canvas aspect in place stretches the image by `fullWidth/width` — a 22%
  horizontal stretch at 1440px, subtle enough to read as bad modelling.

## Glass without `transmission`

`KHR_materials_transmission` is stripped in the pipeline — it forces an extra
render-target pass every frame, 8-15 ms on a mid-range Android. The obvious
replacement, one alpha-blended material, fails for a subtler reason: three multiplies
the *entire* outgoing radiance by `opacity`, specular included, so reflections fade out
as tint rises and 80% tint reads as a dark hole in the bodywork.

Two layers over one shared geometry decouple them:

| layer | |
|---|---|
| tint | `MeshBasicMaterial`, unlit, alpha-blended, `depthWrite: false`, order 10 |
| reflection | black base, `metalness: 1`, **additive** blending, `depthWrite: false`, order 11 |

Additive blending is the point — the reflection layer only ever *adds* light, so it is
unaffected by how opaque the tint beneath it is. Measured over the glass pixels, peak
brightness falls 245 → 215 across 0-95% tint: the film blocks light while the
reflection survives.

The tint layer is deliberately **unlit**. Cloning the physical glass material and
zeroing `envMapIntensity` looks equivalent and is not — it still renders a shaded
surface that gets *brighter* as opacity rises, which is the opposite of tint film.

Past 85% tint the whole `Interior*` subtree leaves the frame, which measures at
**−43 draw calls and −22,562 triangles per frame** (−36% and −11.5%).

## VIN → vehicle → 3D model

```
https://karraj.pages.dev/?vin=WBANE535X7CW65098
```

Decodes a real VIN and selects the 3D model from the result. Three pieces:

| | |
|---|---|
| `src/vin/vin.ts` | Format, ISO 3779 transliteration, check digit. Rejects typos offline |
| `src/vin/nhtsa.ts` | NHTSA vPIC — free, no API key, `access-control-allow-origin: *` |
| `src/vin/registry.ts` | `bodyClass` → GLB. Keyed on body class, not make/model |

**The decoder is an interface, not a call.** `VinDecoder` has one working
implementation (NHTSA) and one stub (`CarseerVinDecoder`), so swapping the source is a
single class and a single line. vPIC is a US agency and its coverage of Chinese-market
vehicles is thin — a MENA decoder would beat it on exactly the vehicles that matter in
Jordan since the November 2025 import regulation.

**The registry is keyed on `bodyClass` deliberately.** vPIC reports a few dozen body
classes against millions of make/model/year combinations, so a handful of generic
shapes covers most of a real inventory — and a viewer looking at their saloon is not
checking shut lines against a press photo. When there is no asset for a body class the
UI says so rather than silently showing the wrong shape.

**A failed check digit is a warning, not an error.** Vehicles built outside North
America do not always carry a valid one, so refusing to decode would reject real cars
in an import market. Length and charset failures *are* fatal, and are caught locally
before any request goes out.

## Debug panel

```
http://localhost:5173/?debug=1
```

Every art parameter — exposure, environment intensity, fog, the five Lightformer
intensities, floor, contact shadows, and all ten knobs of the active paint finish — is
wired to leva behind that flag. BRIEF §7 names look-dev as risk #1; the mitigation is
that day 7 becomes dialling and screenshotting rather than writing code under deadline.
`copy art JSON` puts the current state on the clipboard to paste back into
`DEFAULT_ART` / `FINISH_SPECS` when the look is locked.

leva is **lazy-loaded**, so it never reaches the production bundle — Vite splits it into
a 209 kB chunk fetched only when the flag is present.

`<Environment>` also switches from `frames={1}` to continuous re-baking in debug,
without which dragging a light intensity changes nothing visible.

## Deployment

Cloudflare Pages. See [`docs/DEPLOY.md`](docs/DEPLOY.md).

There is deliberately **no `_redirects` file**. Cloudflare rejects the usual
`/* /index.html 200` SPA rule as an infinite loop, and it turns out to be redundant
anyway: Pages already serves `index.html` with a 200 for every unmatched path, so deep
links and hard refreshes work out of the box. Verified against the live deployment.
Details, including the one thing that would switch that off, in
[`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Licence

Source code: MIT — see [`LICENSE`](LICENSE).
3D assets: CC BY 4.0 and **require attribution** — see [`ATTRIBUTION.md`](ATTRIBUTION.md).
