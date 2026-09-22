import { useEffect, useRef, useState } from 'react';
import './App.css';
import VirtualLot, { type CarVisual, type PingVisual } from './components/VirtualLot';
import PhoneApp, { type NavStatus } from './components/PhoneApp';
import ActivityFeed, { type ActivityEntry } from './components/ActivityFeed';
import StatsHeader from './components/StatsHeader';
import { generateLot } from './lot/generateLot';
import { findNearestFreeSpot, buildRouteToSpot, type RouteResult } from './lot/pathfinding';
import { buildDirections } from './lot/directions';
import type { GridPoint, Spot } from './lot/types';

const MS_PER_CELL = 900;
const AMBIENT_MS_PER_CELL = 550;
const DETECT_MS = 1000;
const SEARCH_MS = 1000;
const PING_MS = 700;
const AMBIENT_SPAWN_MS = 3200;
const MAX_AMBIENT_CARS = 3;
const REROUTE_STEAL_CHANCE = 0.55;

interface AmbientCar {
  id: string;
  path: GridPoint[];
  spotId: string;
  startTime: number;
}

function angleFor(dr: number, dc: number): number {
  return (Math.atan2(dr, dc) * 180) / Math.PI;
}

/**
 * Interpolates a car's position/heading along a grid path at time `t`
 * (in cell units). `idx` always keeps a valid "next" point so the heading
 * stays correct on the final frame instead of snapping to a default angle.
 */
