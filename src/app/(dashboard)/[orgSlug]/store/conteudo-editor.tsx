"use client";

import { useEffect, useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus, Trash2, Eye, EyeOff, GripVertical, Pencil, ShoppingBag, Calendar, Link2, GraduationCap, Megaphone, ChevronDown, ChevronUp } from "lucide-react";
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
import { addStoreBlock, updateStoreBlock, deleteStoreBlock, reorderStoreBlocks, upsertStoreBanner, deleteStoreBanner } from "./actions";

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

interface StoreBanner {
  id?: string;
  text: string;
  link_url: string | null;
  link_product_id: string | null;
  link_course_id: string | null;
  link_label: string | null;
  visible_from: string | null;
  visible_until: string | null;
  active: boolean;
  discount_id: string | null;
}

interface DiscountOption { id: string; code: string; percent_off: number | null; amount_off_brl: number | null }

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function fromDatetimeLocal(val: string): string | null {
  if (!val) return null;
  return new Date(val).toISOString();
}

function BannerEditor({
  orgSlug,
  initialBanner,
  digitalProducts,
  courses,
  discounts,
}: {
  orgSlug: string;
  initialBanner: StoreBanner | null;
  digitalProducts: DigitalProductOption[];
  courses: CourseOption[];
  discounts: DiscountOption[];
}) {
  const tc = useTranslations("common");
  const [open, setOpen] = useState(!!initialBanner);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [active, setActive] = useState(initialBanner?.active ?? true);
  const [text, setText] = useState(initialBanner?.text ?? "");
  const [linkType, setLinkType] = useState<"none" | "url" | "product" | "course">(
    initialBanner?.link_product_id ? "product"
    : initialBanner?.link_course_id ? "course"
    : initialBanner?.link_url ? "url"
    : "none",
  );
  const [linkUrl, setLinkUrl] = useState(initialBanner?.link_url ?? "");
  const [linkProductId, setLinkProductId] = useState(initialBanner?.link_product_id ?? "");
  const [linkCourseId, setLinkCourseId] = useState(initialBanner?.link_course_id ?? "");
  const [linkLabel, setLinkLabel] = useState(initialBanner?.link_label ?? "");
  const [visibleFrom, setVisibleFrom] = useState(toDatetimeLocal(initialBanner?.visible_from));
  const [visibleUntil, setVisibleUntil] = useState(toDatetimeLocal(initialBanner?.visible_until));
  const [discountId, setDiscountId] = useState(initialBanner?.discount_id ?? "");

  function showMessage(type: "ok" | "err", t: string) {
    setMessage({ type, text: t });
    setTimeout(() => setMessage(null), 3000);
  }

  function handleSave() {
    startTransition(async () => {
      const r = await upsertStoreBanner({
        orgSlug,
        text,
        active,
        linkUrl: linkType === "url" ? linkUrl : "",
        linkProductId: linkType === "product" ? linkProductId || null : null,
        linkCourseId: linkType === "course" ? linkCourseId || null : null,
        linkLabel,
        visibleFrom: fromDatetimeLocal(visibleFrom) ?? "",
        visibleUntil: fromDatetimeLocal(visibleUntil) ?? "",
        discountId: discountId || null,
      });
      if (r.error) showMessage("err", r.error);
      else showMessage("ok", "Banner salvo!");
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteStoreBanner(orgSlug);
      setText(""); setLinkType("none"); setLinkUrl(""); setLinkProductId("");
      setLinkCourseId(""); setLinkLabel(""); setVisibleFrom(""); setVisibleUntil(""); setDiscountId("");
      setOpen(false);
      showMessage("ok", "Banner removido.");
    });
  }

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Megaphone className="size-4" />
          Banner
          {initialBanner?.active && (
            <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">Ativo</span>
          )}
        </div>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">Faixa no topo da loja com texto e link opcional. Clicável e dispensável pelo visitante.</p>

          {message && (
            <p className={`text-xs ${message.type === "ok" ? "text-green-600" : "text-destructive"}`}>{message.text}</p>
          )}

          <div className="flex items-center gap-2">
            <input
              id="banner-active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4"
            />
            <Label htmlFor="banner-active" className="cursor-pointer">Ativo</Label>
          </div>

          <div className="space-y-2">
            <Label>Texto do banner</Label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="🔥 50% off no curso de Growth — só até domingo!"
              maxLength={300}
            />
          </div>

          <div className="space-y-2">
            <Label>Link</Label>
            <div className="flex gap-2 flex-wrap">
              {(["none", "url", "product", "course"] as const).map((lt) => (
                <button
                  key={lt}
                  type="button"
                  onClick={() => setLinkType(lt)}
                  className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${linkType === lt ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"}`}
                >
                  {lt === "none" ? "Nenhum" : lt === "url" ? "URL externa" : lt === "product" ? "Produto" : "Curso"}
                </button>
              ))}
            </div>
            {linkType === "url" && (
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
            )}
            {linkType === "product" && (
              <select value={linkProductId} onChange={(e) => setLinkProductId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Selecione um produto</option>
                {digitalProducts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            )}
            {linkType === "course" && (
              <select value={linkCourseId} onChange={(e) => setLinkCourseId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Selecione um curso</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            )}
          </div>

          {linkType !== "none" && (
            <div className="space-y-2">
              <Label>Texto do botão <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Aproveitar agora" maxLength={80} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Exibir de <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input type="datetime-local" value={visibleFrom} onChange={(e) => setVisibleFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Exibir até <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input type="datetime-local" value={visibleUntil} onChange={(e) => setVisibleUntil(e.target.value)} />
            </div>
          </div>

          {discounts.length > 0 && (
            <div className="space-y-2">
              <Label>Desconto vinculado <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <select value={discountId} onChange={(e) => setDiscountId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Nenhum</option>
                {discounts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.percent_off ? `${d.percent_off}% off` : `R$ ${Number(d.amount_off_brl).toFixed(2).replace(".", ",")} off`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Ao clicar no link do banner, o desconto será aplicado automaticamente.</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={pending || !text.trim()} size="sm">
              {pending ? tc("saving") : tc("save")}
            </Button>
            {initialBanner && (
              <Button variant="ghost" size="sm" onClick={handleDelete} disabled={pending} className="text-destructive hover:text-destructive">
                <Trash2 className="size-4 mr-1" /> Remover banner
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

type TStore = ReturnType<typeof useTranslations<"store">>;

function externalUrlLabel(blockType: StoreBlock["type"], t: TStore): string {
  if (blockType === "link") return t("externalUrl");
  if (blockType === "booking") return t("externalUrlBooking");
  return t("externalUrlCheckout");
}

function externalUrlHelp(blockType: StoreBlock["type"], t: TStore): string {
  return t("externalUrlHelp");
}

function getBlockTypes(t: TStore) {
  return [
    { type: "product" as const, label: t("blockProduct"), icon: ShoppingBag },
    { type: "course" as const, label: t("blockCourse"), icon: GraduationCap },
    { type: "booking" as const, label: t("blockMentoring"), icon: Calendar },
    { type: "link" as const, label: t("blockLink"), icon: Link2 },
  ];
}

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
  const t = useTranslations("store");
  const tc = useTranslations("common");
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
              {blockType === "product" ? t("blockProduct") : blockType === "course" ? t("blockCourse") : blockType === "booking" ? t("blockMentoring") : t("blockLink")}
            </Badge>
            <span className="font-medium truncate">{block.title || t("noTitle")}</span>
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
            <Label>{t("blockTitle")}</Label>
            <Input value={editTitle} onChange={(e) => onSetEditTitle(e.target.value)} />
          </div>
          {blockType !== "link" && (
            <>
              <div className="space-y-2">
                <Label>{t("blockDescription")}</Label>
                <Textarea value={editDescription} onChange={(e) => onSetEditDescription(e.target.value)} rows={2} />
              </div>
              <ImageUpload value={editImageUrl} onChange={onSetEditImageUrl} orgSlug={orgSlug} />
            </>
          )}
          {blockType === "product" && (
            <>
              <div className="space-y-2">
                <Label>{t("linkDigitalProduct")}</Label>
                <select value={editDigitalProductId} onChange={(e) => onSetEditDigitalProductId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">{t("noDigitalProduct")}</option>
                  {digitalProducts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              {!editDigitalProductId && (
                <>
                  <div className="space-y-2">
                    <Label>{t("priceBrl")}</Label>
                    <Input type="number" step="0.01" min="0" value={editPriceBrl} onChange={(e) => onSetEditPriceBrl(e.target.value)} placeholder="97.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("priceDisplay")}</Label>
                    <Input value={editPriceDisplay} onChange={(e) => onSetEditPriceDisplay(e.target.value)} placeholder="R$ 97,00" />
                  </div>
                </>
              )}
            </>
          )}
          {blockType === "course" && (
            <div className="space-y-2">
              <Label>{t("linkedCourse")}</Label>
              <select value={editCourseId} onChange={(e) => onSetEditCourseId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">{t("selectCourse")}</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          )}
          {blockType === "booking" && (
            <div className="space-y-2">
              <Label>{t("linkedMentoringCourse")}</Label>
              <select value={editCourseId} onChange={(e) => onSetEditCourseId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">{t("selectMentoringCourse")}</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          )}
          {!editDigitalProductId && !editCourseId && !(blockType === "product" && Number(editPriceBrl) > 0) && blockType !== "course" && (
            <div className="space-y-2">
              <Label>{externalUrlLabel(blockType, t)}</Label>
              <Input value={editExternalUrl} onChange={(e) => onSetEditExternalUrl(e.target.value)} placeholder="https://..." />
              <p className="text-xs text-muted-foreground">{externalUrlHelp(blockType, t)}</p>
            </div>
          )}
          {blockType !== "link" && (
            <div className="space-y-2">
              <Label>{t("ctaText")}</Label>
              <Input value={editCtaText} onChange={(e) => onSetEditCtaText(e.target.value)} />
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={onSave} disabled={pending} size="sm">{pending ? tc("saving") : tc("save")}</Button>
            <Button variant="ghost" size="sm" onClick={onCancelEdit}>{tc("cancel")}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

interface Props {
  orgSlug: string;
  initialBlocks: StoreBlock[];
  initialBanner: StoreBanner | null;
  digitalProducts: DigitalProductOption[];
  courses: CourseOption[];
  discounts: DiscountOption[];
}

export function StoreConteudoEditor({ orgSlug, initialBlocks, initialBanner, digitalProducts, courses, discounts }: Props) {
  const router = useRouter();
  const t = useTranslations("store");
  const tc = useTranslations("common");
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
      else { showMessage("ok", t("blockAdded")); resetBlockForm(); router.refresh(); }
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
      else showMessage("ok", t("blockRemoved"));
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
      else { showMessage("ok", t("blockUpdated")); setEditingBlock(null); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      <BannerEditor
        orgSlug={orgSlug}
        initialBanner={initialBanner}
        digitalProducts={digitalProducts}
        courses={courses}
        discounts={discounts}
      />

      {message && (
        <p className={message.type === "ok" ? "text-sm text-green-600" : "text-sm text-destructive"}>
          {message.text}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("blocks", { count: blocks.length })}</p>
        {!addingBlockType && (
          <div className="flex gap-2 flex-wrap">
            {getBlockTypes(t).map((bt) => (
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
            <h3 className="font-semibold">{getBlockTypes(t).find((b) => b.type === addingBlockType)?.label}</h3>
            <Button variant="ghost" size="sm" onClick={resetBlockForm}>{tc("cancel")}</Button>
          </div>
          <div className="space-y-2">
            <Label>{t("blockTitle")}</Label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t("blockTitlePlaceholder")} />
          </div>
          {addingBlockType !== "link" && (
            <>
              <div className="space-y-2">
                <Label>{t("blockDescription")}</Label>
                <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder={t("blockDescriptionPlaceholder")} rows={2} />
              </div>
              <ImageUpload value={newImageUrl} onChange={setNewImageUrl} orgSlug={orgSlug} />
            </>
          )}
          {addingBlockType === "product" && (
            <>
              <div className="space-y-2">
                <Label>{t("linkDigitalProduct")}</Label>
                <select value={newDigitalProductId} onChange={(e) => setNewDigitalProductId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">{t("noDigitalProduct")}</option>
                  {digitalProducts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">
                  <Link href={`/${orgSlug}/products`} className="underline">{t("blockProduct")}</Link>
                </p>
              </div>
              {!newDigitalProductId && (
                <>
                  <div className="space-y-2">
                    <Label>{t("priceBrl")}</Label>
                    <Input type="number" step="0.01" min="0" value={newPriceBrl} onChange={(e) => setNewPriceBrl(e.target.value)} placeholder="97.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("priceDisplay")}</Label>
                    <Input value={newPriceDisplay} onChange={(e) => setNewPriceDisplay(e.target.value)} placeholder="R$ 97,00" />
                  </div>
                </>
              )}
            </>
          )}
          {addingBlockType === "course" && (
            <div className="space-y-2">
              <Label>{t("linkedCourse")}</Label>
              <select value={newCourseId} onChange={(e) => setNewCourseId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">{t("selectCourse")}</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">
                <Link href={`/${orgSlug}/courses`} className="underline">{t("blockCourse")}</Link>
              </p>
            </div>
          )}
          {addingBlockType === "booking" && (
            <div className="space-y-2">
              <Label>{t("linkedMentoringCourse")}</Label>
              <select value={newCourseId} onChange={(e) => setNewCourseId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">{t("selectMentoringCourse")}</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          )}
          {!newDigitalProductId && !newCourseId && !(addingBlockType === "product" && Number(newPriceBrl) > 0) && addingBlockType !== "course" && (
            <div className="space-y-2">
              <Label>{externalUrlLabel(addingBlockType, t)}</Label>
              <Input value={newExternalUrl} onChange={(e) => setNewExternalUrl(e.target.value)} placeholder="https://..." />
              <p className="text-xs text-muted-foreground">{externalUrlHelp(addingBlockType, t)}</p>
            </div>
          )}
          {addingBlockType !== "link" && (
            <div className="space-y-2">
              <Label>{t("ctaText")}</Label>
              <Input value={newCtaText} onChange={(e) => setNewCtaText(e.target.value)} />
            </div>
          )}
          <Button onClick={handleAddBlock} disabled={pending}>{pending ? t("adding") : t("addBlock")}</Button>
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
