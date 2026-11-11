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
