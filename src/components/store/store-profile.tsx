import { StoreSocialIcons } from "./store-social-icons";

interface StoreProfileProps {
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
  coverImageUrl: string | null;
  socialLinks: { platform: string; url: string }[];
  profileLayout: "centered" | "hero";
}

export function StoreProfile({
  displayName,
  bio,
  photoUrl,
  coverImageUrl,
  socialLinks,
  profileLayout,
}: StoreProfileProps) {
  if (profileLayout === "hero") {
    return (
      <div className="flex flex-col items-center pb-8">
        <div className="relative w-full -mt-6 overflow-hidden" style={{ height: 300 }}>
          {coverImageUrl ? (
            <img src={coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(160deg, var(--store-primary), var(--store-bg))" }}
            />
          )}

          {/* gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

          {/* name + bio on the hero */}
          <div className="absolute inset-x-0 px-6 text-center" style={{ bottom: photoUrl ? 72 : 24 }}>
            <h1
              className="text-3xl font-bold text-white"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,.6)" }}
            >
              {displayName}
            </h1>
            {bio && (
              <p className="mt-1.5 text-sm leading-relaxed text-white/85 line-clamp-2">
                {bio}
              </p>
            )}
          </div>

          {/* profile photo overlapping bottom edge */}
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={displayName}
              className="absolute -bottom-10 left-1/2 -translate-x-1/2 size-20 rounded-full border-4 object-cover shadow-lg"
              style={{ borderColor: "var(--store-bg)" }}
            />
          ) : (
            <div
              className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex size-20 items-center justify-center rounded-full border-4 text-3xl font-bold shadow-lg"
              style={{
                backgroundColor: "var(--store-primary)",
                color: "var(--store-bg)",
                borderColor: "var(--store-bg)",
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div style={{ height: 48 }} />
        <StoreSocialIcons links={socialLinks} />
      </div>
    );
  }

  // centered (default)
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
