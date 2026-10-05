import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

export const MoonIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 16, ...p })}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);

export const SunIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 16, ...p })}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2.5, size: 18, ...p })}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 3, size: 16, ...p })}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2.4, size: 18, ...p })}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const BackIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2.2, size: 20, ...p })}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const ShareIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 20, ...p })}>
    <path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

export const SendIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 20, ...p })}>
    <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" />
  </svg>
);

export const DownloadIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 22, ...p })}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);

export const LinkIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 22, ...p })}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

export const MoreIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 22, ...p })}>
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </svg>
);

export const PencilIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 16, ...p })}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </svg>
);

export const ResetIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 16, ...p })}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export const HelpIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 17, ...p })}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.4c-.8.5-1.2 1-1.2 1.9" />
    <path d="M12 17h.01" />
  </svg>
);
