export const colors = {
  paper: "#f3eee4",
  paper2: "#fffaf2",
  ink: "#1b1814",
  muted: "#6d675c",
  line: "#e0d4c2",
  pine: "#16382c",
  pine2: "#215744",
  moss: "#d7e2d3",
  rust: "#b85c38",
  gold: "#c4a35a",
  dangerBg: "#f3d7d4",
  danger: "#7c2f2a",
  white: "#ffffff",
};

export const roleLabels: Record<string, string> = {
  ADMIN: "Administrator",
  PL: "Projektleder",
  MEDARBEJDER: "Medarbejder",
};

export const absenceTypes = [
  { id: "FERIE", label: "Ferie" },
  { id: "SYG", label: "Sygdom" },
  { id: "FRI", label: "Fri" },
  { id: "ANDET", label: "Andet" },
] as const;
