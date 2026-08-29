# Karraj (كراج)

A browser-based car configurator. One car under showroom lighting, paint / rims / tint /
stance driven live in real-time 3D — plus a **Jordanian modification-compliance layer**
that tells you which choices are street-legal and which must be registered with the DVLD.

It renders on demand rather than continuously, adapts its quality to the device, and
draws nothing at all while you are not touching it.

Bilingual English / Arabic with genuine RTL.

**Status:** complete — ten days, all shipped. Paint and finishes, wheels, glass tint,
lights, ride height, underglow, three scene presets, adaptive quality, a schema-driven
bilingual UI, a dialled look, share links, high-resolution export, and the compliance
layer.

**Live:** <https://karraj.pages.dev>

Try <https://karraj.pages.dev/?lang=ar&c=p1c-111111.p1f-m.gt-80.sd-40> — matte black,
80% tint, lowered, in Arabic. Every one of those choices has a consequence in the
panel.

---

## Road legality

The reason this is not a toy, and the reason it is interesting to a company in vehicle
data. As you configure, `src/rules/dvld.ts` evaluates the build against Jordanian
modification rules and says which choices are street-legal, which have to go on the
vehicle licence, and which are explicitly fine.

Matte black at 80% tint, lowered 40 mm:

| | |
|---|---|
| 🔴 Window tint is over the limit | **Not permitted** — capped at 50% |
| 🟠 Colour change | **Must be registered** on the vehicle licence |
| 🟠 Matte finish | **Must be registered** unless it matches a manufacturer colour code |
| 🟠 Suspension lowered | **Must be registered** |

### Provenance is part of the output

Every finding prints the authority it rests on. That is the whole difference between a
compliance feature and a coloured dot, because the failure mode of rules-as-code is
plausible rules nobody can trace.

- Four rules are tagged `dvld` and cite the **August 2025 DVLD ruling**: the tint cap,
  colour changes and wraps, matte finishes, and transparent nano-ceramic coatings.
- The ride-height rule is tagged **`general`** and says so, because no source was
  researched for it specifically. Inventing a citation would have been worse than
  showing the gap.
- Headlight colour and underglow are **deliberately unruled**, for the same reason. The
  file says so, rather than leaving a reader to wonder whether it was an oversight.

### The unit trap, written down

