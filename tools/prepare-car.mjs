#!/usr/bin/env node
/**
 * prepare-car.mjs — turns the upstream Khronos CarConcept GLB into Karraj's runtime asset.
 *
 *   in   https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/
 *          Models/CarConcept/glTF-Binary/CarConcept.glb        (11.78 MB, 213,347 tris)
 *   out  public/models/car.glb
 *
 * Run with `npm run prepare:car`. The source is cached in tools/.cache/ (gitignored),
 * so re-runs are offline and deterministic.
 *
 * ── Why this is an explicit chain and not `gltf-transform optimize` ──────────────
 *
 * `optimize` defaults to --palette --join --join-named --flatten --instance. Those
 * merge materials into palette textures and merge named meshes into combined ones.
 * This project addresses geometry by node name (WheelFrontLRim) and materials by
 * slug (paint1, rim_lip), so `optimize` would silently destroy the only property the
 * whole configurator depends on. gltfpack has the same defaults. Hence: explicit.
 *
 * The verification pass at the end re-reads the written file and asserts that no such
 * merge happened, among other things. It exits non-zero rather than shipping a
 * quietly-broken asset.
 *
 * ── Deviations from KARRAJ-BRIEF.md §4/§5, all deliberate ────────────────────────
 *
 *  1. §4.2 says "delete image Khronos_C.png". In the glTF-Binary variant every image
 *     is an anonymous bufferView — no `name`, no `uri`. There is nothing to match by
 *     name. The logo is therefore identified by SHA-256 of its decoded PNG bytes
 *     (KHRONOS_LOGO_SHA256 below), and every material slot referencing it is cleared.
 *     §5's proposed assertion, "no texture URI contains Khronos", is vacuously true in
 *     a GLB and has been replaced with the content-hash check.
 *
 *  2. §4.2's mark inventory is incomplete. The Khronos word mark is ALSO on the tyre
 *     sidewall, twice: painted into the Tireside base colour (alongside a 3DCommerce
 *     logo) and embossed into the Tireside normal map. Both are handled in step 4.
 *
 *  3. Textures are named here. They arrive anonymous, and the compression plan, the
 *     logs and any future debugging all need stable handles.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NodeIO, PropertyType } from '@gltf-transform/core'
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
  KHRMaterialsIridescence,
  KHRMaterialsTransmission,
  KHRMaterialsVariants,
  KHRTextureTransform,
} from '@gltf-transform/extensions'
import {
  compressTexture,
  dedup,
  prune,
  quantize,
  reorder,
  simplifyPrimitive,
  weld,
} from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_URL =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb'
const CACHE_PATH = resolve(ROOT, 'tools/.cache/CarConcept.glb')
const OUT_PATH = resolve(ROOT, 'public/models/car.glb')
const STATS_PATH = resolve(ROOT, 'tools/.cache/stats.json')

/** SHA-256 of the decoded Khronos logo PNG (512x128) as it ships in CarConcept.glb. */
const KHRONOS_LOGO_SHA256 =
  '1453559c58526ec236ea7f90a72b0e49823061e6c26b571928b9ea3b91593e4d'

/** Expected reference counts for that image, from §4.2. Asserted, not assumed. */
const KHRONOS_LOGO_EXPECTED_EMISSIVE_USES = 6
const KHRONOS_LOGO_EXPECTED_BASECOLOR_USES = 1

/** Nodes carrying Khronos marks as geometry. Note the space in "License Plate". */
const DELETE_NODES = ['License Plate', 'InteriorSteeringEmblem']

/**
 * Original material name → stable runtime slug (§4.1).
 * The empty string is material index 2, which genuinely has no `name` field despite
 * being the most-used material in the file (wipers, seat frames, cage, pillars,
 * gaskets, taillight panels). It becomes `trim`.
 */
const MATERIAL_SLUGS = {
  'Paint 1 Carmine': 'paint1',
  'Paint 2 Carmine': 'paint2',
  Glass: 'glass',
  Rim1: 'rim_spoke',
  Rim2: 'rim_lip',
  Brake: 'caliper',
  Disc: 'disc',
  Tireside: 'tire_side',
  Tiretread: 'tire_tread',
  Headlight: 'headlight',
  Brakelight: 'taillight',
  Signallight: 'signal',
  '': 'trim',
  Mirror: 'chrome',
  Dashboard: 'dash',
  'Interior 1': 'interior_a',
  'Interior 2': 'interior_b',
  'Interior 3 Carmine': 'interior_c',
  // Not in §4.1's list, but they exist and need stable handles all the same.
  Mechanical: 'mechanical',
  Floormat: 'floormat',
  Hardware: 'hardware',
  'Panel Sides': 'panel_sides',
}

/** The 18 slugs §4.1 names. The build fails if any is missing from the output. */
const REQUIRED_SLUGS = [
  'paint1', 'paint2', 'glass', 'rim_spoke', 'rim_lip', 'caliper', 'disc',
  'tire_side', 'tire_tread', 'headlight', 'taillight', 'signal', 'trim',
  'chrome', 'dash', 'interior_a', 'interior_b', 'interior_c',
]

const PAINT_SLUGS = ['paint1', 'paint2']
const REQUIRED_NODES = ['WheelFrontLRim', 'WheelFrontRRim', 'WheelRearLRim', 'WheelRearRRim']

/**
 * The source ships four unnamed nodes — one tyre per wheel group, carrying the
 * tire_side/tire_tread materials. They are left unnamed here because the brief forbids
 * touching node names; the runtime reaches the tyres through those material slugs
 * instead. Any count above four means a transform injected nodes of its own.
 */
