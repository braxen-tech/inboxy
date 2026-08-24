"use client";

import { useEffect, useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  LayoutGrid,
  MessageCircle,
  BarChart3,
  Palette,
  ExternalLink,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  ShoppingBag,
  Calendar,
  Link2,
} from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { StoreTheme } from "@/lib/store-theme";
import {
  saveStoreProfile,
  toggleStoreEnabled,
  saveStoreTheme,
  saveStoreChatConfig,
  addStoreBlock,
  updateStoreBlock,
  deleteStoreBlock,
  reorderStoreBlocks,
} from "./actions";

interface SocialLink {
  id: string;
  platform: string;
  url: string;
}

interface StoreBlock {
  id: string;
  type: "product" | "booking" | "link";
  position: number;
  visible: boolean;
  title: string | null;
  description: string | null;
  image_url: string | null;
  cta_text: string;
  external_url: string | null;
  price_display: string | null;
  duration_minutes: number | null;
  link_icon: string | null;
}

interface StoreEditorProps {
  orgSlug: string;
  orgId: string;
  storeEnabled: boolean;
  displayName: string;
  bio: string;
  photoUrl: string;
  socialLinks: SocialLink[];
  blocks: StoreBlock[];
  theme: StoreTheme;
  chatEnabled: boolean;
  chatWebsiteToken: string;
  chatTrigger: string;
  chatTriggerSeconds: number;
  chatGreeting: string;
  chatwootConnected: boolean;
  subscriptionPlan: string;
}

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "Twitter/X" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "E-mail" },
  { value: "website", label: "Website" },
];

const BLOCK_TYPES = [
  { type: "product" as const, label: "Produto", icon: ShoppingBag, description: "Ebook, curso, template — link para checkout" },
  { type: "booking" as const, label: "Mentoria", icon: Calendar, description: "Sessão 1:1 — link para agendamento" },
  { type: "link" as const, label: "Link", icon: Link2, description: "Podcast, YouTube, afiliados" },
];

