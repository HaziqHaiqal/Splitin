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
  <svg {...base({ strokeWidth: 2.2, size: 20, ...p })}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
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

export const CopyIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 22, ...p })}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);

export const UploadIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 22, ...p })}>
    <path d="M12 15V4M7 9l5-5 5 5M5 20h14" />
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

export const SettingsIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 19, ...p })}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2.5, size: 14, ...p })}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const MenuIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2.4, ...p })}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const ClockIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 21, ...p })}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const CalculatorIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 21, ...p })}>
    <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
    <path d="M8.5 6.5h7M9 11h.01M12 11h.01M15 11h.01M9 14.5h.01M12 14.5h.01M9 18h.01M12 18h.01M15 14.5V18" />
  </svg>
);

export const ReceiptIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 21, ...p })}>
    <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </svg>
);

export const BankIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2, size: 21, ...p })}>
    <path d="M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18M12 3l9 5H3z" />
  </svg>
);

export const LockIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2.1, size: 21, ...p })}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const UnlockIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2.1, size: 21, ...p })}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 7.5-2" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2.4, size: 18, ...p })}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
