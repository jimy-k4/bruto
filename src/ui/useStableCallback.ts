import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * A callback whose identity never changes but always runs the latest version.
 * Lets memoised children receive handlers without re-rendering on every change.
 */
export function useStableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
): (...args: Args) => Result {
  const ref = useRef(callback)

  useLayoutEffect(() => {
    ref.current = callback
  })

  return useCallback((...args: Args) => ref.current(...args), [])
}
