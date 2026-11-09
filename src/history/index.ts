import { failure } from "../core/data";
import { validateAnnotations, type AnnotationDocument } from "../regions";

/** Immutable history. Record accepted documents, not controlled edit proposals. */
export type AnnotationHistory = Readonly<{
  past: readonly AnnotationDocument[];
  present: AnnotationDocument;
  future: readonly AnnotationDocument[];
  limit: number;
}>;
const freeze = (state: AnnotationHistory): AnnotationHistory =>
  Object.freeze({
    ...state,
    past: Object.freeze([...state.past]),
    future: Object.freeze([...state.future]),
  });
export function createHistory(
  document: AnnotationDocument,
  options: { limit?: number } = {},
): AnnotationHistory {
  const limit = options.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw failure(
      "INVALID_DATA",
      "view",
      "History limit must be a positive safe integer",
    );
  return freeze({
    past: [],
    present: validateAnnotations(document),
    future: [],
    limit,
  });
}
export function recordHistory(
  history: AnnotationHistory,
  document: AnnotationDocument,
): AnnotationHistory {
  const next = validateAnnotations(document);
  if (next.sourceId !== history.present.sourceId)
    return createHistory(next, { limit: history.limit });
  if (JSON.stringify(next) === JSON.stringify(history.present)) return history;
  return freeze({
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present: next,
    future: [],
  });
}
export function undoHistory(history: AnnotationHistory): AnnotationHistory {
  if (!history.past.length) return history;
  return freeze({
    ...history,
    past: history.past.slice(0, -1),
    present: history.past.at(-1)!,
    future: [history.present, ...history.future],
  });
}
export function redoHistory(history: AnnotationHistory): AnnotationHistory {
  if (!history.future.length) return history;
  return freeze({
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present: history.future[0],
    future: history.future.slice(1),
  });
}
