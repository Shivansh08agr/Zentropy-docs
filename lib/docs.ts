import fs from "fs";
import path from "path";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";

const docsDirectory = path.join(process.cwd(), "content");

export type HeadingMeta = {
  level: number;
  text: string;
  id: string;
};

export type DocMeta = {
  slug: string;
  title: string;
  order: number;
  headings: HeadingMeta[];
};

const fileOrder = [
  "ZENTROPY_ANALYSIS.md",
  "MODULE_1_DETAILED_ANALYSIS.md",
  "MODULE_2_FRONTEND_ANALYSIS.md",
  "MODULE_3_CONTRACTS_ANALYSIS.md",
  "MODULE_4_PROVER_ANALYSIS.md",
];

export function cleanMarkdownContent(content: string): string {
  let cleaned = content;

  cleaned = cleaned.replace(/##\s*TABLE OF CONTENTS[\s\S]*?(?=##\s+|---)/i, "");
  cleaned = cleaned.replace(
    /##\s*REPORT FILES CREATED[\s\S]*?(?=##\s+|---)/i,
    "",
  );

  cleaned = cleaned.replace(/ZENTROPY_ANALYSIS\.md/gi, "Zentropy Analysis");
  cleaned = cleaned.replace(/MODULE_1_DETAILED_ANALYSIS\.md/gi, "Backend API");
  cleaned = cleaned.replace(
    /MODULE_2_FRONTEND_ANALYSIS\.md/gi,
    "Frontend Interface",
  );
  cleaned = cleaned.replace(
    /MODULE_3_CONTRACTS_ANALYSIS\.md/gi,
    "Smart Contracts",
  );
  cleaned = cleaned.replace(/MODULE_4_PROVER_ANALYSIS\.md/gi, "ZK Prover");
  cleaned = cleaned.replace(/DOCUMENTATION_INDEX\.md/gi, "Introduction");

  cleaned = cleaned.replace(/([A-Z0-9_]+)\.md/gi, "$1");

  return cleaned;
}

export function extractHeadings(content: string): HeadingMeta[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings: HeadingMeta[] = [];
  const slugger = new GithubSlugger();
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const rawTextForSlug = match[2].replace(/[*_`]/g, "").trim();

    const id = slugger.slug(rawTextForSlug);

    let text = rawTextForSlug.replace(/^\d+\.\s*/, "").trim();

    headings.push({ level, text, id });
  }
  return headings;
}

const getProperTitle = (filename: string): string => {
  if (filename.includes("ZENTROPY_ANALYSIS")) return "Zentropy Analysis";
  if (filename.includes("MODULE_1")) return "Backend Architecture";
  if (filename.includes("MODULE_2")) return "Frontend Architecture";
  if (filename.includes("MODULE_3")) return "Smart Contracts";
  if (filename.includes("MODULE_4")) return "ZK Prover";

  return filename
    .replace(".md", "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export function getAllDocs(): DocMeta[] {
  const fileNames = fs.readdirSync(docsDirectory);
  // Skip over the DOCUMENTATION_INDEX.md since System Overview is functionally the same start page
  const docsFiles = fileNames.filter(
    (file) => file.endsWith(".md") && file !== "DOCUMENTATION_INDEX.md",
  );

  const allDocsData = docsFiles.map((fileName) => {
    const slug = fileName.replace(/\.md$/, "");
    const fullPath = path.join(docsDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, "utf8");

    const cleanedContent = cleanMarkdownContent(fileContents);
    const title = getProperTitle(fileName);
    const headings = extractHeadings(cleanedContent);

    return {
      slug,
      title,
      order:
        fileOrder.indexOf(fileName) !== -1 ? fileOrder.indexOf(fileName) : 99,
      headings,
    };
  });

  return allDocsData.sort((a, b) => a.order - b.order);
}

export function getDocBySlug(slug: string) {
  // If attempting to fetch the dropped index, redirect to the overview
  const actualSlug =
    slug === "DOCUMENTATION_INDEX" ? "ZENTROPY_ANALYSIS" : slug;

  const fullPath = path.join(docsDirectory, `${actualSlug}.md`);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const cleanedContent = cleanMarkdownContent(fileContents);
  const title = getProperTitle(`${actualSlug}.md`);

  return {
    slug: actualSlug,
    title,
    content: cleanedContent,
  };
}
