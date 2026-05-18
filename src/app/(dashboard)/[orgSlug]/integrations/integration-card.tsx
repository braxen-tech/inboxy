"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Settings2 } from "lucide-react";

interface IntegrationCardProps {
  name: string;
  description: string;
  summary: string;
  icon: React.ReactNode;
  status: "active" | "pending";
  children: React.ReactNode;
}

export function IntegrationCard({
  name,
  description,
  summary,
  icon,
  status,
  children,
}: IntegrationCardProps) {
  const [open, setOpen] = useState(false);
  const isActive = status === "active";

  return (
    <>
      <Card
        className="relative cursor-pointer p-4 transition-colors hover:bg-accent/50"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{name}</span>
              <Badge
                variant={isActive ? "default" : "secondary"}
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  isActive
                    ? "bg-green-500 text-white hover:bg-green-500"
                    : "bg-yellow-500 text-white hover:bg-yellow-500"
                )}
              >
                {isActive ? "Conectado" : "Pendente"}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {summary}
            </p>
          </div>

          <Settings2 className="size-4 shrink-0 text-muted-foreground" />
        </div>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                {icon}
              </div>
              <div>
                <SheetTitle>{name}</SheetTitle>
                <SheetDescription>{description}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="px-4 pb-6">{children}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
