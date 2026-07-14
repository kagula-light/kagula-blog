import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const webRoot = resolve(import.meta.dirname, "..");
const standaloneWebRoot = resolve(webRoot, ".next", "standalone", "apps", "web");

async function replaceDirectory(source, target) {
  await rm(target, { recursive: true, force: true });
  await mkdir(resolve(target, ".."), { recursive: true });
  await cp(source, target, { recursive: true });
}

await Promise.all([
  replaceDirectory(resolve(webRoot, ".next", "static"), resolve(standaloneWebRoot, ".next", "static")),
  replaceDirectory(resolve(webRoot, "public"), resolve(standaloneWebRoot, "public")),
]);
