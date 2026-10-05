import { useCallback, useEffect, useRef, useState } from 'react';
import { parseSensorLine, type SensorReading } from './sensorLogic';

export type SerialStatus = 'idle' | 'connecting' | 'connected' | 'error';

const BAUD_RATE = 115200;

/** Reads sensor lines from an Arduino/ESP32 over USB using the Web Serial API (Chrome / Edge). */
export function useSerialSensors() {
  const supported = typeof navigator !== 'undefined' && !!navigator.serial;
  const [status, setStatus] = useState<SerialStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<SensorReading | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const connect = useCallback(async () => {
    if (!navigator.serial) return;
    setError(null);
    setStatus('connecting');

    let port: SerialPort;
    try {
      port = await navigator.serial.requestPort();
    } catch {
      setStatus('idle'); // the user closed the port picker
      return;
    }

    try {
      await port.open({ baudRate: BAUD_RATE });
    } catch {
      setError('Could not open the port. Close the Arduino IDE Serial Monitor (or any other app using it) and try again.');
      setStatus('error');
      return;
    }

    setStatus('connected');
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      if (port.readable) {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let newline = buffer.indexOf('\n');
            while (newline >= 0) {
              const parsed = parseSensorLine(buffer.slice(0, newline));
              buffer = buffer.slice(newline + 1);
              if (parsed) setReading(parsed);
              newline = buffer.indexOf('\n');
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
    } catch {
      setError('Lost connection to the board (was it unplugged?).');
      setStatus('error');
    } finally {
      readerRef.current = null;
      setReading(null);
      try {
        await port.close();
      } catch {
        // already closed
      }
      setStatus((s) => (s === 'error' ? s : 'idle'));
    }
  }, []);

  const disconnect = useCallback(() => {
    readerRef.current?.cancel().catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      readerRef.current?.cancel().catch(() => {});
    };
  }, []);

  return { supported, status, error, reading, connect, disconnect };
}
