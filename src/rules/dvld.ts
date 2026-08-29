import type { MessageKey } from '../i18n/dictionary'
import { DEFAULT_CONFIG, effectivePaint, type Config } from '../state/config'

/**
 * The Jordanian modification-compliance layer — BRIEF §1.
 *
 * This is the thing that makes the project interesting rather than decorative: as you
 * configure, it says which choices are street-legal and which have to go on the vehicle
 * licence. Rules as code, in Carseer's own regulatory domain.
 *
 * ## Provenance is part of the output
 *
 * Every rule carries the authority it came from, and the UI shows it. A compliance
 * claim without a source is an opinion with a coloured dot next to it, and the failure
 * mode of "rules as code" is exactly that — plausible rules nobody can trace. So the
 * four researched rules are tagged `dvld` and cite the August 2025 ruling; anything
 * else is tagged `general` and says so.
 *
 * Rules deliberately NOT encoded, because no source was researched for them: headlight
 * colour, underglow, and any lighting rule. They are obvious candidates and inventing
 * a citation for them would be worse than leaving the gap visible.
 *
 * ## The tint unit
 *
 * `glass.tint` in this app is *darkness*: 0 is clear glass, 1 is limousine black. Tint
 * regulations are normally quoted as VLT — the light that gets through — so the two run
 * in opposite directions and the cap has to be read carefully. A 50% cap lands on the
 * same number either way, which is a coincidence worth writing down rather than relying
 * on: darkness > 0.5 is the same boundary as VLT < 50%.
 */

export type Severity = 'prohibited' | 'registration' | 'permitted'

/** Which authority a rule rests on. Rendered next to every finding. */
export type RuleSource = 'dvld' | 'general'

export interface Rule {
  id: string
  severity: Severity
  source: RuleSource
  titleKey: MessageKey
  detailKey: MessageKey
  applies: (config: Config) => boolean
}

/** Maximum tint darkness. Above this the glass fails inspection. */
export const TINT_LIMIT = 0.5

/**
 * The colour the car left the factory in.
 *
 * The configurator's default is the model's as-delivered colour, so it stands in for
 * the colour on the registration. With a real registration record — which a VIN lookup
 * against a Jordanian registry could supply, unlike NHTSA's vPIC, which does not return
 * colour at all — this is the one constant that would be replaced by real data.
 */
const FACTORY_COLOR = DEFAULT_CONFIG.paint1.color.toLowerCase()

const sameColor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * Whether the car no longer looks like its registration entry.
 *
 * Two-tone counts even when the primary colour is untouched: a car delivered in one
 * colour and wearing two is not the colour on the licence.
 */
function colorChanged(config: Config): boolean {
  if (!sameColor(config.paint1.color, FACTORY_COLOR)) return true
  if (config.twoTone && !sameColor(effectivePaint(config, 'paint2').color, config.paint1.color)) {
    return true
  }
  return false
}

const hasFinish = (config: Config, finish: string): boolean =>
  effectivePaint(config, 'paint1').finish === finish ||
  effectivePaint(config, 'paint2').finish === finish

export const RULES: readonly Rule[] = [
  {
    id: 'tint',
    severity: 'prohibited',
    source: 'dvld',
    titleKey: 'rule.tint.title',
    detailKey: 'rule.tint.detail',
    applies: (c) => c.glass.tint > TINT_LIMIT,
  },
  {
    id: 'colour',
    severity: 'registration',
    source: 'dvld',
    titleKey: 'rule.colour.title',
    detailKey: 'rule.colour.detail',
    applies: colorChanged,
  },
  {
    id: 'matte',
    severity: 'registration',
    source: 'dvld',
    titleKey: 'rule.matte.title',
    detailKey: 'rule.matte.detail',
    applies: (c) => hasFinish(c, 'matte'),
  },
  {
    id: 'stance',
    severity: 'registration',
    source: 'general',
    titleKey: 'rule.stance.title',
    detailKey: 'rule.stance.detail',
    applies: (c) => c.stance.drop > 0,
  },
  {
    // The fourth researched rule. It fires on the stock colour because that is exactly
    // the case it describes: a clear coating over the delivered paint changes nothing
    // on the licence. Without it the panel would only ever speak up to complain.
    id: 'coating',
    severity: 'permitted',
    source: 'dvld',
    titleKey: 'rule.coating.title',
    detailKey: 'rule.coating.detail',
    applies: (c) => !colorChanged(c),
  },
]

/** Loudest first, so the one thing that fails inspection is never below the fold. */
const ORDER: Record<Severity, number> = { prohibited: 0, registration: 1, permitted: 2 }

/** Every rule that applies to this configuration, most serious first. */
export function evaluate(config: Config): Rule[] {
  return RULES.filter((rule) => rule.applies(config)).sort(
    (a, b) => ORDER[a.severity] - ORDER[b.severity],
  )
}
