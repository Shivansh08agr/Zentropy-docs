"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DocMeta } from "@/lib/docs";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocsSidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  docs: DocMeta[];
}

export function DocsSidebar({ docs, className }: DocsSidebarProps) {
  const pathname = usePathname();
  // pathname will be something like "/ZENTROPY_ANALYSIS" or "/MODULE_1_DETAILED_ANALYSIS"

  return (
    <div className={cn("w-full h-full", className)}>
      <ScrollArea className="h-full py-6 pr-6 lg:py-8 pl-4">
        <h4 className="mb-4 rounded-md px-2 py-1 text-sm font-bold uppercase tracking-wider text-muted-foreground/80">
          Documentation
        </h4>
        <div className="flex flex-col space-y-1 pb-10">
          {docs.map((doc) => {
            const isActive = pathname === `/${doc.slug}`;
            return (
              <Link
                key={doc.slug}
                href={`/${doc.slug}`}
                className={cn(
                  "group flex w-full items-center rounded-md px-3 py-2 transition-all duration-200 font-medium text-[0.95rem]",
                  isActive
                    ? " text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {doc.title}
              </Link>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
