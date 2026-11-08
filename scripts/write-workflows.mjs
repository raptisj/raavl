import { readFile, writeFile } from 'node:fs/promises'
import { workflows } from '../examples/workflows.js'

const target = new URL('../docs/design/workflows.md', import.meta.url)
const body = `# Proposed workflows\n\nGenerated from \`examples/workflows.js\` with \`npm run docs:workflows\`.\n\nThese are API sketches, not executable library examples. Imports named ravl\ndo not exist yet. Snippets omit surrounding application UI and repeated imports.\n\`container\`, \`showError\`, \`showStatus\`, \`saveDocument\`, \`episodeSource\`,\nand \`waveformData\` are application-provided placeholders. React snippets use\nReact hooks and the proposed Waveform component. Persistence helpers must handle\ntheir own failures. All async operations in production examples will handle errors.\n\n` + workflows.map(w =>
  `## ${w.title}\n\nImplementation phase: ${w.phase}.\n\n${w.intent}\n\n${w.contract}\n\n### Vanilla JavaScript\n\n\`\`\`js\n${w.vanilla}\n\`\`\`\n\n### React\n\n\`\`\`jsx\n${w.react}\n\`\`\`\n`,
).join('\n')

if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== body) {
    throw new Error('Workflow guide is stale. Run npm run docs:workflows.')
  }
  console.log('Workflow guide matches the browser examples.')
} else {
  await writeFile(target, body)
  console.log('Updated docs/design/workflows.md')
}
