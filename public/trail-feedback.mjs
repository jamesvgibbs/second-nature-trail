// Presentation-only delivery facts. The server remains the scoring authority.
const stages = ["load", "route", "travel", "repair", "deliver"];
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
    incident: cart.incident ? { ...cart.incident } : null,
    journal: cart.journal ? { ...cart.journal } : null,
    wheelChance: rules.shortcutWheelChance ? { ...rules.shortcutWheelChance } : null,
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
    if (action.choice !== 0 || !["deliver", "repair"].includes(nextCart.stage) || nextCart.visited !== true || nextCart.route !== model.selectedRoute || !sameCargo(nextCart.loaded, model.loaded, keys)) return null;
    if (nextCart.stage === "repair") {
      if (model.selectedRoute !== "shortcut" || nextCart.incident?.type !== "loose-wheel" || nextCart.incident.repairedAt !== null) return null;
      title = "A wheel came loose";
      details = ["The rubble shook a wheel loose. Reseat it here before continuing.", "Your cargo stays loaded; the repair uses no extra supplies or points."];
    } else {
      title = "Crossing checked";
      details = ["Your loaded supplies are ready for delivery at the broken highway."];
    }
  } else if (stage === "repair") {
    if (action.choice !== 0 || model.incident?.type !== "loose-wheel" || model.incident.repairedAt !== null || nextCart.stage !== "deliver" || nextCart.incident?.type !== "loose-wheel" || !Number.isFinite(nextCart.incident.repairedAt) || nextCart.visited !== true || nextCart.route !== model.selectedRoute || !sameCargo(nextCart.loaded, model.loaded, keys)) return null;
    title = "Wheel reseated";
    details = ["The wheel is secure. Continue to the delivery with your loaded cart."];
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
    { label: "Total useful value", value: current.primary },
  ];
  if (consistent) deltas.push({ label: "Points this trip", value: current.score - previous.score });
  if (outcome) for (const kind of Object.keys(model.loaded)) {
    deltas.push({ label: `Stored ${kind} now`, value: actualStorage[kind] });
    deltas.push({ label: `Reserve ${kind} now`, value: actualReserve[kind] });
  }
  return { id: action.requestId, title, details, deltas, completed, deltaStatus: consistent ? "consistent" : "concurrent", stage };
}

