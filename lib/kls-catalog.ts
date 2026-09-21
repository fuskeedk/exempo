import { CASE_TRADES, TRADE_LABELS, isTrade, type Trade } from "@/lib/catalog";

export type KlsTemplateSeed = {
  name: string;
  trade: Trade;
  items: string[];
};

export const DEFAULT_KLS_TEMPLATES: KlsTemplateSeed[] = [
  {
    name: "KLS — Tømrer, skadesudbedring",
    trade: "TOMRER",
    items: [
      "Foto af skade før arbejde",
      "Afdækning af tilstødende flader",
      "Fugt/underlag kontrolleret",
      "Konstruktion genopbygget efter anvisning",
      "Dampspærre/membran tæt",
      "Overflade klar til næste fag",
      "Oprydning og spild fjernet",
      "Foto efter arbejde",
    ],
  },
  {
    name: "KLS — Murer, skadesudbedring",
    trade: "MURER",
    items: [
      "Foto af skade før arbejde",
      "Underlag bæredygtigt og rent",
      "Puds/mørtel blandet korrekt",
      "Fuger og overgange tætte",
      "Flader i vater og lod",
      "Afdækning i hærdningsperiode",
      "Oprydning",
      "Foto efter arbejde",
    ],
  },
  {
    name: "KLS — El-installation",
    trade: "ELEKTRIKER",
    items: [
      "Spændingsløs før indgreb",
      "Eksisterende installation kortlagt",
      "Nye føringer fastgjort og mærket",
      "Isolationstest udført",
      "Funktionstest af kredse",
      "Kapsling og afdækning genetableret",
      "Foto efter arbejde",
    ],
  },
  {
    name: "KLS — VVS",
    trade: "VVS",
    items: [
      "Vand/varme spærret før indgreb",
      "Foto af skade før arbejde",
      "Utætheder lokaliseret",
      "Rør og samlinger tæthedsprøvet",
      "Isolering genetableret",
      "Funktionstest af armaturer",
      "Oprydning",
      "Foto efter arbejde",
    ],
  },
  {
    name: "KLS — Maler",
    trade: "MALER",
    items: [
      "Underlag slibet og støvsuget",
      "Pletspartling udført",
      "Grunder påført",
      "Færdigmaling i aftalt glans",
      "Kanter dækker uden overlap",
      "Afdækning fjernet uden skader",
      "Foto efter arbejde",
    ],
  },
  {
    name: "KLS — Gulv",
    trade: "GULV",
    items: [
      "Foto af skade før arbejde",
      "Underlag tørt, rent og bæredygtigt",
      "Fugt målt inden udlægning",
      "Gulv belagt efter anvisning",
      "Overgange og lister monteret",
      "Oprydning",
      "Foto efter arbejde",
    ],
  },
  {
    name: "KLS — Tag",
    trade: "TAG",
    items: [
      "Foto af skade før arbejde",
      "Sikkerhed og afdækning",
      "Undertag/lægter kontrolleret",
      "Dækning genetableret tæt",
      "Inddækninger og afslutninger tætte",
      "Oprydning",
      "Foto efter arbejde",
    ],
  },
  {
    name: "KLS — Generel skadesag",
    trade: "ANDET",
    items: [
      "Kunde informeret om arbejdets omfang",
      "Foto før",
      "Sikkerhed og afdækning",
      "Arbejde udført efter beskrivelse",
      "Afvigelser noteret",
      "Foto efter",
      "Kunden har fået gennemgang",
    ],
  },
];

type KlsDb = {
  klsTemplate: {
    findMany: (args: { select: { name: true } }) => Promise<Array<{ name: string }>>;
    create: (args: {
      data: {
        name: string;
        trade: string;
        items: { create: Array<{ label: string; sortOrder: number }> };
      };
    }) => Promise<unknown>;
  };
};

export async function ensureDefaultKlsTemplates(db: KlsDb) {
  const existing = await db.klsTemplate.findMany({ select: { name: true } });
  const have = new Set(existing.map((row) => row.name));
  for (const template of DEFAULT_KLS_TEMPLATES) {
    if (have.has(template.name)) continue;
    await db.klsTemplate.create({
      data: {
        name: template.name,
        trade: template.trade,
        items: {
          create: template.items.map((label, sortOrder) => ({ label, sortOrder })),
        },
      },
    });
  }
}

export function klsTradeLabel(trade: string) {
  return isTrade(trade) && trade !== "ADMINISTRATION" ? TRADE_LABELS[trade] : "Andet";
}

export function sortKlsTemplates<T extends { trade: string; name: string }>(templates: T[], trade: string) {
  return templates.slice().sort((a, b) => {
    const rank = (row: T) => (row.trade === trade ? 0 : row.trade === "ANDET" ? 1 : 2);
    const diff = rank(a) - rank(b);
    return diff !== 0 ? diff : a.name.localeCompare(b.name, "da");
  });
}

export const KLS_TRADE_OPTIONS = CASE_TRADES;
