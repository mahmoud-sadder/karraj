import { button, folder, Leva, useControls } from 'leva'
import { useEffect } from 'react'

import { DEFAULT_ART, useArt } from '../state/art'
import { useConfig } from '../state/config'
import { FINISHES, RIM_FINISHES, type Finish, type FinishSpec, type RimFinish } from '../three/finishes'

/**
 * The `?debug=1` art-direction panel.
 *
 * BRIEF §7 calls look-dev risk #1 and prescribes exactly this: wire every art
 * parameter into leva on day 3, so day 7 is dialling knobs and taking screenshots
 * rather than writing code against a deadline. Day 7 ends by hard-coding the winners
 * into `DEFAULT_ART` / `FINISH_SPECS` and deleting this directory.
 *
 * Lazy-loaded by `App`, so leva never enters the production bundle — Vite splits it
 * into its own chunk that is only fetched when the flag is present. That is why this
 * lives behind a `React.lazy` boundary rather than a plain `if`.
 */

/** The finish parameters worth dragging, with sane slider ranges. */
const FINISH_CONTROLS: Array<{ key: keyof FinishSpec; min: number; max: number; step: number }> = [
  { key: 'metalness', min: 0, max: 1, step: 0.01 },
  { key: 'roughness', min: 0, max: 1, step: 0.01 },
  { key: 'clearcoat', min: 0, max: 1, step: 0.01 },
  { key: 'clearcoatRoughness', min: 0, max: 1, step: 0.005 },
  { key: 'iridescence', min: 0, max: 1, step: 0.01 },
  { key: 'iridescenceIOR', min: 1, max: 2.4, step: 0.01 },
  { key: 'sheen', min: 0, max: 1, step: 0.01 },
  { key: 'sheenRoughness', min: 0, max: 1, step: 0.01 },
  { key: 'envMapIntensity', min: 0, max: 4, step: 0.05 },
  { key: 'normalScale', min: 0, max: 1, step: 0.01 },
]

function FinishControls({ finish }: { finish: Finish }) {
  const spec = useArt((s) => s.finishes[finish])
  const setFinishParam = useArt((s) => s.setFinishParam)

  useControls(
    `finish: ${finish}`,
    () =>
      Object.fromEntries(
        FINISH_CONTROLS.map(({ key, min, max, step }) => [
          key,
          {
            value: spec[key] as number,
            min,
            max,
            step,
            onChange: (v: number) => setFinishParam(finish, key, v as FinishSpec[typeof key]),
          },
        ]),
      ),
    // Rebuild when the selected finish changes, so the panel always shows the table
    // that is actually on screen.
    [finish],
  )

  return null
}

