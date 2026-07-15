import type { MascotRuntime } from "../types";

interface MascotWidgetOptions {
  readonly model: Readonly<{ readonly path: string; readonly tips: false }>;
  readonly menus: Readonly<{ readonly items: [] }>;
  readonly position: "bottom-right";
  readonly size: Readonly<{ readonly width: 240; readonly height: 320 }>;
  readonly transitionDuration: 0;
  readonly transitionType: "fade";
}

interface MascotWidgetModule {
  readonly createWidget: (options: MascotWidgetOptions) => unknown;
}

interface PartialMascotWidget {
  readonly sleep?: unknown;
  readonly destroy?: unknown;
}

interface MascotLoadSignal {
  readonly canvas?: Readonly<{
    readonly parentElement?: Readonly<{
      readonly classList?: Readonly<{ readonly add: (className: string) => void }>;
    }> | null;
  }>;
  readonly on: (event: "loaded", listener: () => void) => unknown;
  readonly off?: (event: "loaded", listener: () => void) => unknown;
}

interface MascotWidgetLifecycle {
  readonly l2d: MascotLoadSignal;
  readonly sleep: () => void;
  readonly destroy: () => Promise<void>;
}

export type MascotWidgetModuleLoader = () => Promise<MascotWidgetModule>;

function loadWidgetModule(): Promise<MascotWidgetModule> {
  return import("l2d-widget");
}

function isPartialMascotWidget(value: unknown): value is PartialMascotWidget {
  return typeof value === "object" && value !== null;
}

function hasMascotLifecycle(value: unknown): value is MascotWidgetLifecycle {
  return (
    isPartialMascotWidget(value) &&
    "l2d" in value &&
    typeof value.l2d === "object" &&
    value.l2d !== null &&
    "on" in value.l2d &&
    typeof value.l2d.on === "function" &&
    typeof value.sleep === "function" &&
    typeof value.destroy === "function"
  );
}

function markRuntimeHost(widget: MascotWidgetLifecycle): void {
  widget.l2d.canvas?.parentElement?.classList?.add("kagura-mascot-runtime-host");
}

function waitForModelLoaded(widget: MascotWidgetLifecycle, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      widget.l2d.off?.("loaded", handleLoaded);
    };
    const handleLoaded = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("mascot model load timed out"));
    }, timeoutMs);
    widget.l2d.on("loaded", handleLoaded);
  });
}

export async function loadMascot(
  modelUrl: string,
  loadModule: MascotWidgetModuleLoader = loadWidgetModule,
  timeoutMs = 4_000,
): Promise<MascotRuntime> {
  const widgetModule = await loadModule();
  let widget: unknown;

  try {
    widget = widgetModule.createWidget({
      model: { path: modelUrl, tips: false },
      menus: { items: [] },
      position: "bottom-right",
      size: { width: 240, height: 320 },
      transitionDuration: 0,
      transitionType: "fade",
    });
    if (!hasMascotLifecycle(widget)) {
      throw new Error("mascot widget lifecycle is incomplete");
    }

    const runtimeWidget = widget;
    markRuntimeHost(runtimeWidget);
    await waitForModelLoaded(runtimeWidget, timeoutMs);
    return {
      sleep: () => runtimeWidget.sleep(),
      destroy: async () => runtimeWidget.destroy(),
    };
  } catch (error) {
    if (isPartialMascotWidget(widget) && typeof widget.destroy === "function") {
      try {
        await widget.destroy();
      } catch {
        // Preserve the initialization error; cleanup is best effort at this boundary.
      }
    }
    throw error;
  }
}
