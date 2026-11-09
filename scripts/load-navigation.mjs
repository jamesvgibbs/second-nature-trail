import { waypointReached } from "../public/world.mjs";
// Use the same corner tolerance as the browser client.
export function nextWaypoint(position, path) {
  while (path.length && waypointReached(position, path[0])) path.shift();
  return path[0] ?? null;
}
