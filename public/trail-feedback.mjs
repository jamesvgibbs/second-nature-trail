// Presentation-only delivery facts. The server remains the scoring authority.
const stages = ["load", "route", "travel", "deliver"];
const numeric = value => Number.isFinite(value) && value >= 0;
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const quantities = (source, keys) => Object.fromEntries(keys.map(key => [key, source?.[key] ?? 0]));
const sameCargo = (a, b, keys) => keys.every(key => (a?.[key] || 0) === (b?.[key] || 0));
const cargoText = cargo => Object.entries(cargo).filter(([, quantity]) => quantity > 0).map(([kind, quantity]) => `${quantity} ${kind}`).join(" + ");

export function deliveryModel(state) {
  if (state?.event?.chapter !== 0) return null;
  const rules = state.rules, progress = state.me?.progress?.[0];
  if (!rules || !progress || !Array.isArray(rules.cargoPlans) || !rules.cargoPlans.length) return null;
  const keys = Object.keys(rules.values || {});
  if (!keys.length || !keys.every(key => numeric(rules.values[key]))) return null;
  if (![rules.cargoSlots, rules.storageLimit, rules.deliveryDamage, rules.taskPoints].every(numeric)) return null;
  const storage = quantities(state.me.inventory, keys), reserve = quantities(progress.reserve, keys);
  if (![...Object.values(storage), ...Object.values(reserve)].every(value => Number.isSafeInteger(value) && value >= 0)) return null;
  const cart = progress.delivery;
  const total = state.chapter?.taskCount;
  if (!cart || !stages.includes(cart.stage) || !Number.isSafeInteger(total) || total < 1 || !Number.isSafeInteger(progress.step) || progress.step < 0 || progress.step > total) return null;
  const validCargo = cargo => cargo && Object.entries(cargo).every(([kind, qty]) => keys.includes(kind) && Number.isSafeInteger(qty) && qty > 0 && numeric(rules.cargoWeights?.[kind]));
  if (!rules.cargoPlans.every(validCargo) || (cart.loaded && !validCargo(cart.loaded))) return null;
  const value = (cargo, damage = 0) => Object.entries(cargo).reduce((sum, [kind, qty]) => sum + qty * Math.max(0, rules.values[kind] - damage), 0);
  const slots = cargo => Object.entries(cargo).reduce((sum, [kind, qty]) => sum + qty * rules.cargoWeights[kind], 0);
  const maxValue = Math.max(...rules.cargoPlans.map(plan => value(plan)));
  if (!(maxValue > 0)) return null;
  const outcome = (cargo, damage) => {
    const delivered = value(cargo, damage);
    return { value: delivered, points: Math.round(delivered / maxValue * rules.taskPoints), damageValue: value(cargo) - delivered };
  };
  const plans = rules.cargoPlans.map((cargo, id) => ({
    id,
    label: rules.cargoPlanLabels?.[id] || `Load ${id + 1}`,
    cargo: { ...cargo },
    slots: slots(cargo),
    available: slots(cargo) <= rules.cargoSlots && Object.entries(cargo).every(([kind, qty]) => storage[kind] + reserve[kind] >= qty),
    safe: outcome(cargo, 0),
    shortcut: outcome(cargo, rules.deliveryDamage),
  }));
  const loaded = cart.loaded ? { ...cart.loaded } : null;
  const routes = loaded ? [
    { id: "scenic", label: rules.deliveryCheckpoints?.scenic?.name || "Paved detour", ...outcome(loaded, 0) },
    { id: "shortcut", label: rules.deliveryCheckpoints?.shortcut?.name || "Rubble shortcut", ...outcome(loaded, rules.deliveryDamage) },
  ] : [];
  return {
    stage: cart.stage, loaded, storage, reserve,
    storageUsed: Object.values(storage).reduce((sum, quantity) => sum + quantity, 0),
    storageLimit: rules.storageLimit, storageValue: value(storage),
    slots: loaded ? slots(loaded) : 0, maxSlots: rules.cargoSlots,
    deliveryNumber: Math.min(progress.step + 1, total), completedDeliveries: progress.step, totalDeliveries: total,
    plans, routes, selectedRoute: cart.route,
    target: state.chapter?.task?.target ? { ...state.chapter.task.target } : null,
    complete: progress.complete === true, primary: progress.primary, score: progress.score,
  };
}

