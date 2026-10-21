import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TagsEditor } from "./TagsEditor.js";

/** Wrapper keeping tags stateful so onChange updates re-render the editor. */
function ControlledTagsEditor({ initial = [] as string[] }) {
  const [tags, setTags] = useState(initial);
  return <TagsEditor tags={tags} onChange={setTags} />;
}

describe("TagsEditor", () => {
  it("adds a tag on Enter and clears the input", async () => {
    const user = userEvent.setup();
    render(<ControlledTagsEditor />);
    const input = screen.getByLabelText("Add tag");
    await user.type(input, "work{Enter}");
    expect(screen.getByText("work")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("adds a tag via the Add button", async () => {
    const user = userEvent.setup();
    render(<ControlledTagsEditor />);
    await user.type(screen.getByLabelText("Add tag"), "home");
    await user.click(screen.getByRole("button", { name: "Add tag" }));
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("removes a tag via its remove control", async () => {
    const user = userEvent.setup();
    render(<ControlledTagsEditor initial={["keep", "drop"]} />);
    await user.click(screen.getByRole("button", { name: "Remove tag drop" }));
    expect(screen.queryByText("drop")).not.toBeInTheDocument();
    expect(screen.getByText("keep")).toBeInTheDocument();
  });

  it("ignores empty, duplicate, and over-limit tags", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagsEditor tags={["dup"]} onChange={onChange} />);
    const input = screen.getByLabelText("Add tag");
    await user.type(input, "   {Enter}"); // empty after trim
    await user.type(input, "dup{Enter}"); // duplicate
    await user.type(input, `${"x".repeat(51)}{Enter}`); // over 50 chars
    expect(onChange).not.toHaveBeenCalled();
  });

  it("refuses to add past the 32-tag cap", async () => {
    const user = userEvent.setup();
    const tags = Array.from({ length: 32 }, (_, i) => `tag-${i}`);
    const onChange = vi.fn();
    render(<TagsEditor tags={tags} onChange={onChange} />);
    const input = screen.getByLabelText("Add tag");
    await user.type(input, "overflow{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });
});
