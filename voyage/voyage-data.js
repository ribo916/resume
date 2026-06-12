/* ============================================================
   VOYAGE DATA — edit this file to change resume content.
   The engine (voyage-engine.js) reads everything from here.
   You should not need to touch the engine to update content.

   Each island:
     id        unique slug (no spaces)
     name      big label on the island sign + panel title
     role      job title shown in the panel
     dates     date range string
     sector    small subtitle line
     summary   1–2 sentence description (panel body)
     highlights array of bullet strings
     tech      array of short tags
     color     island accent color (buildings/sign), any CSS hex
     position  { x, z } world coordinates (sea is roughly -90..90)
     size      island radius multiplier (1 = normal)

   Order matters: it defines the dotted course line, oldest → newest.
   ============================================================ */

const VOYAGE_DATA = {
  player: {
    name: "Rich Boesch",
    title: "API Integration & Documentation Lead",
    subtitle: "Sail the course to explore 18+ years of integration work",
    email: "richard.boesch@gmail.com",
    linkedin: "linkedin.com/in/rboesch",
    location: "Folsom, CA",
  },

  // Distance at which the boat is considered "docked" (island radius units)
  dockRadius: 13,

  islands: [
    {
      id: "csus",
      name: "CSU Sacramento",
      role: "B.S. Computer Science",
      dates: "Education",
      sector: "Where the voyage began",
      summary:
        "Bachelor of Science in Computer Science from California State University, Sacramento. The home port — every integration journey since has launched from here.",
      highlights: [
        "Bachelor of Science, Computer Science",
        "Foundation in software engineering, systems, and architecture",
      ],
      tech: ["Computer Science", "Software Engineering"],
      color: "#2e7d4f",
      position: { x: -82, z: 42 },
      size: 0.9,
    },
    {
      id: "intuit",
      name: "Intuit",
      role: "Senior Software Engineer",
      dates: "Mar 2008 – Jun 2010",
      sector: "Financial Software / Consumer Banking Technology",
      summary:
        "Intuit Financial Services (IFS) provided consumer lending infrastructure to financial institutions. Rich joined early in his career and helped grow the lending integration ecosystem from its initial partners to a network of 100+ banking and fintech organizations.",
      highlights: [
        "Scaled lending integrations from initial launch to 100+ banking and financial services partners",
        "Designed APIs and integration architecture for the IFS consumer lending division",
        "Built partner-facing API documentation and integration standards that became a multi-platform foundation",
        "Trained QA engineers in Ruby/Watir, improving automation and monitoring",
        "Maintained six J2EE-based consumer lending products across UI, middle tier, database, and UNIX layers",
      ],
      tech: ["J2EE", "Partner APIs", "Ruby/Watir", "Banking Integrations"],
      color: "#1565c0",
      position: { x: -54, z: 20 },
      size: 1.0,
    },
    {
      id: "fis",
      name: "FIS",
      role: "NA Lending Dev Manager / Senior Developer & Team Lead",
      dates: "Feb 2014 – Feb 2020",
      sector: "Financial Technology / Banking Infrastructure",
      summary:
        "FIS is one of the world's largest fintech providers. Rich's six-year tenure spanned individual contributor to development manager — building the API-driven consumer lending platform that became the standard origination experience across the FIS LOS product suite.",
      highlights: [
        "Launched a responsive consumer lending interface adopted by 50+ financial institutions",
        "Delivered API-based loan origination integrations to banks and credit unions",
        "Translated partner feedback and integration pain points into product roadmap features",
        "Built reusable onboarding templates and playbooks for implementation and Customer Success teams",
        "Led and mentored a team of developers on integration architecture and API design",
      ],
      tech: ["API-Driven Platform", "LOS Vendors", "Team Lead", "FinTech"],
      color: "#00695c",
      position: { x: -25, z: 34 },
      size: 1.15,
    },
    {
      id: "trustage",
      name: "TruStage",
      role: "Senior Software Engineer / Integration Consultant",
      dates: "Feb 2020 – Dec 2023",
      sector: "Insurance & Credit Union Financial Services",
      summary:
        "TruStage (formerly CUNA Mutual Group) provides insurance and financial products to credit unions. Rich worked at the intersection of lending technology and integration architecture, including a flagship auto lending platform integration.",
      highlights: [
        "Led technical integration for 50+ dynamic document partners with compliance-related workflows",
        "Solution Architect for the launch of a new Fintech Auto division",
        "Coordinated deployment of a new API gateway and orchestration platform",
        "Oversaw LOS migrations including Symitar SymConnect → SymXchange partner certification",
      ],
      tech: ["REST / Webhooks", "Auto Lending", "LOS Integration", "API Gateway"],
      color: "#ef6c00",
      position: { x: 6, z: 12 },
      size: 1.05,
    },
    {
      id: "oneinc",
      name: "One Inc",
      role: "Technical Integration Lead",
      dates: "Jan 2024 – Jun 2024",
      sector: "InsurTech / Payment Platforms",
      summary:
        "One Inc connects insurers with modern payment processing and policy management. Rich led the creation of a new Partner Solutions division, building the integration standards and security patterns needed for scaled partner adoption.",
      highlights: [
        "Led creation of a new Partner Solutions division — strategy, roadmap, and operating model",
        "Established vendor evaluation frameworks and integration standards",
        "Designed and delivered API integrations for core systems and third-party vendors",
        "Introduced standardized security protocols: OAuth 2.0, SSH, digital signatures",
        "Created reusable onboarding frameworks and integration playbooks, reducing rework",
      ],
      tech: ["OAuth 2.0", "Partner Solutions", "Insurance Tech", "API Design"],
      color: "#6a1b9a",
      position: { x: 36, z: 26 },
      size: 1.0,
    },
    {
      id: "paynearme",
      name: "PayNearMe",
      role: "Internal Solutions Consultant",
      dates: "Jan 2025 – Sept 2025",
      sector: "Payments Technology",
      summary:
        "PayNearMe serves lenders, government agencies, and regulated industries with digital payment solutions. Rich joined in a consulting capacity to evaluate and modernize internal onboarding workflows.",
      highlights: [
        "Designed integrations between internal systems using MuleSoft Anypoint Platform",
        "Evaluated third-party onboarding platforms and recommended solution and implementation path",
        "Partnered with HR and IT stakeholders to align technical workflows with operational needs",
      ],
      tech: ["MuleSoft", "Workflow Design", "Payments"],
      color: "#c62828",
      position: { x: 60, z: 4 },
      size: 0.95,
    },
    {
      id: "polly",
      name: "Polly",
      role: "API Integration & Documentation Lead",
      dates: "Sept 2025 – Present",
      sector: "Mortgage Technology / Product & Pricing Engine (PPE)",
      summary:
        "Polly is a cloud-native Product & Pricing Engine for the mortgage industry. Rich owns the technical integration layer — connecting external POS, LOS, and CRM platforms to the core pricing engine while building the documentation that makes those integrations repeatable.",
      highlights: [
        "Lead integration of POS, LOS, CRM, and customer systems spanning 100+ API endpoints and 70+ webhooks",
        "Own API documentation — Swagger spec refinement and end-to-end integration guides",
        "Establish technical standards for third-party platform connections",
        "Partner across implementations, support, sales, leadership, and engineering",
      ],
      tech: ["API Docs", "POS/LOS", "Integration Standards", "Mortgage Tech"],
      color: "#f9a825",
      current: true,
      position: { x: 84, z: 16 },
      size: 1.2,
    },
  ],
};
