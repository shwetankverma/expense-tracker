// Hairline stroke icons — no emoji in the app chrome.

const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconHome = (p) => (
  <svg {...base} {...p}>
    <path d="M3.5 10.6 12 3.8l8.5 6.8" />
    <path d="M5.3 9.4V19a1.4 1.4 0 0 0 1.4 1.4h10.6a1.4 1.4 0 0 0 1.4-1.4V9.4" />
  </svg>
);

export const IconCalendar = (p) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 9.8h17M8.2 2.8v4M15.8 2.8v4" />
  </svg>
);

export const IconChart = (p) => (
  <svg {...base} {...p}>
    <path d="M5.5 20V13.5M12 20V7.5M18.5 20v-4" />
  </svg>
);

export const IconCard = (p) => (
  <svg {...base} {...p}>
    <rect x="2.8" y="5.5" width="18.4" height="13" rx="3" />
    <path d="M2.8 9.7h18.4" strokeWidth="2.2" />
    <path d="M6.2 15.3h4" />
  </svg>
);

export const IconUser = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8.4" r="3.8" />
    <path d="M4.9 20.2c.5-3.4 3.3-5.3 7.1-5.3s6.6 1.9 7.1 5.3" />
  </svg>
);

export const IconSpark = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3.5 14 10l6.5 2L14 14l-2 6.5L10 14l-6.5-2L10 10Z" />
  </svg>
);

export const IconPlus = (p) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
