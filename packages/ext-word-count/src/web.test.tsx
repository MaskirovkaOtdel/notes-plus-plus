import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WordCountChip, wordCountWebExtension } from "./web.js";
import type { Note } from "@notespp/shared";

const makeNote = (overrides: Partial<Note> = {}): Note => ({
  id: "n1",
  title: "Test note",
  body: "alpha beta gamma",
  tags: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("WordCountChip", () => {
  it("renders the word count and reading time", () => {
    render(<WordCountChip note={makeNote()} />);
    expect(screen.getByTestId("word-count-chip")).toHaveTextContent(
      "3 words · ~0 min read",
    );
  });

  it("uses the singular form for one word", () => {
    render(<WordCountChip note={makeNote({ body: "alone" })} />);
    expect(screen.getByTestId("word-count-chip")).toHaveTextContent("1 word");
  });
});

describe("wordCountWebExtension", () => {
  it("shares the manifest with the api extension", () => {
    expect(wordCountWebExtension.manifest.id).toBe("word-count");
  });

  it("contributes a toolbar element", () => {
    const Contribution = wordCountWebExtension.contributions.noteToolbar!;
    expect(Contribution).toBeTypeOf("function");
    render(<Contribution note={makeNote({ body: "two words" })} />);
    expect(screen.getByTestId("word-count-chip")).toHaveTextContent("2 words");
  });
});
