import {
  AtSign,
  Video,
  Globe,
  Mail,
  Music2,
  Hash,
  Link2,
  type LucideIcon,
} from "lucide-react";

interface SocialLink {
  platform: string;
  url: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  instagram: AtSign,
  tiktok: Music2,
  youtube: Video,
  email: Mail,
  twitter: Hash,
  facebook: Globe,
  linkedin: Link2,
  website: Globe,
};

export function StoreSocialIcons({ links }: { links: SocialLink[] }) {
  if (links.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-3">
      {links.map(({ platform, url }) => {
        const Icon = ICON_MAP[platform] ?? Globe;
        const href = platform === "email" ? `mailto:${url}` : url;

        return (
          <a
            key={platform}
            href={href}
            target={platform === "email" ? undefined : "_blank"}
            rel={platform === "email" ? undefined : "noopener noreferrer"}
            className="flex size-10 items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ backgroundColor: "var(--store-card)" }}
          >
            <Icon className="size-5" style={{ color: "var(--store-text)" }} />
          </a>
        );
      })}
    </div>
  );
}
