import { describe, expect, it } from "vitest";
import { markdownToPlainText, renderMarkdown } from "./index.js";

describe("renderMarkdown", () => {
  it("renders headings, emphasis, and lists", () => {
    const html = renderMarkdown("# Title\n\nSome **bold** and *italic*.\n\n- one\n- two");
    expect(html).toContain("<h1");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<li>two</li>");
  });

  it("honours line breaks as <br>", () => {
    expect(renderMarkdown("line one\nline two")).toContain("<br>");
  });

  it("renders links and adds hardening to external http(s) links", () => {
    const html = renderMarkdown("[docs](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("does not force target/rel on in-page anchors", () => {
    const html = renderMarkdown("[top](#section)");
    expect(html).toContain('href="#section"');
    expect(html).not.toContain('target="_blank"');
  });

  it("strips script tags entirely", () => {
    const html = renderMarkdown('before <script>alert("xss")</script> after');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert");
    expect(html).toContain("before");
    expect(html).toContain("after");
  });

  it("strips inline event handlers", () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });

  it("removes javascript: URLs from links", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });

  it("accepts an injected sanitizer for non-DOM environments", () => {
    const seen: string[] = [];
    const html = renderMarkdown("# Hi", {
      sanitize: (h) => {
        seen.push(h);
        return "<p>custom</p>";
      },
    });
    expect(html).toBe("<p>custom</p>");
    expect(seen[0]).toContain("<h1");
  });
});

describe("markdownToPlainText", () => {
  it("strips markdown syntax to plain text", () => {
    expect(markdownToPlainText("# Heading\n\nSome **bold** body.")).toBe(
      "Heading Some bold body.",
    );
  });

  it("extracts list item text", () => {
    expect(markdownToPlainText("- alpha\n- beta")).toBe("alpha beta");
  });

  it("collapses whitespace runs", () => {
    expect(markdownToPlainText("a   b\n\n\nc")).toBe("a b c");
  });

  it("returns empty string for empty input", () => {
    expect(markdownToPlainText("")).toBe("");
  });
});
