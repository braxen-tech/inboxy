"use client";

import { useState, useTransition } from "react";
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
  ArrowUp,
  ArrowDown,
  ShoppingBag,
  Calendar,
  Link2,
} from "lucide-react";
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
    startTransition(async () => {
      const r = await updateStoreBlock({ orgSlug, blockId: block.id, visible: !block.visible });
      if (r.error) showMessage("err", r.error);
      else router.refresh();
    });
  }

  function handleDeleteBlock(blockId: string) {
    startTransition(async () => {
      const r = await deleteStoreBlock(orgSlug, blockId);
      if (r.error) showMessage("err", r.error);
      else {
        showMessage("ok", "Bloco removido.");
        router.refresh();
      }
    });
  }

  function handleMoveBlock(index: number, direction: "up" | "down") {
    const newBlocks = [...blocks];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[swapIndex]] = [newBlocks[swapIndex], newBlocks[index]];
    setBlocks(newBlocks);

    startTransition(async () => {
      const r = await reorderStoreBlocks(orgSlug, newBlocks.map((b) => b.id));
      if (r.error) showMessage("err", r.error);
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

            <div className="space-y-2">
              {blocks.map((block, index) => (
                <Card key={block.id} className={`p-4 flex items-center gap-3 ${!block.visible ? "opacity-50" : ""}`}>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="icon" className="size-6" onClick={() => handleMoveBlock(index, "up")} disabled={index === 0 || pending}>
                      <ArrowUp className="size-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-6" onClick={() => handleMoveBlock(index, "down")} disabled={index === blocks.length - 1 || pending}>
                      <ArrowDown className="size-3" />
                    </Button>
                  </div>

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
                    <Button variant="ghost" size="icon" onClick={() => handleToggleBlockVisibility(block)} disabled={pending}>
                      {block.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteBlock(block.id)} disabled={pending}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
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
          <div className="mt-6">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-6 text-center">
              <BarChart3 className="mx-auto size-10 text-blue-500/50" />
              <h3 className="mt-3 font-semibold">Analytics em breve</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Visualize page views, cliques por bloco, chats iniciados e taxas de conversão.
                Os eventos já estão sendo rastreados via PostHog.
              </p>
            </div>
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
