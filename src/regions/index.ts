import { failure } from '../core/data'

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue }
export type Region = Readonly<{ id: string; start: number; end: number; label?: string; channel?: number; locked?: boolean; metadata?: JsonValue }>
export type Marker = Readonly<{ id: string; time: number; label?: string; locked?: boolean; metadata?: JsonValue }>
export type AnnotationDocument = Readonly<{ version: 1; sourceId: string; regions: readonly Region[]; markers: readonly Marker[] }>
export type Selection = Readonly<{ start: number; end: number }> | null
export type AnnotationRules = { minLength?: number; maxLength?: number; snap?: number }
export type AnnotationChange = Readonly<{ operation: 'add' | 'update' | 'remove' | 'replace'; origin: 'api' | 'pointer' | 'keyboard'; ids: readonly string[]; baseRevision: number }>
export type CommitHandler = (document: AnnotationDocument, change: AnnotationChange) => void
export type ControlledAnnotations = { value: AnnotationDocument; revision: number; onCommit: CommitHandler }
export type AnnotationSnapshot = Readonly<{ document: AnnotationDocument; revision: number; duration: number | null; invalidIds: readonly string[] }>
export type AnnotationStore = {
  getSnapshot(): AnnotationSnapshot
  subscribe(callback: () => void): () => void
  onCommit(callback: CommitHandler): () => void
  addRegion(region: Region, origin?: AnnotationChange['origin']): void
  updateRegion(id: string, patch: Partial<Omit<Region, 'id'>>, origin?: AnnotationChange['origin']): void
  addMarker(marker: Marker, origin?: AnnotationChange['origin']): void
  updateMarker(id: string, patch: Partial<Omit<Marker, 'id'>>, origin?: AnnotationChange['origin']): void
  remove(id: string, origin?: AnnotationChange['origin']): void
  replaceDocument(document: AnnotationDocument): void
  setControlled(value: ControlledAnnotations): void
  setDuration(duration: number | null): void
  dispose(): void
}
const invalid = (message: string): never => { throw failure('INVALID_DATA', 'view', message) }
function json(value: unknown, seen = new Set<object>()): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'object' || !value || seen.has(value)) return invalid('Metadata must be finite, acyclic JSON data')
  seen.add(value)
  let result: JsonValue
  if (Array.isArray(value)) result = Object.freeze(value.map(item => json(item, seen)))
  else {
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return invalid('Metadata must contain plain objects')
    result = Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, json(item, seen)])))
  }
  seen.delete(value)
  return result
}
/** Validates and copies input. Returned annotation data is deeply frozen. */
export function validateAnnotations(input: unknown, expectedSourceId?: string): AnnotationDocument {
  if (!input || typeof input !== 'object') return invalid('Expected an annotation document')
  const doc = input as AnnotationDocument
  if (doc.version !== 1 || typeof doc.sourceId !== 'string' || !doc.sourceId || !Array.isArray(doc.regions) || !Array.isArray(doc.markers)) return invalid('Annotations require version 1, sourceId, regions, and markers')
  if (expectedSourceId && expectedSourceId !== doc.sourceId) return invalid('Annotations belong to a different source')
  const ids = new Set<string>()
  function common(item: Region | Marker) {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) return invalid('Annotation IDs must be nonempty and unique')
    ids.add(item.id)
    if (item.label !== undefined && typeof item.label !== 'string') return invalid('Annotation label must be text')
    if (item.locked !== undefined && typeof item.locked !== 'boolean') return invalid('locked must be a boolean')
    return { id: item.id, ...(item.label === undefined ? {} : { label: item.label }), ...(item.locked === undefined ? {} : { locked: item.locked }), ...(item.metadata === undefined ? {} : { metadata: json(item.metadata) }) }
  }
  const regions = doc.regions.map(region => {
    const base = common(region)
    if (!Number.isFinite(region.start) || !Number.isFinite(region.end) || region.start < 0 || region.end <= region.start) return invalid('Regions require finite 0 <= start < end; use markers for points')
    if (region.channel !== undefined && (!Number.isInteger(region.channel) || region.channel < 0)) return invalid('Channel must be a nonnegative integer')
    return Object.freeze({ ...base, start: region.start, end: region.end, ...(region.channel === undefined ? {} : { channel: region.channel }) })
  })
  const markers = doc.markers.map(marker => {
    const base = common(marker)
    if (!Number.isFinite(marker.time) || marker.time < 0) return invalid('Marker time must be finite and nonnegative')
    return Object.freeze({ ...base, time: marker.time })
  })
  return Object.freeze({ version: 1, sourceId: doc.sourceId, regions: Object.freeze(regions), markers: Object.freeze(markers) })
}
export function parseAnnotations(text: string, expectedSourceId?: string): AnnotationDocument {
  let value: unknown
  try { value = JSON.parse(text) } catch { return invalid('Invalid annotation JSON') }
  return validateAnnotations(value, expectedSourceId)
}
export function stringifyAnnotations(document: AnnotationDocument): string { return JSON.stringify(validateAnnotations(document), null, 2) }
export function validateRules(rules: AnnotationRules = {}): Required<AnnotationRules> {
  const result = { minLength: rules.minLength ?? 0, maxLength: rules.maxLength ?? Infinity, snap: rules.snap ?? 0 }
  if (!Number.isFinite(result.minLength) || result.minLength < 0 || result.maxLength < result.minLength || Number.isNaN(result.maxLength) || !Number.isFinite(result.snap) || result.snap < 0) invalid('Invalid annotation length or snap rules')
  return result
}
/** Snap only user edits, never imported or caller-provided coordinates. */
export function snapTime(time: number, interval = 0): number { return interval ? Math.round(time / interval) * interval : time }

