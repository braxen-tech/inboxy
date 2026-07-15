"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  moveLead,
  createLead,
  updateLead,
  deleteLead,
  setLeadTags,
  createStage,
  updateStage,
  deleteStage,
  reorderStages,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { can } from "@/lib/authz";
import type { MemberRole } from "@/domain/entities/organization-member";
import { MoreHorizontal, Plus } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  position: number;
  color: string | null;
}

interface LeadTag {
  id: string;
  name: string;
  color: string;
}

interface Lead {
  id: string;
  title: string;
  value: number | null;
  description: string | null;
  status: "open" | "won" | "lost";
  stageId: string;
  position: number;
  contactId: string | null;
  contactName: string;
  tags: LeadTag[];
}

interface OrgTag {
  id: string;
  name: string;
  color: string;
}

type Role = MemberRole;

interface Props {
  orgSlug: string;
  pipelineId: string;
  stages: Stage[];
  leads: Lead[];
  orgTags: OrgTag[];
  viewerRole: Role;
}

export function KanbanBoard({
  orgSlug,
  pipelineId,
  stages: initialStages,
  leads: initialLeads,
  orgTags,
  viewerRole,
}: Props) {
  const [stages, setStages] = useState(initialStages);
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const canWrite = can(viewerRole, "write_leads");
  const isAdmin = can(viewerRole, "manage_pipeline");

  useEffect(() => {
    setStages(initialStages);
  }, [initialStages]);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStage = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const s of stages) map.set(s.id, []);
    for (const l of leads) {
      const arr = map.get(l.stageId);
      if (arr) arr.push(l);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [leads, stages]);

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;

    const active = String(e.active.id);
    const over = String(e.over.id);

    // Column reorder (admin)
    if (isAdmin && stages.some((s) => s.id === active)) {
      const oldIndex = stages.findIndex((s) => s.id === active);
      const newIndex = stages.findIndex((s) => s.id === over);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = arrayMove(stages, oldIndex, newIndex).map((s, i) => ({ ...s, position: i }));
      setStages(next);
      startTransition(async () => {
        const res = await reorderStages({
          orgSlug,
          pipelineId,
          stageIds: next.map((s) => s.id),
        });
        if (res.error) setStages(initialStages);
      });
      return;
    }

    if (!canWrite) return;

    const leadId = active;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    const targetStageId = stages.some((s) => s.id === over)
      ? over
      : leads.find((l) => l.id === over)?.stageId;
    if (!targetStageId || lead.stageId === targetStageId) return;

    const nextPosition = (byStage.get(targetStageId)?.length ?? 0) * 1000;
    const snapshot = leads;
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stageId: targetStageId, position: nextPosition } : l)),
    );

    startTransition(async () => {
      const res = await moveLead({ orgSlug, leadId, targetStageId, targetPosition: nextPosition });
      if (res.error) setLeads(snapshot);
    });
  }

  function handleOptimisticCreate(stageId: string, title: string, tempId: string) {
    const optimistic: Lead = {
      id: tempId,
      title,
      value: 0,
      description: null,
      status: "open",
      stageId,
      position: (byStage.get(stageId)?.length ?? 0) * 1000,
      contactId: null,
      contactName: title,
      tags: [],
    };
    setLeads((prev) => [...prev, optimistic]);
    startTransition(async () => {
      const res = await createLead({ orgSlug, pipelineId, stageId, title });
      if (res.error) {
        setLeads((prev) => prev.filter((l) => l.id !== tempId));
        return;
      }
      if (res.leadId) {
        setLeads((prev) => prev.map((l) => (l.id === tempId ? { ...l, id: res.leadId! } : l)));
      }
    });
  }

  async function handleAddStage(name: string) {
    const tempId = `temp-stage-${Date.now()}`;
    const optimistic: Stage = {
      id: tempId,
      name,
      color: "#94a3b8",
      position: stages.length,
    };
    setStages((prev) => [...prev, optimistic]);
    const res = await createStage({ orgSlug, pipelineId, name });
    if (res.error || !res.stage) {
      setStages((prev) => prev.filter((s) => s.id !== tempId));
      alert(res.error ?? "Falha ao criar coluna.");
      return;
    }
    setStages((prev) =>
      prev.map((s) =>
        s.id === tempId
          ? {
              id: res.stage!.id as string,
              name: res.stage!.name as string,
              position: res.stage!.position as number,
              color: (res.stage!.color as string | null) ?? "#94a3b8",
            }
          : s,
      ),
    );
  }

  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null;
  const editingLead = editingLeadId ? leads.find((l) => l.id === editingLeadId) ?? null : null;

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          <SortableContext items={stages.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
            {stages.map((stage) => (
              <Column
                key={stage.id}
                stage={stage}
                stages={stages}
                leads={byStage.get(stage.id) ?? []}
                canWrite={canWrite}
                isAdmin={isAdmin}
                onCreateLead={(title) => handleOptimisticCreate(stage.id, title, `temp-${Date.now()}`)}
                onEditLead={setEditingLeadId}
                onRenameStage={(name, color) => {
                  setStages((prev) =>
                    prev.map((s) => (s.id === stage.id ? { ...s, name, color: color ?? s.color } : s)),
                  );
                  startTransition(async () => {
                    const res = await updateStage({
                      orgSlug,
                      stageId: stage.id,
                      name,
                      color: color ?? undefined,
                    });
                    if (res.error) setStages(initialStages);
                  });
                }}
                onDeleteStage={(moveTo) => {
                  const snapshot = stages;
                  const leadSnapshot = leads;
                  setStages((prev) => prev.filter((s) => s.id !== stage.id));
                  if (moveTo) {
                    setLeads((prev) =>
                      prev.map((l) => (l.stageId === stage.id ? { ...l, stageId: moveTo } : l)),
                    );
                  }
                  startTransition(async () => {
                    const res = await deleteStage({
                      orgSlug,
                      stageId: stage.id,
                      moveLeadsToStageId: moveTo,
                    });
                    if (res.error) {
                      setStages(snapshot);
                      setLeads(leadSnapshot);
                      alert(res.error);
                    }
                  });
                }}
              />
            ))}
          </SortableContext>

          {isAdmin && (
            <AddColumnButton
              onAdd={(name) => {
                startTransition(() => {
                  void handleAddStage(name);
                });
              }}
            />
          )}
        </div>

        <DragOverlay>{activeLead ? <LeadCard lead={activeLead} dragging /> : null}</DragOverlay>
      </DndContext>

      <LeadEditSheet
        open={Boolean(editingLead)}
        lead={editingLead}
        orgTags={orgTags}
        canWrite={canWrite}
        onOpenChange={(open) => {
          if (!open) setEditingLeadId(null);
        }}
        onSave={(patch) => {
          if (!editingLead) return;
          const id = editingLead.id;
          setLeads((prev) =>
            prev.map((l) =>
              l.id === id
                ? {
                    ...l,
                    title: patch.title ?? l.title,
                    value: patch.value ?? l.value,
                    description: patch.description ?? l.description,
                    status: patch.status ?? l.status,
                    tags: patch.tags ?? l.tags,
                  }
                : l,
            ),
          );
          if (patch.status === "won" || patch.status === "lost") {
            setLeads((prev) => prev.filter((l) => l.id !== id));
            setEditingLeadId(null);
          }
          startTransition(async () => {
            const res = await updateLead({
              orgSlug,
              leadId: id,
              title: patch.title,
              value: patch.value ?? undefined,
              description: patch.description,
              status: patch.status,
            });
            if (res.error) {
              setLeads(initialLeads);
              alert(res.error);
              return;
            }
            if (patch.tagIds) {
              const tagRes = await setLeadTags({ orgSlug, leadId: id, tagIds: patch.tagIds });
              if (tagRes.error) alert(tagRes.error);
            }
          });
        }}
        onDelete={() => {
          if (!editingLead) return;
          const id = editingLead.id;
          const snapshot = leads;
          setLeads((prev) => prev.filter((l) => l.id !== id));
          setEditingLeadId(null);
          startTransition(async () => {
            const res = await deleteLead({ orgSlug, leadId: id });
            if (res.error) {
              setLeads(snapshot);
              alert(res.error);
            }
          });
        }}
      />
    </>
  );
}

