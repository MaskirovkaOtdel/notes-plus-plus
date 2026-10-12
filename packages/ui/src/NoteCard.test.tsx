import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NoteCard } from "./NoteCard.js";

const note = {
  id: "n1",
  title: "My first note",
  body: "Some **markdown** body",
  tags: ["idea", "todo"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("NoteCard", () => {
  it("renders the title", () => {
    render(<NoteCard note={note} />);
    expect(screen.getByText("My first note")).toBeInTheDocument();
  });

  it("renders each tag", () => {
    render(<NoteCard note={note} />);
    expect(screen.getByText("idea")).toBeInTheDocument();
    expect(screen.getByText("todo")).toBeInTheDocument();
  });

  it("hides the body paragraph and tag list when empty", () => {
    render(<NoteCard note={{ ...note, body: "", tags: [] }} />);
    expect(screen.getByText("My first note")).toBeInTheDocument();
    expect(screen.queryByText("Some **markdown** body")).not.toBeInTheDocument();
    expect(screen.queryByText("idea")).not.toBeInTheDocument();
  });

  it("invokes onSelect with the note id", () => {
    let selected: string | null = null;
    render(<NoteCard note={note} onSelect={(id) => (selected = id)} />);
    screen.getByRole("button").click();
    expect(selected).toBe("n1");
  });
});
