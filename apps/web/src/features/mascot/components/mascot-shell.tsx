import Image from "next/image";
import { connection } from "next/server";

import { getServerEnv } from "../../../server/config/env";
import { MascotClient } from "./mascot-client";
import { createMascotServerConfig } from "../lib/mascot-config";

export async function MascotShell() {
  await connection();
  const env = getServerEnv();
  const config = createMascotServerConfig({
    enabled: env.MASCOT_ENABLED,
    publicAssetBaseUrl: env.R2_PUBLIC_BASE_URL,
    posterPath: env.MASCOT_POSTER_PATH,
    ...(env.MASCOT_MODEL_PATH === undefined ? {} : { modelPath: env.MASCOT_MODEL_PATH }),
  });
  if (!config.enabled) return null;

  return (
    <aside className="mascot-shell" aria-label="神乐静无月看板娘">
      <MascotClient enabled={config.enabled} modelUrl={config.modelUrl}>
        <Image
          src={config.posterPath}
          alt=""
          width={240}
          height={320}
          sizes="(max-width: 768px) 64px, 240px"
        />
      </MascotClient>
    </aside>
  );
}
