import { PARISH } from "@/lib/site";

/**
 * A link out to the parish's own site.
 *
 * Deliberately a plain followed link: this is a genuine editorial link from a
 * group to the parish it belongs to, which is exactly the relationship search
 * engines want to see declared. Adding rel="nofollow" here would be telling
 * them to ignore the one connection that explains what this site is.
 *
 * `rel="noopener"` is still required with target="_blank" — without it the
 * opened page gets a handle on this one through window.opener.
 */
export default function ParishLink({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={PARISH.url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children ?? PARISH.name}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
