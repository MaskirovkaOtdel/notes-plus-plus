import { useState } from "react";
import { Button } from "@notespp/ui";

export interface TagsEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Tag chips with add/remove affordances. Enter (or the Add button) appends
 * the pending input; each chip has a remove control. Mirrors the shared
 * schema limits: max 32 tags, max 50 chars per tag, no duplicates.
 */
export function TagsEditor({ tags, onChange }: TagsEditorProps) {
  const [pending, setPending] = useState("");

  const trimmed = pending.trim();
  const canAdd =
    trimmed.length > 0 &&
    trimmed.length <= 50 &&
    !tags.includes(trimmed) &&
    tags.length < 32;

  const addTag = () => {
    if (!canAdd) return;
    onChange([...tags, trimmed]);
    setPending("");
  };

  return (
    <div className="mt-4">
      <label htmlFor="note-tags" className="sr-only">
        Add tag
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="ml-1 rounded-full px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="note-tags"
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="Add tag…"
          className="w-36 rounded-md border border-slate-300 px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <Button variant="secondary" onClick={addTag} disabled={!canAdd}>
          Add tag
        </Button>
      </div>
    </div>
  );
}
