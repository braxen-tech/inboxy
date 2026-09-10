import { StoreSocialIcons } from "./store-social-icons";

interface StoreProfileProps {
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
  socialLinks: { platform: string; url: string }[];
}

export function StoreProfile({
  displayName,
  bio,
  photoUrl,
  socialLinks,
}: StoreProfileProps) {
  return (
    <div className="flex flex-col items-center gap-4 pt-12 pb-8">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={displayName}
          className="size-24 rounded-full object-cover border-4 shadow-lg"
          style={{ borderColor: "var(--store-bg)" }}
        />
      ) : (
        <div
          className="flex size-24 items-center justify-center rounded-full text-3xl font-bold shadow-lg"
          style={{
            backgroundColor: "var(--store-primary)",
            color: "var(--store-bg)",
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}

      <h1
        className="text-2xl font-bold drop-shadow-md"
        style={{ color: "var(--store-text)" }}
      >
        {displayName}
      </h1>

      {bio && (
        <p
          className="max-w-md text-center text-sm leading-relaxed opacity-90 drop-shadow-sm"
          style={{ color: "var(--store-text)" }}
        >
          {bio}
        </p>
      )}

      <StoreSocialIcons links={socialLinks} />
    </div>
  );
}
