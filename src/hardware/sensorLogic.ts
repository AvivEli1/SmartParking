export interface SensorReading {
  entranceCm: number;
  spotCm: number;
}

/**
 * Parses one line from the board. Accepts the JSON the sketch sends
 * (`{"entrance":12.3,"spot":80.0}`) or a plain `12.3,80.0` CSV line.
 * Returns null for anything else (boot messages, partial lines, ...).
 */
export function parseSensorLine(line: string): SensorReading | null {
  const text = line.trim();
  let entrance: unknown;
  let spot: unknown;

  if (text.startsWith('{')) {
    try {
      const data = JSON.parse(text) as { entrance?: unknown; spot?: unknown };
      entrance = data.entrance;
      spot = data.spot;
    } catch {
      return null;
    }
  } else {
    const parts = text.split(',');
    if (parts.length !== 2) return null;
    entrance = Number(parts[0]);
    spot = Number(parts[1]);
  }

  if (typeof entrance !== 'number' || typeof spot !== 'number') return null;
  if (!Number.isFinite(entrance) || !Number.isFinite(spot)) return null;
  return { entranceCm: entrance, spotCm: spot };
}

export interface Detector {
  active: boolean;
  streak: number;
}

export const IDLE_DETECTOR: Detector = { active: false, streak: 0 };

/**
 * Turns noisy distance samples into a stable yes/no. "Active" means something
 * is closer than `thresholdCm`. A small hysteresis band plus a consecutive-sample
 * requirement stops the state flickering when a reading hovers near the threshold.
 */
export function stepDetector(
  prev: Detector,
  distanceCm: number,
  thresholdCm: number,
  hysteresisCm = 2,
  samplesNeeded = 3,
): Detector {
  const wantActive = prev.active ? distanceCm < thresholdCm + hysteresisCm : distanceCm < thresholdCm;
  if (wantActive === prev.active) return { active: prev.active, streak: 0 };
  const streak = prev.streak + 1;
  return streak >= samplesNeeded ? { active: wantActive, streak: 0 } : { active: prev.active, streak };
}
