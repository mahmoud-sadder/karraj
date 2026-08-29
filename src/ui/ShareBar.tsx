import { useCallback, useEffect, useRef, useState } from 'react'

import { t } from '../i18n/dictionary'
import { useConfig } from '../state/config'
import { useSceneReady } from '../state/loading'
import { shareUrl } from '../state/urlConfig'
import { captureFrame, saveBlob } from '../three/capture'
import { useDirection } from './useDirection'

/**
 * Share and export — BRIEF §8, day 8.
 *
 * Two actions, both of which turn "I made this" into something that leaves the tab:
 * the link, and the picture.
 */

type Status = 'idle' | 'busy' | 'done' | 'failed'

const FEEDBACK_MS = 2000

/** A status that falls back to idle on its own, and never fires after unmount. */
function useTransientStatus(): [Status, string, (status: Status, note?: string) => void] {
  const [state, setState] = useState<{ status: Status; note: string }>({
    status: 'idle',
    note: '',
  })
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const report = useCallback((status: Status, note = '') => {
    window.clearTimeout(timer.current)
    setState({ status, note })
    if (status !== 'busy') {
      timer.current = window.setTimeout(() => setState({ status: 'idle', note: '' }), FEEDBACK_MS)
    }
  }, [])

  return [state.status, state.note, report]
}

/**
 * Clipboard, with the legacy path behind it.
 *
 * `navigator.clipboard` needs a secure context and can still be refused by permission
 * policy — inside an iframe on someone else's page, for instance, which is exactly
 * where this configurator is meant to end up.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.cssText = 'position:fixed;top:0;opacity:0'
    document.body.append(field)
    field.select()
    let copied = false
    try {
      copied = document.execCommand('copy')
    } catch {
      copied = false
    }
    field.remove()
    return copied
  }
}

function Action({
  label,
  busy,
  disabled,
  onClick,
}: {
  label: string
  busy: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-2 font-mono text-[10px] tracking-[0.15em] text-neutral-300 uppercase transition hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:text-neutral-300"
    >
      {label}
    </button>
  )
}

export default function ShareBar() {
  const direction = useDirection()
  const ready = useSceneReady((s) => s.ready)
  const paint = useConfig((s) => s.paint1)

  const [linkStatus, , reportLink] = useTransientStatus()
  const [imageStatus, imageNote, reportImage] = useTransientStatus()

  const share = async () => {
    reportImage('idle')
    reportLink('busy')
    reportLink((await copyText(shareUrl())) ? 'done' : 'failed')
  }

  const save = async () => {
    reportLink('idle')
    reportImage('busy')
    try {
      const { blob, width, height } = await captureFrame({ rtl: direction === 'rtl' })
      // The colour and finish are in the name, so a folder of exports stays legible
      // without opening them.
      saveBlob(blob, `karraj-${paint.color.replace('#', '')}-${paint.finish}.png`)
      reportImage('done', `${width}×${height}`)
    } catch {
      reportImage('failed')
    }
  }

  const linkLabel =
    linkStatus === 'done'
      ? t('share.copied')
      : linkStatus === 'failed'
        ? t('share.failed')
        : t('share.copy')

  const imageLabel =
    imageStatus === 'busy'
      ? t('share.rendering')
      : imageStatus === 'done'
        ? imageNote || t('share.saved')
        : imageStatus === 'failed'
          ? t('share.failed')
          : t('share.save')

  return (
    <div className="flex gap-2 border-t border-white/10 pt-3">
      <Action
        label={linkLabel}
        busy={linkStatus === 'busy'}
        disabled={false}
        onClick={() => void share()}
      />
      <Action
        label={imageLabel}
        busy={imageStatus === 'busy'}
        // The renderer is only reachable once the scene has mounted.
        disabled={!ready}
        onClick={() => void save()}
      />
    </div>
  )
}
