import { expect, it } from 'vitest'
import { createHistory, recordHistory, undoHistory, redoHistory } from '../src/history'
import { createSnapper } from '../src/snapping'
import { formatTime } from '../src/timeline'
import type { AnnotationDocument } from '../src/regions'
const document: AnnotationDocument = { version: 1, sourceId: 'a', regions: [{ id: 'r', start: 2, end: 4 }], markers: [{ id: 'm', time: 8 }] }
const edit = (label: string) => ({ ...document, regions: [{ ...document.regions[0], label }] })
it('keeps immutable bounded history and clears redo after a divergent edit', () => {
  const initial = createHistory(document, { limit: 2 })
  let state = recordHistory(initial, edit('one'))
  state = recordHistory(state, edit('two')); state = recordHistory(state, edit('three'))
  expect(state.past).toHaveLength(2)
  expect(initial.present.regions[0].label).toBeUndefined()
  const undone = undoHistory(state)
  expect(undone.present.regions[0].label).toBe('two')
  expect(redoHistory(undone).present).toBe(state.present)
  expect(recordHistory(undone, edit('replacement')).future).toHaveLength(0)
  expect(recordHistory(state, state.present)).toBe(state)
  expect(Object.isFrozen(state.present.regions[0])).toBe(true)
  expect(() => createHistory(document, { limit: 0 })).toThrow()
})
it('resets history on a different source and treats empty undo/redo as no-ops', () => {
  const initial = createHistory(document)
  expect(undoHistory(initial)).toBe(initial); expect(redoHistory(initial)).toBe(initial)
  const next = recordHistory(recordHistory(initial, edit('one')), { ...document, sourceId: 'b' })
  expect(next.past).toHaveLength(0); expect(next.present.sourceId).toBe('b')
  expect(() => recordHistory(next, { ...document, markers: [{ id: 'm', time: NaN }] })).toThrow()
})
it('snaps within pixel tolerance, excludes self, and resolves equal distances to the earlier target', () => {
  const snap = createSnapper({ targets: () => [6, 7, NaN, 30], playhead: () => 5 })
  const context = { document, duration: 10, pixelsPerSecond: 100, excludeId: 'r' }
  expect(snap(2.02, context)).toBe(2.02)
  expect(snap(7.95, context)).toBe(8)
  expect(snap(5.02, context)).toBe(5)
  expect(snap(7.95, { ...context, pixelsPerSecond: 1000 })).toBe(7.95)
  expect(createSnapper({ tolerancePixels: 50 })(3, { ...context, excludeId: undefined, pixelsPerSecond: 50 })).toBe(2)
  expect(snap(7.95, { ...context, excludeId: 'm' })).toBe(7.95)
  expect(createSnapper({ grid: .5, markers: false, regionBoundaries: false })(1.48, context)).toBe(1.5)
  expect(() => createSnapper({ tolerancePixels: -1 })).toThrow()
})
it('formats fractional, minute, and hour boundaries without sixty-second labels', () => {
  expect(formatTime(.025)).toBe('0:00.025')
  expect(formatTime(59.9999)).toBe('1:00')
  expect(formatTime(3661.5)).toBe('1:01:01.5')
})