function carVisualFromPath(path: GridPoint[], t: number): CarVisual {
  const maxIdx = Math.max(path.length - 1, 0);
  if (maxIdx === 0) {
    const p = path[0] ?? [0, 0];
    return { row: p[0], col: p[1], angle: 0 };
  }
  const safeT = Number.isFinite(t) ? t : 0;
  const clampedT = Math.min(Math.max(safeT, 0), maxIdx);
  const idx = Math.min(Math.floor(clampedT), maxIdx - 1);
  const frac = clampedT - idx;
  const p0 = path[idx];
  const p1 = path[idx + 1];
  return {
    row: p0[0] + (p1[0] - p0[0]) * frac,
    col: p0[1] + (p1[1] - p0[1]) * frac,
    angle: angleFor(p1[0] - p0[0], p1[1] - p0[1]),
  };
}

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function App() {
  const [lot, setLot] = useState(() => generateLot());
  const [userStatus, setUserStatus] = useState<NavStatus>('idle');
  const [userRoute, setUserRoute] = useState<RouteResult | null>(null);
  const [userRouteStart, setUserRouteStart] = useState<number | null>(null);
  const [rerouteNotice, setRerouteNotice] = useState<string | null>(null);
  const [ambientCars, setAmbientCars] = useState<AmbientCar[]>([]);
  const [pings, setPings] = useState<{ id: string; row: number; col: number; startTime: number }[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [liveTraffic, setLiveTraffic] = useState(false);
  const [clock, setClock] = useState(() => performance.now());

  const lotRef = useRef(lot);
  const userStatusRef = useRef(userStatus);
  const userRouteRef = useRef(userRoute);
  const userRouteStartRef = useRef(userRouteStart);
  const ambientCarsRef = useRef(ambientCars);
  const pingsRef = useRef(pings);
  const idCounter = useRef(0);

  useEffect(() => {
    lotRef.current = lot;
  }, [lot]);
  useEffect(() => {
    userStatusRef.current = userStatus;
  }, [userStatus]);
  useEffect(() => {
    userRouteRef.current = userRoute;
  }, [userRoute]);
  useEffect(() => {
    userRouteStartRef.current = userRouteStart;
  }, [userRouteStart]);
  useEffect(() => {
    ambientCarsRef.current = ambientCars;
  }, [ambientCars]);
  useEffect(() => {
    pingsRef.current = pings;
  }, [pings]);

  const nextId = (prefix: string) => `${prefix}${idCounter.current++}`;

  const logActivity = (text: string, kind: ActivityEntry['kind']) => {
    setActivity((prev) => [{ id: nextId('a'), time: timeNow(), text, kind }, ...prev].slice(0, 40));
  };

  const addPing = (row: number, col: number) => {
    const now = performance.now();
    setPings((prev) => [...prev, { id: nextId('p'), row, col, startTime: now }]);
    setClock((prevClock) => Math.max(prevClock, now));
  };

  const freeCount = lot.spots.filter((s) => !s.occupied).length;
  const interactive = userStatus === 'idle';

  const toggleSpot = (id: string) => {
    if (!interactive) return;
    const spot = lot.spots.find((s) => s.id === id);
    if (!spot) return;
    const willBeOccupied = !spot.occupied;
    setLot((prev) => ({
      ...prev,
      spots: prev.spots.map((s) => (s.id === id ? { ...s, occupied: willBeOccupied } : s)),
    }));
    addPing(spot.row, spot.col);
    logActivity(`🔧 Spot ${id} sensor → ${willBeOccupied ? 'OCCUPIED' : 'FREE'}`, 'info');
  };

  const handleFindSpot = () => {
    if (userStatus !== 'idle' || freeCount === 0) return;
    setUserStatus('detecting');
    logActivity('🚦 Entrance sensor triggered — car detected', 'info');
  };

  const handleReset = () => {
    setUserRoute(null);
    setUserRouteStart(null);
    setUserStatus('idle');
    setRerouteNotice(null);
  };

  // Stage 1: "CAR DETECTED"
  useEffect(() => {
    if (userStatus !== 'detecting') return;
    const id = setTimeout(() => setUserStatus('searching'), DETECT_MS);
    return () => clearTimeout(id);
  }, [userStatus]);

  // Stage 2: "Finding nearest spot…"
  useEffect(() => {
    if (userStatus !== 'searching') return;
    logActivity('🔍 Searching for the nearest spot…', 'info');
    const id = setTimeout(() => {
      const result = findNearestFreeSpot(lotRef.current, [lotRef.current.entrance.row, lotRef.current.entrance.col]);
      if (!result) {
        setUserStatus('idle');
        logActivity('❌ No spots available', 'warning');
        return;
      }
      const startTime = performance.now();
      setUserRoute(result);
      setUserRouteStart(startTime);
      setUserStatus('navigating');
      setClock(startTime);
      logActivity(`🅿️ Routing you to Spot ${result.spot.id}`, 'success');
    }, SEARCH_MS);
    return () => clearTimeout(id);
  }, [userStatus]);

  // Ambient traffic spawner
  useEffect(() => {
    if (!liveTraffic) return;
    const id = setInterval(() => {
      const currentLot = lotRef.current;
      const free = currentLot.spots.filter((s) => !s.occupied);
      const occupied = currentLot.spots.filter((s) => s.occupied);
      const occupancy = currentLot.spots.length === 0 ? 0 : occupied.length / currentLot.spots.length;
      const arrivalProb = Math.max(0.15, Math.min(0.85, 0.75 - occupancy * 0.5));

      if (Math.random() < arrivalProb && free.length > 0 && ambientCarsRef.current.length < MAX_AMBIENT_CARS) {
        let target: Spot | undefined;
        const activeUserRoute = userRouteRef.current;
        if (userStatusRef.current === 'navigating' && activeUserRoute && Math.random() < REROUTE_STEAL_CHANCE) {
          target = currentLot.spots.find((s) => s.id === activeUserRoute.spot.id && !s.occupied);
        }
        if (!target) target = free[Math.floor(Math.random() * free.length)];

        const start: GridPoint = [currentLot.entrance.row, currentLot.entrance.col];
        const route = buildRouteToSpot(currentLot, start, target);
        if (route) {
          const startTime = performance.now();
          setAmbientCars((prev) => [...prev, { id: nextId('amb'), path: route.path, spotId: target!.id, startTime }]);
          setClock(startTime);
          logActivity(`🚗 Another car is heading to Spot ${target.id}`, 'ambient');
        }
      } else if (occupied.length > 0) {
        const spot = occupied[Math.floor(Math.random() * occupied.length)];
        setLot((prev) => ({
          ...prev,
          spots: prev.spots.map((s) => (s.id === spot.id ? { ...s, occupied: false } : s)),
        }));
        addPing(spot.row, spot.col);
        logActivity(`🚙 Spot ${spot.id} just freed up`, 'ambient');
      }
    }, AMBIENT_SPAWN_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTraffic]);

  // Master animation loop — drives the user's car, ambient traffic, and ping ripples.
  useEffect(() => {
    let raf: number;

    const tick = () => {
      const now = performance.now();
      let animating = false;

      // Your car
      if (userStatusRef.current === 'navigating' && userRouteRef.current && userRouteStartRef.current !== null) {
        const route = userRouteRef.current;
        const maxT = route.path.length - 1;
        const t = Math.min((now - userRouteStartRef.current) / MS_PER_CELL, maxT);
        const targetSpot = lotRef.current.spots.find((s) => s.id === route.spot.id);

        if (targetSpot?.occupied && t < maxT - 0.02) {
          const idx = Math.min(Math.round(t), maxT);
          const currentCell = route.path[idx];
          const alt = findNearestFreeSpot(lotRef.current, currentCell);
          if (alt) {
            userRouteRef.current = alt;
            userRouteStartRef.current = now;
            setUserRoute(alt);
            setUserRouteStart(now);
            const notice = `Spot ${route.spot.id} was just taken — rerouting to ${alt.spot.id}`;
            setRerouteNotice(notice);
            logActivity(`⚠️ ${notice}`, 'warning');
            setTimeout(() => setRerouteNotice(null), 2600);
          } else {
            userStatusRef.current = 'idle';
            userRouteRef.current = null;
            userRouteStartRef.current = null;
            setUserStatus('idle');
            setUserRoute(null);
            setUserRouteStart(null);
            logActivity('❌ Lot filled up before you could park', 'warning');
          }
        } else if (t >= maxT) {
          const spotId = route.spot.id;
          userStatusRef.current = 'arrived';
          setLot((prev) => ({
            ...prev,
            spots: prev.spots.map((s) => (s.id === spotId ? { ...s, occupied: true } : s)),
          }));
          addPing(route.spot.row, route.spot.col);
          setUserStatus('arrived');
          logActivity(`✅ Parked at Spot ${spotId}`, 'success');
        }
        animating = true;
      }

      // Ambient traffic
      if (ambientCarsRef.current.length > 0) {
        const arrived: string[] = [];
        const remaining: AmbientCar[] = [];
        for (const c of ambientCarsRef.current) {
          const maxT = c.path.length - 1;
          const t = Math.min((now - c.startTime) / AMBIENT_MS_PER_CELL, maxT);
          if (t >= maxT) arrived.push(c.spotId);
          else remaining.push(c);
        }
        if (arrived.length > 0) {
          ambientCarsRef.current = remaining;
          setLot((prev) => ({
            ...prev,
            spots: prev.spots.map((s) => (arrived.includes(s.id) ? { ...s, occupied: true } : s)),
          }));
          for (const spotId of arrived) {
            const spot = lotRef.current.spots.find((s) => s.id === spotId);
            if (spot) addPing(spot.row, spot.col);
            logActivity(`🚗 Another car parked at Spot ${spotId}`, 'ambient');
          }
          setAmbientCars(remaining);
        }
        animating = true;
      }

      // Ping ripples
      const hasPings = pingsRef.current.length > 0;
      if (hasPings) {
        setPings((prev) => {
          const alive = prev.filter((p) => now - p.startTime < PING_MS);
          return alive.length === prev.length ? prev : alive;
        });
      }

      if (animating || hasPings) {
        setClock(now);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const userT =
    userRoute && userRouteStart !== null
      ? Math.min((clock - userRouteStart) / MS_PER_CELL, userRoute.path.length - 1)
      : 0;

  const steps = userRoute ? buildDirections(userRoute.path, userRoute.spot.id) : [];
  let currentStepIndex = 0;
  if (userRoute) {
    const idx = Math.min(Math.round(userT), userRoute.path.length - 1);
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].fromIndex <= idx) currentStepIndex = i;
      else break;
    }
  }

  const showRoute = userStatus === 'navigating' || userStatus === 'arrived';
  const carVisual: CarVisual | null = userRoute && showRoute ? carVisualFromPath(userRoute.path, userT) : null;

  const ambientVisuals: CarVisual[] = ambientCars.map((c) => {
    const maxT = c.path.length - 1;
    const t = Math.min((clock - c.startTime) / AMBIENT_MS_PER_CELL, maxT);
    return carVisualFromPath(c.path, t);
  });

  const pingVisuals: PingVisual[] = pings.map((p) => ({
    row: p.row,
    col: p.col,
    age: Math.max(0, Math.min((clock - p.startTime) / PING_MS, 1)),
  }));

  return (
    <div className="app">
      <StatsHeader free={freeCount} total={lot.spots.length} liveTraffic={liveTraffic} onToggleLiveTraffic={setLiveTraffic} />

      <main className="app__main">
        <section className="app__col app__col--phone">
          <PhoneApp
            status={userStatus}
            targetSpotId={userRoute?.spot.id ?? null}
            steps={steps}
            currentStepIndex={currentStepIndex}
            freeCount={freeCount}
            totalCount={lot.spots.length}
            rerouteNotice={rerouteNotice}
            onFindSpot={handleFindSpot}
            onReset={handleReset}
          />
        </section>

        <section className="app__col app__col--lot">
          <div className="lot-card">
            <VirtualLot
              lot={lot}
              car={carVisual}
              ambientCars={ambientVisuals}
              path={showRoute ? (userRoute?.path ?? null) : null}
              progress={userT}
              targetSpotId={userRoute?.spot.id ?? null}
              pings={pingVisuals}
              interactive={interactive}
              onToggleSpot={toggleSpot}
            />
          </div>
          <div className="legend">
            <span className="legend__item">
              <span className="legend__swatch legend__swatch--free" /> Free
            </span>
            <span className="legend__item">
              <span className="legend__swatch legend__swatch--occupied" /> Occupied
            </span>
            <span className="legend__item">
              <span className="legend__swatch legend__swatch--route" /> Your route
            </span>
            <span className="legend__item">
              <span className="legend__swatch legend__swatch--ambient" /> Other traffic
            </span>
          </div>
          <p className="app__hint">
            {interactive
              ? 'Click any spot to simulate its sensor.'
              : 'Spots are locked while your car is navigating.'}
          </p>
        </section>

        <section className="app__col app__col--feed">
          <ActivityFeed entries={activity} />
        </section>
      </main>
    </div>
  );
}

export default App;
