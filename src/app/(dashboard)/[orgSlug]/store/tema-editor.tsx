"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StoreTheme } from "@/lib/store-theme";
import { STORE_TEMPLATES } from "@/lib/store-theme";
import { TemplatePreviewCard } from "@/components/store/template-preview-card";
import { ImageUpload } from "@/components/store/image-upload";
import { saveStoreTheme } from "./actions";

interface Props {
  orgSlug: string;
  initialTheme: StoreTheme;
}


export function StoreTemaEditor({ orgSlug, initialTheme }: Props) {
  const [theme, setTheme] = useState(initialTheme);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function showMessage(type: "ok" | "err", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  function handleSave() {
    startTransition(async () => {
      const r = await saveStoreTheme({ orgSlug, theme });
      if (r.error) showMessage("err", r.error);
      else showMessage("ok", "Tema salvo!");
    });
  }

  return (
    <div className="space-y-4 max-w-lg">
      {message && (
        <p className={message.type === "ok" ? "text-sm text-green-600" : "text-sm text-destructive"}>
          {message.text}
        </p>
      )}

      <div className="space-y-3">
        <Label>Templates</Label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {STORE_TEMPLATES.map((template) => {
            const isActive =
              theme.primaryColor === template.theme.primaryColor &&
              theme.backgroundColor === template.theme.backgroundColor &&
              theme.colorScheme === template.theme.colorScheme;
            return (
              <TemplatePreviewCard
                key={template.id}
                template={template}
                isActive={isActive}
                onSelect={() => setTheme({ ...template.theme })}
              />
            );
          })}
        </div>
      </div>

      <hr />
      <p className="text-sm font-medium text-muted-foreground">Personalizar</p>

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

      <hr />
      <p className="text-sm font-medium text-muted-foreground">Imagem de fundo</p>
      <ImageUpload
        value={theme.coverImageUrl ?? ""}
        onChange={(url) => setTheme({ ...theme, coverImageUrl: url || null })}
        orgSlug={orgSlug}
        label="Imagem de fundo"
      />
      {theme.coverImageUrl && (
        <p className="text-xs text-muted-foreground">
          A imagem fica fixada ao fundo com uma sobreposição semitransparente para manter a legibilidade.
        </p>
      )}

      <Button onClick={handleSave} disabled={pending}>
        {pending ? "Salvando..." : "Salvar tema"}
      </Button>
    </div>
  );
}
