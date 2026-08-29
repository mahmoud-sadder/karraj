/**
 * Strings, keyed, in both languages.
 *
 * BRIEF §6 argues against i18next for two languages — a small typed dictionary plus
 * `dir` switching is cleaner and lighter. This is that dictionary.
 *
 * `ar` is typed `Record<MessageKey, string>`, so the English table is the schema: add
 * a key without translating it and the build fails. That is the whole reason both
 * languages live in one file rather than two that drift.
 *
 * BRIEF §1 calls full Arabic with genuine RTL the second cheap Carseer signal, on the
 * grounds that nearly no portfolio project does it properly. Doing it properly is more
 * than translated strings — see `index.css` for why Arabic cannot keep the Latin UI's
 * letter-spacing, and `ui/layout.ts` for the camera side of it.
 */

export const en = {
  'app.name': 'Karraj',

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

  'value.stock': 'Stock',
  'unit.mm': 'mm',

  // ── Loading ────────────────────────────────────────────────────────────────
  'loading.preparing': 'Preparing the car',
  'loading.failed': 'The car model could not be loaded. It may be a network problem.',
  'loading.retry': 'Retry',

  // ── Vehicle / VIN ──────────────────────────────────────────────────────────
  'vin.placeholder': 'Enter a VIN',
  'vin.label': 'Vehicle identification number',
  'vin.decode': 'Decode',
  'vin.decoding': 'Decoding…',
  'vin.decoder': 'Decoder',
  'vin.badLength': 'A VIN is 17 characters.',
  'vin.badCharset': 'A VIN never contains I, O or Q.',
  'vin.checkDigit': 'Check digit does not validate. Common outside North America — decoded anyway.',
  'vin.vehicle': 'Vehicle',
  'vin.series': 'Series',
  'vin.body': 'Body',
  'vin.doors': 'Doors',
  'vin.builtIn': 'Built in',
  'vin.model3d': '3D model',
  'vin.substituted': 'Substituted',

  // ── Compliance (BRIEF §1) ──────────────────────────────────────────────────
  'compliance.title': 'Road legality',
  'compliance.clear': 'Nothing here needs registering.',
  'compliance.prohibited': 'Not permitted',
  'compliance.registration': 'Must be registered',
  'compliance.permitted': 'Permitted',
  'compliance.source.dvld': 'DVLD ruling, August 2025',
  'compliance.source.general': 'General modification rule',
  'compliance.note':
    'An illustration of the Jordanian rules in code, not legal advice. Each finding cites the rule it came from.',

  'rule.tint.title': 'Window tint is over the limit',
  'rule.tint.detail': 'Tint is capped at 50%. Anything darker fails inspection.',
  'rule.colour.title': 'Colour change',
  'rule.colour.detail':
    'A colour that differs from the one on the registration — paint or wrap — has to be recorded on the vehicle licence.',
  'rule.matte.title': 'Matte finish',
  'rule.matte.detail':
    'Matte is permitted only where it matches a manufacturer colour code. Otherwise it has to be registered.',
  'rule.coating.title': 'Transparent coating',
  'rule.coating.detail':
    'Clear nano-ceramic coatings are explicitly permitted and change nothing on the licence.',
  'rule.stance.title': 'Suspension lowered',
  'rule.stance.detail': 'Ride-height changes are a registrable modification.',

  // ── Credits (BRIEF §4.9) ───────────────────────────────────────────────────
  'credits.open': 'Credits and licences',
  'credits.title': 'Credits',
  'credits.close': 'Close',
  'credits.model': '3D model',
  'credits.licence': 'Licence',
  'credits.source': 'Source',
  'credits.modified': 'Modified',
  'credits.modifiedDetail':
    'This file is a derivative: trade marks removed, materials renamed to stable slugs, selected meshes simplified, geometry and textures recompressed.',
  'credits.code': 'Code',
  'credits.codeDetail': 'MIT. Built with three.js, React Three Fiber and Tailwind.',
  'credits.attribution':
    'Car Concept \u00a9 2024 Darmstadt Graphics Group GmbH, model and textures by Eric Chadwick, CC BY 4.0',

  'lang.switch': 'العربية',
  'lang.label': 'Switch language',
} as const

export type MessageKey = keyof typeof en

/**
 * Arabic.
 *
 * Terminology follows Jordanian usage where it differs from formal MSA — الجنوط for
 * rims rather than العجلات, كراج for the garage — because the audience for this is
 * Jordanian and the formal word reads like a translation.
 *
 * `rule.colour.detail` keeps the wording BRIEF §1 specifies verbatim.
 */