const ANONYMOUS_NODE_COUNT = 4

/** Attributes handed to `quantize` — what meshopt's own `level: 'medium'` uses. */
const QUANTIZE_PATTERN = /.*/

/**
 * Pearl iridescence, hoisted onto the base paint materials (§4.5).
 * Ranges follow KARRAJ-LOOKDEV.md §5, not the asset's own Pearl variant — that one
 * ships [820, 920] at IOR 1.2, which is very nearly invisible.
 */
const PEARL = { ior: 1.32, thicknessMin: 420, thicknessMax: 1000 }

/**
 * Targeted simplification (§4.7). Global simplification is the wrong tool here: the
 * geometry is wildly uneven, with the top 8 nodes holding 52.8% of all triangles.
 *
 * Deliberately NOT simplified:
 *   Wheel*Rim  — 12,176 tris each, thin spokes, cracks visibly under decimation
 *   Body*      — silhouette and reflection quality are the entire product
 */
const SIMPLIFY_TARGETS = [
  // 24,336 tris — 11.4% of the whole model is windscreen wipers.
  { match: /^BodyWindshieldWipers$/, ratio: 0.3, error: 0.005 },
  // Structure that is never on screen.
  { match: /^(Engine|Axles|BodyUnderside)$/, ratio: 0.3, error: 0.02 },
  // Under the closed hood.
  { match: /^BodyHood(Interior01|Interior02|Under)$/, ratio: 0.35, error: 0.015 },
  // Behind glass, and hidden outright once window tint exceeds 0.85 (BRIEF §6).
  { match: /^Interior/, ratio: 0.55, error: 0.005 },
]

/**
 * Per-texture compression plan (§5). Keyed by the role names assigned in step 7.
 * Baseline is WebP q80; the exceptions each have a reason.
 */
const TEXTURE_PLAN = {
  occlusion_ao: { resize: [1024, 1024], quality: 88 }, // §5. Banding here is visible on every panel.
  tire_side_n: { resize: [512, 512], quality: 80 }, // §5
  mechanical_n: { resize: [256, 256], quality: 80 }, // §5
  // 128px nearest-filtered flake noise. Lossy WebP averages the grain away and takes
  // the metallic-flake finish with it, for the sake of ~20 KB. Not worth it.
  powdercoat_n: { lossless: true },
  thickness: { quality: 90 }, // Drives pearl interference; banding shows as colour rings.
  dash_e: { quality: 85 },
  tire_tread_n: { quality: 85 },
  disc_n: { quality: 85 },
  disc_base: { quality: 85 },
  interior_a_n: { quality: 85 },
  interior_b_n: { quality: 85 },
  mechanical_mr: { quality: 85 },
}
const TEXTURE_QUALITY_DEFAULT = 80

/**
 * The two angular sectors of the tyre sidewall annulus carrying brand marks
 * (deviation 2 above). Measured off the 1024x1024 Tireside normal map, whose UV
 * circle is centred in the image. Everything outside these sectors — the generic
 * TREADWEAR / TRACTION / OUTSIDE / DOT markings and all the groove arcs — is kept,
 * because it is what makes the tyre read as a tyre.
 */
const SIDEWALL_MARK_SECTORS = [
  { name: 'KHRONOS GROUP', centreDeg: 180, halfWidthDeg: 26 },
  { name: '3DCommerce', centreDeg: 0, halfWidthDeg: 18 },
]
const SIDEWALL_R_INNER = 0.32
const SIDEWALL_R_OUTER = 0.53
const SIDEWALL_FEATHER_R = 0.012
const SIDEWALL_FEATHER_DEG = 3

// ─────────────────────────────────────────────────────────────────────────────

const log = (...a) => console.log(...a)
const step = (n, msg) => console.log(`\n\x1b[36m[${n}]\x1b[0m ${msg}`)
const note = (msg) => console.log(`      \x1b[2m${msg}\x1b[0m`)
const warn = (msg) => console.log(`      \x1b[33m! ${msg}\x1b[0m`)

