const components = new Map();

export function registerOpeningComponent(name, component) {
  components.set(name, component);
}

export function getOpeningComponent(name) {
  return components.get(name);
}

window.SamsaraOpening = Object.freeze({
  registerOpeningComponent,
  getOpeningComponent,
});
