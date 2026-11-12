import type { Region } from "../regions/index.js";

type Lane = number | "all-channels" | "combined";
type Overlap = {
  key: string;
  time: number;
  lane: Lane;
  count: number;
  left: number;
  top: number;
  width: number;
};

const chipWidth = 100;
const chipHeight = 44;

export function includesOverlapRegion(region: Region, time: number, lane: Lane) {
  return (
    region.start <= time && time < region.end &&
    (lane === "combined" || region.channel === undefined || region.channel === lane)
  );
}

export function visibleOverlaps(
  regions: Region[],
  { duration, width, channels, splitChannels }: {
    duration: number;
    width: number;
    channels: number;
    splitChannels: boolean;
  },
  viewport: { left: number; width: number; height: number },
) {
  if (regions.length < 2 || !duration || !width || !viewport.width) return [];
  const pixelsPerSecond = width / duration;
  const viewStart = viewport.left / pixelsPerSecond;
  const viewEnd = (viewport.left + viewport.width) / pixelsPerSecond;
  const buttonWidth = Math.min(chipWidth, viewport.width);
  const candidates: Overlap[] = [];

  function addLane(items: Region[], lane: Lane) {
    const edges = new Map<number, { count: number; scoped: number }>();
    for (const item of items) {
      if (item.end <= viewStart || item.start >= viewEnd) continue;
      for (const [time, delta] of [[item.start, 1], [item.end, -1]]) {
        const edge = edges.get(time) ?? { count: 0, scoped: 0 };
        edge.count += delta;
        if (item.channel !== undefined) edge.scoped += delta;
        edges.set(time, edge);
      }
    }
    const sorted = [...edges].sort(([a], [b]) => a - b);
    let count = 0;
    let scoped = 0;
    const top = Math.min(
      Math.max(0, viewport.height - chipHeight),
      4 + (typeof lane === "number" ? (viewport.height * lane) / channels : 0),
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const [start, edge] = sorted[i];
      const [end] = sorted[i + 1];
      count += edge.count;
      scoped += edge.scoped;
      const from = Math.max(start, viewStart);
      const to = Math.min(end, viewEnd);
      if (count < 2 || (typeof lane === "number" && !scoped) || from >= to)
        continue;
      const midpoint = from + (to - from) / 2;
      const time = midpoint < to ? midpoint : from;
      const left = Math.max(
        viewport.left,
        Math.min(
          viewport.left + viewport.width - buttonWidth,
          time * pixelsPerSecond - buttonWidth / 2,
        ),
      );
      candidates.push({
        key: `${lane}:${start}:${end}`,
        time,
        lane,
        count,
        left,
        top,
        width: buttonWidth,
      });
    }
  }

  if (splitChannels && channels > 1) {
    const allChannels: Region[] = [];
    const byChannel = new Map<number, Region[]>();
    for (const region of regions) {
      const { channel } = region;
      if (channel === undefined) allChannels.push(region);
      else {
        const items = byChannel.get(channel) ?? [];
        items.push(region);
        byChannel.set(channel, items);
      }
    }
    addLane(allChannels, "all-channels");
    for (const [lane, items] of byChannel)
      addLane([...allChannels, ...items], lane);
  } else {
    addLane(regions, "combined");
  }

  // Give crowded areas one tap target, favoring the spot with the most choices.
  const kept: Overlap[] = [];
  candidates.sort(
    (a, b) => b.count - a.count || a.left - b.left || a.top - b.top,
  );
  for (const candidate of candidates) {
    const collides = kept.some(
      (other) => Math.abs(other.left - candidate.left) < buttonWidth + 4 &&
        (viewport.height
          ? Math.abs(other.top - candidate.top) < chipHeight
          : other.lane === candidate.lane),
    );
    if (!collides) kept.push(candidate);
  }
  return kept.sort((a, b) => a.left - b.left || a.top - b.top);
}
