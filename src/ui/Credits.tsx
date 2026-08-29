import { useEffect, useRef } from 'react'

import { useT } from '../state/lang'

/**
 * The credits sheet — BRIEF §4.9.
 *
 * CC BY 4.0 requires the attribution to be visible wherever the work is displayed, and
 * §4.9 accepts a sheet behind an "i" button as visible enough, in both languages. The
 * required notice therefore lives here in full, and the rail keeps a one-line credit so
 * it is never zero-click.
 *
 * A native `<dialog>` rather than a hand-rolled overlay: `showModal()` brings the focus
 * trap, the Escape key, the inert background and the top-layer stacking with it. All
 * four are things a div gets wrong quietly.
 */

const MODEL_URL =
  'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept'
const LICENCE_URL = 'https://creativecommons.org/licenses/by/4.0/'
const REPO_URL = 'https://github.com/mahmoud-sadder/karraj'

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-white/10 pt-3">
      <span className="font-mono text-[9px] tracking-[0.18em] text-neutral-500 uppercase">
        {label}
      </span>
      <div className="text-xs leading-relaxed text-neutral-300">{children}</div>
    </div>
  )
}

const link = 'text-neutral-100 underline decoration-white/30 underline-offset-2 hover:decoration-white'

export default function Credits({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const node = dialog.current
    if (!node) return
    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      // Clicking the backdrop lands on the dialog element itself, not on its contents.
      onClick={(e) => {
        if (e.target === dialog.current) onClose()
      }}
      // `showModal()` is supposed to bring Escape with it, and in a normal browser it
      // does. It does not in every embedded webview: measured here, a bare <dialog>
      // with no relationship to this app received the keydown, reported
      // `defaultPrevented: false`, and never fired `cancel`. Since the point of this
      // viewer is to be embedded in someone else's page, the one key that dismisses a
      // modal should not depend on the host. Both paths call `onClose`, which is
      // idempotent.
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      className="bg-garage-void m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-white/10 p-0 text-neutral-200 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-3 p-5">
        <header className="flex items-center justify-between gap-4">
          <h2 className="text-sm tracking-[0.2em] text-neutral-100 uppercase">
            {t('credits.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-neutral-400 transition hover:border-white/30 hover:text-white"
          >
            {t('credits.close')}
          </button>
        </header>

        <Line label={t('credits.model')}>{t('credits.attribution')}</Line>

        <Line label={t('credits.licence')}>
          <a className={link} href={LICENCE_URL} target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
        </Line>

        <Line label={t('credits.source')}>
          <a className={link} href={MODEL_URL} target="_blank" rel="noreferrer">
            KhronosGroup/glTF-Sample-Assets
          </a>
        </Line>

        <Line label={t('credits.modified')}>{t('credits.modifiedDetail')}</Line>

        <Line label={t('credits.code')}>
          {t('credits.codeDetail')}{' '}
          <a className={link} href={REPO_URL} target="_blank" rel="noreferrer">
            mahmoud-sadder/karraj
          </a>
        </Line>
      </div>
    </dialog>
  )
}