export default function DebugPanel() {
  const config = useConfig()
  const art = useArt()

  useControls('paint', {
    color1: {
      value: config.paint1.color,
      label: 'paint1 colour',
      onChange: (v: string) => useConfig.getState().setPaintColor('paint1', v),
    },
    finish1: {
      value: config.paint1.finish,
      label: 'paint1 finish',
      options: [...FINISHES],
      onChange: (v: Finish) => useConfig.getState().setPaintFinish('paint1', v),
    },
    twoTone: {
      value: config.twoTone,
      onChange: (v: boolean) => useConfig.getState().setTwoTone(v),
    },
    color2: {
      value: config.paint2.color,
      label: 'paint2 colour',
      onChange: (v: string) => useConfig.getState().setPaintColor('paint2', v),
    },
    finish2: {
      value: config.paint2.finish,
      label: 'paint2 finish',
      options: [...FINISHES],
      onChange: (v: Finish) => useConfig.getState().setPaintFinish('paint2', v),
    },
  })

  useControls('vehicle', {
    rimFinish: {
      value: config.wheels.finish,
      options: [...RIM_FINISHES],
      onChange: (v: RimFinish) => useConfig.getState().setWheels({ finish: v }),
    },
    rimColor: {
      value: config.wheels.color,
      onChange: (v: string) => useConfig.getState().setWheels({ color: v }),
    },
    caliperColor: {
      value: config.wheels.caliperColor,
      onChange: (v: string) => useConfig.getState().setWheels({ caliperColor: v }),
    },
    windowTint: {
      value: config.glass.tint,
      min: 0,
      max: 1,
      step: 0.01,
      onChange: (v: number) => useConfig.getState().setTint(v),
    },
    lightsOn: {
      value: config.lights.on,
      onChange: (v: boolean) => useConfig.getState().setLights({ on: v }),
    },
    headlightColor: {
      value: config.lights.headlightColor,
      onChange: (v: string) => useConfig.getState().setLights({ headlightColor: v }),
    },
  })

  useControls({
    tone: folder({
      exposure: {
        value: art.exposure,
        min: 0.4,
        max: 2.5,
        step: 0.01,
        onChange: (v: number) => useArt.getState().set({ exposure: v }),
      },
      environmentIntensity: {
        value: art.environmentIntensity,
        min: 0,
        max: 3,
        step: 0.01,
        onChange: (v: number) => useArt.getState().set({ environmentIntensity: v }),
      },
      fogDensity: {
        value: art.fogDensity,
        min: 0,
        max: 0.2,
        step: 0.001,
        onChange: (v: number) => useArt.getState().set({ fogDensity: v }),
      },
    }),

    // LOOKDEV §3 ratios: key 1.0 → flanks 0.6–0.8 → kicker 1.2–2.0 → fill 0.1–0.2.
    // Move the key strip's height and length while watching the streak travel down
    // the flank — that iteration loop is the actual skill.
    lighting: folder({
      keyIntensity: {
        value: art.keyIntensity,
        min: 0,
        max: 20,
        step: 0.1,
        onChange: (v: number) => useArt.getState().set({ keyIntensity: v }),
      },
      flankLeftIntensity: {
        value: art.flankLeftIntensity,
        min: 0,
        max: 20,
        step: 0.1,
        onChange: (v: number) => useArt.getState().set({ flankLeftIntensity: v }),
      },
      flankRightIntensity: {
        value: art.flankRightIntensity,
        min: 0,
        max: 20,
        step: 0.1,
        onChange: (v: number) => useArt.getState().set({ flankRightIntensity: v }),
      },
      kickerIntensity: {
        value: art.kickerIntensity,
        min: 0,
        max: 20,
        step: 0.1,
        onChange: (v: number) => useArt.getState().set({ kickerIntensity: v }),
      },
      fillIntensity: {
        value: art.fillIntensity,
        min: 0,
        max: 10,
        step: 0.05,
        onChange: (v: number) => useArt.getState().set({ fillIntensity: v }),
      },
    }),

    ground: folder({
      floorColor: {
        value: art.floorColor,
        onChange: (v: string) => useArt.getState().set({ floorColor: v }),
      },
      floorRoughness: {
        value: art.floorRoughness,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (v: number) => useArt.getState().set({ floorRoughness: v }),
      },
      contactOpacity: {
        value: art.contactOpacity,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (v: number) => useArt.getState().set({ contactOpacity: v }),
      },
      floorReflection: {
        value: art.floorReflection,
        min: 0,
        max: 1.5,
        step: 0.01,
        onChange: (v: number) => useArt.getState().set({ floorReflection: v }),
      },
      contactPoolOpacity: {
        value: art.contactPoolOpacity,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (v: number) => useArt.getState().set({ contactPoolOpacity: v }),
      },
      contactBlur: {
        value: art.contactBlur,
        min: 0,
        max: 8,
        step: 0.05,
        onChange: (v: number) => useArt.getState().set({ contactBlur: v }),
      },
    }),

    post: folder({
      bloomIntensity: {
        value: art.bloomIntensity,
        min: 0,
        max: 2,
        step: 0.01,
        onChange: (v: number) => useArt.getState().set({ bloomIntensity: v }),
      },
      bloomThreshold: {
        value: art.bloomThreshold,
        min: 0,
        max: 2,
        step: 0.01,
        onChange: (v: number) => useArt.getState().set({ bloomThreshold: v }),
      },
      vignetteOffset: {
        value: art.vignetteOffset,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (v: number) => useArt.getState().set({ vignetteOffset: v }),
      },
      vignetteDarkness: {
        value: art.vignetteDarkness,
        min: 0,
        max: 1.5,
        step: 0.01,
        onChange: (v: number) => useArt.getState().set({ vignetteDarkness: v }),
      },
    }),

    'reset art': button(() => {
      useArt.getState().reset()
      window.location.reload()
    }),
    'copy art JSON': button(() => {
      const { set: _s, setFinishParam: _f, reset: _r, ...values } = useArt.getState()
      // Day 7 ends by pasting this back into DEFAULT_ART and FINISH_SPECS.
      void navigator.clipboard?.writeText(JSON.stringify(values, null, 2))
    }),
  })

  useEffect(() => {
    document.title = 'Karraj — debug'
    return () => {
      document.title = 'Karraj — car configurator'
    }
  }, [])

  return (
    <>
      <Leva collapsed={false} titleBar={{ title: `art · ${DEFAULT_ART.exposure ? 'day 3' : ''}` }} />
      <FinishControls finish={config.paint1.finish} />
    </>
  )
}
