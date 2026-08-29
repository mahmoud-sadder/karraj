/**
 * Strings, keyed.
 *
 * BRIEF §6 argues against i18next for two languages — a small typed dictionary plus
 * `dir` switching is cleaner and lighter. This is that dictionary, and it exists now
 * rather than on day 9 because the UI schema references labels by key. Hardcoding
 * English into the schema would defeat the point of having one.
 *
 * Arabic lands on day 9. The type below means a missing key is a compile error, so the
 * translation pass cannot quietly skip a control.
 */

export const en = {
  'panel.paint': 'Paint',
  'panel.wheels': 'Wheels',
  'panel.glass': 'Glass',
  'panel.lights': 'Lights',
  'panel.stance': 'Stance',
  'panel.scene': 'Scene',

  'paint.primary': 'Colour',
  'paint.finish': 'Finish',
  'paint.twoTone': 'Two-tone',
  'paint.secondary': 'Secondary colour',

  'wheels.finish': 'Rim finish',
  'wheels.color': 'Rim tint',
  'wheels.caliper': 'Calipers',

  'glass.tint': 'Window tint',

  'lights.on': 'Headlights',
  'lights.color': 'Headlight colour',

  'stance.drop': 'Ride height',

  'scene.preset': 'Environment',
  'scene.underglow': 'Underglow',
  'scene.underglowColor': 'Underglow colour',
  'scene.underglowIntensity': 'Intensity',

  'finish.gloss': 'Gloss',
  'finish.matte': 'Matte',
  'finish.satin': 'Satin',
  'finish.flake': 'Flake',
  'finish.chrome': 'Chrome',
  'finish.pearl': 'Pearl',

  'rim.silver': 'Silver',
  'rim.gloss_black': 'Gloss',
  'rim.matte_black': 'Matte',
  'rim.gunmetal': 'Gunmetal',
  'rim.chrome': 'Chrome',
  'rim.bronze': 'Bronze',

  'env.garage': 'Garage',
  'env.studio': 'Studio',
  'env.night': 'Night',

  'share.copy': 'Copy link',
  'share.copied': 'Link copied',
  'share.save': 'Save image',
  'share.rendering': 'Rendering',
  'share.saved': 'Saved',
  'share.failed': 'Failed',

  'value.on': 'On',
  'value.off': 'Off',
  'value.stock': 'Stock',
} as const

export type MessageKey = keyof typeof en

export const t = (key: MessageKey): string => en[key]