function AddColumnButton({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-min w-72 shrink-0 items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground hover:bg-muted/40"
      >
        <Plus className="size-4" />
        Nova coluna
      </button>
    );
  }

  return (
    <div className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da coluna"
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onAdd(name.trim());
            setName("");
            setOpen(false);
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          disabled={!name.trim()}
          onClick={() => {
            if (!name.trim()) return;
            onAdd(name.trim());
            setName("");
            setOpen(false);
          }}
        >
          Adicionar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function Column({
  stage,
  stages,
  leads,
  canWrite,
  isAdmin,
  onCreateLead,
  onEditLead,
  onRenameStage,
  onDeleteStage,
}: {
  stage: Stage;
  stages: Stage[];
  leads: Lead[];
  canWrite: boolean;
  isAdmin: boolean;
  onCreateLead: (title: string) => void;
  onEditLead: (id: string) => void;
  onRenameStage: (name: string, color?: string | null) => void;
  onDeleteStage: (moveTo?: string) => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: stage.id });
  const {
    attributes,
    listeners,
    setNodeRef: setSortRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id, disabled: !isAdmin });

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(stage.name);
  const [colorDraft, setColorDraft] = useState(stage.color ?? "#94a3b8");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={(node) => {
        setSortRef(node);
        setDropRef(node);
      }}
      style={style}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-3",
        isOver && "ring-2 ring-primary/60",
        isDragging && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div
          className={cn("flex min-w-0 flex-1 items-center gap-2", isAdmin && "cursor-grab")}
          {...(isAdmin ? { ...attributes, ...listeners } : {})}
        >
          <span
            className="inline-block size-2 shrink-0 rounded-full"
            style={{ backgroundColor: stage.color ?? "#94a3b8" }}
          />
          <span className="truncate text-sm font-medium">{stage.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">({leads.length})</span>
        </div>
        {isAdmin && (
          <div className="relative">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Menu da coluna"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal className="size-4" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-popover p-1 shadow-md">
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setRenaming(true);
                    setMenuOpen(false);
                    setNameDraft(stage.name);
                    setColorDraft(stage.color ?? "#94a3b8");
                  }}
                >
                  Renomear / cor
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-destructive hover:bg-muted"
                  onClick={() => {
                    setMenuOpen(false);
                    const others = stages.filter((s) => s.id !== stage.id);
                    if (leads.length > 0) {
                      if (others.length === 0) {
                        alert("Crie outra coluna antes de excluir esta com leads.");
                        return;
                      }
                      const moveTo = window.prompt(
                        `Mover ${leads.length} lead(s) para qual coluna?\n${others.map((s) => `- ${s.name}`).join("\n")}\n\nDigite o nome exato:`,
                        others[0]?.name,
                      );
                      const dest = others.find((s) => s.name === moveTo?.trim());
                      if (!dest) {
                        alert("Coluna destino inválida.");
                        return;
                      }
                      if (!confirm(`Excluir coluna "${stage.name}" e mover leads para "${dest.name}"?`)) return;
                      onDeleteStage(dest.id);
                    } else if (confirm(`Excluir coluna "${stage.name}"?`)) {
                      onDeleteStage();
                    }
                  }}
                >
                  Excluir coluna
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {renaming && (
        <div className="space-y-2 rounded-md border bg-background p-2">
          <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorDraft}
              onChange={(e) => setColorDraft(e.target.value)}
              className="h-8 w-10 rounded border"
            />
            <Button
              size="sm"
              onClick={() => {
                if (!nameDraft.trim()) return;
                onRenameStage(nameDraft.trim(), colorDraft);
                setRenaming(false);
              }}
            >
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            disabled={!canWrite}
            onOpen={() => onEditLead(lead.id)}
          />
        ))}
      </div>

      {canWrite &&
        (creating ? (
          <div className="mt-1 space-y-1">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) {
                  onCreateLead(title.trim());
                  setTitle("");
                  setCreating(false);
                }
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="Título do lead"
              className="h-8 w-full rounded-md border bg-background px-2 text-sm"
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={() => {
                  if (!title.trim()) return;
                  onCreateLead(title.trim());
                  setTitle("");
                  setCreating(false);
                }}
              >
                Adicionar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-1 rounded-md py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            + adicionar lead
          </button>
        ))}
    </div>
  );
}

