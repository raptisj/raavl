import { notFound } from "next/navigation";
import { pageMarkdown, source } from "@/lib/source";
import { canonicalDocSlugs } from "@/lib/skill-config";

export const revalidate = false;
export const dynamicParams = false;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  if (slug.at(-1) !== "content.md") notFound();
  const page = source.getPage(canonicalDocSlugs(slug.slice(0, -1)));
  if (!page) notFound();
  return new Response(await pageMarkdown(page), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

export function generateStaticParams() {
  return [
    ...source.getPages().map((page) => ({ slug: [...page.slugs, 'content.md'] })),
    { slug: ['agents', 'content.md'] },
  ];
}
