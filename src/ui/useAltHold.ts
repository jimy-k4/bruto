import { useEffect, useState } from 'react'

/** Long enough that a quick Alt+2 doesn't flash anything on screen. */
const HOLD_DELAY = 400

/**
 * True while Alt is held down on its own: the moment to show which number
 * each open project has, before the user picks one with Alt+1…9.
 */
export function useAltHold(delay = HOLD_DELAY): boolean {
  const [held, setHeld] = useState(false)

  useEffect(() => {
    let timer: number | undefined
    let shown = false
    /** Alt went with a click or a drag this time, not on its own. */
    let usedWithPointer = false

    const reset = () => {
      window.clearTimeout(timer)
      timer = undefined
      shown = false
      setHeld(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt') {
        // Held keys repeat: only the first press starts the wait.
        if (timer === undefined && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
          timer = window.setTimeout(() => {
            shown = true
            setHeld(true)
          }, delay)
        }
        return
      }

      // Alt+1…9 switches project while the list stays up; anything else is another shortcut.
      if (!(event.altKey && /^Digit[1-9]$/.test(event.code))) reset()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Alt') return

      // Releasing Alt alone would otherwise move focus to the browser's menu.
      if (shown || usedWithPointer) event.preventDefault()
      usedWithPointer = false
      reset()
    }

    // Alt+drag copies notes: the project list must not pop up over the drag.
    const onPointerDown = (event: PointerEvent) => {
      if (!event.altKey) return

      usedWithPointer = true
      reset()
      // Keeps the wait from starting again while Alt is still held.
      timer = -1
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerdown', onPointerDown, true)
    // Alt+Tab to another window: the key is released where we can't see it.
    window.addEventListener('blur', reset)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('blur', reset)
    }
  }, [delay])

  return held
}
