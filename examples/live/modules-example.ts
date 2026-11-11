import type { AnnotationDocument } from "raavl";

export const modulesDocument: AnnotationDocument = {
  version: 1,
  sourceId: "demo-a",
  regions: [
    { id: "intro", start: 1, end: 3, label: "Opening" },
    { id: "phrase", start: 5, end: 7, label: "Phrase" },
  ],
  markers: [{ id: "cue", time: 8, label: "Snap target" }],
};
