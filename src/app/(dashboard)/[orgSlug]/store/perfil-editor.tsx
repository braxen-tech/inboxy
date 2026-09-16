"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/store/image-upload";
import { saveStoreProfile } from "./actions";

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

interface SocialLink {
  id: string;
  platform: string;
  url: string;
}

interface Props {
  orgSlug: string;
  initialDisplayName: string;
  initialBio: string;
  initialPhotoUrl: string;
  initialSocialLinks: SocialLink[];
}

export function StorePerfilEditor({
  orgSlug,
  initialDisplayName,
  initialBio,
  initialPhotoUrl,
  initialSocialLinks,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [socialLinks, setSocialLinks] = useState(
    initialSocialLinks.map((l) => ({ platform: l.platform, url: l.url })),
  );

  function showMessage(type: "ok" | "err", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  function addSocialLink() {
    const usedPlatforms = new Set(socialLinks.map((l) => l.platform));
    const next = PLATFORMS.find((p) => !usedPlatforms.has(p.value));
    if (next) setSocialLinks([...socialLinks, { platform: next.value, url: "" }]);
  }

  function removeSocialLink(index: number) {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  }

  function handleSave() {
    startTransition(async () => {
      const r = await saveStoreProfile({ orgSlug, displayName, bio, photoUrl, socialLinks });
      if (r.error) showMessage("err", r.error);
      else {
        showMessage("ok", "Perfil salvo!");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4 max-w-lg">
      {message && (
        <p className={message.type === "ok" ? "text-sm text-green-600" : "text-sm text-destructive"}>
          {message.text}
        </p>
      )}

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
        <ImageUpload value={photoUrl} onChange={setPhotoUrl} orgSlug={orgSlug} label="Foto de perfil" />
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

      <Button onClick={handleSave} disabled={pending}>
        {pending ? "Salvando..." : "Salvar perfil"}
      </Button>
    </div>
  );
}