`glass.tint` in this app is *darkness* — 0 is clear, 1 is limousine black. Tint
regulations are quoted as **VLT**, the light that gets through, which runs the other
way. A 50% cap happens to land on the same number under both readings. That is a
coincidence, not a design, and it is exactly the kind of thing that leaves a rules
engine quietly wrong, so it is a comment in the source and an assertion in `check.mjs`.

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
npm run check      # assertions for the pure modules (see below)
npm run prepare:car  # rebuild public/models/car.glb from the Khronos source
```

`npm run check` is the gate for the code whose failures are invisible: the URL codec,
the viewport layout, the translations and the compliance rules. A link that decodes to
a slightly different car still looks like a working link, and a layout function that
returns `NaN` still looks like arithmetic — so they get 34 assertions instead of a
reviewer's good intentions. It runs in CI beside lint and build.

It has earned its place four times: an out-of-range tint that clamped or reverted
depending on how many digits the nonsense had, two dictionary keys nothing referenced,
a formatter that printed `mm` into an Arabic panel, and a viewport layout that returned
`NaN` for a `0x0` container — which is what React hands you on the first render of
every mount.

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
out with CSS **logical properties**, so `dir="rtl"` mirrors the rail, the toggle knobs
and the camera's framing offset without a single conditional. That was the cheap half of
RTL; the expensive half is below.

## Arabic, and what RTL actually costs

Both languages live in one file, with `ar` typed `Record<MessageKey, string>` so the
English table is the schema and an untranslated key is a compile error. 94 keys. The
language follows `?lang=`, then the browser's own preference — an Arabic browser opens
in Arabic.

Translation is the easy half. These are the parts that make it *genuine* RTL, and every
one of them was a visible defect first:

- **Arabic is cursive.** `letter-spacing` severs the joins between letters and turns a
  word into a row of disconnected glyphs. The wide tracking that gives the Latin UI its
  look is not a style choice in Arabic, it is a bug — so every `tracking-*` utility is
  neutralised under `[lang='ar']`.
- **Monospace faces do not carry Arabic.** Left alone, every `font-mono` label fell back
  to an arbitrary system face with different metrics from the panel around it, and the
  labels stopped lining up with their values.
- **Bidi reorders runs with no strong direction of their own.** The build counter in the
  footer rendered as `10 / 9`. Slider values have the same exposure and are isolated in
  `<bdi>`.
- **Formatters print words.** `stock` and `mm` are text, so the formatter signature takes
  the translator. A `Record<MessageKey, string>` cannot catch a string that never went
  through the dictionary; the "every key is referenced" assertion in `npm run check` can.
- **The camera has to be told.** A projection offset has a direction and cannot infer
  one, so `useDirection` observes the `dir` attribute rather than reading it once. The
  car re-frames to the other side of the canvas when the language flips.

System font stack rather than a webfont: every current OS ships a good Arabic face, and
the 0.08 MB the brief budgets for fonts would still need a third-party download step in
the build. The trade is consistency across platforms; the upgrade is a subsetted
self-hosted face.

## Share links and export

**`src/state/codec.ts`** encodes the whole configuration into one query parameter:

```
?c=p1c-2b2f36.p1f-m.gt-70.ev-n
```

Query, never a path segment — a static CDN has no routing. `-` and `.` are the
separators because they are the only punctuation `URLSearchParams` leaves alone; `~`
reads better and comes back as `%7E`, and a share link full of percent escapes looks
broken even when it works.

Three rules earned their place:

- **Defaults are omitted**, so a stock car has no parameter at all and a short link
  genuinely means "close to stock".
- **Decoding never throws and never rejects wholesale.** Chat apps truncate links and
  people hand-edit them, so each field validates alone: a bad one falls back to its
  default and every other field still lands. `check.mjs` decodes every prefix of 200
  encoded links and 220 adversarial strings.
- **Enums encode as explicit letter codes, never list indices**, so reordering
  `FINISHES` cannot silently repaint every link ever shared.

**Screenshot export** renders one frame at 2x the visible area. It is not
`canvas.toDataURL()`, for three reasons: tone mapping lives in the post-processing
chain, so a plain `gl.render` is washed out; the composer has to be resized alongside
the renderer or the effects cover only a corner; and the exported frame must not contain
the hole the UI was sitting in. That last one reuses the same `setViewOffset` mechanism
the on-screen framing uses, so the export is exactly the pixels you can see, at whatever
scale is asked for. Renderer size, pixel ratio and view offset are all restored,
including on failure.

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

## Performance, measured

Numbers below are from the **live deployment**, not a dev server, at 1280x760 CSS on a
2x display (1920x1140 drawing buffer). Draw calls are counted at the WebGL context by
wrapping `drawElements`/`drawArrays`, so nothing here depends on trusting the framework.

### What ships

| | over the wire | |
|---|---:|---|
| `index.html` | 371 B | brotli |
| CSS | 5.4 kB | brotli |
| JS | ~430 kB | brotli, three chunks |
| `car.glb` | 2.28 MB | already meshopt + WebP internally, so served as-is |
| **first load** | **≈ 2.7 MB** | against the brief's 3.4 MB budget |

No HDRI (the environment is built from `<Lightformer>`s at runtime) and no font files,
which is where the remaining headroom comes from. leva is lazy-loaded and never reaches
production.

The JS is split into `three` / `react` / app. First load is byte-identical either way;
a **redeploy costs a returning visitor ~20 kB instead of ~430 kB**, because the engine
chunk sits in a year-long immutable cache and only the app chunk changes.

### What it costs to draw

| | draw calls | triangles |
|---|---:|---:|
| main scene | 134 | 196,380 |
| floor reflection | 133 | 196,480 |
| post-processing chain | ~18 | — |
| **per rendered frame** | **285** | **392,878** |

**The reflective floor doubles the scene.** `MeshReflectorMaterial` re-renders everything
from a mirrored camera, so the car is drawn twice per frame for a 256x256 target that is
then blurred `[400, 100]`. It is already dropped at quality tier 0, which is where the
adaptive monitor puts a device that cannot hold frame rate. If this ever needs to be
faster, that pass is the first place to look — putting the interior and the garage set on
a separate layer would cut roughly a third of its draw calls with no visible difference
at that resolution and blur.

That cost is only paid on frames that actually render. `frameloop="demand"` means a
parked scene draws nothing at all:

- **0 draw calls over 5 seconds idle.** The car is static and the camera only moves when
  dragged; drawing at display refresh rate forever would pin the GPU for frames identical
  to the last one.

### No leaks

Switching environment preset remounts `<Environment>` and re-bakes a cube target — a
classic place to leak GPU objects. Twelve switches:

- 12 textures created, **12 deleted**
- 72 framebuffers created, **72 deleted**
- **0 shader programs compiled**, which is the flake normal map staying bound at scale 0
  paying off — swapping a material's texture bindings triggers a recompile, and a
  recompile is a visible hitch
- JS heap +2.6 MB across all twelve, i.e. ordinary churn

## Browser support

**Safari 16.4+ · Chrome 111+ · Firefox 128+**, and WebGL2 in all cases.

That floor comes from Tailwind 4, not from anything in this project: the generated
stylesheet uses `@property` (46 occurrences), `color-mix()` (52) and `oklch()` (11).
Nothing in the application code needs anything newer than `<dialog>.showModal()` and
`structuredClone`, both of which predate it.

Verified in Safari on macOS against the live deployment: the render, the post-processing,
the reflective floor, the schema-driven panel and the compliance readout all behave. The
one thing a modal `<dialog>` does *not* reliably bring with it is the Escape key — some
embedded webviews swallow it, measured — so `Credits` handles Escape explicitly rather
than trusting the host page.

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

Cloudflare Pages, pushed from CI on `main`. See [`docs/DEPLOY.md`](docs/DEPLOY.md).

`public/_headers` sets the caching, and the split is deliberate:

- `/assets/*` — `immutable`, one year. Vite content-hashes everything there.
- `/models/*` — one day, plus a week of `stale-while-revalidate`. The GLB is **not**
  content-hashed; it is a stable path out of `public/`. A repushed model therefore
  reaches returning visitors within a day without costing a round trip on every load.
  Marking it immutable would be wrong until the filename carries a hash.

CI runs `lint`, `check` and `build` for everyone, and deploys only when the Cloudflare
secrets exist — so a fork gets a green tick rather than a red X for a step that was never
going to work.

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
