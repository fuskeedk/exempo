export const DEFAULT_WHOLESALERS = [
  { name: "Ahlsell Danmark A/S", loginUrl: "https://www.ahlsell.dk" },
  { name: "AO Johansen", loginUrl: "https://ao.dk" },
  { name: "Brødrene Dahl", loginUrl: "https://www.bd.dk" },
  { name: "Bygma", loginUrl: "https://www.bygma.dk" },
  { name: "Carl Ras A/S", loginUrl: "https://www.carlras.dk" },
  { name: "Davidsens Tømmerhandel A/S", loginUrl: "https://www.davidsens.dk" },
  { name: "Lemvigh-Müller A/S", loginUrl: "https://www.lemu.dk" },
  { name: "Optimera", loginUrl: "https://www.optimera.dk" },
  { name: "STARK", loginUrl: "https://www.stark.dk" },
  { name: "Würth", loginUrl: "https://www.wuerth.dk" },
  { name: "XL-Byg", loginUrl: "https://www.xl-byg.dk" },
] as const;

export async function seedWholesalerAgreements(db: {
  wholesalerAgreement: {
    count: () => Promise<number>;
    createMany: (args: { data: Array<{ name: string; loginUrl: string }> }) => Promise<unknown>;
  };
}) {
  if ((await db.wholesalerAgreement.count()) > 0) return;
  await db.wholesalerAgreement.createMany({
    data: DEFAULT_WHOLESALERS.map((row) => ({ name: row.name, loginUrl: row.loginUrl })),
  });
}
