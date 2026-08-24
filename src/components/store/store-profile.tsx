import { StoreSocialIcons } from "./store-social-icons";

interface StoreProfileProps {
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
  coverImageUrl: string | null;
  socialLinks: { platform: string; url: string }[];
}

export function StoreProfile({
  displayName,
  bio,
  photoUrl,
  coverImageUrl,
  socialLinks,
}: StoreProfileProps) {
  return (
    <div className="flex flex-col items-center gap-4 pb-8">
      {coverImageUrl && (
        <div className="w-full h-48 sm:h-64 overflow-hidden rounded-b-2xl -mt-6">
          <img
            src={coverImageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {photoUrl ? (
        <img
          src={photoUrl}
          alt={displayName}
          className="size-24 rounded-full object-cover border-4"
          style={{
            borderColor: "var(--store-bg)",
            marginTop: coverImageUrl ? "-3rem" : undefined,
          }}
        />
      ) : (
        <div
          className="flex size-24 items-center justify-center rounded-full text-3xl font-bold"
          style={{
            backgroundColor: "var(--store-primary)",
            color: "var(--store-bg)",
            marginTop: coverImageUrl ? "-3rem" : undefined,
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}

      <h1 className="text-2xl font-bold" style={{ color: "var(--store-text)" }}>
        {displayName}
      </h1>

      {bio && (
        <p
          className="max-w-md text-center text-sm leading-relaxed opacity-80"
          style={{ color: "var(--store-text)" }}
        >
          {bio}
        </p>
      )}

      <StoreSocialIcons links={socialLinks} />
    </div>
  );
}