export const ar: Record<MessageKey, string> = {
  'app.name': 'كَراج',

  'panel.paint': 'الطلاء',
  'panel.wheels': 'الجنوط',
  'panel.glass': 'الزجاج',
  'panel.lights': 'الأضواء',
  'panel.stance': 'الارتفاع',
  'panel.scene': 'المشهد',

  'paint.primary': 'اللون',
  'paint.finish': 'التشطيب',
  'paint.twoTone': 'لونان',
  'paint.secondary': 'اللون الثانوي',

  'wheels.finish': 'تشطيب الجنط',
  'wheels.color': 'لون الجنط',
  'wheels.caliper': 'ملاقط الفرامل',

  'glass.tint': 'تظليل الزجاج',

  'lights.on': 'الأضواء الأمامية',
  'lights.color': 'لون الأضواء',

  'stance.drop': 'ارتفاع المركبة',

  'scene.preset': 'البيئة',
  'scene.underglow': 'الإضاءة السفلية',
  'scene.underglowColor': 'لون الإضاءة السفلية',
  'scene.underglowIntensity': 'الشدة',

  'finish.gloss': 'لامع',
  'finish.matte': 'مطفأ',
  'finish.satin': 'نصف لامع',
  'finish.flake': 'ميتاليك',
  'finish.chrome': 'كروم',
  'finish.pearl': 'لؤلؤي',

  'rim.silver': 'فضي',
  'rim.gloss_black': 'أسود لامع',
  'rim.matte_black': 'أسود مطفأ',
  'rim.gunmetal': 'رصاصي',
  'rim.chrome': 'كروم',
  'rim.bronze': 'برونزي',

  'env.garage': 'كراج',
  'env.studio': 'استوديو',
  'env.night': 'ليلي',

  'share.copy': 'نسخ الرابط',
  'share.copied': 'تم نسخ الرابط',
  'share.save': 'حفظ الصورة',
  'share.rendering': 'جارٍ التصدير',
  'share.saved': 'تم الحفظ',
  'share.failed': 'تعذّر',

  'value.stock': 'المصنع',
  'unit.mm': 'مم',

  'loading.preparing': 'جارٍ تحضير السيارة',
  'loading.failed': 'تعذّر تحميل نموذج السيارة. قد تكون المشكلة في الاتصال.',
  'loading.retry': 'إعادة المحاولة',

  'vin.placeholder': 'أدخل رقم الهيكل',
  'vin.label': 'رقم الهيكل (VIN)',
  'vin.decode': 'تحليل',
  'vin.decoding': 'جارٍ التحليل…',
  'vin.decoder': 'المُحلِّل',
  'vin.badLength': 'رقم الهيكل يتكوّن من 17 خانة.',
  'vin.badCharset': 'رقم الهيكل لا يحتوي الحروف I أو O أو Q.',
  'vin.checkDigit': 'خانة التحقق غير مطابقة. شائع خارج أمريكا الشمالية — وتم التحليل رغم ذلك.',
  'vin.vehicle': 'المركبة',
  'vin.series': 'الفئة',
  'vin.body': 'الهيكل',
  'vin.doors': 'الأبواب',
  'vin.builtIn': 'بلد الصنع',
  'vin.model3d': 'النموذج ثلاثي الأبعاد',
  'vin.substituted': 'بديل',

  'compliance.title': 'المطابقة النظامية',
  'compliance.clear': 'لا شيء هنا يحتاج تسجيلاً.',
  'compliance.prohibited': 'غير مسموح',
  'compliance.registration': 'يتطلب التسجيل',
  'compliance.permitted': 'مسموح',
  'compliance.source.dvld': 'قرار إدارة السير، آب 2025',
  'compliance.source.general': 'قاعدة تعديل عامة',
  'compliance.note':
    'عرض توضيحي للأنظمة الأردنية بصيغة برمجية، وليس استشارة قانونية. كل ملاحظة تذكر القاعدة التي استندت إليها.',

  'rule.tint.title': 'التظليل يتجاوز الحد المسموح',
  'rule.tint.detail': 'الحد الأقصى للتظليل 50٪. وما هو أغمق من ذلك لا يجتاز الفحص.',
  'rule.colour.title': 'تغيير اللون',
  'rule.colour.detail': 'هذا التعديل يتطلب تسجيله على رخصة المركبة.',
  'rule.matte.title': 'تشطيب مطفأ',
  'rule.matte.detail':
    'التشطيب المطفأ مسموح فقط إذا طابق رمز لون من الشركة الصانعة، وإلا وجب تسجيله.',
  'rule.coating.title': 'طلاء شفاف',
  'rule.coating.detail': 'الطلاءات النانوية الشفافة مسموح بها صراحةً ولا تغيّر شيئاً في الرخصة.',
  'rule.stance.title': 'تخفيض المركبة',
  'rule.stance.detail': 'تغيير ارتفاع المركبة تعديل يستوجب التسجيل.',

  'credits.open': 'المصادر والتراخيص',
  'credits.title': 'المصادر',
  'credits.close': 'إغلاق',
  'credits.model': 'النموذج ثلاثي الأبعاد',
  'credits.licence': 'الرخصة',
  'credits.source': 'المصدر',
  'credits.modified': 'التعديلات',
  'credits.modifiedDetail':
    'هذا الملف نسخة مشتقّة: أُزيلت العلامات التجارية، وأُعيدت تسمية الخامات، وبُسِّطت مجسّمات مختارة، وأُعيد ضغط الهندسة والخامات.',
  'credits.code': 'الشيفرة',
  'credits.codeDetail': 'رخصة MIT. مبنيّة على three.js وReact Three Fiber وTailwind.',
  // The RLM marks are load-bearing: without them the bidi algorithm drags the trailing
  // Latin run and the comma to the wrong end of the line. Matches ATTRIBUTION.md.
  'credits.attribution':
    '\u200fCar Concept \u00a9 2024 Darmstadt Graphics Group GmbH\u060c النموذج والخامات من إعداد \u200fEric\u00a0Chadwick\u060c رخصة CC BY 4.0',

  'lang.switch': 'English',
  'lang.label': 'تغيير اللغة',
}

export const LANGS = ['en', 'ar'] as const
export type Lang = (typeof LANGS)[number]

export const DICTIONARIES: Record<Lang, Record<MessageKey, string>> = { en, ar }

/** Writing direction. Only Arabic is RTL here, but the map is the place to add more. */
export const DIRECTION: Record<Lang, 'ltr' | 'rtl'> = { en: 'ltr', ar: 'rtl' }

export const translate = (lang: Lang, key: MessageKey): string => DICTIONARIES[lang][key]