function LeadCard({
  lead,
  dragging = false,
  disabled = false,
  onOpen,
}: {
  lead: Lead;
  dragging?: boolean;
  disabled?: boolean;
  onOpen?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: lead.id,
    disabled,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border bg-background p-3 shadow-sm hover:shadow-md",
        !disabled && "cursor-grab",
        dragging && "opacity-90 rotate-1",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.();
          }}
        >
          <div className="text-sm font-medium">{lead.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{lead.contactName}</div>
        </button>
        {!disabled && (
          <button
            type="button"
            className="shrink-0 cursor-grab touch-none p-1 text-muted-foreground"
            aria-label="Arrastar"
            {...listeners}
            {...attributes}
          >
            ⠿
          </button>
        )}
      </div>
      {lead.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.tags.map((t) => (
            <span
              key={t.id}
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: t.color }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
      {lead.value != null && lead.value > 0 && (
        <div className="mt-2 text-xs font-medium text-emerald-600">
          {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.value)}
        </div>
      )}
    </div>
  );
}

function LeadEditSheet({
  open,
  lead,
  orgTags,
  canWrite,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean;
  lead: Lead | null;
  orgTags: OrgTag[];
  canWrite: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: {
    title?: string;
    value?: number | null;
    description?: string | null;
    status?: "open" | "won" | "lost";
    tags?: LeadTag[];
    tagIds?: string[];
  }) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"open" | "won" | "lost">("open");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (!lead) return;
    setTitle(lead.title);
    setValue(lead.value != null ? String(lead.value) : "");
    setDescription(lead.description ?? "");
    setStatus(lead.status);
    setSelectedTagIds(lead.tags.map((t) => t.id));
  }, [lead]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Editar lead</SheetTitle>
          <SheetDescription>
            {canWrite ? "Atualize dados, status e tags." : "Visualização somente leitura."}
          </SheetDescription>
        </SheetHeader>

        {lead && (
          <div className="mt-4 space-y-4 px-4 pb-6">
            <div className="space-y-2">
              <Label htmlFor="lead-title">Título</Label>
              <Input
                id="lead-title"
                value={title}
                disabled={!canWrite}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-value">Valor (R$)</Label>
              <Input
                id="lead-value"
                type="number"
                min={0}
                step="0.01"
                value={value}
                disabled={!canWrite}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-desc">Notas</Label>
              <Textarea
                id="lead-desc"
                value={description}
                disabled={!canWrite}
                rows={3}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-status">Status</Label>
              <select
                id="lead-status"
                value={status}
                disabled={!canWrite}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                onChange={(e) => setStatus(e.target.value as "open" | "won" | "lost")}
              >
                <option value="open">Aberto</option>
                <option value="won">Ganho</option>
                <option value="lost">Perdido</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {orgTags.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma tag. Crie em Configurações → Tags.
                  </p>
                )}
                {orgTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={!canWrite}
                      onClick={() => {
                        setSelectedTagIds((prev) =>
                          selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id],
                        );
                      }}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs",
                        selected ? "text-white" : "bg-background text-foreground",
                      )}
                      style={selected ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {canWrite && (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  onClick={() => {
                    const parsedValue =
                      value.trim() === "" ? null : Number.parseFloat(value.replace(",", "."));
                    onSave({
                      title: title.trim() || lead.title,
                      value: Number.isFinite(parsedValue) ? parsedValue : lead.value,
                      description,
                      status,
                      tagIds: selectedTagIds,
                      tags: orgTags.filter((t) => selectedTagIds.includes(t.id)),
                    });
                    onOpenChange(false);
                  }}
                >
                  Salvar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Excluir este lead permanentemente?")) onDelete();
                  }}
                >
                  Excluir
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
