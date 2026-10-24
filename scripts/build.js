#!/usr/bin/env node
// Builds one .zab per Zepp OS API profile from build.config.js.
//
//   node scripts/build.js [--api <level>|all] [--debug] [--shape r,s]
//                         [--feature name=true|false]... [--dry-run]
//
// Env: ZEPP_API is used when --api is not given. Each profile is staged in
// build/api-<level>/ (tree copy + generated app.json and config/build.js, with
// *.api-X.Y.js variants resolved), then `zeus build` runs there and the
// package is copied to dist/ha-zepp-api<level>.zab.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const config = require("../build.config.js");

const ROOT = path.resolve(__dirname, "..");
// Never copied into a modern stage.
const SKIP = new Set([
  ".git", ".github", ".claude", "build", "dist", "node_modules", "legacy",
  "scripts", "test", "docs", "images", "types", "i18n-src", "jsconfig.json", "build.config.js", "app.template.json",
  "package.json", "package-lock.json", "README.md",
]);
const SHAPES = { r: { st: "r", dw: 480 }, s: { st: "s", dw: 390 } };
const VARIANT = /\.api-(\d+(?:\.\d+)?)\.js$/;

function parseArgs(argv) {
  const args = { api: process.env.ZEPP_API || config.default, debug: false, dryRun: false, shape: null, features: {} };
  const known = new Set(Object.values(config.profiles).flatMap((p) => Object.keys(p.features || {})));
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--api") args.api = value();
    else if (a === "--debug") args.debug = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--shape") {
      args.shape = value().split(",");
      const bad = args.shape.filter((s) => !SHAPES[s]);
      if (bad.length) throw new Error(`Unknown shape ${bad.join(",")}; use ${Object.keys(SHAPES).join(",")}`);
    } else if (a === "--feature") {
      const [k, v] = value().split("=");
      if (!known.has(k)) throw new Error(`Unknown feature ${k}; known: ${[...known].join(", ")}`);
      if (v !== "true" && v !== "false") throw new Error(`--feature ${k} needs =true or =false`);
      args.features[k] = v === "true";
    } else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

const versionNum = (v) => v.split(".").map(Number).reduce((acc, n, i) => acc + n / 1000 ** i, 0);

function copyTree(src, dest, skip) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (skip && skip.has(name)) continue;
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyTree(from, to, null);
    else fs.copyFileSync(from, to);
  }
}

// foo.api-4.0.js replaces foo.js when level >= 4.0; the highest match wins.
function resolveVariants(dir, level) {
  const variants = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const file = path.join(d, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else if (VARIANT.test(name)) variants.push({ file, base: file.replace(VARIANT, ".js"), v: versionNum(name.match(VARIANT)[1]) });
    }
  };
  walk(dir);
  const best = new Map();
  for (const x of variants) {
    if (x.v <= versionNum(level) && !(best.get(x.base)?.v >= x.v)) best.set(x.base, x);
  }
  for (const x of variants) {
    if (best.get(x.base) === x) fs.renameSync(x.file, x.base);
    else fs.rmSync(x.file);
  }
  return [...best.keys()].map((f) => path.relative(dir, f));
}

function appJson(profile, args, features) {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, "app.template.json"), "utf8"));
  json.configVersion = profile.configVersion;
  json.permissions = profile.permissions;
  json.runtime.apiVersion = profile.apiVersion;
  json.debug = args.debug;
  const target = json.targets.common;
  target.platforms = args.shape ? args.shape.map((s) => SHAPES[s]) : profile.platforms;
  if (!features.appService) delete target.module["app-service"];
  // Every page the home screen can open stays registered; the camera page shows camera_disabled itself.
  if (!features.sleepAsAndroid) target.module.page.pages = target.module.page.pages.filter((p) => !p.startsWith("page/sleep/"));
  return json;
}

function stage(level, args) {
  const profile = config.profiles[level];
  if (!profile) throw new Error(`Unknown API profile "${level}". Known: ${Object.keys(config.profiles).join(", ")}`);
  const dir = path.join(ROOT, "build", `api-${level}`);
  fs.rmSync(dir, { recursive: true, force: true });

  if (profile.tree === "legacy") {
    copyTree(path.join(ROOT, "legacy"), dir, null);
    return { dir, report: { level, tree: "legacy" } };
  }

  const features = { ...profile.features, ...args.features };
  copyTree(ROOT, dir, SKIP);
  const variants = resolveVariants(dir, level);
  fs.mkdirSync(path.join(dir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "config", "build.js"),
    `// Generated by scripts/build.js. Do not edit.\nexport const API_LEVEL = ${JSON.stringify(level)};\nexport const FEATURES = ${JSON.stringify(features, null, 2)};\n`
  );
  fs.writeFileSync(path.join(dir, "app.json"), JSON.stringify(appJson(profile, args, features), null, 2) + "\n");
  return { dir, report: { level, tree: "modern", features, variants } };
}

function zeusBuild(dir, level) {
  // zeus resolves @zeppos/zml from the stage dir.
  const nm = path.join(dir, "node_modules");
  if (!fs.existsSync(nm)) fs.symlinkSync(path.join(ROOT, "node_modules"), nm, "dir");
  execFileSync("npx", ["zeus", "build"], { cwd: dir, stdio: "inherit" });
  const zab = fs.readdirSync(path.join(dir, "dist")).find((f) => f.endsWith(".zab"));
  if (!zab) throw new Error(`zeus produced no .zab for API ${level}`);
  fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
  const out = path.join(ROOT, "dist", `ha-zepp-api${level}.zab`);
  fs.copyFileSync(path.join(dir, "dist", zab), out);
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const levels = args.api === "all" ? Object.keys(config.profiles) : [args.api];
  for (const level of levels) {
    const { dir, report } = stage(level, args);
    console.log(JSON.stringify(report));
    if (!args.dryRun) console.log(`built ${zeusBuild(dir, level)}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = { parseArgs, resolveVariants, appJson, stage, versionNum };
