import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const browser = process.argv.includes("--browser");
const artifacts = join(root, "artifacts");
const run = (command, args, cwd = root, options = {}) => execFileSync(command, args, { cwd, stdio: "inherit", ...options });
const node = (file, args = [], cwd = root, options = {}) => run(process.execPath, [file, ...args], cwd, options);
assert(existsSync(join(root, "dist/index.js")), "Run npm run build before checking the package.");
mkdirSync(artifacts, { recursive: true });
// A new pack invalidates any previous release receipt, even at the same version.
rmSync(join(artifacts, "release.json"), { force: true });
const [pack] = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", artifacts], { cwd: root, encoding: "utf8" }));
const tarball = join(artifacts, pack.filename);
for (const { path } of pack.files) {
  assert.match(path, /^(dist\/|package\.json$|README\.md$|LICENSE$|CHANGELOG\.md$)/, `Unexpected published file: ${path}`);
}
for (const file of ["LICENSE", "README.md", "CHANGELOG.md", "dist/styles.css", "dist/styles.d.css.ts", "dist/themes/presets.json"]) {
  assert(pack.files.some(({ path }) => path === file), `Missing published file: ${file}`);
}
node(join(root, "node_modules/.bin/publint"), [tarball, "--strict"]);
node(join(root, "node_modules/.bin/attw"), ["--profile", "esm-only", "--format", "table-flipped", "--no-color", tarball]);

