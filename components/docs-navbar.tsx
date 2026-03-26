import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";
import { getAllDocs } from "@/lib/docs";
import { Button } from "./ui/button";
import { SearchDocs } from "@/components/search";
import { Logo } from "@/components/logo";

export function DocsNavbar() {
  const docs = getAllDocs();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4 md:px-8">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Logo className="h-6 w-6" />
            <span className="font-bold text-xl tracking-tight hidden sm:inline-block text-foreground/90">
              Zentropy <span className="text-primary">Docs</span>
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              href="/DOCUMENTATION_INDEX"
              className="transition-colors hover:text-foreground text-foreground/60"
            >
              Documentation
            </Link>
          </nav>
        </div>
        <MobileNav docs={docs} />
        
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <SearchDocs docs={docs} />
          </div>
          <nav className="flex items-center space-x-2">
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}
