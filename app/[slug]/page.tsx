import { getAllDocs, getDocBySlug } from "@/lib/docs";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import { TableOfContents } from "@/components/table-of-contents";
import { CodeBlock } from "@/components/code-block";
import { PageTransition } from "@/components/page-transition";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface PageProps {
  params: {
    slug: string;
  };
}

export async function generateStaticParams() {
  const docs = getAllDocs();
  return docs.map((doc) => ({
    slug: doc.slug,
  }));
}

export function generateMetadata({ params }: PageProps) {
  const doc = getDocBySlug(params.slug);
  if (!doc) {
    return { title: "Documentation Not Found" };
  }
  return { title: `${doc.title} - Zentropy Docs` };
}

export default function DocPage({ params }: PageProps) {
  const doc = getDocBySlug(params.slug);

  if (!doc) {
    notFound();
  }

  return (
    <>
      <div className="mx-auto w-full min-w-0">
        <PageTransition>
          <div className="mb-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/" className="transition-colors hover:text-foreground">Docs</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-foreground">{doc.title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          
          <div className="pb-16 pt-2 w-full max-w-full overflow-hidden">
            <div className="premium-prose">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeSlug]}
                components={{
                  // Prevent Hydration Error: replace <p> with <div> to allow block-level <div> children
                  p({ node, ...props }: any) {
                    return <div className="leading-7 [&:not(:first-child)]:mt-6 text-foreground/80 break-words" {...props} />;
                  },
                  code({ node, inline, className, children, ...props }: any) {
                    return !inline ? (
                      <CodeBlock className={className} {...props}>
                        {children}
                      </CodeBlock>
                    ) : (
                      <code
                        className="relative rounded bg-muted/60 px-[0.4rem] py-[0.2rem] font-mono text-[0.85em] text-primary/90"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  table({ node, ...props }: any) {
                    return (
                      <div className="w-full overflow-x-auto my-8 rounded-lg border border-border shadow-sm">
                        <table className="w-full text-sm text-left" {...props} />
                      </div>
                    );
                  },
                  thead({ node, ...props }: any) {
                    return <thead className="text-xs uppercase bg-muted/30 border-b border-border text-muted-foreground/80" {...props} />;
                  },
                  th({ node, ...props }: any) {
                    return <th className="px-4 py-3 font-semibold border-r border-border last:border-0" {...props} />;
                  },
                  td({ node, ...props }: any) {
                    return <td className="px-4 py-3 border-r border-t border-border last:border-r-0" {...props} />;
                  },
                  tr({ node, ...props }: any) {
                    return <tr className="hover:bg-muted/10 transition-colors" {...props} />;
                  },
                }}
              >
                {doc.content}
              </ReactMarkdown>
            </div>
          </div>
        </PageTransition>
      </div>
      <TableOfContents content={doc.content} />
    </>
  );
}
