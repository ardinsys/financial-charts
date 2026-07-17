import type {
  ControllerConstructor,
  ControllerType
} from "./chart-options";

/** Owns chart-scoped controller registration and lookup. */
export class ControllerRegistry {
  private readonly constructors = new Map<
    ControllerType,
    ControllerConstructor
  >();
  private readonly defaultConstructors: readonly ControllerConstructor[];
  private snapshot?: readonly ControllerConstructor[];

  constructor(defaultConstructors: readonly ControllerConstructor[]) {
    this.defaultConstructors = [...defaultConstructors];
  }

  register(controller: ControllerConstructor): boolean {
    const id = getRegistrationId(controller) as ControllerType;
    if (this.constructors.get(id) === controller) return false;
    this.constructors.set(id, controller);
    this.snapshot = undefined;
    return true;
  }

  registerDefaults(): boolean {
    let changed = false;
    for (const controller of this.defaultConstructors) {
      changed = this.register(controller) || changed;
    }
    return changed;
  }

  get(type: ControllerType): ControllerConstructor {
    const controller = this.constructors.get(type);
    if (!controller) {
      throw new Error(`Controller: ${type} is not registered!`);
    }
    return controller;
  }

  getSnapshot(): readonly ControllerConstructor[] {
    if (!this.snapshot) {
      this.snapshot = [...this.constructors.values()];
    }
    return this.snapshot;
  }
}

function getRegistrationId(controller: ControllerConstructor): string {
  if (controller.ID === "default" || !controller.ID) {
    throw new Error("Controller must have a static ID field!");
  }
  return controller.ID;
}
