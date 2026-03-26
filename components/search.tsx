"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { DocMeta } from "@/lib/docs";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

export function SearchDocs({ docs }: { docs: DocMeta[] }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start rounded-full bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64 border-border/50 hover:bg-muted/80 transition-colors"
        onClick={() => setOpen(true)}
      >
        <span className="hidden lg:inline-flex">Search documentation...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <SearchIcon className="absolute right-3 top-2.5 hidden sm:block h-4 w-4 opacity-50" />
        <kbd className="pointer-events-none absolute right-8 top-2 hidden h-5 select-none items-center gap-1 rounded border border-border/60 bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          <CommandGroup heading="Pages">
            {docs.map((doc) => (
              <CommandItem
                key={doc.slug}
                value={doc.title}
                onSelect={() => {
                  runCommand(() => router.push(`/${doc.slug}`));
                }}
                className="font-medium"
              >
                {doc.title}
              </CommandItem>
            ))}
          </CommandGroup>

          {docs.map((doc) => {
            if (!doc.headings || doc.headings.length === 0) return null;
            return (
              <CommandGroup key={`${doc.slug}-headings`} heading={`${doc.title} Sections`}>
                {doc.headings.map((heading) => (
                  <CommandItem
                    key={`${doc.slug}-${heading.id}`}
                    value={`${doc.title} ${heading.text}`}
                    onSelect={() => {
                      runCommand(() => router.push(`/${doc.slug}#${heading.id}`));
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{heading.text}</span>
                      <span className="text-xs text-muted-foreground/80">in {doc.title}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
