import { cn } from "@/lib/utils";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import GithubSlugger from "github-slugger";

interface TableOfContentsProps {
  content: string;
}

export function TableOfContents({ content }: TableOfContentsProps) {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings = [];
  const slugger = new GithubSlugger();
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const rawTextForSlug = match[2].replace(/[*_`]/g, '').trim();
    
    // Exact ID mapping used by rehype-slug
    const id = slugger.slug(rawTextForSlug);

    // Filter text for display
    let text = rawTextForSlug.replace(/^\d+\.\s*/, '').trim();
    
    headings.push({ level, text, id });
  }

  if (headings.length === 0) {
    return null;
  }

  return (
    <div className="hidden xl:block">
      <div className="sticky top-14 -mt-10 h-[calc(100vh-3.5rem)] py-12">
        <ScrollArea className="h-full pr-6">
          <div className="mb-4 text-sm font-semibold tracking-tight">On This Page</div>
          <div className="flex flex-col space-y-2.5 text-sm">
            {headings.map((heading, index) => (
              <Link
                key={index}
                href={`#${heading.id}`}
                className={cn(
                  "hover:text-foreground text-muted-foreground transition-colors line-clamp-1",
                  heading.level === 3 ? "pl-4 text-xs" : "font-medium"
                )}
              >
                {heading.text}
              </Link>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
