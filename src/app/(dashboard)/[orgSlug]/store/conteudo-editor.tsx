"use client";

import { useEffect, useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Eye, EyeOff, GripVertical, Pencil, ShoppingBag, Calendar, Link2, GraduationCap } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ImageUpload } from "@/components/store/image-upload";
import { addStoreBlock, updateStoreBlock, deleteStoreBlock, reorderStoreBlocks } from "./actions";

interface StoreBlock {
  id: string;
  type: "product" | "booking" | "link" | "course";
  position: number;
  visible: boolean;
  title: string | null;
  description: string | null;
  image_url: string | null;
  cta_text: string;
  external_url: string | null;
  price_display: string | null;
  price_brl: number | null;
  duration_minutes: number | null;
  link_icon: string | null;
  digital_product_id: string | null;
  course_id: string | null;
}

interface DigitalProductOption { id: string; title: string; price_brl: number | null }
interface CourseOption { id: string; title: string; price_brl: number | null }

function externalUrlLabel(blockType: StoreBlock["type"]): string {
  if (blockType === "link") return "URL do link";
  if (blockType === "booking") return "Link de agendamento (opcional)";
  return "Link de checkout externo (opcional)";
}

function externalUrlHelp(blockType: StoreBlock["type"]): string {
  if (blockType === "link") return "Para onde o cliente vai ao clicar neste link.";
  if (blockType === "booking") return "Só preencha se NÃO usar a integração Cal.com (em Integrações). Com o Cal.com conectado, o agendamento acontece direto pelo chat.";
  return 'Deixe em branco: com um preço definido acima, o Inboxy já gera o link de pagamento (Asaas) automaticamente ao clicar em "Comprar". Preencha só se quiser usar um checkout de outro lugar.';
}

const BLOCK_TYPES = [
  { type: "product" as const, label: "Produto", icon: ShoppingBag },
  { type: "course" as const, label: "Curso Online", icon: GraduationCap },
  { type: "booking" as const, label: "Mentoria", icon: Calendar },
  { type: "link" as const, label: "Link", icon: Link2 },
];

