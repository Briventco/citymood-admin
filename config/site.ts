// Site-wide settings. Values in [BRACKETS] are placeholders until CityMood
// supplies them (docs/design/OPEN_QUESTIONS.md #2, #4, #5).

export const site = {
  name: "CityMood",
  publisher: "CityMood Communications",
  tagline: "Window to Badagry",
  place: "Badagry, Lagos State",
  description:
    "Independent news for Badagry and surrounding communities. Published by CityMood Communications.",
  // Production domain to be confirmed (OPEN_QUESTIONS #5).
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://citymood.ng",
  timeZone: "Africa/Lagos",

  contact: {
    address: "10, Agric Road, Opposite Badagry Local Government Secretariat, Ajara, Badagry Central, Lagos State",
    phone: "+234 904 558 7616",
    newsroomEmail: "citymoodbadagry@gmail.com",
    correctionsEmail: "corrections@citymood.ng",
  },

  social: [
    { network: "Facebook", label: "CityMood Badagry", url: "https://www.facebook.com/citymoodbadagry" },
    { network: "Instagram", label: "@citymoodbadagry", url: "https://www.instagram.com/citymoodbadagry/" },
    { network: "TikTok", label: "@citymoodbadagry", url: "https://www.tiktok.com/@citymoodbadagry" },
  ],

  // Footer "CityMood" group, and the extra links at the bottom of the mobile menu.
  pages: {
    about: { label: "About us", href: "/about" },
    contact: { label: "Contact", href: "/contact" },
    advertise: { label: "Advertise with us", href: "/advertise" },
    corrections: { label: "Corrections policy", href: "/corrections" },
    privacy: { label: "Privacy notice", href: "/privacy" },
    terms: { label: "Terms of use", href: "/terms" },
  },

  searchPath: "/search",
  latestPath: "/latest",

  // Breaking ticker: articles tagged "breaking" drop off after this many hours.
  breakingMaxAgeHours: 6,
  breakingMaxItems: 5,
} as const;
