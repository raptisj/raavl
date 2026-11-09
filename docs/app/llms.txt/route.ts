import { markdownUrl, source } from "@/lib/source";
import { publicUrl } from "@/lib/site-config.mjs";

export const revalidate = false;
export function GET() {
  const pages = source
    .getPages()
    .map(
      (page) =>
        `- [${page.data.title}](${publicUrl(markdownUrl(page.slugs))}): ${page.data.description ?? ""}`,
    );
  return new Response(
    `# raavl\n\n> TypeScript audio waveform player and annotation toolkit for JavaScript and React.\n\nRead ${publicUrl('/skill.md')} for the integration workflow, ${publicUrl('/docs/skills')} for skill installation, or ${publicUrl('/llms-full.txt')} for the complete documentation.\n\n## Skill\n\n- [raavl-integrate](${publicUrl('/skill.md')}): Integrate raavl into an existing application.\n\n## Documentation\n\n${pages.join("\n")}\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