class BuildError extends Error {}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function srgbToLinear(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

async function fetchSource() {
  try {
    const s = await stat(CACHE_PATH)
    note(`cache hit: tools/.cache/CarConcept.glb (${s.size.toLocaleString()} bytes)`)
    return await readFile(CACHE_PATH)
  } catch {
    /* not cached */
  }
  note(`downloading ${SOURCE_URL}`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new BuildError(`download failed: HTTP ${res.status} ${res.statusText}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  await mkdir(dirname(CACHE_PATH), { recursive: true })
  await writeFile(CACHE_PATH, bytes)
  note(`cached ${bytes.length.toLocaleString()} bytes`)
  return bytes
}

/** Triangles, draw calls, materials, textures — measured the same way before and after. */
function measure(doc, bytes) {
  const root = doc.getRoot()
  let triangles = 0
  let drawCalls = 0
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    for (const prim of mesh.listPrimitives()) {
      drawCalls++
      const indices = prim.getIndices()
      const count = indices ? indices.getCount() : prim.getAttribute('POSITION').getCount()
      if (prim.getMode() === 4) triangles += count / 3
    }
  }
  return {
    bytes,
    triangles: Math.round(triangles),
    drawCalls,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    nodes: root.listNodes().length,
    meshes: root.listMeshes().length,
  }
}

/** Every named node in the file, so we can prove nothing was renamed or merged. */
function nodeNames(doc) {
  return doc
    .getRoot()
    .listNodes()
    .map((n) => n.getName())
    .filter(Boolean)
    .sort()
}

/**
 * name → whether that node carries geometry. Names surviving is not enough: quantize
 * will happily keep a name while moving its mesh to an anonymous child, which breaks
 * every `getObjectByName(...).material = ...` in the runtime without changing a name.
 */
function meshOwners(doc) {
  const owners = new Set()
  for (const node of doc.getRoot().listNodes()) {
    if (node.getName() && node.getMesh()) owners.add(node.getName())
  }
  return owners
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now()
  MeshoptSimplifier.useExperimentalFeatures = true
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready])

  // The encoder is needed to WRITE EXT_meshopt_compression; the decoder to read the
  // result back in the verification pass.
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })

  step(0, 'Read source')
  const sourceBytes = await fetchSource()
  const doc = await io.readBinary(new Uint8Array(sourceBytes))
  const root = doc.getRoot()
  const before = measure(doc, sourceBytes.length)
  const namesBefore = nodeNames(doc)
  const ownersBefore = meshOwners(doc)
  note(
    `${before.triangles.toLocaleString()} tris · ${before.drawCalls} draw calls · ` +
      `${before.materials} materials · ${before.textures} textures · ${before.nodes} nodes`,
  )

  const byName = (name) => root.listMaterials().find((m) => m.getName() === name)

  // ── 1. Hoist the pearl thickness map (§4.5) ────────────────────────────────
  // Must happen BEFORE the variants extension is stripped. Thickness.png is bound
  // only to "Paint 1 Pearl", which is a variant material; strip variants first and
  // prune takes the texture with it, and the pearl finish is unbuildable at runtime.
  step(1, 'Hoist pearl iridescence thickness onto the base paint materials (§4.5)')
  {
    const donor = byName('Paint 1 Pearl')
    if (!donor) throw new BuildError('material "Paint 1 Pearl" not found — cannot hoist §4.5')
    const donorIrid = donor.getExtension('KHR_materials_iridescence')
    const thickness = donorIrid?.getIridescenceThicknessTexture()
    if (!thickness) throw new BuildError('"Paint 1 Pearl" has no iridescenceThicknessTexture')

    const donorInfo = donorIrid.getIridescenceThicknessTextureInfo()
    const donorScale = donorInfo?.getExtension('KHR_texture_transform')?.getScale() ?? [1, 1]

    const iridExt = doc.createExtension(KHRMaterialsIridescence)
    const xformExt = doc.createExtension(KHRTextureTransform)

    for (const name of ['Paint 1 Carmine', 'Paint 2 Carmine']) {
      const mat = byName(name)
      if (!mat) throw new BuildError(`base paint material "${name}" not found`)
      const irid = iridExt.createIridescence()
      // Off by default — gloss is the default finish. The runtime raises the factor
      // when the user picks pearl. What matters here is that the graph edge to the
      // texture exists, so prune keeps it.
      irid
        .setIridescenceFactor(0)
        .setIridescenceIOR(PEARL.ior)
        .setIridescenceThicknessMinimum(PEARL.thicknessMin)
        .setIridescenceThicknessMaximum(PEARL.thicknessMax)
        .setIridescenceThicknessTexture(thickness)
      irid
        .getIridescenceThicknessTextureInfo()
        .setExtension(
          'KHR_texture_transform',
          xformExt.createTransform().setScale([donorScale[0], donorScale[1]]),
        )
      mat.setExtension('KHR_materials_iridescence', irid)
      note(`${name} ← thickness map, scale [${donorScale.join(', ')}], IOR ${PEARL.ior}, range [${PEARL.thicknessMin}, ${PEARL.thicknessMax}]`)
    }
  }

  // ── 2. Strip KHR_materials_variants (§4.6) ─────────────────────────────────
  step(2, 'Strip KHR_materials_variants (§4.6)')
  {
    const ext = root
      .listExtensionsUsed()
      .find((e) => e.extensionName === KHRMaterialsVariants.EXTENSION_NAME)
    if (ext) {
      ext.dispose()
      note('disposed — three.js GLTFLoader does not implement it; the variant materials are dead weight')
    } else warn('KHR_materials_variants not present (already stripped?)')
  }

  // ── 3. Strip KHR_materials_transmission (BRIEF §6) ─────────────────────────
  step(3, 'Strip KHR_materials_transmission (BRIEF §6)')
  {
    const ext = root
      .listExtensionsUsed()
      .find((e) => e.extensionName === KHRMaterialsTransmission.EXTENSION_NAME)
    if (ext) {
      ext.dispose()
      note('disposed — transmission forces a render-target pass every frame (8-15ms on mid-range Android)')
      note('glass is rebuilt at runtime as two additively-blended layers instead')
    } else warn('KHR_materials_transmission not present')
  }

  // ── 4. Strip the Khronos marks (§4.2) — a licence condition ────────────────
  step(4, 'Strip Khronos trade marks (§4.2) — licence condition, not a nicety')

  // 4a. Find the logo image by content hash, since GLB images have no name or URI.
  const logoTexture = root
    .listTextures()
    .find((t) => t.getImage() && sha256(Buffer.from(t.getImage())) === KHRONOS_LOGO_SHA256)
  if (!logoTexture) {
    throw new BuildError(
      `Khronos logo image not found by SHA-256 ${KHRONOS_LOGO_SHA256}.\n` +
        'The upstream asset changed. Re-verify §4.2 against the new file before shipping.',
    )
  }
  note(`logo image located by SHA-256 (${logoTexture.getSize()?.join('x')}, ${logoTexture.getImage().byteLength} bytes)`)

  let emissiveUses = 0
  let baseColorUses = 0
  for (const mat of root.listMaterials()) {
    if (mat.getEmissiveTexture() === logoTexture) {
      mat.setEmissiveTexture(null).setEmissiveFactor([0, 0, 0])
      emissiveUses++
      note(`cleared emissive + zeroed emissiveFactor on ${JSON.stringify(mat.getName())}`)
    }
    if (mat.getBaseColorTexture() === logoTexture) {
      mat.setBaseColorTexture(null)
      baseColorUses++
      note(`cleared baseColor on ${JSON.stringify(mat.getName())}`)
    }
  }
  if (emissiveUses !== KHRONOS_LOGO_EXPECTED_EMISSIVE_USES) {
    throw new BuildError(
      `expected the logo on ${KHRONOS_LOGO_EXPECTED_EMISSIVE_USES} emissive slots (§4.2), found ${emissiveUses}`,
    )
  }
  if (baseColorUses !== KHRONOS_LOGO_EXPECTED_BASECOLOR_USES) {
    throw new BuildError(
      `expected the logo on ${KHRONOS_LOGO_EXPECTED_BASECOLOR_USES} baseColor slot (§4.2), found ${baseColorUses}`,
    )
  }
  logoTexture.dispose()
  note('logo image disposed')

  // 4b. Delete the two nodes that ARE marks.
  for (const name of DELETE_NODES) {
    const node = root.listNodes().find((n) => n.getName() === name)
    if (!node) throw new BuildError(`node ${JSON.stringify(name)} not found — cannot strip mark`)
    node.dispose()
    note(`deleted node ${JSON.stringify(name)}`)
  }

  // 4c. The tyre sidewall. NOT in §4.2's inventory — found by auditing every image.
  //     The base colour map is 99.1% one flat value plus two logos, so it collapses
  //     to a factor with nothing lost. The normal map carries the relief that makes
  //     the tyre read, so only the two branded sectors are flattened.
  {
    const tyre = byName('Tireside')
    if (!tyre) throw new BuildError('material "Tireside" not found — cannot strip sidewall marks')

    const base = tyre.getBaseColorTexture()
    if (base) {
      const { dominant } = await sharp(Buffer.from(base.getImage())).stats()
      const factor = [
        srgbToLinear(dominant.r),
        srgbToLinear(dominant.g),
        srgbToLinear(dominant.b),
        1,
      ]
      tyre.setBaseColorTexture(null).setBaseColorFactor(factor)
      base.dispose()
      note(
        `Tireside baseColor: dropped (carried KHRONOS + 3DCommerce logos), ` +
          `replaced with factor rgb(${dominant.r}, ${dominant.g}, ${dominant.b})`,
      )
    } else warn('Tireside has no baseColorTexture — sidewall logos may already be gone')

    const normal = tyre.getNormalTexture()
    if (normal) {
      const masked = await maskSidewallMarks(Buffer.from(normal.getImage()))
      normal.setImage(masked.bytes).setMimeType('image/png')
      note(
        `Tireside normal: flattened ${masked.sectors} branded sector(s) of the sidewall annulus ` +
          `(${masked.percent}% of the image); generic DOT/TREADWEAR markings and groove arcs kept`,
      )
    } else warn('Tireside has no normalTexture')
  }

  // ── 5. Normalise material names to stable slugs (§4.1) ─────────────────────
  step(5, 'Normalise material names to stable slugs (§4.1)')
  {
    const unnamed = root.listMaterials().filter((m) => m.getName() === '')
    if (unnamed.length !== 1) {
      throw new BuildError(
        `expected exactly 1 unnamed material (§4.1 says index 2 has no name), found ${unnamed.length}`,
      )
    }
    const seen = new Set()
    for (const mat of root.listMaterials()) {
      const original = mat.getName()
      const slug = MATERIAL_SLUGS[original]
      if (!slug) {
        // Variant + licence-plate materials are unreferenced by now and prune will
        // remove them. Anything else reaching here is a genuine surprise.
        note(`no slug for ${JSON.stringify(original)} — expected to be pruned as unused`)
        continue
      }
      if (seen.has(slug)) throw new BuildError(`slug collision: two materials map to "${slug}"`)
      seen.add(slug)
      mat.setName(slug)
    }
    note(`renamed ${seen.size} materials`)
  }

  // ── 6. Paint panels to FrontSide (§4.8) ────────────────────────────────────
  step(6, 'Set paint materials to FrontSide (§4.8)')
  for (const slug of PAINT_SLUGS) {
    const mat = byName(slug)
    if (!mat) throw new BuildError(`paint material "${slug}" missing at the FrontSide step`)
    if (!mat.getDoubleSided()) {
      warn(`${slug} was already single-sided`)
      continue
    }
    mat.setDoubleSided(false)
    note(`${slug}: doubleSided → false (≈2x fragment saving on the largest clearcoat meshes)`)
  }

  // ── 7. Name the textures ───────────────────────────────────────────────────
  // They arrive anonymous. Roles are derived from the reference graph, so the names
  // describe what each image actually does rather than what upstream called the file.
  step(7, 'Name textures by role')
  {
    const slots = [
      ['getBaseColorTexture', 'base'],
      ['getNormalTexture', 'n'],
      ['getOcclusionTexture', 'ao'],
      ['getEmissiveTexture', 'e'],
      ['getMetallicRoughnessTexture', 'mr'],
    ]
    const roles = new Map()
    for (const mat of root.listMaterials()) {
      for (const [getter, suffix] of slots) {
        const tex = mat[getter]?.()
        if (tex && !roles.has(tex)) roles.set(tex, `${mat.getName()}_${suffix}`)
      }
      const irid = mat.getExtension('KHR_materials_iridescence')
      const thick = irid?.getIridescenceThicknessTexture()
      if (thick && !roles.has(thick)) roles.set(thick, 'thickness')
    }
    // Two roles get canonical names the graph can't infer: the AO atlas is shared by
    // nearly every material, and the flake normal is what §4.4 calls Powdercoat_N.
    const paintNormal = byName('paint1')?.getNormalTexture()
    if (paintNormal) roles.set(paintNormal, 'powdercoat_n')
    const ao = byName('trim')?.getOcclusionTexture()
    if (ao) roles.set(ao, 'occlusion_ao')

    for (const tex of root.listTextures()) {
      const role = roles.get(tex) ?? `texture_${root.listTextures().indexOf(tex)}`
      tex.setName(role)
      note(`${role.padEnd(16)} ${tex.getSize()?.join('x').padEnd(11)} ${tex.getImage().byteLength.toLocaleString().padStart(10)} bytes`)
    }
  }

  // ── 8. dedup ───────────────────────────────────────────────────────────────
  // ACCESSOR, MESH and TEXTURE only. MATERIAL is deliberately excluded: merging two
  // slugged materials that happen to share parameters would silently destroy the
  // per-part addressability this whole project rests on.
  step(8, 'dedup (accessors, meshes, textures — never materials)')
  await doc.transform(
    dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
  )
  note(`${root.listMeshes().length} meshes, ${root.listTextures().length} textures, ${root.listMaterials().length} materials`)

  // ── 9. prune ───────────────────────────────────────────────────────────────
  step(9, 'prune unreferenced properties')
  await doc.transform(prune({ keepLeaves: true }))
  note(`${root.listMaterials().length} materials, ${root.listTextures().length} textures remain`)

  // ── 10. weld ───────────────────────────────────────────────────────────────
  step(10, 'weld')
  await doc.transform(weld())
  note(`${measure(doc, 0).triangles.toLocaleString()} tris`)

  // ── 11. Targeted simplify (§4.7) ───────────────────────────────────────────
  step(11, 'Targeted simplify (§4.7) — never global')
  {
    // A Mesh shared between a targeted node and an untargeted one would decimate
    // geometry we meant to leave alone. Refuse rather than guess.
    const targeted = new Map()
    const untargeted = new Set()
    for (const node of root.listNodes()) {
      const mesh = node.getMesh()
      if (!mesh) continue
      const rule = SIMPLIFY_TARGETS.find((t) => t.match.test(node.getName()))
      if (rule) targeted.set(mesh, { rule, node: node.getName() })
      else untargeted.add(mesh)
    }
    for (const [mesh, { node }] of targeted) {
      if (untargeted.has(mesh)) {
        throw new BuildError(
          `mesh for "${node}" is shared with an untargeted node; simplifying it would ` +
            'decimate geometry that was deliberately left alone',
        )
      }
    }

    const triOf = (mesh) =>
      mesh.listPrimitives().reduce((sum, p) => {
        const i = p.getIndices()
        return sum + (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3
      }, 0)

    let saved = 0
    for (const [mesh, { rule, node }] of targeted) {
      const was = triOf(mesh)
      for (const prim of mesh.listPrimitives()) {
        simplifyPrimitive(prim, {
          simplifier: MeshoptSimplifier,
          ratio: rule.ratio,
          error: rule.error,
        })
      }
      const now = triOf(mesh)
      saved += was - now
      note(
        `${node.padEnd(28)} ${String(Math.round(was)).padStart(6)} → ${String(Math.round(now)).padStart(6)} tris  ` +
          `(-${(((was - now) / was) * 100).toFixed(0)}%)`,
      )
    }
    note(`${Math.round(saved).toLocaleString()} triangles removed; rims and body panels untouched by design`)
    await doc.transform(prune({ keepLeaves: true }))
  }

  // ── 12. Drop TANGENT ───────────────────────────────────────────────────────
  // 0.97 MB of float32 vec4. three.js derives tangents in the fragment shader when
  // the attribute is absent and a normal map is present, so this costs nothing visible.
  step(12, 'Drop TANGENT')
  {
    let dropped = 0
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        if (prim.getAttribute('TANGENT')) {
          prim.setAttribute('TANGENT', null)
          dropped++
        }
      }
    }
    await doc.transform(prune({ keepLeaves: true, keepAttributes: true }))
    note(`removed from ${dropped} primitives`)
  }

  // ── 13. Textures → WebP (§5) ───────────────────────────────────────────────
  step(13, 'Compress textures to WebP (§5)')
  {
    // A plan key that matches nothing is how §5's resize for the tyre normal map
    // silently fails to apply. Catch it here rather than wonder about the byte count.
    const roles = new Set(root.listTextures().map((t) => t.getName()))
    const orphaned = Object.keys(TEXTURE_PLAN).filter((k) => !roles.has(k))
    if (orphaned.length) {
      throw new BuildError(
        `TEXTURE_PLAN keys match no texture: ${orphaned.join(', ')}. ` +
          `Available roles: ${[...roles].sort().join(', ')}`,
      )
    }

    let wasTotal = 0
    let nowTotal = 0
    for (const tex of root.listTextures()) {
      const role = tex.getName()
      const plan = TEXTURE_PLAN[role] ?? {}
      const was = tex.getImage().byteLength
      await compressTexture(tex, {
        encoder: sharp,
        targetFormat: 'webp',
        effort: 100,
        ...(plan.lossless ? { lossless: true } : { quality: plan.quality ?? TEXTURE_QUALITY_DEFAULT }),
        ...(plan.resize ? { resize: plan.resize } : {}),
      })
      const now = tex.getImage().byteLength
      wasTotal += was
      nowTotal += now
      note(
        `${role.padEnd(16)} ${tex.getSize()?.join('x').padEnd(11)} ` +
          `${was.toLocaleString().padStart(10)} → ${now.toLocaleString().padStart(9)} bytes` +
          `${plan.lossless ? '  (lossless)' : ''}${plan.resize ? '  (resized)' : ''}`,
      )
    }
    note(`textures: ${(wasTotal / 1e6).toFixed(2)} MB → ${(nowTotal / 1e6).toFixed(2)} MB`)
  }

  // ── 14. meshopt: reorder → quantize → repair → EXT_meshopt_compression ─────
  //
  // Written out rather than calling meshopt({level:'medium'}), for the same reason
  // this file never calls optimize(): the wrapper hides the step that has to be
  // corrected.
  //
  // quantize gives quantized POSITION data a corrective node transform T. A node with
  // BOTH a mesh and children cannot hold T without also scaling its children, so
  // quantize moves the mesh onto a freshly created anonymous child instead (see
  // transformMeshParents in @gltf-transform/functions). Six nodes here are that
  // shape — BodyHood, BodyRearPanelsColor1, BodyDoorLColor1, BodyDoorRColor1,
  // BodyUnderside, InteriorSteeringCylinder. Each keeps its name and loses its
  // geometry, so getObjectByName('BodyHood') returns an empty node and every material
  // assignment against it silently does nothing. quantizationVolume:'scene' does not
  // avoid this; T is still non-identity, so the split still happens.
  //
  // The repair below undoes it exactly. T is a uniform scale plus a translation, so
  // it inverts cleanly: push T back onto the parent, push T-inverse onto each of the
  // parent's other children, and their world transforms are unchanged. Asserted, not
  // assumed — every surviving node's world matrix is compared before and after.
  step(14, 'meshopt: reorder → quantize → repair → EXT_meshopt_compression')
  await doc.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }))
  {
    const hadMesh = new Set(root.listNodes().filter((n) => n.getMesh()))
    const knownNodes = new Set(root.listNodes())
    const worldBefore = new Map(root.listNodes().map((n) => [n, n.getWorldMatrix()]))

    await doc.transform(
      quantize({
        pattern: QUANTIZE_PATTERN,
        patternTargets: QUANTIZE_PATTERN,
        quantizationVolume: 'scene',
        quantizeNormal: 10,
        quantizeTexcoord: 12,
        quantizeColor: 8,
      }),
    )

    const { repaired, T } = repairQuantizeSplits(root, hadMesh, knownNodes)
    if (repaired.length) {
      note(`re-attached geometry to ${repaired.length} split node(s): ${repaired.join(', ')}`)
    }

    // Nothing may have moved. Quantized vertices live in T-space, so a node carrying a
    // mesh is expected to have absorbed exactly T and nothing else; a node without one
    // is expected not to have moved at all. Any other outcome means the repair pushed
    // geometry somewhere it does not belong.
    let maxDrift = 0
    let worst = null
    for (const [node, before] of worldBefore) {
      if (node.isDisposed()) continue
      const expected = node.getMesh() && T ? mat4Multiply(before, T) : before
      const after = node.getWorldMatrix()
      for (let i = 0; i < 16; i++) {
        const d = Math.abs(after[i] - expected[i])
        if (d > maxDrift) {
          maxDrift = d
          worst = node.getName() || '(anonymous)'
        }
      }
    }
    if (maxDrift > 1e-4) {
      throw new BuildError(
        `quantize repair moved geometry: world-matrix drift ${maxDrift.toExponential(2)} on ${worst}`,
      )
    }
    note(`world transforms preserved across ${worldBefore.size} nodes (max drift ${maxDrift.toExponential(1)})`)
  }
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
  note('NORMAL at 10 bits; meshopt level "high" drops to 8, which stairsteps clearcoat highlights')

  // ── Write ──────────────────────────────────────────────────────────────────
  step(15, 'Write')
  const outBytes = Buffer.from(await io.writeBinary(doc))
  await mkdir(dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, outBytes)
  note(`public/models/car.glb — ${outBytes.length.toLocaleString()} bytes`)

  // ── Verify ─────────────────────────────────────────────────────────────────
  step(16, 'Verify (re-read the written file and assert)')
  const after = await verify(io, outBytes, namesBefore, ownersBefore)

  report(before, after, Date.now() - t0)
  await writeFile(STATS_PATH, JSON.stringify({ before, after }, null, 2))
}

/** Column-major mat4 product, a * b. */
function mat4Multiply(a, b) {
  const out = new Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let v = 0
      for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k]
      out[c * 4 + r] = v
    }
  }
  return out
}

/**
 * Undoes quantize's mesh-bearing-parent split (see step 14).
 *
 * quantize turns   P[mesh, children]   into   P[children] → ""[mesh, T]
 *
 * T is always a uniform scale plus a translation (getNodeTransform returns exactly
 * that), so this restores P[mesh, children] with P's matrix post-multiplied by T and
 * every other child pre-multiplied by T-inverse. World transforms are unchanged; the
 * caller verifies that.
 *
 * Returns the repaired node names and T itself, which the caller needs to express what
 * "unchanged" means for a node whose vertices are now in quantized space.
 */
function repairQuantizeSplits(root, hadMesh, knownNodes) {
  const repaired = []
  let T = null
  for (const parent of root.listNodes()) {
    if (!hadMesh.has(parent) || parent.getMesh()) continue

    const injected = parent.listChildren().filter((c) => !knownNodes.has(c) && c.getMesh())
    if (injected.length !== 1) {
      throw new BuildError(
        `node ${JSON.stringify(parent.getName())} lost its mesh but has ${injected.length} ` +
          'injected children — quantize behaved unexpectedly, refusing to guess',
      )
    }
    const child = injected[0]

    const scale = child.getScale()
    const rot = child.getRotation()
    const uniform = Math.abs(scale[0] - scale[1]) < 1e-9 && Math.abs(scale[1] - scale[2]) < 1e-9
    const unrotated = Math.abs(rot[0]) + Math.abs(rot[1]) + Math.abs(rot[2]) < 1e-9
    if (!uniform || !unrotated || scale[0] === 0) {
      throw new BuildError(
        `quantize transform on ${JSON.stringify(parent.getName())} is not an invertible ` +
          `uniform scale + translation (scale ${scale}, rotation ${rot})`,
      )
    }

    T = child.getMatrix()
    const s = scale[0]
    const [tx, ty, tz] = child.getTranslation()
    // prettier-ignore
    const Tinv = [
      1 / s, 0, 0, 0,
      0, 1 / s, 0, 0,
      0, 0, 1 / s, 0,
      -tx / s, -ty / s, -tz / s, 1,
    ]

    for (const sibling of parent.listChildren()) {
      if (sibling === child) continue
      sibling.setMatrix(mat4Multiply(Tinv, sibling.getMatrix()))
    }
    parent.setMesh(child.getMesh())
    parent.setMatrix(mat4Multiply(parent.getMatrix(), T))
    child.dispose()
    repaired.push(parent.getName())
  }
  return { repaired, T }
}

/**
 * Flattens the branded sectors of the tyre sidewall annulus to a neutral normal.
 * Returns PNG bytes; the WebP pass in step 13 re-encodes them.
 */
async function maskSidewallMarks(pngBytes) {
  const { data, info } = await sharp(pngBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H, channels: C } = info
  const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)
  }

  let touched = 0
  for (let y = 0; y < H; y++) {
    const dy = (y + 0.5) / H - 0.5
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5) / W - 0.5
      const r = Math.hypot(dx, dy)
      if (r < SIDEWALL_R_INNER - SIDEWALL_FEATHER_R || r > SIDEWALL_R_OUTER + SIDEWALL_FEATHER_R) continue
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI
      let m = 0
      for (const s of SIDEWALL_MARK_SECTORS) {
        const d = Math.abs(((ang - s.centreDeg + 540) % 360) - 180)
        m = Math.max(m, 1 - smooth(s.halfWidthDeg - SIDEWALL_FEATHER_DEG, s.halfWidthDeg, d))
      }
      m *=
        smooth(SIDEWALL_R_INNER - SIDEWALL_FEATHER_R, SIDEWALL_R_INNER + SIDEWALL_FEATHER_R, r) *
        (1 - smooth(SIDEWALL_R_OUTER - SIDEWALL_FEATHER_R, SIDEWALL_R_OUTER + SIDEWALL_FEATHER_R, r))
      if (m <= 0) continue
      touched++
      const i = (y * W + x) * C
      data[i] = Math.round(data[i] * (1 - m) + 128 * m)
      data[i + 1] = Math.round(data[i + 1] * (1 - m) + 128 * m)
      data[i + 2] = Math.round(data[i + 2] * (1 - m) + 255 * m)
    }
  }
  if (touched === 0) throw new BuildError('sidewall mask touched 0 pixels — the UV layout changed')

  const bytes = await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toBuffer()
  return {
    bytes: new Uint8Array(bytes),
    sectors: SIDEWALL_MARK_SECTORS.length,
    percent: ((touched / (W * H)) * 100).toFixed(1),
  }
}

/**
 * Re-reads the written GLB and asserts every invariant the runtime depends on.
 * Anything wrong here means the build fails loudly now, rather than on day 6 as a
 * mystery about why WheelFrontLRim no longer exists.
 */
async function verify(io, outBytes, namesBefore, ownersBefore) {
  const doc = await io.readBinary(new Uint8Array(outBytes))
  const root = doc.getRoot()
  const failures = []
  const check = (ok, msg) => {
    console.log(`      ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${msg}`)
    if (!ok) failures.push(msg)
  }

  // §5 — every expected material slug exists.
  const slugs = new Set(root.listMaterials().map((m) => m.getName()))
  const missing = REQUIRED_SLUGS.filter((s) => !slugs.has(s))
  check(missing.length === 0, `all ${REQUIRED_SLUGS.length} required material slugs present${missing.length ? ` — MISSING: ${missing.join(', ')}` : ''}`)
  const unnamed = root.listMaterials().filter((m) => !m.getName())
  check(unnamed.length === 0, `no unnamed materials remain (${unnamed.length} found)`)

  // §5 — the mark-bearing nodes are gone.
  const names = new Set(root.listNodes().map((n) => n.getName()))
  for (const name of DELETE_NODES) check(!names.has(name), `node ${JSON.stringify(name)} deleted`)

  // §5 — all four rims survive. This is the `--join` canary.
  const missingNodes = REQUIRED_NODES.filter((n) => !names.has(n))
  check(missingNodes.length === 0, `all four Wheel*Rim nodes present${missingNodes.length ? ` — MISSING: ${missingNodes.join(', ')}` : ''}`)

  // Stronger than §5 asks: prove NOTHING was renamed or merged, not just the rims.
  const expected = namesBefore.filter((n) => !DELETE_NODES.includes(n))
  const got = nodeNames(doc)
  const lost = expected.filter((n) => !names.has(n))
  const gained = got.filter((n) => !expected.includes(n))
  check(
    lost.length === 0 && gained.length === 0,
    `all ${expected.length} named nodes preserved, none added` +
      `${lost.length ? ` — LOST: ${lost.slice(0, 8).join(', ')}` : ''}` +
      `${gained.length ? ` — GAINED: ${gained.slice(0, 8).join(', ')}` : ''}`,
  )

  // Names alone are not enough — see meshOwners(). Every named node that carried
  // geometry on the way in must still carry it on the way out.
  const ownersAfter = meshOwners(doc)
  const hollowed = [...ownersBefore].filter((n) => !DELETE_NODES.includes(n) && !ownersAfter.has(n))
  check(
    hollowed.length === 0,
    `all ${ownersBefore.size - DELETE_NODES.length} mesh-bearing nodes still carry their geometry` +
      `${hollowed.length ? ` — HOLLOWED: ${hollowed.slice(0, 8).join(', ')}` : ''}`,
  )
  const anonymous = doc.getRoot().listNodes().filter((n) => !n.getName()).length
  check(
    anonymous === ANONYMOUS_NODE_COUNT,
    `${anonymous} anonymous nodes, expected ${ANONYMOUS_NODE_COUNT} (the four tyres) — ` +
      'a higher count means something injected nodes',
  )

  // §5's URI check is vacuous in a GLB, so assert on content instead.
  const logoPresent = root
    .listTextures()
    .some((t) => t.getImage() && sha256(Buffer.from(t.getImage())) === KHRONOS_LOGO_SHA256)
  check(!logoPresent, 'Khronos logo image absent (verified by SHA-256, not by URI)')
  const badRef = root
    .listTextures()
    .some((t) => /khronos/i.test(t.getName() ?? '') || /khronos/i.test(t.getURI() ?? ''))
  check(!badRef, 'no texture name or URI references Khronos')
  const emissive = root.listMaterials().filter((m) => m.getEmissiveTexture())
  check(
    emissive.every((m) => m.getName() === 'dash'),
    `only 'dash' retains an emissive texture (found: ${emissive.map((m) => m.getName()).join(', ') || 'none'})`,
  )

  // Extensions that must be gone.
  const used = root.listExtensionsUsed().map((e) => e.extensionName)
  check(!used.includes('KHR_materials_variants'), 'KHR_materials_variants stripped')
  check(!used.includes('KHR_materials_transmission'), 'KHR_materials_transmission stripped')
  check(used.includes('EXT_meshopt_compression'), 'EXT_meshopt_compression applied')

  // §4.5 — the hoist actually survived prune. This is the whole point of step 1.
  for (const slug of PAINT_SLUGS) {
    const mat = root.listMaterials().find((m) => m.getName() === slug)
    const thick = mat?.getExtension('KHR_materials_iridescence')?.getIridescenceThicknessTexture()
    check(!!thick, `${slug} retains the pearl thickness map (§4.5 hoist survived prune)`)
  }

  // §4.8 — paint is single-sided.
  for (const slug of PAINT_SLUGS) {
    const mat = root.listMaterials().find((m) => m.getName() === slug)
    check(mat?.getDoubleSided() === false, `${slug} is FrontSide`)
  }

  // §4.3 — TEXCOORD_1 is the baked AO channel and must survive pruning.
  const hasAoUv = root
    .listMeshes()
    .some((m) => m.listPrimitives().some((p) => p.getAttribute('TEXCOORD_1')))
  check(hasAoUv, 'TEXCOORD_1 (baked AO channel) preserved')
  const hasTangent = root
    .listMeshes()
    .some((m) => m.listPrimitives().some((p) => p.getAttribute('TANGENT')))
  check(!hasTangent, 'TANGENT dropped')

  // Every texture is WebP.
  const nonWebp = root.listTextures().filter((t) => t.getMimeType() !== 'image/webp')
  check(nonWebp.length === 0, `all ${root.listTextures().length} textures are WebP${nonWebp.length ? ` — ${nonWebp.map((t) => t.getName()).join(', ')} are not` : ''}`)

  if (failures.length) {
    throw new BuildError(`${failures.length} verification check(s) failed — not shipping this asset`)
  }
  return measure(doc, outBytes.length)
}

function report(before, after, ms) {
  const mb = (n) => `${(n / 1e6).toFixed(2)} MB`
  const delta = (b, a) => {
    const pct = ((a - b) / b) * 100
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
  }
  const rows = [
    ['bytes', mb(before.bytes), mb(after.bytes), delta(before.bytes, after.bytes)],
    ['triangles', before.triangles.toLocaleString(), after.triangles.toLocaleString(), delta(before.triangles, after.triangles)],
    ['draw calls', String(before.drawCalls), String(after.drawCalls), delta(before.drawCalls, after.drawCalls)],
    ['materials', String(before.materials), String(after.materials), delta(before.materials, after.materials)],
    ['textures', String(before.textures), String(after.textures), delta(before.textures, after.textures)],
    ['nodes', String(before.nodes), String(after.nodes), delta(before.nodes, after.nodes)],
  ]
  const w = [12, 12, 12, 9]
  const line = (c) => `  ${c[0].padEnd(w[0])}${c[1].padStart(w[1])}${c[2].padStart(w[2])}${c[3].padStart(w[3])}`
  console.log(`\n\x1b[1m  CarConcept → car.glb\x1b[0m`)
  console.log(line(['', 'before', 'after', 'delta']))
  console.log(`  ${'─'.repeat(w[0] + w[1] + w[2] + w[3])}`)
  for (const r of rows) console.log(line(r))
  console.log(`\n  done in ${(ms / 1000).toFixed(1)}s\n`)
}

main().catch((err) => {
  console.error(`\n\x1b[31m✗ ${err instanceof BuildError ? err.message : err.stack}\x1b[0m\n`)
  process.exitCode = 1
})