// Call only on the actual accepted action response, not on SSE/reconnect updates.
// A matching net delta cannot prove absence of countervailing concurrent actions;
// therefore delta text describes observed totals, not exclusive action causality.
export function deliveryReceipt(before, after, action, result) {
  if (action?.type !== "task" || typeof action.requestId !== "string" || !action.requestId || result?.ok !== true || result.correct !== true) return null;
  if (before?.event?.phase !== "chapter" || after?.event?.phase !== "chapter" || before.event.chapter !== 0 || after.event.chapter !== 0) return null;
  if (!before.me?.id || before.me.id !== after.me?.id || !before.projectionEpoch || before.projectionEpoch !== after.projectionEpoch) return null;
  if (!Number.isSafeInteger(before.projectionVersion) || !Number.isSafeInteger(after.projectionVersion) || after.projectionVersion <= before.projectionVersion) return null;
  const model = deliveryModel(before);
  if (!model || model.complete || action.expectedChapter !== 0 || action.expectedStep !== model.completedDeliveries || action.expectedStage !== model.stage) return null;
  const previous = before.me.progress[0], current = after.me.progress?.[0], nextCart = current?.delivery;
  if (!current || !nextCart || !numeric(current.score) || !Number.isFinite(current.primary)) return null;
  const keys = Object.keys(model.storage), stage = model.stage;
  let title, details, outcome = null;
  if (stage === "load") {
    const plan = model.plans[action.choice];
    if (!Number.isInteger(action.choice) || !plan?.available || nextCart.stage !== "route" || !sameCargo(nextCart.loaded, plan.cargo, keys) || nextCart.route !== null || nextCart.visited !== false) return null;
    title = "Cart packed";
    details = [`${cargoText(plan.cargo)} · ${plan.slots}/${model.maxSlots} cart slots.`, "Supplies are used when you deliver. Choose a route next."];
  } else if (stage === "route") {
    if (![0, 1].includes(action.choice)) return null;
    const route = model.routes[action.choice];
    if (!route || nextCart.stage !== "travel" || nextCart.route !== route.id || nextCart.visited !== false || !sameCargo(nextCart.loaded, model.loaded, keys)) return null;
    title = "Route chosen";
    details = [route.label, route.damageValue ? `This route will lose ${route.damageValue} cargo value: ${route.value} useful value and ${route.points} delivery points remain.` : `Cargo stays protected: ${route.value} useful value and ${route.points} delivery points.`, "Reach the marked crossing before delivering."];
  } else if (stage === "travel") {
    if (action.choice !== 0 || nextCart.stage !== "deliver" || nextCart.visited !== true || nextCart.route !== model.selectedRoute || !sameCargo(nextCart.loaded, model.loaded, keys)) return null;
    title = "Crossing checked";
    details = ["Your loaded supplies are ready for delivery at the broken highway."];
  } else {
    outcome = model.routes.find(route => route.id === model.selectedRoute);
    if (action.choice !== 0 || !previous.delivery.visited || !outcome || nextCart.stage !== "load" || nextCart.loaded !== null || nextCart.route !== null || nextCart.visited !== false) return null;
    title = "Delivery complete";
    details = [`${cargoText(model.loaded)} delivered.`, `Delivered useful value: ${outcome.value}.${outcome.damageValue ? ` The shortcut cost ${outcome.damageValue} value.` : " The paved route protected the cargo."}`, `Delivery points: ${outcome.points}.`];
  }
  const expectedStep = previous.step + (stage === "deliver" ? 1 : 0);
  const completed = expectedStep === model.totalDeliveries;
  if (current.step !== expectedStep || current.complete !== completed || result.complete !== completed) return null;
  if (current.primary !== previous.primary + (outcome?.value || 0)) return null;
  const expectedStorage = { ...model.storage }, expectedReserve = { ...model.reserve };
  if (outcome) for (const [kind, qty] of Object.entries(model.loaded)) {
    const fromStorage = Math.min(expectedStorage[kind], qty);
    expectedStorage[kind] -= fromStorage; expectedReserve[kind] -= qty - fromStorage;
  }
  const actualStorage = quantities(after.me.inventory, keys), actualReserve = quantities(current.reserve, keys);
  if (![...Object.values(actualStorage), ...Object.values(actualReserve)].every(value => Number.isSafeInteger(value) && value >= 0)) return null;
  const changedElsewhere = !equal(previous.quiz, current.quiz) || previous.challenge !== current.challenge || previous.mistakes !== current.mistakes || !equal(previous.assists, current.assists);
  const consistent = current.score - previous.score === (outcome?.points || 0) && sameCargo(actualStorage, expectedStorage, keys) && sameCargo(actualReserve, expectedReserve, keys) && !changedElsewhere;
  if (!consistent) details.push("Your supplies or score also changed while you were delivering. Current totals are shown below.");
  if (completed) details.push(`All ${model.totalDeliveries} deliveries are complete. Your completed objective contributes to shared neighborhood restoration.`);
  const deltas = [
    { label: "Deliveries", value: `${current.step}/${model.totalDeliveries}` },
    { label: "Score now", value: current.score },
    { label: "Useful value delivered", value: current.primary },
  ];
  if (consistent) deltas.push({ label: "Score change", value: current.score - previous.score });
  if (outcome) for (const kind of Object.keys(model.loaded)) {
    deltas.push({ label: `Stored ${kind} now`, value: actualStorage[kind] });
    deltas.push({ label: `Reserve ${kind} now`, value: actualReserve[kind] });
  }
  return { id: action.requestId, title, details, deltas, completed, deltaStatus: consistent ? "consistent" : "concurrent", stage };
}
