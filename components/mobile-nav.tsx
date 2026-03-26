"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DocMeta } from "@/lib/docs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export function MobileNav({ docs }: { docs: DocMeta[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
        >
          <Menu className="h-6 w-6 text-foreground" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0 border-r-border/50 bg-background/95 backdrop-blur-xl">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SheetDescription className="sr-only">Main menu mapping through available platform sections</SheetDescription>
        <div className="flex items-center space-x-2 pt-4 pb-6 pl-4">
          <Logo className="h-6 w-6" />
          <span className="font-bold tracking-tight text-lg text-primary">Zentropy</span>
          <span className="font-semibold text-muted-foreground">Docs</span>
        </div>
        <ScrollArea className="my-4 h-[calc(100vh-8rem)] pb-10 pl-4 pr-6">
          <div className="flex flex-col space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3">Documentation</h4>
            {docs.map((doc) => {
              const isActive = pathname === `/${doc.slug}`;
              return (
                <Link
                  key={doc.slug}
                  href={`/${doc.slug}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "px-3 py-2 rounded-md font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-foreground/80 hover:text-primary hover:bg-muted/50 border border-transparent"
                  )}
                >
                  {doc.title}
                </Link>
              )
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
