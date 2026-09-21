export const PURCHASE_TABS = [
  { id: "rekvisitioner", label: "Ordrerekvisitioner" },
  { id: "indkomne", label: "Indkomne" },
  { id: "delvist", label: "Delvist behandlet" },
  { id: "afventer", label: "Afventer" },
  { id: "behandlede", label: "Behandlede" },
] as const;

export type PurchaseTab = (typeof PURCHASE_TABS)[number]["id"];

export const PURCHASE_STATUS_LABELS: Record<string, string> = {
  MODTAGET: "Ny",
  DELVIST: "Delvist",
  AFVENTER: "Afventer",
  GODKENDT: "Godkendt",
  DRIFT: "Drift",
  AFVIST: "Afvist",
};

export function isPurchaseTab(value: string | undefined): value is PurchaseTab {
  return PURCHASE_TABS.some((tab) => tab.id === value);
}

export function parsePurchaseTab(value?: string): PurchaseTab {
  return isPurchaseTab(value) ? value : "indkomne";
}

export function purchaseStatusWhere(tab: PurchaseTab): { status?: string | { in: string[] } } | null {
  if (tab === "rekvisitioner") return null;
  if (tab === "indkomne") return { status: "MODTAGET" };
  if (tab === "delvist") return { status: "DELVIST" };
  if (tab === "afventer") return { status: "AFVENTER" };
  return { status: { in: ["GODKENDT", "DRIFT", "AFVIST"] } };
}

export function purchaseInboxCopy(tab: PurchaseTab): { title: string; description: string } {
  if (tab === "rekvisitioner") {
    return {
      title: "Ordrerekvisitioner",
      description:
        "Angiv en arbejdsseddel og klik på Fortsæt til webshop for at handle hos jeres tilføjede grossister.",
    };
  }
  if (tab === "indkomne") {
    return {
      title: "Indkomne indkøbsfakturaer til godkendelse",
      description:
        "Her findes nye indkøbsfakturaer, som endnu ikke er godkendt og kræver behandling af enten dig eller en anden bruger.",
    };
  }
  if (tab === "delvist") {
    return {
      title: "Delvist behandlede indkøbsfakturaer",
      description: "Fakturaer der er påbegyndt, men stadig mangler godkendelse eller matching.",
    };
  }
  if (tab === "afventer") {
    return {
      title: "Indkøbsfakturaer der afventer",
      description: "Fakturaer sat på en sag, som venter på godkendelse.",
    };
  }
  return {
    title: "Behandlede indkøbsfakturaer",
    description: "Godkendte, afviste og driftsførte indkøbsfakturaer.",
  };
}

export function purchaseRoleTag(role: string): string {
  if (role === "PL") return "PL";
  if (role === "ADMIN") return "Admin";
  return "AN";
}

export function purchaseOrderReference(input: {
  orderReference?: string | null;
  case?: {
    caseNumber: string;
    customerAddress?: string | null;
    customerCity?: string | null;
  } | null;
}): string {
  if (input.case) {
    const place = [input.case.customerAddress, input.case.customerCity].filter(Boolean).join(" ");
    return place ? `${input.case.caseNumber}/${place}` : input.case.caseNumber;
  }
  return input.orderReference?.trim() || "";
}
