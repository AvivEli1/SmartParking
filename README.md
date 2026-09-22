# Smart Parking Lot — Software Simulation

A web-based simulation of the software side of our smart parking lot project. It models
a parking lot with an entrance sensor and a per-spot sensor grid, automatically routes an
arriving car to the nearest open spot, and shows the whole thing from two angles at once:

- **Virtual lot** (right) — a top-down view of the lot with live spot status, the car
  driving to its spot, and big directional arrows tracing the route.
- **Phone app** (left) — a mockup of the mobile app a driver would use in their car:
  "car detected" → "finding nearest spot" → turn-by-turn directions → arrival.

There's no real hardware involved here — every sensor event (a car arriving, a spot
filling up or freeing) is simulated in the browser. Click any spot to simulate its
sensor, or turn on **Live Traffic** to have the lot fill and empty on its own. If the
spot your car is heading to gets taken while it's en route, it re-routes automatically.

## Tech stack

- **React + TypeScript**, built with **Vite**
- Plain **HTML5 Canvas** for the lot rendering — no game engine, no charting library
- No backend — all state lives in the browser for now (see below)

## Getting started

You'll need [Node.js](https://nodejs.org/) (v18 or newer) installed.

```bash
# 1. Clone the repo
git clone https://github.com/AvivEli1/SmartParking.git
cd SmartParking

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Then open the URL it prints (usually `http://localhost:5173`) in your browser.

Other useful commands:

```bash
npm run build    # type-check and build a production bundle to dist/
npm run lint     # run the linter
npm run preview  # preview the production build locally
```

## Project structure

```
src/
  lot/                  # pure logic — no React here
    types.ts            # Cell / Spot / LotModel types
    generateLot.ts       # builds the lot layout (spots, lanes, entrance)
    pathfinding.ts        # BFS pathfinding — nearest free spot, route to a specific spot
    directions.ts          # turns a path into turn-by-turn text directions
  components/
    VirtualLot.tsx        # canvas rendering of the lot, cars, route arrows, sensor pings
    PhoneApp.tsx           # the phone mockup UI
    ActivityFeed.tsx        # live sensor/event log
    StatsHeader.tsx          # header bar: occupancy ring + Live Traffic toggle
  App.tsx                # top-level state + the animation loop that drives everything
```

## Working on this as a team

1. Pull the latest `main` before you start: `git pull`
2. Make a branch for your change: `git checkout -b your-name/short-description`
3. Commit and push your branch, then open a Pull Request into `main` so others can review
   before it merges — please avoid pushing straight to `main`.
4. Run `npm run build` before pushing to make sure it still type-checks and builds cleanly.

## Where this is headed

This repo is only the software simulation. The plan is for it to eventually plug into
the real hardware (entrance sensor + per-spot sensors) by swapping the simulated sensor
events in `App.tsx` for real ones over MQTT/HTTP, without changing the lot logic,
rendering, or phone UI underneath.
