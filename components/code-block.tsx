"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  className?: string;
}

export function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  const [hasCopied, setHasCopied] = useState(false);

  // Extract string content from children if it's a code block
  const textContent = Array.isArray(children)
    ? children.join("")
    : typeof children === "string"
    ? children
    : "";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(textContent);
    setHasCopied(true);
    setTimeout(() => {
      setHasCopied(false);
    }, 2000);
  };

  return (
    <div className="relative group">
      <pre
        className={`mt-6 mb-4 overflow-x-auto rounded-lg border bg-muted p-4 pt-10 ${
          className || ""
        }`}
        {...props}
      >
        <code className="relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm">
          {children}
        </code>
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-4 top-4 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background/50 hover:bg-background"
        onClick={copyToClipboard}
      >
        {hasCopied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
        <span className="sr-only">Copy code</span>
      </Button>
    </div>
  );
}