export function createAnnotations(options: { document: AnnotationDocument; rules?: AnnotationRules } | (ControlledAnnotations & { rules?: AnnotationRules })): AnnotationStore {
  let controlled = 'value' in options ? options : null
  const rules = validateRules(options.rules)
  let disposed = false, duration: number | null = null
  let state: AnnotationSnapshot = snapshot(validateAnnotations('document' in options ? options.document : options.value), controlled?.revision ?? 0)
  const subscribers = new Set<() => void>(), commits = new Set<CommitHandler>()
  function snapshot(document: AnnotationDocument, revision: number): AnnotationSnapshot {
    if (!Number.isSafeInteger(revision) || revision < 0) invalid('Revision must be a nonnegative safe integer')
    const limit = duration
    const invalidIds = limit === null ? [] : [...document.regions.filter(r => r.end > limit).map(r => r.id), ...document.markers.filter(m => m.time > limit).map(m => m.id)]
    return Object.freeze({ document, revision, duration, invalidIds: Object.freeze(invalidIds) })
  }
  const guard = () => { if (disposed) throw failure('DISPOSED', 'lifecycle', 'Annotations have been disposed') }
  const notify = () => subscribers.forEach(fn => fn())
  function commit(next: AnnotationDocument, operation: AnnotationChange['operation'], ids: string[], origin: AnnotationChange['origin'] = 'api') {
    guard()
    const value = validateAnnotations(next)
    const changed = new Set(ids)
    for (const region of value.regions) if (changed.has(region.id) || operation === 'replace') {
      if (duration !== null && region.end > duration) invalid('Region exceeds recording duration')
      if (region.end - region.start < rules.minLength || region.end - region.start > rules.maxLength) invalid('Region violates length constraints')
    }
    for (const marker of value.markers) if ((changed.has(marker.id) || operation === 'replace') && duration !== null && marker.time > duration) invalid('Marker exceeds recording duration')
    const change = Object.freeze({ operation, origin, ids: Object.freeze(ids), baseRevision: state.revision })
    if (controlled) controlled.onCommit(value, change)
    else { state = snapshot(value, state.revision + 1); notify(); commits.forEach(fn => fn(value, change)) }
  }
  const api: AnnotationStore = {
    getSnapshot: () => state,
    subscribe(fn) { guard(); subscribers.add(fn); return () => subscribers.delete(fn) },
    onCommit(fn) { guard(); commits.add(fn); return () => commits.delete(fn) },
    addRegion(region, origin) { commit({ ...state.document, regions: [...state.document.regions, region] }, 'add', [region.id], origin) },
    updateRegion(id, patch, origin) {
      const region = state.document.regions.find(r => r.id === id)
      if (!region) return invalid('Region not found')
      if (region.locked && (patch.start !== undefined || patch.end !== undefined || patch.channel !== undefined)) invalid('Unlock the region before changing its coordinates')
      commit({ ...state.document, regions: state.document.regions.map(r => r.id === id ? { ...r, ...patch, id } : r) }, 'update', [id], origin)
    },
    addMarker(marker, origin) { commit({ ...state.document, markers: [...state.document.markers, marker] }, 'add', [marker.id], origin) },
    updateMarker(id, patch, origin) {
      const marker = state.document.markers.find(m => m.id === id)
      if (!marker) return invalid('Marker not found')
      if (marker.locked && patch.time !== undefined) invalid('Unlock the marker before moving it')
      commit({ ...state.document, markers: state.document.markers.map(m => m.id === id ? { ...m, ...patch, id } : m) }, 'update', [id], origin)
    },
    remove(id, origin) {
      const item = [...state.document.regions, ...state.document.markers].find(item => item.id === id)
      if (!item) return invalid('Annotation not found')
      if (item.locked) invalid('Unlock the annotation before removing it')
      commit({ ...state.document, regions: state.document.regions.filter(r => r.id !== id), markers: state.document.markers.filter(m => m.id !== id) }, 'remove', [id], origin)
    },
    replaceDocument(document) { commit(document, 'replace', [...document.regions, ...document.markers].map(item => item.id)) },
    setControlled(value) {
      guard()
      if (!controlled) invalid('Cannot change annotation ownership mode')
      const document = validateAnnotations(value.value)
      if (value.revision === state.revision && JSON.stringify(document) !== JSON.stringify(state.document)) invalid('Changed controlled data requires a new revision')
      const next = snapshot(document, value.revision)
      controlled = value
      if (value.revision !== state.revision || value.value.sourceId !== state.document.sourceId) { state = next; notify() }
    },
    setDuration(value) {
      guard()
      if (value !== null && (!Number.isFinite(value) || value <= 0)) invalid('Duration must be positive or unknown')
      if (value === duration) return
      duration = value; state = snapshot(state.document, state.revision); notify()
    },
    dispose() { if (disposed) return; disposed = true; subscribers.clear(); commits.clear() },
  }
  return api
}
