import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
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

const defaultEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",
  AUTH_SECRET: process.env.AUTH_SECRET || "exempo-ci-secret-change-me-please-32b",
};

function run(command, args, extra = {}) {
  const { env: extraEnv, ...rest } = extra;
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...defaultEnv, ...extraEnv },
    ...rest,
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

function patchStandaloneServer(serverPath) {
  let source = readFileSync(serverPath, "utf8");
  const inject = `
nextConfig.outputFileTracingRoot = dir
nextConfig.repoRoot = dir
nextConfig.distDirRoot = path.join(dir, '.next')
if (nextConfig.turbopack) nextConfig.turbopack.root = dir
`;
  if (!source.includes("nextConfig.outputFileTracingRoot = dir")) {
    if (!source.includes("process.env.__NEXT_PRIVATE_STANDALONE_CONFIG")) {
      throw new Error("server.js har ikke det forventede Next-standalone format.");
    }
    source = source.replace(
      "process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig)",
      `${inject}\nprocess.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig)`,
    );
    writeFileSync(serverPath, source);
  }
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

if (!existsSync(join(root, ".env"))) {
  writeFileSync(
    join(root, ".env"),
    'DATABASE_URL="file:./dev.db"\nAUTH_SECRET="exempo-ci-secret-change-me-please-32b"\n',
  );
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

console.log("→ Prisma generate + demo-database");
run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "db", "push"]);
run("npx", ["tsx", "prisma/seed.ts"]);

console.log("→ Next.js standalone build");
run("npx", ["next", "build", "--webpack"]);

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
patchStandaloneServer(join(dist, "server.js"));
writeFileSync(
  join(dist, ".env"),
  [
    'DATABASE_URL="file:./data/exempo.db"',
    'AUTH_SECRET="exempo-portable-secret-change-me-please-32b"',
    'COOKIE_SECURE="0"',
    "",
  ].join("\n"),
);

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
if (process.platform === "win32") {
  run("tar", ["-a", "-c", "-f", "Exempo-windows.zip", "Exempo-win"], {
    cwd: join(root, "dist"),
  });
} else {
  run("zip", ["-r", "-q", zipPath, "Exempo-win"], { cwd: join(root, "dist") });
}

console.log("Pakke klar:", zipPath);
