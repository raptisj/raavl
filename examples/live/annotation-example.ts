import type { AnnotationDocument } from "raavl";

export const annotationDocument: AnnotationDocument = {
  version: 1,
  sourceId: "demo-a",
  regions: [
    { id: "intro", start: 0.5, end: 2.5, label: "Introduction", metadata: { speaker: "A" } },
    { id: "quote", start: 4, end: 6.5, label: "Key phrase" },
  ],
  markers: [{ id: "cue", time: 8, label: "Cue" }],
};

export const overlapDocument: AnnotationDocument = {
  version: 1,
  sourceId: annotationDocument.sourceId,
  regions: [
    { id: "opening", start: 0.4, end: 2.5, label: "Opening" },
    { id: "melody", start: 0.8, end: 1.9, label: "Melody" },
    { id: "accent", start: 1.1, end: 2.1, label: "Accent" },

    { id: "motif", start: 3.4, end: 4.1, label: "Motif" },
    { id: "doubling", start: 3.4, end: 4.1, label: "Doubling" },

    { id: "pickup", start: 5.2, end: 6.45, label: "Pickup" },
    { id: "transition", start: 5.75, end: 6.85, label: "Transition" },

    { id: "bridge", start: 7.15, end: 9.35, label: "Bridge" },
    { id: "harmony", start: 7.7, end: 9.15, label: "Harmony" },
    { id: "bass", start: 8.05, end: 8.95, label: "Bass" },
    { id: "lead", start: 8.2, end: 8.6, label: "Lead" },

    { id: "outro", start: 9.55, end: 10.45, label: "Outro" },
    { id: "echo", start: 9.95, end: 11.7, label: "Echo" },
    { id: "tail", start: 11.05, end: 11.85, label: "Tail" },

    ...[5, 22, 255, 273, 291, 309, 327, 420, 438, 456, 474, 492, 506, 689, 702, 1186].map(
      (start, index) => ({
        id: `phrase-${index + 1}`,
        start: start / 100,
        end: (start + 12) / 100,
        label: `Phrase ${index + 1}`,
      }),
    ),
  ],
  markers: [],
};

export const annotationStyles = `
.annotation-app { color: #203b30; font: 14px/1.5 system-ui, sans-serif; }
.annotation-app [hidden] { display: none; }
.annotation-app :where(.transport) button { padding: 9px 12px; border: 1px solid #ced8ca; border-radius: 6px; background: #fff; color: #234f40; font: 12px/1.5 system-ui, sans-serif; cursor: pointer; }
.annotation-app :where(.transport) button:hover:not(:disabled) { background: #eaf1e4; }
.annotation-app :where(.transport) button:disabled { opacity: .4; cursor: default; }
.annotation-app button.primary { background: #245e49; color: #fff; border-color: #245e49; }
.annotation-app button.primary:hover:not(:disabled) { background: #153c2e; }
.annotation-app .transport { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 22px 0 18px; }
.annotation-app .clock { margin-left: auto; font: 15px ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.annotation-app .raavl-region-label { text-align: left; }
.annotation-app .raavl-region .raavl-region-label { right: 10px; overflow: hidden; text-overflow: ellipsis; }
.annotation-app .error:empty { display: none; }
.annotation-app .error { color: #a32323; }
@media (max-width: 520px) { .annotation-app .clock { width: 100%; margin-top: 6px; } }
`;
