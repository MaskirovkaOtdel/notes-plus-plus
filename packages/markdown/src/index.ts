import { Marked, type Tokens } from "marked";
import createDOMPurify, { type DOMPurify } from "dompurify";

/**
 * Shared markdown rendering.
 *
 * Parsing is fixed (marked, GFM + line breaks) so the web app and any
 * server-side consumer — e.g. premium's HTML export — produce identical
 * output from the same note body. Sanitization is injectable: the browser
 * binds DOMPurify to its window, while a server passes its own DOM-backed
 * sanitizer (isomorphic-dompurify / jsdom). We never emit unsanitized HTML.
 */

/** A sanitizer turns parsed HTML into safe-to-inject HTML. */
export type Sanitize = (html: string) => string;

const marked = new Marked({ gfm: true, breaks: true });

/**
 * DOMPurify bound to the ambient window, with external links hardened to
 * open in a new tab without giving the target page a handle on us.
 */
function createBrowserSanitizer(): Sanitize {
  const purify: DOMPurify = createDOMPurify(window);
  purify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.hasAttribute("href")) {
      const href = node.getAttribute("href") ?? "";
      if (/^https?:\/\//i.test(href)) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }
  });
  return (html) => purify.sanitize(html);
}

let browserSanitizer: Sanitize | null = null;

function defaultSanitize(): Sanitize {
  if (typeof window === "undefined") {
    throw new Error(
      "renderMarkdown: no DOM available. Pass a `sanitize` option " +
        "(e.g. isomorphic-dompurify) when rendering on the server.",
    );
  }
  browserSanitizer ??= createBrowserSanitizer();
  return browserSanitizer;
}

export interface RenderOptions {
  /** Override the sanitizer. Required outside a DOM environment. */
  sanitize?: Sanitize;
}

/** Parse markdown to HTML and sanitize it. Safe to inject into the DOM. */
export function renderMarkdown(markdown: string, options: RenderOptions = {}): string {
  const html = marked.parse(markdown ?? "", { async: false });
  const sanitize = options.sanitize ?? defaultSanitize();
  return sanitize(html);
}

/** Flatten markdown to plain text (for list previews), collapsing whitespace. */
export function markdownToPlainText(markdown: string): string {
  const out: string[] = [];
  const walk = (tokens: Tokens.Generic[]): void => {
    for (const token of tokens) {
      if ("tokens" in token && Array.isArray(token.tokens)) {
        walk(token.tokens as Tokens.Generic[]);
      } else if ("items" in token && Array.isArray(token.items)) {
        walk(token.items as Tokens.Generic[]);
      } else {
        const text = (token as { text?: unknown }).text;
        if (typeof text === "string") out.push(text);
      }
    }
  };
  walk(marked.lexer(markdown ?? "") as Tokens.Generic[]);
  return out.join(" ").replace(/\s+/g, " ").trim();
}
