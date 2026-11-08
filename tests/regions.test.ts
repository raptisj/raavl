import { describe, expect, it, vi } from 'vitest'
import { createAnnotations, parseAnnotations, stringifyAnnotations, validateAnnotations, type AnnotationDocument } from '../src/regions'
const document = (): AnnotationDocument => ({ version: 1, sourceId: 'a', regions: [{ id: 'intro', start: 2, end: 4, label: 'Intro', metadata: { tags: ['voice'], confidence: .9 } }], markers: [{ id: 'point', time: 6 }] })

describe('annotation documents', () => {
  it('deep-copies/freeze data and round-trips metadata without DOM or class instances', () => {
    const input = document(), store = createAnnotations({ document: input })
    expect(store.getSnapshot().document).not.toBe(input)
    expect(Object.isFrozen(store.getSnapshot().document.regions[0].metadata)).toBe(true)
    expect(parseAnnotations(stringifyAnnotations(input), 'a')).toEqual(input)
    expect(() => parseAnnotations(stringifyAnnotations(input), 'b')).toThrow('different source')
    expect(() => validateAnnotations({ ...input, regions: [{ ...input.regions[0], metadata: new Date() }] })).toThrow('plain objects')
    store.dispose()
  })
  it('rejects malformed coordinates, duplicate IDs, non-JSON metadata and unknown versions', () => {
    for (const value of [
      { ...document(), version: 2 },
      { ...document(), markers: [{ id: 'intro', time: 3 }] },
      { ...document(), regions: [{ id: 'x', start: 4, end: 2 }] },
      { ...document(), regions: [{ id: 'x', start: 2, end: 2 }] },
      { ...document(), markers: [{ id: 'x', time: NaN }] },
      { ...document(), regions: [{ ...document().regions[0], metadata: { callback: () => {} } }] },
    ]) expect(() => validateAnnotations(value)).toThrow()
    expect(() => parseAnnotations('{')).toThrow('JSON')
  })
  it('retains annotations before metadata and reports invalid bounds when duration arrives', () => {
    const store = createAnnotations({ document: document() })
    store.setDuration(3)
    expect(store.getSnapshot().document.regions[0]).toMatchObject({ start: 2, end: 4 })
    expect(store.getSnapshot().invalidIds).toEqual(['intro', 'point'])
    store.updateRegion('intro', { end: 3 })
    expect(store.getSnapshot().invalidIds).toEqual(['point'])
    expect(() => store.addMarker({ id: 'late', time: 9 })).toThrow('duration')
    store.setDuration(null)
    expect(store.getSnapshot().invalidIds).toEqual([])
    store.dispose()
  })
  it('proposes controlled edits without changing the host value until a new revision arrives', () => {
    const onCommit = vi.fn(), value = document()
    const store = createAnnotations({ value, revision: 4, onCommit })
    store.updateRegion('intro', { start: 1 }, 'pointer')
    expect(store.getSnapshot().document.regions[0].start).toBe(2)
    expect(onCommit).toHaveBeenCalledOnce()
    const [next, change] = onCommit.mock.calls[0]
    expect(change).toMatchObject({ baseRevision: 4, operation: 'update', origin: 'pointer', ids: ['intro'] })
    expect(() => store.setControlled({ value: next, revision: 4, onCommit })).toThrow('new revision')
    store.setControlled({ value: next, revision: 5, onCommit })
    expect(store.getSnapshot().document.regions[0].start).toBe(1)
    expect(value.regions[0].start).toBe(2)
    store.dispose()
  })
  it('enforces locks and length constraints atomically', () => {
    const store = createAnnotations({ document: document(), rules: { minLength: 1, maxLength: 5 } })
    const onCommit = vi.fn(); store.onCommit(onCommit)
    expect(() => store.updateRegion('intro', { end: 2.1 })).toThrow('length')
    expect(onCommit).not.toHaveBeenCalled()
    store.updateRegion('intro', { locked: true })
    expect(() => store.remove('intro')).toThrow('Unlock')
    expect(() => store.updateRegion('intro', { start: 1 })).toThrow('Unlock')
    store.updateRegion('intro', { locked: false }); store.remove('intro')
    expect(store.getSnapshot().document.regions).toHaveLength(0)
    store.dispose(); store.dispose()
    expect(() => store.addMarker({ id: 'x', time: 1 })).toThrow('disposed')
  })
})
