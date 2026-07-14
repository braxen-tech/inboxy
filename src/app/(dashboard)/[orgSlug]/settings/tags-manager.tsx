"use client";

import { useState, useTransition } from "react";
import { createTag, updateTag, deleteTag } from "./tags-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface OrgTag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  orgSlug: string;
  initialTags: OrgTag[];
  canManage: boolean;
}

export function TagsManager({ orgSlug, initialTags, canManage }: Props) {
  const [tags, setTags] = useState(initialTags);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await createTag({ orgSlug, name: name.trim(), color });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.tag) {
        setTags((prev) => [...prev, res.tag as OrgTag].sort((a, b) => a.name.localeCompare(b.name)));
        setName("");
      }
    });
  }

  function handleRename(tag: OrgTag, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === tag.name) return;
    startTransition(async () => {
      const res = await updateTag({ orgSlug, tagId: tag.id, name: trimmed });
      if (res.error) {
        setError(res.error);
        return;
      }
      setTags((prev) =>
        prev
          .map((t) => (t.id === tag.id ? { ...t, name: trimmed } : t))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    });
  }

  function handleColor(tag: OrgTag, nextColor: string) {
    startTransition(async () => {
      const res = await updateTag({ orgSlug, tagId: tag.id, color: nextColor });
      if (res.error) {
        setError(res.error);
        return;
      }
      setTags((prev) => prev.map((t) => (t.id === tag.id ? { ...t, color: nextColor } : t)));
    });
  }

  function handleDelete(tagId: string) {
    if (!confirm("Excluir esta tag? Ela será removida de conversas e leads.")) return;
    startTransition(async () => {
      const res = await deleteTag({ orgSlug, tagId });
      if (res.error) {
        setError(res.error);
        return;
      }
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <ul className="space-y-2">
        {tags.length === 0 && (
          <li className="text-sm text-muted-foreground">Nenhuma tag ainda.</li>
        )}
        {tags.map((tag) => (
          <li key={tag.id} className="flex flex-wrap items-center gap-2">
            <input
              type="color"
              value={tag.color}
              disabled={!canManage || isPending}
              onChange={(e) => handleColor(tag, e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border bg-background disabled:opacity-50"
              aria-label={`Cor da tag ${tag.name}`}
            />
            <Input
              defaultValue={tag.name}
              disabled={!canManage || isPending}
              className="h-8 max-w-xs"
              onBlur={(e) => handleRename(tag, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
            />
            {canManage && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => handleDelete(tag.id)}
              >
                Excluir
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <div className="space-y-2 border-t pt-4">
          <Label>Nova tag</Label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border bg-background"
              aria-label="Cor da nova tag"
            />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da tag"
              className="h-8 max-w-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <Button type="button" size="sm" disabled={isPending || !name.trim()} onClick={handleCreate}>
              Criar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            As mesmas tags servem para conversas e leads. O agente só aplica tags já existentes.
          </p>
        </div>
      )}
    </div>
  );
}
