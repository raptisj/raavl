import { mkdir, writeFile } from "node:fs/promises";
const directory = new URL("../examples/public/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const [name, base] of [
  ["demo-a", 220],
  ["demo-b", 330],
]) {
  const rate = 16000,
    duration = 12,
    length = rate * duration;
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / rate,
      envelope =
        Math.min(1, t / 0.1, (duration - t) / 0.25) * Math.exp(-(t % 0.75) * 5);
    const f = base * [1, 1.25, 1.5, 2][Math.floor(t / 1.5) % 4];
    samples[i] =
      envelope *
      (0.35 * Math.sin(t * f * Math.PI * 2) +
        0.12 * Math.sin(t * f * Math.PI * 4));
  }
  const wav = Buffer.alloc(44 + length * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++)
    wav.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
  const min = [],
    max = [];
  for (let i = 0; i < length; i += 80) {
    let lo = 0,
      hi = 0;
    for (let j = i; j < Math.min(length, i + 80); j++) {
      lo = Math.min(lo, samples[j]);
      hi = Math.max(hi, samples[j]);
    }
    min.push(Number(lo.toFixed(5)));
    max.push(Number(hi.toFixed(5)));
  }
  await writeFile(new URL(`${name}.wav`, directory), wav);
  await writeFile(
    new URL(`${name}.json`, directory),
    JSON.stringify({
      version: 1,
      sourceId: name,
      duration,
      channels: [{ min, max }],
    }),
  );
}
console.log("Generated original synthetic WAV clips and matching peaks.");