function SortableBlockCard({
  block,
  isEditing,
  pending,
  blockType,
  editTitle,
  editDescription,
  editImageUrl,
  editCtaText,
  editExternalUrl,
  editPriceDisplay,
  editDuration,
  editLinkIcon,
  onSetEditTitle,
  onSetEditDescription,
  onSetEditImageUrl,
  onSetEditCtaText,
  onSetEditExternalUrl,
  onSetEditPriceDisplay,
  onSetEditDuration,
  onSetEditLinkIcon,
  onToggleVisibility,
  onDelete,
  onEdit,
  onSave,
  onCancelEdit,
}: {
  block: StoreBlock;
  isEditing: boolean;
  pending: boolean;
  blockType: StoreBlock["type"];
  editTitle: string;
  editDescription: string;
  editImageUrl: string;
  editCtaText: string;
  editExternalUrl: string;
  editPriceDisplay: string;
  editDuration: string;
  editLinkIcon: string;
  onSetEditTitle: (v: string) => void;
  onSetEditDescription: (v: string) => void;
  onSetEditImageUrl: (v: string) => void;
  onSetEditCtaText: (v: string) => void;
  onSetEditExternalUrl: (v: string) => void;
  onSetEditPriceDisplay: (v: string) => void;
  onSetEditDuration: (v: string) => void;
  onSetEditLinkIcon: (v: string) => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <Card ref={setNodeRef} style={style} className={`p-4 ${!block.visible ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <button type="button" className="cursor-grab touch-none text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
          <GripVertical className="size-5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {block.type === "product" ? "Produto" : block.type === "booking" ? "Mentoria" : "Link"}
            </Badge>
            <span className="font-medium truncate">{block.title || "Sem título"}</span>
          </div>
          {block.external_url && (
            <p className="mt-1 text-xs text-muted-foreground truncate">{block.external_url}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} disabled={pending}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onToggleVisibility} disabled={pending}>
            {block.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} disabled={pending}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
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
              <div className="space-y-2">
                <Label>URL da imagem</Label>
                <Input value={editImageUrl} onChange={(e) => onSetEditImageUrl(e.target.value)} placeholder="https://..." />
              </div>
            </>
          )}
          {blockType === "product" && (
            <div className="space-y-2">
              <Label>Preço (texto)</Label>
              <Input value={editPriceDisplay} onChange={(e) => onSetEditPriceDisplay(e.target.value)} placeholder="R$ 97,00" />
            </div>
          )}
          {blockType === "booking" && (
            <div className="space-y-2">
              <Label>Duração (minutos)</Label>
              <Input type="number" value={editDuration} onChange={(e) => onSetEditDuration(e.target.value)} placeholder="60" />
            </div>
          )}
          <div className="space-y-2">
            <Label>{blockType === "link" ? "URL do link" : "Link de checkout / agendamento"}</Label>
            <Input value={editExternalUrl} onChange={(e) => onSetEditExternalUrl(e.target.value)} placeholder="https://..." />
          </div>
          {blockType !== "link" && (
            <div className="space-y-2">
              <Label>Texto do botão</Label>
              <Input value={editCtaText} onChange={(e) => onSetEditCtaText(e.target.value)} />
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={onSave} disabled={pending} size="sm">
              {pending ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancelEdit}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function StoreEditor({
  orgSlug,
  orgId,
  storeEnabled: initialEnabled,
  displayName: initialDisplayName,
  bio: initialBio,
  photoUrl: initialPhotoUrl,
  socialLinks: initialSocialLinks,
  blocks: initialBlocks,
  theme: initialTheme,
  chatEnabled: initialChatEnabled,
  chatWebsiteToken: initialChatToken,
  chatTrigger: initialChatTrigger,
  chatTriggerSeconds: initialTriggerSeconds,
  chatGreeting: initialChatGreeting,
  chatwootConnected,
  subscriptionPlan,
}: StoreEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Profile state
  const [enabled, setEnabled] = useState(initialEnabled);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [socialLinks, setSocialLinks] = useState<{ platform: string; url: string }[]>(
    initialSocialLinks.map((l) => ({ platform: l.platform, url: l.url })),
  );

  // Blocks state
  const [blocks, setBlocks] = useState(initialBlocks);
  const [addingBlockType, setAddingBlockType] = useState<"product" | "booking" | "link" | null>(null);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);

  useEffect(() => { setBlocks(initialBlocks); }, [initialBlocks]);

  // New block form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newCtaText, setNewCtaText] = useState("");
  const [newExternalUrl, setNewExternalUrl] = useState("");
  const [newPriceDisplay, setNewPriceDisplay] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newLinkIcon, setNewLinkIcon] = useState("");

  // Chat state
  const [chatEnabled, setChatEnabled] = useState(initialChatEnabled);
  const [chatToken, setChatToken] = useState(initialChatToken);
  const [chatTrigger, setChatTrigger] = useState(initialChatTrigger);
  const [triggerSeconds, setTriggerSeconds] = useState(initialTriggerSeconds);
  const [chatGreeting, setChatGreeting] = useState(initialChatGreeting);

  // Theme state
  const [theme, setTheme] = useState(initialTheme);

  // Analytics state
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [analyticsData, setAnalyticsData] = useState<{
    totalViews: number;
    totalClicks: number;
    totalChats: number;
    ctr: number;
    blockClicks: { blockId: string; blockTitle: string; blockType: string; clicks: number; ctr: number }[];
    dailyViews: { day: string; views: number }[];
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  function loadAnalytics(days: number) {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    fetch(`/api/store/analytics?orgSlug=${orgSlug}&days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setAnalyticsError(data.error);
        else setAnalyticsData(data);
      })
      .catch(() => setAnalyticsError("Erro ao carregar analytics."))
      .finally(() => setAnalyticsLoading(false));
  }

  // Edit block form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editCtaText, setEditCtaText] = useState("");
  const [editExternalUrl, setEditExternalUrl] = useState("");
  const [editPriceDisplay, setEditPriceDisplay] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editLinkIcon, setEditLinkIcon] = useState("");

  // Drag and drop
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const isAllowedPlan = subscriptionPlan === "professional" || subscriptionPlan === "business";

  function showMessage(type: "ok" | "err", text?: string) {
    setMessage({ type, text: text ?? "Erro inesperado." });
    setTimeout(() => setMessage(null), 3000);
  }

  function handleToggleEnabled() {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    startTransition(async () => {
      const r = await toggleStoreEnabled(orgSlug, newEnabled);
      if (r.error) {
        setEnabled(!newEnabled);
        showMessage("err", r.error);
      } else {
        showMessage("ok", newEnabled ? "Loja ativada!" : "Loja desativada.");
      }
    });
  }

  function handleSaveProfile() {
    startTransition(async () => {
      const r = await saveStoreProfile({ orgSlug, displayName, bio, photoUrl, socialLinks });
      if (r.error) showMessage("err", r.error);
      else showMessage("ok", "Perfil salvo!");
      router.refresh();
    });
  }

  function addSocialLink() {
    const usedPlatforms = new Set(socialLinks.map((l) => l.platform));
    const next = PLATFORMS.find((p) => !usedPlatforms.has(p.value));
    if (next) setSocialLinks([...socialLinks, { platform: next.value, url: "" }]);
  }

  function removeSocialLink(index: number) {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  }

  function resetBlockForm() {
    setNewTitle("");
    setNewDescription("");
    setNewImageUrl("");
    setNewCtaText("");
    setNewExternalUrl("");
    setNewPriceDisplay("");
    setNewDuration("");
    setNewLinkIcon("");
    setAddingBlockType(null);
  }

  function handleAddBlock() {
    if (!addingBlockType) return;
    startTransition(async () => {
      const r = await addStoreBlock({
        orgSlug,
        type: addingBlockType,
        title: newTitle,
        description: newDescription,
        imageUrl: newImageUrl,
        ctaText: newCtaText || (addingBlockType === "booking" ? "Agendar" : "Comprar"),
        externalUrl: newExternalUrl,
        priceDisplay: newPriceDisplay,
        durationMinutes: newDuration ? parseInt(newDuration) : undefined,
        linkIcon: newLinkIcon,
      });
      if (r.error) showMessage("err", r.error);
      else {
        showMessage("ok", "Bloco adicionado!");
        resetBlockForm();
        router.refresh();
      }
    });
  }

  function handleToggleBlockVisibility(block: StoreBlock) {
    const newVisible = !block.visible;
    setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, visible: newVisible } : b)));
    startTransition(async () => {
      const r = await updateStoreBlock({ orgSlug, blockId: block.id, visible: newVisible });
      if (r.error) {
        setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, visible: !newVisible } : b)));
        showMessage("err", r.error);
      }
    });
  }

  function handleDeleteBlock(blockId: string) {
    const prev = blocks;
    setBlocks((b) => b.filter((x) => x.id !== blockId));
    startTransition(async () => {
      const r = await deleteStoreBlock(orgSlug, blockId);
      if (r.error) {
        setBlocks(prev);
        showMessage("err", r.error);
      } else {
        showMessage("ok", "Bloco removido.");
      }
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
    setEditTitle(block.title ?? "");
    setEditDescription(block.description ?? "");
    setEditImageUrl(block.image_url ?? "");
    setEditCtaText(block.cta_text);
    setEditExternalUrl(block.external_url ?? "");
    setEditPriceDisplay(block.price_display ?? "");
    setEditDuration(block.duration_minutes?.toString() ?? "");
    setEditLinkIcon(block.link_icon ?? "");
  }

  function cancelEditingBlock() {
    setEditingBlock(null);
  }

  function handleSaveBlock(block: StoreBlock) {
    startTransition(async () => {
      const r = await updateStoreBlock({
        orgSlug,
        blockId: block.id,
        title: editTitle,
        description: editDescription,
        imageUrl: editImageUrl,
        ctaText: editCtaText,
        externalUrl: editExternalUrl,
        priceDisplay: editPriceDisplay,
        durationMinutes: editDuration ? parseInt(editDuration) : null,
        linkIcon: editLinkIcon,
      });
      if (r.error) {
        showMessage("err", r.error);
      } else {
        showMessage("ok", "Bloco atualizado!");
        setEditingBlock(null);
        router.refresh();
      }
    });
  }

  function handleSaveChat() {
    startTransition(async () => {
      const r = await saveStoreChatConfig({
        orgSlug,
        chatEnabled,
        websiteToken: chatToken,
        trigger: chatTrigger as "none" | "timer" | "scroll" | "exit_intent",
        triggerSeconds,
        greeting: chatGreeting,
      });
      if (r.error) showMessage("err", r.error);
      else showMessage("ok", "Configuração de chat salva!");
    });
  }

  function handleSaveTheme() {
    startTransition(async () => {
      const r = await saveStoreTheme({ orgSlug, theme });
      if (r.error) showMessage("err", r.error);
      else showMessage("ok", "Tema salvo!");
    });
  }

  if (!isAllowedPlan) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Minha Loja</h1>
        <Card className="p-8 text-center">
          <ShoppingBag className="mx-auto size-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">Disponível no plano Professional</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie sua página de vendas com produtos, mentorias e chat com IA.
          </p>
          <Link href={`/${orgSlug}/billing`}>
            <Button className="mt-4">Fazer upgrade</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Minha Loja</h1>
        <div className="flex items-center gap-3">
          {enabled && (
            <Link
              href={`/s/${orgSlug}`}
              target="_blank"
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              Ver loja <ExternalLink className="size-3" />
            </Link>
          )}
          <Button
            variant={enabled ? "default" : "outline"}
            size="sm"
            onClick={handleToggleEnabled}
            disabled={pending}
          >
            {enabled ? "Ativa" : "Ativar loja"}
          </Button>
        </div>
      </div>

      {message && (
        <p className={message.type === "ok" ? "text-sm text-green-600" : "text-sm text-destructive"}>
          {message.text}
        </p>
      )}

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><User className="size-4 mr-1" /> Perfil</TabsTrigger>
          <TabsTrigger value="blocks"><LayoutGrid className="size-4 mr-1" /> Blocos</TabsTrigger>
          <TabsTrigger value="chat"><MessageCircle className="size-4 mr-1" /> Chat</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="size-4 mr-1" /> Analytics</TabsTrigger>
          <TabsTrigger value="theme"><Palette className="size-4 mr-1" /> Tema</TabsTrigger>
        </TabsList>

        {/* Tab 1 — Profile */}
        <TabsContent value="profile">
          <div className="mt-6 space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label htmlFor="displayName">Nome de exibição</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome ou marca"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Fale um pouco sobre você..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="photoUrl">URL da foto de perfil</Label>
              <Input
                id="photoUrl"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Redes sociais</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addSocialLink} disabled={socialLinks.length >= 8}>
                  <Plus className="size-4 mr-1" /> Adicionar
                </Button>
              </div>
              {socialLinks.map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={link.platform}
                    onChange={(e) => {
                      const updated = [...socialLinks];
                      updated[i] = { ...updated[i], platform: e.target.value };
                      setSocialLinks(updated);
                    }}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <Input
                    value={link.url}
                    onChange={(e) => {
                      const updated = [...socialLinks];
                      updated[i] = { ...updated[i], url: e.target.value };
                      setSocialLinks(updated);
                    }}
                    placeholder="URL ou e-mail"
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeSocialLink(i)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <Button onClick={handleSaveProfile} disabled={pending}>
              {pending ? "Salvando..." : "Salvar perfil"}
            </Button>
          </div>
        </TabsContent>

        {/* Tab 2 — Blocks */}
        <TabsContent value="blocks">
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{blocks.length} bloco(s)</p>
              {!addingBlockType && (
                <div className="flex gap-2">
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
                  <h3 className="font-semibold">
                    Novo {BLOCK_TYPES.find((b) => b.type === addingBlockType)?.label}
                  </h3>
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
                    <div className="space-y-2">
                      <Label>URL da imagem</Label>
                      <Input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="https://..." />
                    </div>
                  </>
                )}
                {addingBlockType === "product" && (
                  <div className="space-y-2">
                    <Label>Preço (texto)</Label>
                    <Input value={newPriceDisplay} onChange={(e) => setNewPriceDisplay(e.target.value)} placeholder="R$ 97,00" />
                  </div>
                )}
                {addingBlockType === "booking" && (
                  <div className="space-y-2">
                    <Label>Duração (minutos)</Label>
                    <Input type="number" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} placeholder="60" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{addingBlockType === "link" ? "URL do link" : "Link de checkout / agendamento"}</Label>
                  <Input value={newExternalUrl} onChange={(e) => setNewExternalUrl(e.target.value)} placeholder="https://..." />
                </div>
                {addingBlockType !== "link" && (
                  <div className="space-y-2">
                    <Label>Texto do botão</Label>
                    <Input
                      value={newCtaText}
                      onChange={(e) => setNewCtaText(e.target.value)}
                      placeholder={addingBlockType === "booking" ? "Agendar" : "Comprar"}
                    />
                  </div>
                )}
                <Button onClick={handleAddBlock} disabled={pending}>
                  {pending ? "Adicionando..." : "Adicionar bloco"}
                </Button>
              </Card>
            )}

            <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {blocks.map((block) => (
                    <SortableBlockCard
                      key={block.id}
                      block={block}
                      isEditing={editingBlock === block.id}
                      pending={pending}
                      blockType={block.type}
                      editTitle={editTitle}
                      editDescription={editDescription}
                      editImageUrl={editImageUrl}
                      editCtaText={editCtaText}
                      editExternalUrl={editExternalUrl}
                      editPriceDisplay={editPriceDisplay}
                      editDuration={editDuration}
                      editLinkIcon={editLinkIcon}
                      onSetEditTitle={setEditTitle}
                      onSetEditDescription={setEditDescription}
                      onSetEditImageUrl={setEditImageUrl}
                      onSetEditCtaText={setEditCtaText}
                      onSetEditExternalUrl={setEditExternalUrl}
                      onSetEditPriceDisplay={setEditPriceDisplay}
                      onSetEditDuration={setEditDuration}
                      onSetEditLinkIcon={setEditLinkIcon}
                      onToggleVisibility={() => handleToggleBlockVisibility(block)}
                      onDelete={() => handleDeleteBlock(block.id)}
                      onEdit={() => startEditingBlock(block)}
                      onSave={() => handleSaveBlock(block)}
                      onCancelEdit={cancelEditingBlock}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </TabsContent>

        {/* Tab 3 — Chat */}
        <TabsContent value="chat">
          <div className="mt-6 space-y-4 max-w-lg">
            {!chatwootConnected && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium text-amber-950 dark:text-amber-100">Chatwoot não conectado</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Para usar o chat na loja, primeiro conecte o Chatwoot em{" "}
                  <Link href={`/${orgSlug}/integrations`} className="underline">Integrações</Link>.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label>Chat na loja</Label>
                <p className="text-xs text-muted-foreground">Habilitar widget de chat com IA na sua loja</p>
              </div>
              <Button
                variant={chatEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setChatEnabled(!chatEnabled)}
              >
                {chatEnabled ? "Ativo" : "Desativado"}
              </Button>
            </div>

            {chatEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="chatToken">Website Token do Chatwoot</Label>
                  <Input
                    id="chatToken"
                    value={chatToken}
                    onChange={(e) => setChatToken(e.target.value)}
                    placeholder="Token do inbox tipo 'Website'"
                  />
                  <p className="text-xs text-muted-foreground">
                    No Chatwoot, crie um inbox tipo &quot;Website&quot; e cole o Website Token aqui.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chatTrigger">Trigger do chat</Label>
                  <select
                    id="chatTrigger"
                    value={chatTrigger}
                    onChange={(e) => setChatTrigger(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="none">Sempre visível (botão no canto)</option>
                    <option value="timer">Timer (abre após X segundos)</option>
                    <option value="scroll">Scroll (abre ao rolar a página)</option>
                    <option value="exit_intent">Exit intent (abre quando mouse sai)</option>
                  </select>
                </div>

                {chatTrigger === "timer" && (
                  <div className="space-y-2">
                    <Label htmlFor="triggerSeconds">Segundos até abrir</Label>
                    <Input
                      id="triggerSeconds"
                      type="number"
                      min={5}
                      max={300}
                      value={triggerSeconds}
                      onChange={(e) => setTriggerSeconds(parseInt(e.target.value) || 60)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="chatGreeting">Mensagem de boas-vindas</Label>
                  <Textarea
                    id="chatGreeting"
                    value={chatGreeting}
                    onChange={(e) => setChatGreeting(e.target.value)}
                    placeholder="Oi! Posso te ajudar a escolher o melhor produto?"
                    rows={2}
                  />
                </div>
              </>
            )}

            <Button onClick={handleSaveChat} disabled={pending}>
              {pending ? "Salvando..." : "Salvar configuração de chat"}
            </Button>
          </div>
        </TabsContent>

        {/* Tab 4 — Analytics */}
        <TabsContent value="analytics">
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Analytics da loja</h3>
              <div className="flex items-center gap-2">
                <select
                  value={analyticsDays}
                  onChange={(e) => {
                    const d = parseInt(e.target.value);
                    setAnalyticsDays(d);
                    loadAnalytics(d);
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value={7}>Últimos 7 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadAnalytics(analyticsDays)}
                  disabled={analyticsLoading}
                >
                  {analyticsLoading ? "Carregando..." : "Atualizar"}
                </Button>
              </div>
            </div>

            {!analyticsData && !analyticsLoading && !analyticsError && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-6 text-center">
                <BarChart3 className="mx-auto size-10 text-blue-500/50" />
                <p className="mt-2 text-sm text-muted-foreground">Clique em "Atualizar" para carregar os dados.</p>
              </div>
            )}

            {analyticsError && (
              <p className="text-sm text-destructive">{analyticsError}</p>
            )}

            {analyticsData && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Page views", value: analyticsData.totalViews },
                    { label: "Cliques", value: analyticsData.totalClicks },
                    { label: "Chats abertos", value: analyticsData.totalChats },
                    { label: "CTR médio", value: `${analyticsData.ctr}%` },
                  ].map((stat) => (
                    <Card key={stat.label} className="p-4 text-center">
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                    </Card>
                  ))}
                </div>

                {analyticsData.dailyViews.length > 0 && (
                  <Card className="p-4">
                    <p className="mb-3 text-sm font-medium">Views diárias</p>
                    <div className="flex items-end gap-1" style={{ height: 80 }}>
                      {analyticsData.dailyViews.map((d) => {
                        const max = Math.max(...analyticsData.dailyViews.map((x) => x.views), 1);
                        const h = Math.round((d.views / max) * 100);
                        return (
                          <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                            <div
                              className="w-full rounded-sm bg-primary/70"
                              style={{ height: `${h}%`, minHeight: d.views > 0 ? 4 : 0 }}
                              title={`${d.day}: ${d.views} views`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>{analyticsData.dailyViews[0]?.day}</span>
                      <span>{analyticsData.dailyViews[analyticsData.dailyViews.length - 1]?.day}</span>
                    </div>
                  </Card>
                )}

                {analyticsData.blockClicks.length > 0 && (
                  <Card className="p-4">
                    <p className="mb-3 text-sm font-medium">Cliques por bloco</p>
                    <div className="space-y-2">
                      {analyticsData.blockClicks.map((b) => (
                        <div key={b.blockId} className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">{b.blockTitle || "Sem título"}</span>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span>{b.clicks} cliques</span>
                            <span>{b.ctr}% CTR</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* Tab 5 — Theme */}
        <TabsContent value="theme">
          <div className="mt-6 space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label>Modo</Label>
              <select
                value={theme.colorScheme}
                onChange={(e) => setTheme({ ...theme, colorScheme: e.target.value as "light" | "dark" })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cor primária</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={theme.primaryColor} onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border" />
                  <Input value={theme.primaryColor} onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor de fundo</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={theme.backgroundColor} onChange={(e) => setTheme({ ...theme, backgroundColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border" />
                  <Input value={theme.backgroundColor} onChange={(e) => setTheme({ ...theme, backgroundColor: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor dos cards</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={theme.cardColor} onChange={(e) => setTheme({ ...theme, cardColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border" />
                  <Input value={theme.cardColor} onChange={(e) => setTheme({ ...theme, cardColor: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor do texto</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={theme.textColor} onChange={(e) => setTheme({ ...theme, textColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border" />
                  <Input value={theme.textColor} onChange={(e) => setTheme({ ...theme, textColor: e.target.value })} className="flex-1" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fonte</Label>
              <select
                value={theme.fontFamily}
                onChange={(e) => setTheme({ ...theme, fontFamily: e.target.value as StoreTheme["fontFamily"] })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="geist">Geist</option>
                <option value="inter">Inter</option>
                <option value="poppins">Poppins</option>
                <option value="playfair">Playfair Display</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Borda dos cards</Label>
              <select
                value={theme.borderRadius}
                onChange={(e) => setTheme({ ...theme, borderRadius: e.target.value as StoreTheme["borderRadius"] })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="sm">Pequena</option>
                <option value="md">Média</option>
                <option value="lg">Grande</option>
                <option value="full">Arredondada</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Layout dos cards</Label>
              <select
                value={theme.cardLayout}
                onChange={(e) => setTheme({ ...theme, cardLayout: e.target.value as "horizontal" | "vertical" })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="horizontal">Horizontal (imagem à esquerda)</option>
                <option value="vertical">Vertical (imagem em cima)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>URL da foto de capa/banner</Label>
              <Input
                value={theme.coverImageUrl ?? ""}
                onChange={(e) => setTheme({ ...theme, coverImageUrl: e.target.value || null })}
                placeholder="https://..."
              />
            </div>

            <Button onClick={handleSaveTheme} disabled={pending}>
              {pending ? "Salvando..." : "Salvar tema"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
