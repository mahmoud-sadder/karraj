import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

import { useArt } from '../state/art'

/**
 * Post-processing, per KARRAJ-LOOKDEV.md §10.
 *
 * Three decisions here are the difference between this helping and hurting.
 *
 * **Tone mapping lives here and nowhere else.** §4: "Setting tone mapping in both the
 * Canvas and the composer is a classic, subtle, 'why does everything look washed out'
 * bug. Pick one." The Canvas is therefore set to `NoToneMapping` — which also means
 * `toneMappingExposure` stops doing anything, so exposure is folded into the scene's
 * environment intensity instead. Every light in this scene is image-based, so the two
 * are equivalent in practice; the one real difference is that emissive lights are no
 * longer scaled down with exposure, which is exactly what you want when the point of
 * the bloom threshold is to catch them.
 *
 * **The bloom threshold is 1.0, in a linear workspace.** That means only things above
 * 1.0 bloom, which is precisely the headlights (emissiveStrength 10), taillights and
 * signals (2) and the dash (3). Paint highlights stay crisp. §10 is blunt that
 * low-threshold bloom is the classic amateur haze: "if in doubt, raise the threshold
 * and lower the intensity."
 *
 * **No SSAO.** The asset ships a 2048² baked AO map on TEXCOORD_1. SSAO on top of a
 * good bake adds noise, costs 3-6 ms, and drags in another dependency — a pure-loss
 * trade. With it gone, `enableNormalPass` can be false, which saves a whole geometry
 * pass.
 */
export default function Post({ tier }: { tier: number }) {
  const bloomIntensity = useArt((s) => s.bloomIntensity)
  const bloomThreshold = useArt((s) => s.bloomThreshold)
  const vignetteDarkness = useArt((s) => s.vignetteDarkness)
  const vignetteOffset = useArt((s) => s.vignetteOffset)

  return (
    <EffectComposer
      // Multisampling beats SMAA when it can be afforded; SMAA on the weakest tier only.
      multisampling={tier >= 2 ? 4 : 0}
      enableNormalPass={false}
    >
      <Bloom
        mipmapBlur
        intensity={bloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.2}
        levels={tier >= 2 ? 7 : 5}
      />
      <Vignette offset={vignetteOffset} darkness={vignetteDarkness} />
      {tier < 2 ? <SMAA /> : <></>}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}