// Start without peers: vanilla imports and declarations must work without React.
const fixture = mkdtempSync(join(tmpdir(), "raavl-consumer-"));
try {
  writeFileSync(join(fixture, "package.json"), JSON.stringify({ private: true, type: "module" }));
  run("npm", ["install", tarball, "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false"], fixture);
  assert(!existsSync(join(fixture, "node_modules/react")), "Vanilla installation unexpectedly installed React");
  const entries = Object.keys(pkg.exports).filter((entry) => entry !== "./react" && !entry.endsWith(".css") && !entry.endsWith(".json"));
  writeFileSync(join(fixture, "vanilla.mjs"), `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import * as api from 'raavl';
    const { createPlayer, parseTheme } = api;
    for (const name of ['failure', 'finite', 'Waveform', 'AudioPlayer']) assert(!(name in api), 'Leaked root export: ' + name);
    import catalog from 'raavl/themes.json' with { type: 'json' };
    assert.equal(typeof window, 'undefined');
    for (const entry of ${JSON.stringify(entries)}) await import(entry === '.' ? 'raavl' : 'raavl/' + entry.slice(2));
    const player = createPlayer();
    assert.equal(player.getSnapshot().source, 'idle');
    player.dispose();
    assert.equal(parseTheme(catalog.sage).version, 1);
    assert.match(readFileSync(new URL(import.meta.resolve('raavl/styles.css')), 'utf8'), /raavl-waveform/);
    for (const path of ['raavl/player', 'raavl/src/player.js', 'raavl/dist/player.js']) {
      await assert.rejects(import(path), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    }
  `);
  node(join(fixture, "vanilla.mjs"), [], fixture);
  writeFileSync(join(fixture, "consumer.ts"), `
    import { createPlayer, type Player, type PlayerSnapshot } from 'raavl';
    import { parseTheme, type WaveformTheme } from 'raavl/themes';
    import catalog from 'raavl/themes.json' with { type: 'json' };
    import 'raavl/styles.css';
    ${entries.filter((entry) => entry !== ".").map((entry, index) => `import * as module${index} from 'raavl/${entry.slice(2)}'; void module${index};`).join("\n")}
    const player: Player = createPlayer();
    const snapshot: PlayerSnapshot = player.getSnapshot();
    const theme: WaveformTheme = parseTheme(catalog.sage);
    void snapshot; void theme; player.dispose();
  `);
  function typecheck() {
    for (const module of ["NodeNext", "ESNext"]) {
      writeFileSync(join(fixture, "tsconfig.json"), JSON.stringify({
        compilerOptions: { module, moduleResolution: module === "NodeNext" ? "NodeNext" : "Bundler", target: "ES2022", lib: ["ES2022", "DOM", "DOM.Iterable"], types: [], strict: true, skipLibCheck: false, noEmit: true, resolveJsonModule: true, jsx: "react-jsx", noUncheckedSideEffectImports: true },
        include: ["consumer.ts", "consumer.tsx"],
      }));
      node(join(root, "node_modules/typescript/bin/tsc"), ["-p", join(fixture, "tsconfig.json")], fixture);
    }
  }
  typecheck();

  // Supply only the consumer's peers, never the library source or its build tools.
  for (const name of ["react", "react-dom", "@types/react", "@types/react-dom"]) {
    const target = join(fixture, "node_modules", name);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(join(root, "node_modules", name), target, "dir");
  }
  writeFileSync(join(fixture, "react.mjs"), `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { createElement } from 'react';
    import { renderToString } from 'react-dom/server';
    import * as api from 'raavl/react';
    assert.equal(typeof document, 'undefined');
    for (const name of ['AudioPlayer', 'Waveform', 'PlayerRoot', 'PlayPauseButton', 'SeekSlider', 'TimeDisplay', 'MuteButton', 'VolumeSlider', 'PlaybackRateSelect', 'LoopButton', 'PlayerStatus', 'usePlayer', 'usePlayerState', 'usePlayerTime', 'useAnnotations', 'usePlayerContext']) {
      assert(name in api, 'Missing public React export: ' + name);
    }
    for (const name of ['PlayerContext', 'usePlayerRoot', 'useErrorReporter']) assert(!(name in api), 'Leaked internal export: ' + name);
    const html = renderToString(createElement(api.AudioPlayer, { source: { kind: 'url', id: 'audio', url: '/tone.wav' } }));
    assert.match(html, /Play audio/); assert.match(html, /disabled/);
    assert.match(readFileSync(new URL(import.meta.resolve('raavl/react')), 'utf8'), /^['"]use client['"]/);
  `);
  node(join(fixture, "react.mjs"), [], fixture);
  writeFileSync(join(fixture, "consumer.tsx"), `
    import { AudioPlayer, PlayerRoot, Waveform, PlayPauseButton, usePlayer, type AudioPlayerProps } from 'raavl/react';
    const props: AudioPlayerProps = { source: { kind: 'url', id: 'audio', url: '/tone.wav' } };
    export const complete = <AudioPlayer {...props} />;
    export const composed = <PlayerRoot {...props}><Waveform /><PlayPauseButton /></PlayerRoot>;
    export function Headless() { const player = usePlayer(props); return <Waveform player={player ?? undefined} />; }
  `);
  typecheck();
  cpSync(join(root, "tests/package/consumer"), fixture, { recursive: true });
  // A small real PCM recording exercises native metadata, playback and decoding.
  const samples = 16_000, wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8_000, 24); wav.writeUInt32LE(16_000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / 8_000) * 8_000), 44 + i * 2);
  mkdirSync(join(fixture, "public"), { recursive: true });
  writeFileSync(join(fixture, "public/tone.wav"), wav);
  const env = { ...process.env, RAAVL_CONSUMER_DIR: fixture };
  node(join(root, "node_modules/.bin/vite"), ["build", "--config", join(root, "tests/package/vite.config.mjs")], root, { env });
  const css = readdirSync(join(fixture, "dist/assets")).filter((file) => file.endsWith(".css")).map((file) => join(fixture, "dist/assets", file));
  assert(css.some((path) => path && readFileSync(path, "utf8").includes(".raavl-waveform")), "Production build dropped the stylesheet");
  if (browser) node(join(root, "node_modules/.bin/playwright"), ["test", "--config", "tests/package/playwright.config.mjs"], root, { env });
  console.log(`Validated ${pack.filename}${browser ? " including Chromium playback" : ""}.`);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
