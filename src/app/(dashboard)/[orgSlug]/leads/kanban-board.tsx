"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { moveLead, createLead } from "./actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  position: number;
  color: string | null;
}

interface Lead {
  id: string;
  title: string;
  value: number | null;
  stageId: string;
  position: number;
  contactName: string;
}

interface Props {
  orgSlug: string;
  pipelineId: string;
  stages: Stage[];
  leads: Lead[];
}

export function KanbanBoard({ orgSlug, pipelineId, stages, leads: initial }: Props) {
  const [leads, setLeads] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

    const leadId = String(e.active.id);
    const targetStageId = String(e.over.id);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stageId === targetStageId) return;

    // Optimistic: append to end of target stage
    const nextPosition = (byStage.get(targetStageId)?.length ?? 0) * 1000;
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stageId: targetStageId, position: nextPosition } : l)),
    );

    startTransition(async () => {
      const res = await moveLead({ orgSlug, leadId, targetStageId, targetPosition: nextPosition });
      if (res.error) {
        setLeads(initial); // rollback
      }
    });
  }

  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <Column
            key={stage.id}
            stage={stage}
            leads={byStage.get(stage.id) ?? []}
            orgSlug={orgSlug}
            pipelineId={pipelineId}
          />
        ))}
      </div>

      <DragOverlay>{activeLead ? <LeadCard lead={activeLead} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({
  stage,
  leads,
  orgSlug,
  pipelineId,
}: {
  stage: Stage;
  leads: Lead[];
  orgSlug: string;
  pipelineId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [, startTransition] = useTransition();

  function handleCreate() {
    if (!title.trim()) return;
    startTransition(async () => {
      await createLead({ orgSlug, pipelineId, stageId: stage.id, title: title.trim() });
      setTitle("");
      setCreating(false);
    });
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-3",
        isOver && "ring-2 ring-primary/60",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: stage.color ?? "#94a3b8" }}
          />
          <span className="text-sm font-medium">{stage.name}</span>
          <span className="text-xs text-muted-foreground">({leads.length})</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>

      {creating ? (
        <div className="mt-1 space-y-1">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder="Título do lead"
            className="h-8 w-full rounded-md border bg-background px-2 text-sm"
          />
          <div className="flex gap-1">
            <Button size="sm" onClick={handleCreate}>
              Adicionar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mt-1 rounded-md py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          + adicionar lead
        </button>
      )}
    </div>
  );
}

function LeadCard({ lead, dragging = false }: { lead: Lead; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: lead.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab rounded-md border bg-background p-3 shadow-sm hover:shadow-md",
        dragging && "opacity-90 rotate-1",
      )}
    >
      <div className="text-sm font-medium">{lead.title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{lead.contactName}</div>
      {lead.value != null && (
        <div className="mt-2 text-xs font-medium text-emerald-600">
          {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.value)}
        </div>
      )}
    </div>
  );
}