function SortableBlockCard({
  block, orgSlug, isEditing, pending, editTitle, editDescription, editImageUrl, editCtaText,
  editExternalUrl, editPriceDisplay, editPriceBrl, editDuration, editLinkIcon,
  editDigitalProductId, editCourseId, digitalProducts, courses,
  onSetEditTitle, onSetEditDescription, onSetEditImageUrl, onSetEditCtaText,
  onSetEditExternalUrl, onSetEditPriceDisplay, onSetEditPriceBrl, onSetEditDuration,
  onSetEditLinkIcon, onSetEditDigitalProductId, onSetEditCourseId,
  onToggleVisibility, onDelete, onEdit, onSave, onCancelEdit,
}: {
  block: StoreBlock; orgSlug: string; isEditing: boolean; pending: boolean;
  editTitle: string; editDescription: string; editImageUrl: string; editCtaText: string;
  editExternalUrl: string; editPriceDisplay: string; editPriceBrl: string; editDuration: string;
  editLinkIcon: string; editDigitalProductId: string; editCourseId: string;
  digitalProducts: DigitalProductOption[]; courses: CourseOption[];
  onSetEditTitle: (v: string) => void; onSetEditDescription: (v: string) => void;
  onSetEditImageUrl: (v: string) => void; onSetEditCtaText: (v: string) => void;
  onSetEditExternalUrl: (v: string) => void; onSetEditPriceDisplay: (v: string) => void;
  onSetEditPriceBrl: (v: string) => void; onSetEditDuration: (v: string) => void;
  onSetEditLinkIcon: (v: string) => void; onSetEditDigitalProductId: (v: string) => void;
  onSetEditCourseId: (v: string) => void; onToggleVisibility: () => void;
  onDelete: () => void; onEdit: () => void; onSave: () => void; onCancelEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : undefined };
  const blockType = block.type;

  return (
    <Card ref={setNodeRef} style={style} className={`p-4 ${!block.visible ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <button type="button" className="cursor-grab touch-none text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
          <GripVertical className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {blockType === "product" ? "Produto" : blockType === "course" ? "Curso" : blockType === "booking" ? "Mentoria" : "Link"}
            </Badge>
            <span className="font-medium truncate">{block.title || "Sem título"}</span>
          </div>
          {block.external_url && <p className="mt-1 text-xs text-muted-foreground truncate">{block.external_url}</p>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} disabled={pending}><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={onToggleVisibility} disabled={pending}>
            {block.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} disabled={pending}><Trash2 className="size-4 text-destructive" /></Button>
        </div>
      </div>

      {isEditing && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={editTitle} onChange={(e) => onSetEditTitle(e.target.value)} />
          </div>
          {blockType !== "link" && (
            <>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={editDescription} onChange={(e) => onSetEditDescription(e.target.value)} rows={2} />
              </div>
              <ImageUpload value={editImageUrl} onChange={onSetEditImageUrl} orgSlug={orgSlug} />
            </>
          )}
          {blockType === "product" && (
            <>
              <div className="space-y-2">
                <Label>Vincular a um produto digital (opcional)</Label>
                <select value={editDigitalProductId} onChange={(e) => onSetEditDigitalProductId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Nenhum — produto físico/serviço</option>
                  {digitalProducts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              {!editDigitalProductId && (
                <>
                  <div className="space-y-2">
                    <Label>Preço (R$)</Label>
                    <Input type="number" step="0.01" min="0" value={editPriceBrl} onChange={(e) => onSetEditPriceBrl(e.target.value)} placeholder="97.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço (texto para exibição)</Label>
                    <Input value={editPriceDisplay} onChange={(e) => onSetEditPriceDisplay(e.target.value)} placeholder="R$ 97,00" />
                  </div>
                </>
              )}
            </>
          )}
          {blockType === "course" && (
            <div className="space-y-2">
              <Label>Curso vinculado</Label>
              <select value={editCourseId} onChange={(e) => onSetEditCourseId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Selecione um curso</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          )}
          {blockType === "booking" && (
            <div className="space-y-2">
              <Label>Curso de mentoria vinculado</Label>
              <select value={editCourseId} onChange={(e) => onSetEditCourseId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Selecione um curso de mentoria</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          )}
          {!editDigitalProductId && !editCourseId && !(blockType === "product" && Number(editPriceBrl) > 0) && blockType !== "course" && (
            <div className="space-y-2">
              <Label>{externalUrlLabel(blockType)}</Label>
              <Input value={editExternalUrl} onChange={(e) => onSetEditExternalUrl(e.target.value)} placeholder="https://..." />
              <p className="text-xs text-muted-foreground">{externalUrlHelp(blockType)}</p>
            </div>
          )}
          {blockType !== "link" && (
            <div className="space-y-2">
              <Label>Texto do botão</Label>
              <Input value={editCtaText} onChange={(e) => onSetEditCtaText(e.target.value)} />
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={onSave} disabled={pending} size="sm">{pending ? "Salvando..." : "Salvar"}</Button>
            <Button variant="ghost" size="sm" onClick={onCancelEdit}>Cancelar</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

interface Props {
  orgSlug: string;
  initialBlocks: StoreBlock[];
  digitalProducts: DigitalProductOption[];
  courses: CourseOption[];
}

export function StoreConteudoEditor({ orgSlug, initialBlocks, digitalProducts, courses }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [addingBlockType, setAddingBlockType] = useState<"product" | "booking" | "link" | "course" | null>(null);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);

  useEffect(() => { setBlocks(initialBlocks); }, [initialBlocks]);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newCtaText, setNewCtaText] = useState("");
  const [newExternalUrl, setNewExternalUrl] = useState("");
  const [newPriceDisplay, setNewPriceDisplay] = useState("");
  const [newPriceBrl, setNewPriceBrl] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newLinkIcon, setNewLinkIcon] = useState("");
  const [newDigitalProductId, setNewDigitalProductId] = useState("");
  const [newCourseId, setNewCourseId] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editCtaText, setEditCtaText] = useState("");
  const [editExternalUrl, setEditExternalUrl] = useState("");
  const [editPriceDisplay, setEditPriceDisplay] = useState("");
  const [editPriceBrl, setEditPriceBrl] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editLinkIcon, setEditLinkIcon] = useState("");
  const [editDigitalProductId, setEditDigitalProductId] = useState("");
  const [editCourseId, setEditCourseId] = useState("");

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function showMessage(type: "ok" | "err", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  function resetBlockForm() {
    setNewTitle(""); setNewDescription(""); setNewImageUrl(""); setNewCtaText("");
    setNewExternalUrl(""); setNewPriceDisplay(""); setNewPriceBrl(""); setNewDuration("");
    setNewLinkIcon(""); setNewDigitalProductId(""); setNewCourseId("");
    setAddingBlockType(null);
  }

  function handleAddBlock() {
    if (!addingBlockType) return;
    startTransition(async () => {
      const r = await addStoreBlock({
        orgSlug, type: addingBlockType, title: newTitle, description: newDescription,
        imageUrl: newImageUrl, ctaText: newCtaText || (addingBlockType === "booking" ? "Agendar" : "Comprar"),
        externalUrl: newExternalUrl, priceDisplay: newPriceDisplay,
        priceBrl: newPriceBrl ? parseFloat(newPriceBrl) : undefined,
        durationMinutes: newDuration ? parseInt(newDuration) : undefined,
        linkIcon: newLinkIcon, digitalProductId: newDigitalProductId || undefined,
        courseId: newCourseId || undefined,
      });
      if (r.error) showMessage("err", r.error);
      else { showMessage("ok", "Bloco adicionado!"); resetBlockForm(); router.refresh(); }
    });
  }

  function handleToggleBlockVisibility(block: StoreBlock) {
    const newVisible = !block.visible;
    setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, visible: newVisible } : b)));
    startTransition(async () => {
      const r = await updateStoreBlock({ orgSlug, blockId: block.id, visible: newVisible });
      if (r.error) { setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, visible: !newVisible } : b))); showMessage("err", r.error); }
    });
  }

  function handleDeleteBlock(blockId: string) {
    const prev = blocks;
    setBlocks((b) => b.filter((x) => x.id !== blockId));
    startTransition(async () => {
      const r = await deleteStoreBlock(orgSlug, blockId);
      if (r.error) { setBlocks(prev); showMessage("err", r.error); }
      else showMessage("ok", "Bloco removido.");
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newBlocks = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(newBlocks);
    startTransition(async () => {
      const r = await reorderStoreBlocks(orgSlug, newBlocks.map((b) => b.id));
      if (r.error) showMessage("err", r.error);
    });
  }

  function startEditingBlock(block: StoreBlock) {
    setEditingBlock(block.id);
    setEditTitle(block.title ?? ""); setEditDescription(block.description ?? "");
    setEditImageUrl(block.image_url ?? ""); setEditCtaText(block.cta_text);
    setEditExternalUrl(block.external_url ?? ""); setEditPriceDisplay(block.price_display ?? "");
    setEditPriceBrl(block.price_brl?.toString() ?? ""); setEditDuration(block.duration_minutes?.toString() ?? "");
    setEditLinkIcon(block.link_icon ?? ""); setEditDigitalProductId(block.digital_product_id ?? "");
    setEditCourseId(block.course_id ?? "");
  }

  function handleSaveBlock(block: StoreBlock) {
    startTransition(async () => {
      const r = await updateStoreBlock({
        orgSlug, blockId: block.id, title: editTitle, description: editDescription,
        imageUrl: editImageUrl, ctaText: editCtaText, externalUrl: editExternalUrl,
        priceDisplay: editPriceDisplay, priceBrl: editPriceBrl ? parseFloat(editPriceBrl) : null,
        durationMinutes: editDuration ? parseInt(editDuration) : null,
        linkIcon: editLinkIcon, digitalProductId: editDigitalProductId || null,
        courseId: editCourseId || null,
      });
      if (r.error) showMessage("err", r.error);
      else { showMessage("ok", "Bloco atualizado!"); setEditingBlock(null); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className={message.type === "ok" ? "text-sm text-green-600" : "text-sm text-destructive"}>
          {message.text}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{blocks.length} bloco(s)</p>
        {!addingBlockType && (
          <div className="flex gap-2 flex-wrap">
            {BLOCK_TYPES.map((bt) => (
              <Button key={bt.type} variant="outline" size="sm" onClick={() => setAddingBlockType(bt.type)}>
                <bt.icon className="size-4 mr-1" /> {bt.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {addingBlockType && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Novo {BLOCK_TYPES.find((b) => b.type === addingBlockType)?.label}</h3>
            <Button variant="ghost" size="sm" onClick={resetBlockForm}>Cancelar</Button>
          </div>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Nome do produto, mentoria ou link" />
          </div>
          {addingBlockType !== "link" && (
            <>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Descrição curta" rows={2} />
              </div>
              <ImageUpload value={newImageUrl} onChange={setNewImageUrl} orgSlug={orgSlug} />
            </>
          )}
          {addingBlockType === "product" && (
            <>
              <div className="space-y-2">
                <Label>Vincular a um produto digital (opcional)</Label>
                <select value={newDigitalProductId} onChange={(e) => setNewDigitalProductId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Nenhum — produto físico/serviço</option>
                  {digitalProducts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">
                  Vincule um produto já criado em{" "}
                  <Link href={`/${orgSlug}/products`} className="underline">Produtos Digitais</Link>
                  {" "}para entrega automática por e-mail.
                </p>
              </div>
              {!newDigitalProductId && (
                <>
                  <div className="space-y-2">
                    <Label>Preço (R$)</Label>
                    <Input type="number" step="0.01" min="0" value={newPriceBrl} onChange={(e) => setNewPriceBrl(e.target.value)} placeholder="97.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço (texto para exibição)</Label>
                    <Input value={newPriceDisplay} onChange={(e) => setNewPriceDisplay(e.target.value)} placeholder="R$ 97,00" />
                  </div>
                </>
              )}
            </>
          )}
          {addingBlockType === "course" && (
            <div className="space-y-2">
              <Label>Curso vinculado</Label>
              <select value={newCourseId} onChange={(e) => setNewCourseId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Selecione um curso</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">
                Selecione o curso criado em{" "}
                <Link href={`/${orgSlug}/courses`} className="underline">Cursos Online</Link>
                {" "}para gerar o checkout automaticamente.
              </p>
            </div>
          )}
          {addingBlockType === "booking" && (
            <div className="space-y-2">
              <Label>Curso de mentoria vinculado</Label>
              <select value={newCourseId} onChange={(e) => setNewCourseId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Selecione um curso de mentoria</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          )}
          {!newDigitalProductId && !newCourseId && !(addingBlockType === "product" && Number(newPriceBrl) > 0) && addingBlockType !== "course" && (
            <div className="space-y-2">
              <Label>{externalUrlLabel(addingBlockType)}</Label>
              <Input value={newExternalUrl} onChange={(e) => setNewExternalUrl(e.target.value)} placeholder="https://..." />
              <p className="text-xs text-muted-foreground">{externalUrlHelp(addingBlockType)}</p>
            </div>
          )}
          {addingBlockType !== "link" && (
            <div className="space-y-2">
              <Label>Texto do botão</Label>
              <Input value={newCtaText} onChange={(e) => setNewCtaText(e.target.value)} placeholder={addingBlockType === "booking" ? "Agendar" : "Comprar"} />
            </div>
          )}
          <Button onClick={handleAddBlock} disabled={pending}>{pending ? "Adicionando..." : "Adicionar bloco"}</Button>
        </Card>
      )}

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {blocks.map((block) => (
              <SortableBlockCard
                key={block.id}
                block={block}
                orgSlug={orgSlug}
                isEditing={editingBlock === block.id}
                pending={pending}
                editTitle={editTitle} editDescription={editDescription} editImageUrl={editImageUrl}
                editCtaText={editCtaText} editExternalUrl={editExternalUrl} editPriceDisplay={editPriceDisplay}
                editPriceBrl={editPriceBrl} editDuration={editDuration} editLinkIcon={editLinkIcon}
                editDigitalProductId={editDigitalProductId} editCourseId={editCourseId}
                digitalProducts={digitalProducts} courses={courses}
                onSetEditTitle={setEditTitle} onSetEditDescription={setEditDescription}
                onSetEditImageUrl={setEditImageUrl} onSetEditCtaText={setEditCtaText}
                onSetEditExternalUrl={setEditExternalUrl} onSetEditPriceDisplay={setEditPriceDisplay}
                onSetEditPriceBrl={setEditPriceBrl} onSetEditDuration={setEditDuration}
                onSetEditLinkIcon={setEditLinkIcon} onSetEditDigitalProductId={setEditDigitalProductId}
                onSetEditCourseId={setEditCourseId}
                onToggleVisibility={() => handleToggleBlockVisibility(block)}
                onDelete={() => handleDeleteBlock(block.id)}
                onEdit={() => startEditingBlock(block)}
                onSave={() => handleSaveBlock(block)}
                onCancelEdit={() => setEditingBlock(null)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
