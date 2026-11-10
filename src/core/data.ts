import type { ErrorCode, RaavlError, WaveformData } from "./types.js";

export function failure(
  code: ErrorCode,
  stage: RaavlError["stage"],
  message: string,
  sourceId?: string,
  cause?: unknown,
): RaavlError {
  return Object.assign(new Error(message, { cause }), {
    name: "RaavlError",
    code,
    stage,
    sourceId,
  });
}
export function finite(
  value: number,
  name: string,
  min = 0,
  max = Infinity,
): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw failure(
      "INVALID_DATA",
      "source",
      `${name} must be finite and between ${min} and ${max}`,
    );
  }
  return value;
}
export function validateWaveform(data: WaveformData): WaveformData {
  if (
    !data ||
    data.version !== 1 ||
    typeof data.sourceId !== "string" ||
    !data.sourceId ||
    !Number.isFinite(data.duration) ||
    data.duration <= 0 ||
    !Array.isArray(data.channels) ||
    !data.channels.length
  ) {
    throw failure(
      "INVALID_DATA",
      "waveform",
      "Waveform needs version 1, sourceId, positive duration, and channels",
    );
  }
  const length = data.channels[0]?.min?.length;
  if (!length)
    throw failure(
      "INVALID_DATA",
      "waveform",
      "Waveform channels cannot be empty",
    );
  for (const channel of data.channels) {
    if (channel?.min?.length !== length || channel?.max?.length !== length) {
      throw failure(
        "INVALID_DATA",
        "waveform",
        "All min/max arrays must have the same length",
      );
    }
    for (let i = 0; i < length; i++) {
      const lo = channel.min[i],
        hi = channel.max[i];
      if (
        !Number.isFinite(lo) ||
        !Number.isFinite(hi) ||
        lo < -1 ||
        hi > 1 ||
        lo > hi
      ) {
        throw failure(
          "INVALID_DATA",
          "waveform",
          `Invalid min/max values in bucket ${i}`,
        );
      }
    }
  }
  return data;
}
export function createPeaks(
  buffer: Pick<
    AudioBuffer,
    "duration" | "numberOfChannels" | "length" | "getChannelData"
  >,
  sourceId: string,
  sourceRevision?: string,
): WaveformData {
  const count = Math.min(buffer.length, 24_000);
  const channels = Array.from(
    { length: buffer.numberOfChannels },
    (_, channel) => {
      const samples = buffer.getChannelData(channel);
      const min = new Float32Array(count),
        max = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        let lo = 1,
          hi = -1;
        const end = Math.floor(((i + 1) * samples.length) / count);
        for (let j = Math.floor((i * samples.length) / count); j < end; j++) {
          lo = Math.min(lo, samples[j]);
          hi = Math.max(hi, samples[j]);
        }
        min[i] = Math.max(-1, lo);
        max[i] = Math.min(1, hi);
      }
      return { min, max };
    },
  );
  return validateWaveform({
    version: 1,
    sourceId,
    sourceRevision,
    duration: buffer.duration,
    channels,
  });
}
