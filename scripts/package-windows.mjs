import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist", "Exempo-win");
const zipPath = join(root, "dist", "Exempo-windows.zip");
const nodeVersion = process.env.EXEMPO_NODE_VERSION || "22.14.0";
const nodeUrl = `https://nodejs.org/dist/v${nodeVersion}/win-x64/node.exe`;

function run(command, args, extra = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...extra,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function copyIfExists(from, to) {
  if (!existsSync(from)) return false;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  return true;
}

async function download(url, dest) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download fejlede: ${url} (${response.status})`);
  }
  mkdirSync(dirname(dest), { recursive: true });
  await pipeline(response.body, createWriteStream(dest));
}

function collectWindowsEngines(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectWindowsEngines(full, found);
    } else if (/windows/i.test(entry.name) || entry.name.endsWith(".dll.node")) {
      found.push(full);
    }
  }
  return found;
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

console.log("→ Prisma generate + demo-database");
run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "db", "push"]);
run("npx", ["tsx", "prisma/seed.ts"]);

console.log("→ Next.js standalone build");
run("npx", ["next", "build"]);

const standalone = join(root, ".next", "standalone");
if (!existsSync(join(standalone, "server.js"))) {
  throw new Error("Standalone-build mangler server.js");
}

cpSync(standalone, dist, { recursive: true });
mkdirSync(join(dist, ".next"), { recursive: true });
cpSync(join(root, ".next", "static"), join(dist, ".next", "static"), { recursive: true });
if (existsSync(join(root, "public"))) {
  cpSync(join(root, "public"), join(dist, "public"), { recursive: true });
}

const engineSources = [
  join(root, "node_modules", ".prisma", "client"),
  join(root, "node_modules", "@prisma", "engines"),
];
for (const source of engineSources) {
  for (const file of collectWindowsEngines(source)) {
    const relative = file.slice(root.length).replace(/^[/\\]+/, "");
    const target = join(dist, relative);
    copyIfExists(file, target);
  }
}

mkdirSync(join(dist, "seed"), { recursive: true });
mkdirSync(join(dist, "data"), { recursive: true });
mkdirSync(join(dist, "uploads"), { recursive: true });
copyFileSync(join(root, "prisma", "dev.db"), join(dist, "seed", "exempo.db"));
copyFileSync(join(root, "prisma", "dev.db"), join(dist, "data", "exempo.db"));

writeFileSync(
  join(dist, "LÆSMIG.txt"),
  [
    "Exempo — bærbar Windows-udgave",
    "",
    "1. Pak hele mappen ud (ikke kun Exempo.exe).",
    "2. Dobbeltklik Exempo.exe.",
    "3. Browseren åbner http://127.0.0.1:3000",
    "",
    "Login: pl@exempo.dk / exempo123",
    "Tømrer: lars@exempo.dk / exempo123",
    "",
    "Luk det sorte vindue for at stoppe programmet.",
    "Windows kan advare om en usigneret fil — vælg 'Flere oplysninger' → 'Kør alligevel'.",
    "",
  ].join("\r\n"),
);

console.log("→ Henter Windows Node", nodeVersion);
await download(nodeUrl, join(dist, "node.exe"));

console.log("→ Bygger Exempo.exe");
run("go", ["build", "-o", join(dist, "Exempo.exe"), join(root, "packaging", "launcher.go")], {
  env: { ...process.env, GOOS: "windows", GOARCH: "amd64", CGO_ENABLED: "0" },
});

if (existsSync(zipPath)) rmSync(zipPath);
const zip = spawnSync("zip", ["-r", "-q", zipPath, "Exempo-win"], {
  cwd: join(root, "dist"),
  stdio: "inherit",
});
if (zip.status !== 0) {
  throw new Error("zip fejlede — installer zip eller kør scriptet på Windows.");
}

console.log("Pakke klar:", zipPath);
