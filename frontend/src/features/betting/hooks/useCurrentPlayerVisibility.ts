import { useEffect, useState, type RefObject } from 'react'

export function useCurrentPlayerVisibility(
  scrollRef: RefObject<HTMLElement | null>,
  playerRowRef: RefObject<HTMLElement | null>,
) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const scrollElement = scrollRef.current
    const playerRowElement = playerRowRef.current
    if (!scrollElement || !playerRowElement || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting && entry.intersectionRatio >= 0.85),
      { root: scrollElement, threshold: [0, 0.85, 1] },
    )
    observer.observe(playerRowElement)
    return () => observer.disconnect()
  }, [playerRowRef, scrollRef])

  return isVisible
}
