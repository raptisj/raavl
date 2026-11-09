import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
} from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/mdx-components";
import { PageOpenMenu } from "@/components/page-open-menu";
import { markdownUrl, source } from "@/lib/source";
import { canonicalDocSlugs } from "@/lib/skill-config";
import { publicUrl } from "@/lib/site-config.mjs";

type Props = { params: Promise<{ slug?: string[] }> };

export default async function Page({ params }: Props) {
  const page = source.getPage(canonicalDocSlugs((await params).slug));
  if (!page) notFound();
  const MDX = page.data.body;
  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="page-tools">
        <MarkdownCopyButton markdownUrl={markdownUrl(page.slugs)} />
        <PageOpenMenu
          pageUrl={publicUrl(page.url)}
          markdownUrl={markdownUrl(page.slugs)}
          githubUrl={`https://github.com/raptisj/raavl/blob/main/docs/content/docs/${page.path}`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({ a: createRelativeLink(source, page) })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return [...source.generateParams(), { slug: ['agents'] }];
}
export const dynamicParams = false;

export async function generateMetadata({ params }: Props) {
  const page = source.getPage(canonicalDocSlugs((await params).slug));
  if (!page) notFound();
  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: publicUrl(page.url) },
  };
}
