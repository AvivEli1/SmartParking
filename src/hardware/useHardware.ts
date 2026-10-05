import { useEffect, useRef, useState } from 'react';
import { IDLE_DETECTOR, stepDetector, type Detector, type SensorReading } from './sensorLogic';
import { useSerialSensors } from './useSerialSensors';

export type HardwareSource = 'none' | 'serial' | 'emulator';

const EMULATOR_SAMPLE_MS = 150;
const FAR_CM = 80;

/**
 * One place for everything hardware: the real board (Web Serial) or the on-screen
 * emulator feed the same pipeline, which outputs two stable booleans.
 */
export function useHardware() {
  const serial = useSerialSensors();

  const [emulatorOn, setEmulatorOn] = useState(false);
  const [emuEntranceCm, setEmuEntranceCm] = useState(FAR_CM);
  const [emuSpotCm, setEmuSpotCm] = useState(FAR_CM);
  const [emuReading, setEmuReading] = useState<SensorReading | null>(null);
  const [entranceThresholdCm, setEntranceThresholdCm] = useState(15);
  const [spotThresholdCm, setSpotThresholdCm] = useState(15);

  const emuValuesRef = useRef({ entrance: FAR_CM, spot: FAR_CM });
  useEffect(() => {
    emuValuesRef.current = { entrance: emuEntranceCm, spot: emuSpotCm };
  }, [emuEntranceCm, emuSpotCm]);

  const serialConnected = serial.status === 'connected';
  const source: HardwareSource = serialConnected ? 'serial' : emulatorOn ? 'emulator' : 'none';

  // The emulator behaves like a device: it streams a sample a few times a second.
  const emulating = source === 'emulator';
  useEffect(() => {
    if (!emulating) return;
    const id = setInterval(() => {
      setEmuReading({ entranceCm: emuValuesRef.current.entrance, spotCm: emuValuesRef.current.spot });
    }, EMULATOR_SAMPLE_MS);
    return () => clearInterval(id);
  }, [emulating]);

  const reading = source === 'serial' ? serial.reading : source === 'emulator' ? emuReading : null;

  const thresholdsRef = useRef({ entrance: entranceThresholdCm, spot: spotThresholdCm });
  useEffect(() => {
    thresholdsRef.current = { entrance: entranceThresholdCm, spot: spotThresholdCm };
  }, [entranceThresholdCm, spotThresholdCm]);

  // Detector state is tagged with the source it belongs to, so switching or dropping
  // the source can never leave a stale "car detected" behind.
  const [detectors, setDetectors] = useState<{ source: HardwareSource; entrance: Detector; spot: Detector }>({
    source: 'none',
    entrance: IDLE_DETECTOR,
    spot: IDLE_DETECTOR,
  });

  useEffect(() => {
    if (!reading) return;
    setDetectors((prev) => {
      const base = prev.source === source ? prev : { source, entrance: IDLE_DETECTOR, spot: IDLE_DETECTOR };
      return {
        source,
        entrance: stepDetector(base.entrance, reading.entranceCm, thresholdsRef.current.entrance),
        spot: stepDetector(base.spot, reading.spotCm, thresholdsRef.current.spot),
      };
    });
  }, [reading, source]);

  const detectorsLive = source !== 'none' && detectors.source === source;
  const entranceDetected = detectorsLive && detectors.entrance.active;
  const spotOccupied = detectorsLive && detectors.spot.active;

  return {
    source,
    active: source !== 'none',
    reading,
    entranceDetected,
    spotOccupied,
    entranceThresholdCm,
    spotThresholdCm,
    setEntranceThresholdCm,
    setSpotThresholdCm,
    serial: {
      supported: serial.supported,
      status: serial.status,
      error: serial.error,
      connect: serial.connect,
      disconnect: serial.disconnect,
    },
    emulator: {
      on: emulatorOn,
      setOn: setEmulatorOn,
      entranceCm: emuEntranceCm,
      spotCm: emuSpotCm,
      setEntranceCm: setEmuEntranceCm,
      setSpotCm: setEmuSpotCm,
    },
  };
}

export type Hardware = ReturnType<typeof useHardware>;
