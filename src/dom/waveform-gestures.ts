import type { Player } from "../core/types.js";
import type { Selection } from "../regions/index.js";
import type { Interaction } from "./index.js";
import type { mountAnnotations } from "./annotations.js";

export const maxZoom = 10000;

type GestureOptions = {
  root: HTMLElement;
  player: Player | undefined;
  interaction: () => Required<Interaction>;
  annotations: () => ReturnType<typeof mountAnnotations>;
  geometry: () => { totalWidth: number; duration: number };
  getDuration: () => number;
  contentWidth: (width: number, duration: number) => number;
  playRegion: (range: NonNullable<Selection>) => void;
  request: () => void;
  invalidate: () => void;
};

/** Owns input state and listeners; the view still owns drawing and layout. */
export function mountWaveformGestures({
  root,
  player,
  interaction,
  annotations,
  geometry,
  getDuration,
  contentWidth,
  playRegion,
  request,
  invalidate,
}: GestureOptions) {
  let pointer: number | null = null;
  const touchPoints = new Map<number, { x: number; y: number }>();
  let multiTouch = false;
  let pinch: { distance: number; zoom: number; time: number } | null = null;
  let pinchZoom: number | "fit" | null = null;
  let pendingPinch: { zoom: number; scrollLeft: number } | null = null;
  const resetPinchZoom = () => {
    pinch = null;
    pinchZoom = null;
    pendingPinch = null;
  };
  const seekAt = (clientX: number) => {
    const { totalWidth } = geometry();
    if (!player || player.getSnapshot().source !== "ready" || totalWidth <= 0)
      return;
    const x = clientX - root.getBoundingClientRect().left + root.scrollLeft;
    player.seekFraction(Math.max(0, Math.min(1, x / totalWidth)));
    request();
  };
  // Track taps directly so a drag, scroll, or cancelled touch cannot activate playback.
  let touch: {
    id: number;
    x: number;
    y: number;
    time: number;
    moved: boolean;
    regionId: string | undefined;
  } | null = null;
  let lastRegionTap: { id: string; x: number; y: number; time: number } | null =
    null;
  let lastTouchTime = -Infinity;
  let lastClickRegionId: string | undefined;
  let doubleClickBlocked = false;
  const pinchGeometry = () => {
    const [first, second] = touchPoints.values();
    return {
      distance: Math.hypot(first.x - second.x, first.y - second.y),
      center: (first.x + second.x) / 2 - root.getBoundingClientRect().left,
    };
  };
  const touchDown = (event: PointerEvent) => {
    if (!touchPoints.size) multiTouch = false;
    if (event.pointerType !== "touch" || event.button !== 0) return;
    if (event.isPrimary) {
      touchPoints.clear();
      pinch = null;
      multiTouch = false;
    }
    lastTouchTime = performance.now();
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!event.isPrimary) {
      multiTouch = true;
      touch = null;
      lastRegionTap = null;
      pointer = null;
      pinch = null;
      annotations().cancelGesture();
      const duration = getDuration();
      if (touchPoints.size === 2 && duration > 0) {
        const { distance, center } = pinchGeometry();
        const zoom =
          pendingPinch?.zoom ??
          contentWidth(Math.max(1, root.clientWidth), duration) / duration;
        const scrollLeft = pendingPinch?.scrollLeft ?? root.scrollLeft;
        pinch = {
          distance: Math.max(1, distance),
          zoom,
          time: (scrollLeft + center) / zoom,
        };
        // Keep tracking if a finger moves outside or its annotation is removed.
        for (const id of touchPoints.keys()) {
          try {
            root.setPointerCapture(id);
          } catch {
            // The browser may have already cancelled the pointer for scrolling.
          }
        }
      }
      return;
    }
    const region = annotations().getPlaybackTarget(event.target);
    if (
      region === undefined ||
      !player ||
      player.getSnapshot().source !== "ready"
    ) {
      touch = null;
      lastRegionTap = null;
      pointer = null;
      return;
    }
    touch = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: lastTouchTime,
      moved: false,
      regionId: region?.id,
    };
  };
  const touchMove = (event: PointerEvent) => {
    const point =
      event.pointerType === "touch" && touchPoints.get(event.pointerId);
    if (!point || (point.x === event.clientX && point.y === event.clientY))
      return;
    point.x = event.clientX;
    point.y = event.clientY;
    if (pinch) {
      const duration = getDuration();
      if (duration <= 0) return;
      const { distance, center } = pinchGeometry();
      const width = Math.max(1, root.clientWidth);
      const zoom = Math.max(
        width / duration,
        Math.min(maxZoom, (pinch.zoom * distance) / pinch.distance),
      );
      const scrollLeft = Math.max(
        0,
        Math.min(duration * zoom - width, pinch.time * zoom - center),
      );
      pendingPinch = { zoom, scrollLeft };
      invalidate();
      return;
    }
    if (!touch || event.pointerId !== touch.id) return;
    const dx = Math.abs(event.clientX - touch.x),
      dy = Math.abs(event.clientY - touch.y);
    touch.moved ||= Math.hypot(dx, dy) > 10;
    // Vertical scrolling stays with the browser.
    if (
      touch.regionId === undefined &&
      touch.moved &&
      dx > dy &&
      interaction().drag === "seek"
    ) {
      pointer = event.pointerId;
      seekAt(event.clientX);
    }
  };
  const endTouch = (event: PointerEvent) => {
    if (touchPoints.delete(event.pointerId)) pinch = null;
  };
  const touchUp = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    endTouch(event);
    lastTouchTime = performance.now();
    if (!touch || event.pointerId !== touch.id) return;
    const gesture = touch;
    touch = null;
    const previousTap = lastRegionTap;
    lastRegionTap = null;
    const target = annotations().getPlaybackTarget(event.target, true);
    if (
      target === undefined ||
      target?.id !== gesture.regionId ||
      gesture.moved ||
      lastTouchTime - gesture.time > 350 ||
      Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10
    )
      return;
    if (
      target &&
      previousTap?.id === target.id &&
      lastTouchTime - previousTap.time <= 350 &&
      Math.hypot(
        event.clientX - previousTap.x,
        event.clientY - previousTap.y,
      ) <= 24
    ) {
      playRegion(target);
      return;
    }
    if (target)
      lastRegionTap = {
        id: target.id,
        x: event.clientX,
        y: event.clientY,
        time: lastTouchTime,
      };
    if (interaction().seek === "click") seekAt(event.clientX);
  };
  const touchCancel = (event: PointerEvent) => {
    // Switching capture from a child to the root keeps the contact active.
    if (
      event.type === "lostpointercapture" &&
      root.hasPointerCapture?.(event.pointerId)
    )
      return;
    if (event.pointerType === "touch") endTouch(event);
    if (touch?.id !== event.pointerId) return;
    touch = null;
    lastRegionTap = null;
    lastTouchTime = performance.now();
  };
  const blockPinchClick = (event: MouseEvent) => {
    if (!multiTouch || event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const click = (event: MouseEvent) => {
    if (event.button !== 0 || performance.now() - lastTouchTime < 700) return;
    const target = annotations().getPlaybackTarget(event.target, true);
    if (event.detail > 0) {
      // Pointer capture can give clicks on different targets the same DOM target.
      doubleClickBlocked = event.detail > 1 && lastClickRegionId !== target?.id;
      lastClickRegionId = target?.id;
    }
    // A keyboard activation selects the focused annotation without a pointer position.
    if (event.detail === 0 && target) return;
    if (target !== undefined && interaction().seek === "click")
      seekAt(event.clientX);
  };
  const doubleClick = (event: MouseEvent) => {
    if (event.button !== 0 || performance.now() - lastTouchTime < 700) return;
    if (event.detail > 1 && doubleClickBlocked) return;
    const target = annotations().getPlaybackTarget(event.target, true);
    if (target) playRegion(target);
  };
  const down = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    if (annotations().isAnnotationTarget(event.target)) return;
    if (
      !player ||
      event.button !== 0 ||
      interaction().drag !== "seek" ||
      player.getSnapshot().source !== "ready"
    )
      return;
    pointer = event.pointerId;
    root.setPointerCapture(pointer);
    seekAt(event.clientX);
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    if (event.pointerId === pointer) seekAt(event.clientX);
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    if (root.hasPointerCapture(pointer)) root.releasePointerCapture(pointer);
    pointer = null;
  };
  const key = (event: KeyboardEvent) => {
    if (annotations().isAnnotationTarget(event.target)) return;
    if (
      !player ||
      interaction().seek === "off" ||
      player.getSnapshot().source !== "ready"
    )
      return;
    const { duration } = geometry();
    const now = player.getMediaElement()?.currentTime ?? 0;
    const step = event.shiftKey ? 10 : 1;
    const times: Record<string, number> = {
      ArrowRight: now + step,
      ArrowLeft: now - step,
      Home: 0,
      End: duration,
    };
    if (event.key in times) {
      event.preventDefault();
      player.seek(Math.max(0, Math.min(duration, times[event.key])));
      request();
    }
  };
  root.addEventListener("click", blockPinchClick, true);
  root.addEventListener("click", click);
  root.addEventListener("dblclick", doubleClick);
  root.addEventListener("keydown", key);
  root.addEventListener("pointerdown", touchDown);
  root.addEventListener("pointermove", touchMove);
  root.addEventListener("pointerup", touchUp);
  root.addEventListener("pointercancel", touchCancel);
  root.addEventListener("lostpointercapture", touchCancel);
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", up);
  root.addEventListener("lostpointercapture", up);
  return {
    get zoom() {
      return pinchZoom;
    },
    isActive: () => pointer !== null || (multiTouch && touchPoints.size > 0),
    resetZoom: resetPinchZoom,
    resetSource() {
      touch = null;
      lastRegionTap = null;
      lastClickRegionId = undefined;
      doubleClickBlocked = false;
      resetPinchZoom();
    },
    stopSeeking() {
      pointer = null;
    },
    prepareDraw(width: number, duration: number) {
      if (pendingPinch)
        pinchZoom =
          pendingPinch.zoom <= width / duration ? "fit" : pendingPinch.zoom;
    },
    finishLayout() {
      // Apply scroll only after the surface's new width establishes its bounds.
      if (pendingPinch) {
        root.scrollLeft = pendingPinch.scrollLeft;
        pendingPinch = null;
      }
    },
    dispose() {
      root.removeEventListener("click", blockPinchClick, true);
      root.removeEventListener("click", click);
      root.removeEventListener("dblclick", doubleClick);
      root.removeEventListener("keydown", key);
      touch = null;
      touchPoints.clear();
      resetPinchZoom();
      lastRegionTap = null;
      root.removeEventListener("pointerdown", touchDown);
      root.removeEventListener("pointermove", touchMove);
      root.removeEventListener("pointerup", touchUp);
      root.removeEventListener("pointercancel", touchCancel);
      root.removeEventListener("lostpointercapture", touchCancel);
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
      root.removeEventListener("lostpointercapture", up);
    },
  };
}
