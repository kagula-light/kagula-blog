import type { MascotRuntime } from "../types";

interface MascotWidgetOptions {
  readonly model: Readonly<{ readonly path: string }>;
}

interface MascotWidgetModule {
  readonly createWidget: (options: MascotWidgetOptions) => unknown;
}

interface PartialMascotWidget {
  readonly sleep?: unknown;
  readonly destroy?: unknown;
}

interface MascotWidgetLifecycle {
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
    typeof value.sleep === "function" &&
    typeof value.destroy === "function"
  );
}

export async function loadMascot(
  modelUrl: string,
  loadModule: MascotWidgetModuleLoader = loadWidgetModule,
): Promise<MascotRuntime> {
  const widgetModule = await loadModule();
  let widget: unknown;

  try {
    widget = widgetModule.createWidget({ model: { path: modelUrl } });
    if (!hasMascotLifecycle(widget)) {
      throw new Error("mascot widget lifecycle is incomplete");
    }

    const runtimeWidget = widget;
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
