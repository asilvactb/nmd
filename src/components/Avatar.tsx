/* eslint-disable @next/next/no-img-element */
const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`;

export const avatarUrl = (path: string | null | undefined) => (path ? BASE + path : null);

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

/** Circular profile photo (LinkedIn-style), with initials when there is none yet. */
export function Avatar({ name, path, size = 32, className = "" }: {
  name: string; path?: string | null; size?: number; className?: string;
}) {
  const url = avatarUrl(path);
  const style = { width: size, height: size, fontSize: size * 0.38 };
  return url ? (
    <img src={url} alt={name} style={style} loading="lazy"
      className={`shrink-0 rounded-full object-cover ring-2 ring-bg ${className}`} />
  ) : (
    <span style={style} aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-line font-medium text-muted ring-2 ring-bg ${className}`}>
      {initials(name)}
    </span>
  );
}

/** Two overlapping avatars for a pair. */
export function PairAvatars({ a, b, size = 28 }: {
  a: { name: string; path?: string | null }; b: { name: string; path?: string | null }; size?: number;
}) {
  return (
    <span className="inline-flex shrink-0">
      <Avatar name={a.name} path={a.path} size={size} />
      <Avatar name={b.name} path={b.path} size={size} className="-ml-2" />
    </span>
  );
}
