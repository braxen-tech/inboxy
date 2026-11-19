import { StoreSocialIcons } from "./store-social-icons";

interface StoreProfileProps {
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
  coverImageUrl?: string | null;
  socialLinks: { platform: string; url: string }[];
  orgId?: string;
  orgSlug?: string;
  hasProducts?: boolean;
}

export function StoreProfile({
  displayName,
  bio,
  photoUrl,
  coverImageUrl,
  socialLinks,
  orgId,
  orgSlug,
  hasProducts = true,
}: StoreProfileProps) {
  return (
    <aside className="s-profile" aria-label={`Sobre ${displayName}`}>
      <div className="s-cover" aria-hidden="true">
        {coverImageUrl ? (
          <img src={coverImageUrl} alt="" />
        ) : (
          <>
            <div className="c1" />
            <div className="c2" />
          </>
        )}
      </div>
      <div className="s-p-body">
        {photoUrl ? (
          <img src={photoUrl} alt={displayName} className="s-avatar" />
        ) : (
          <div className="s-avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</div>
        )}
        <h1 className="s-name s-display">{displayName}</h1>
        {orgSlug && <div className="s-handle s-mono">@{orgSlug}</div>}
        {bio && <p className="s-bio">{bio}</p>}
        {socialLinks.length > 0 && (
          <div className="s-socials">
            <StoreSocialIcons links={socialLinks} orgId={orgId} orgSlug={orgSlug} />
          </div>
        )}
        {hasProducts && (
          <a className="s-btn s-btn-primary s-btn-block" href="#produtos">Ver produtos ↓</a>
        )}
      </div>
    </aside>
  );
}
