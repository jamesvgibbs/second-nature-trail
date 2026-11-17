// Presentation copy and display geometry only; this module never changes game rules.
export const FIELD_NOTES = [
  'The AI has rerouted moving day into a dead end. Pack a delivery cart, inspect a route, and get useful supplies to the broken highway.',
  'The neighborhood air system is failing. Read each home’s label, then fit the right filter in the right direction.',
  'Counterfeit notices are spreading through the district. Check the evidence and verify the source before acting.',
  'Homes need help after a string of disasters. Document what happened, put safety first, and check the actual policy.',
  'The warning network has gone haywire. Read the marked signal, choose a target, and help each affected site recover.',
  'Payment systems are stuck in a loop. Plan each fictional cycle, make a payment on time, and carry your remaining budget forward.',
  'The AI has hoarded the neighborhood’s rewards. Complete supply jobs, then spend earned tokens on a shared repair.',
  'The last connections are down. Route a network through working relays and reconnect the homes within the cable budget.',
];
export function fitWorld(width, height) {
  const scale = Math.max(0, Math.min(Number(width) / 1200, Number(height) / 800));
  return { width: 1200 * scale, height: 800 * scale };
}
export const DELIVERY_STAGES = [
  ['load', 'Pack'], ['route', 'Choose route'], ['travel', 'Inspect'], ['deliver', 'Deliver'],
];
export function stageLabel(task) {
  return ({ load: 'Pack the cart', route: 'Choose your route', travel: 'Inspect the route', deliver: 'Make the delivery', inspect: 'Inspect the site', decide: 'Put the plan to work', redeem: 'Use your rewards' })[task?.stage] || ({ targeting: 'Resolve the warning', routing: 'Connect the home', budget: 'Plan this payment', rewards: 'Use your rewards' })[task?.kind] || 'Continue the objective';
}
export const SITE_LABELS = [
  ['MOVING DEPOT', 'HIGHWAY'], ['FILTER DEPOT', 'VENT MAZE'],
  ['IDENTITY OFFICE', 'TOWN HALL'], ['INSURANCE', 'DISASTER BLK'],
  ['APARTMENTS', 'SERVICE HQ'], ['TRADING POST', 'PAYMENT STN'],
  ['REWARDS ARCADE', 'NIGHT MARKET'], ['NET EXCHANGE', 'AI HQ'],
];
