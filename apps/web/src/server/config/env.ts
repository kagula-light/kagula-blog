import { parseRuntimeEnv, type RuntimeEnv } from "@kagura/config/env";

export function getServerEnv(input: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  return parseRuntimeEnv(input);
}
