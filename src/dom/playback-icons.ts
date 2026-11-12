export const playbackIcons = {
  play: "M6 4.5a1 1 0 0 1 1.5-.86l13 7.5a1 1 0 0 1 0 1.72l-13 7.5A1 1 0 0 1 6 19.5Z",
  pause: "M6 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 0h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z",
};

const speaker = "M3 9h4l5-4v14l-5-4H3Z";
const repeat = "M3 11V9a4 4 0 0 1 4-4h13m-3-3 3 3-3 3M21 13v2a4 4 0 0 1-4 4H4m3-3-3 3 3 3";

export const playbackToggleIcons = {
  mute: {
    off: `${speaker}M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12`,
    on: `${speaker}M16 9l6 6m0-6-6 6`,
  },
  loop: {
    off: repeat,
    on: `${repeat}M8.5 12l2.5 2.5 4.5-4.5`,
  },
};
