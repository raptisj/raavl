import { pageMarkdown, source } from "@/lib/source";

export const revalidate = false;
export async function GET() {
  const pages = await Promise.all(source.getPages().map(pageMarkdown));
  return new Response(
    `# raavl documentation\n\n${pages.join("\n\n---\n\n")}\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
