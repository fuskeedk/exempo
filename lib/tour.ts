import type { Role } from "@/lib/catalog";

export type TourStep = {
  id: string;
  title: string;
  body: string;
  target?: string;
  href?: string;
  exact?: boolean;
  openCreate?: boolean;
};

export function tourSettingKey(userId: string) {
  return `tour_seen_${userId}`;
}

export function isTourCompleted(settings: Record<string, string>, userId: string) {
  return settings[tourSettingKey(userId)] === "1";
}

function officeRole(role: Role) {
  return role === "ADMIN" || role === "PL";
}

export function tourSteps(role: Role, companyName: string, userName: string): TourStep[] {
  const brand = companyName.trim() || "jeres virksomhed";
  const first = userName.trim() || "der";
  if (officeRole(role)) {
    return [
      {
        id: "welcome",
        title: `Velkommen, ${first}`,
        body: `${brand} har sin egen database. En sag kører typisk: kunde → tilbud → arbejdsseddel → planlægning → tid på Min dag → faktura.`,
      },
      {
        id: "opret",
        title: "Opret",
        body: "Her starter I. Opret kunden først, så et tilbud eller en sag. Ekstraarbejde kommer på, når noget ligger uden for det aftalte.",
        target: "nav-opret",
        openCreate: true,
      },
      {
        id: "overblik",
        title: "Overblik",
        body: "Pipeline viser sagerne fra ny til faktura. Klik en sag for at åbne arbejdssedlen — tid, materialer, KLS og faktura bor der.",
        target: "tour-pipeline",
        href: "/",
        exact: true,
      },
      {
        id: "sager",
        title: "Arbejdssedler",
        body: "Alle sager ligger her. Søg på nummer, kunde eller skadenr. Status følger sagen, så I kan se, hvad der mangler.",
        target: "tour-page",
        href: "/sager",
      },
      {
        id: "plan",
        title: "Planlægning",
        body: "Træk en sag ned på en medarbejder. Hold musen inde og træk tiden — også i bunden for at forlænge. Døgnet er 00:00–23:59.",
        target: "tour-plan",
        href: "/kalender",
      },
      {
        id: "dag",
        title: "Min dag",
        body: "Her registrerer medarbejderen tid. Planlagt bliver til registreret, når I gemmer — den lægges ikke oveni. Hel dag er 7,5 timer (fredag 7), så ugen rammer 37 før overarbejde.",
        target: "tour-day",
        href: "/min-dag",
      },
      {
        id: "faktura",
        title: "Fakturaer",
        body: "Når arbejdet er færdigt, dannes fakturaen fra sagen. Bankoplysninger fra Indstillinger kommer med på dokumentet.",
        target: "tour-page",
        href: "/fakturaer",
      },
      {
        id: "indstillinger",
        title: "Indstillinger",
        body: "Udfyld virksomhed, CVR og bank. Tilføj medarbejdere under Administration. I kan altid åbne rundvisningen igen nederst i menuen.",
        target: "tour-virksomhed",
        href: "/indstillinger",
      },
      {
        id: "done",
        title: "I er klar",
        body: "Næste skridt: virksomhedsoplysninger, første kunde og evt. en kollega. Derefter opretter I den første sag.",
      },
    ];
  }

  return [
    {
      id: "welcome",
      title: `Velkommen, ${first}`,
      body: `Du er logget ind i ${brand}. Din dag handler om de sager, der er lagt på dig: se dem, registrér tid og hold styr på materialer.`,
    },
    {
      id: "dag",
      title: "Min dag",
      body: "Her ligger din kalender. Træk for at planlægge, og registrér tiden når jobbet er udført. Hel dag tæller 7,5 timer — fredag 7.",
      target: "tour-day",
      href: "/min-dag",
    },
    {
      id: "sager",
      title: "Arbejdssedler",
      body: "Åbn sagen for at se kunden, tilføje billeder, materialer og KLS. Når du er færdig, færdigmelder du — kontoret tager fakturaen.",
      target: "tour-page",
      href: "/sager",
    },
    {
      id: "kunder",
      title: "Kunder",
      body: "Adresser og kontakt ligger i kartoteket, så du ikke skal taste det igen på næste sag.",
      target: "tour-page",
      href: "/kunder",
    },
    {
      id: "done",
      title: "Du er klar",
      body: "Start på Min dag. Du kan åbne rundvisningen igen nederst i menuen, hvis du vil se den senere.",
    },
  ];
}

export function pathMatchesTour(pathname: string, href?: string, exact?: boolean) {
  if (!href) return true;
  if (exact || href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
