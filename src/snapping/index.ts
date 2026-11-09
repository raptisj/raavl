import { failure } from '../core/data'
import type { AnnotationSnapper } from '../dom/annotations'
export type SnapOptions = {
  tolerancePixels?: number
  grid?: number
  markers?: boolean
  regionBoundaries?: boolean
  playhead?: () => number | null
  targets?: () => readonly number[]
}
/** Pointer-only magnetic snapping; a distance in pixels stays consistent at any zoom. */
export function createSnapper(options: SnapOptions = {}): AnnotationSnapper {
  const tolerance = options.tolerancePixels ?? 8, grid = options.grid ?? 0
  if (!Number.isFinite(tolerance) || tolerance < 0 || !Number.isFinite(grid) || grid < 0) throw failure('INVALID_DATA', 'view', 'Snap tolerance and grid must be finite and nonnegative')
  return (time, context) => {
    if (!(context.pixelsPerSecond > 0)) return time
    const targets: number[] = [...(options.targets?.() ?? [])]
    if (options.markers !== false) for (const marker of context.document.markers) if (marker.id !== context.excludeId) targets.push(marker.time)
    if (options.regionBoundaries !== false) for (const region of context.document.regions) if (region.id !== context.excludeId) targets.push(region.start, region.end)
    const playhead = options.playhead?.()
    if (playhead != null) targets.push(playhead)
    if (grid) targets.push(Math.round(time / grid) * grid)
    let best = time, distance = Infinity
    for (const target of targets) {
      if (!Number.isFinite(target) || target < 0 || target > context.duration) continue
      const delta = Math.abs(target - time)
      if (delta <= tolerance / context.pixelsPerSecond && (delta < distance || (delta === distance && target < best))) { best = target; distance = delta }
    }
    return best
  }
}