// Shared receipts for the existing non-delivery activities. These report current
// authoritative totals and submitted outcomes; they do not inspect answer keys.
export function actionReceipt(before, after, action, result) {
  if (action?.type === "task" && before?.event?.chapter === 0)
    return deliveryReceipt(before, after, action, result);
  if (!["task", "challenge", "rewardRedeem"].includes(action?.type) || !action.requestId || result?.ok !== true) return null;
  const chapter = before?.event?.chapter;
  if (!Number.isInteger(chapter) || chapter < 0 || chapter > 7 || action.expectedChapter !== chapter || after?.event?.chapter !== chapter || before.event.phase !== "chapter" || after.event.phase !== "chapter") return null;
  if (!before.me?.id || before.me.id !== after.me?.id || !before.projectionEpoch || before.projectionEpoch !== after.projectionEpoch || !Number.isSafeInteger(before.projectionVersion) || !Number.isSafeInteger(after.projectionVersion) || after.projectionVersion <= before.projectionVersion) return null;
  const previous = before.me.progress?.[chapter], current = after.me.progress?.[chapter], task = before.chapter?.task;
  const total = before.chapter?.taskCount;
  if (!previous || !current || !Number.isSafeInteger(total) || total < 1 || !Number.isSafeInteger(current.step) || !numeric(current.score)) return null;
  if (action.type === "task" && (previous.complete || action.expectedStep !== previous.step || action.expectedStage !== (task?.stage || null))) return null;
  let title, details, stage, completed = current.complete === true;
  const deltas = [{ label: "Score now", value: current.score }];
  if (action.type === "challenge") {
    if (!previous.complete || previous.challenge || typeof result.correct !== "boolean" || current.step !== previous.step || current.challenge !== result.correct || (!result.correct && current.mistakes !== previous.mistakes + 1)) return null;
    title = result.correct ? "Challenge complete" : "Try another approach";
    details = [result.correct ? "You solved the optional challenge." : "That choice did not solve the challenge. Review the problem and try again."];
    stage = "challenge"; completed = result.correct;
  } else if (action.type === "rewardRedeem" || task?.kind === "rewards") {
    const project = before.chapter?.rewardShop?.options?.[action.choice];
    if (chapter !== 6 || result.correct !== true || !project || previous.rewardUses?.includes(project.id) || !current.rewardUses?.includes(project.id) || current.rewardUses.length !== previous.rewardUses.length + 1 || current.rewardBalance !== previous.rewardBalance - project.cost || current.step !== previous.step + (previous.complete ? 0 : 1) || !current.complete) return null;
    title = "Neighborhood project funded";
    details = [project.label, ...(typeof result.message === "string" ? [result.message] : [])];
    deltas.push({ label: "Reward tokens remaining", value: current.rewardBalance });
    stage = "redeem";
  } else if (task?.kind === "targeting") {
    // Ordinary hits and misses stay inline; no additional dialog per round.
    if (action.expectedRound !== task.round || result.correct !== true || current.step !== previous.step + 1 || current.targetHits !== previous.targetHits + 1 || current.siteHits !== 0) return null;
    title = "Site cleared";
    details = [`${task.target?.name || "This site"} is clear.`, current.complete ? "Every outbreak site is clear." : "Continue to the next marked site."];
    deltas.push({ label: "Targets resolved", value: current.targetHits });
    stage = "target-site";
  } else if (task?.kind === "budget") {
    const cycle = current.cycles?.at(-1);
    if (typeof result.correct !== "boolean" || current.step !== previous.step + 1 || current.cycles?.length !== previous.cycles?.length + 1 || !cycle || cycle.onTime !== result.correct || cycle.retained !== current.budget) return null;
    title = cycle.onTime ? "Payment made on time" : "Payment cycle recorded";
    details = [`Paid ${cycle.payment}; spent ${cycle.expense}; kept ${cycle.retained}.`, cycle.onTime ? "This fictional payment met the amount and deadline." : "No on-time points earned. This fictional payment did not meet both the required amount and deadline."];
    deltas.push({ label: "Fictional budget retained", value: current.budget });
    stage = "budget";
  } else if (task?.kind === "routing") {
    if (typeof result.correct !== "boolean" || current.step !== previous.step + (result.correct ? 1 : 0) || (!result.correct && current.mistakes !== previous.mistakes + 1)) return null;
    title = result.correct ? "Home connected" : "Connection needs another plan";
    details = [result.correct ? "Your route connects this home within its relay and cable constraints." : "This route did not meet every connection, relay and budget requirement. Adjust the plan and try again."];
    stage = "routing";
  } else if (task?.stage === "inspect") {
    if (result.inspected !== true || previous.inspected || !current.inspected || current.step !== previous.step) return null;
    title = "Site inspected";
    details = ["The site evidence is ready. Review it before choosing your next action."];
    stage = "inspect";
  } else if (task?.stage === "decide") {
    if (!previous.inspected || typeof result.correct !== "boolean" || current.step !== previous.step + (result.correct ? 1 : 0) || (result.correct ? current.inspected : current.mistakes !== previous.mistakes + 1)) return null;
    title = result.correct ? "Work completed" : "This site still needs help";
    details = [result.correct ? "Your action completed this site’s task." : "That action did not resolve the task. Review the evidence and try again."];
    stage = "decide";
    if (chapter === 6) deltas.push({ label: "Reward tokens available", value: current.rewardBalance });
  } else return null;
  if (action.type !== "challenge") {
    if (current.complete !== (current.step === total)) return null;
    if (result.complete !== undefined && result.complete !== current.complete) return null;
    deltas.unshift({ label: "Objective progress", value: `${current.step}/${total}` });
    if (completed && !previous.complete) details.push("Your completed objective contributes to shared neighborhood restoration.");
  }
  return { id: action.requestId, title, details, deltas, completed, deltaStatus: "totals", stage };
}
