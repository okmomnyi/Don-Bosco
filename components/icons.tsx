import type { SVGProps } from "react";

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function MassIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2v20M6 7h12" />
    </svg>
  );
}

export function FellowshipIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="16.5" cy="9.5" r="2.25" />
      <path d="M3.5 19c0-3.1 2.5-5.2 5.5-5.2s5.5 2.1 5.5 5.2M14.5 14.2c2.6.2 5 1.9 5 4.8" />
    </svg>
  );
}

export function GamesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a13 13 0 0 1 0 18 13 13 0 0 1 0-18Z" />
    </svg>
  );
}

export function FestivalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="6.5" cy="18" r="2.25" />
      <circle cx="16.5" cy="16" r="2.25" />
      <path d="M8.75 18V5.5L18.75 4v12" />
    </svg>
  );
}

export function SeminarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M9 18.5h6M10 21.5h4" />
      <path d="M12 2.5a6.5 6.5 0 0 0-3.6 11.9c.4.3.6.8.6 1.3v.3h6v-.3c0-.5.2-1 .6-1.3A6.5 6.5 0 0 0 12 2.5Z" />
    </svg>
  );
}
