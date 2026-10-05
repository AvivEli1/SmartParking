import type { Hardware } from '../hardware/useHardware';
import './HardwarePanel.css';

const MAX_CM = 80;

interface HardwarePanelProps {
  hw: Hardware;
  spotId: string;
  preferRealSpot: boolean;
  onPreferRealSpot: (value: boolean) => void;
}

function SensorRow({
  label,
  pin,
  cm,
  thresholdCm,
  detected,
  detectedText,
  clearText,
}: {
  label: string;
  pin: string;
  cm: number | null;
  thresholdCm: number;
  detected: boolean;
  detectedText: string;
  clearText: string;
}) {
  const pct = cm === null ? 0 : Math.min(cm / MAX_CM, 1) * 100;
  return (
    <div className="hw__sensor">
      <div className="hw__sensor-top">
        <span className="hw__sensor-label">
          {label} <span className="hw__pin">{pin}</span>
        </span>
        <span className={`hw__chip ${detected ? 'hw__chip--on' : ''}`}>{cm === null ? '—' : detected ? detectedText : clearText}</span>
      </div>
      <div className="hw__bar">
        <div className="hw__bar-fill" style={{ width: `${pct}%` }} />
        <div className="hw__bar-threshold" style={{ left: `${(thresholdCm / MAX_CM) * 100}%` }} />
      </div>
      <div className="hw__sensor-bottom">
        <span>{cm === null ? 'no data' : `${cm.toFixed(1)} cm`}</span>
        <span>trigger &lt; {thresholdCm} cm</span>
      </div>
    </div>
  );
}

export default function HardwarePanel({ hw, spotId, preferRealSpot, onPreferRealSpot }: HardwarePanelProps) {
  const { serial, emulator } = hw;
  const connected = serial.status === 'connected';
  const busy = serial.status === 'connecting';

  const statusText = connected ? 'Board connected' : hw.source === 'emulator' ? 'Emulating sensors' : 'Not connected';
  const statusClass = connected ? 'hw__status--live' : hw.source === 'emulator' ? 'hw__status--emu' : '';

  return (
    <div className="hw">
      <div className="hw__header">
        <span className="hw__title">Hardware</span>
        <span className={`hw__status ${statusClass}`}>
          <span className="hw__status-dot" />
          {statusText}
        </span>
      </div>

      <div className="hw__body">
        {serial.supported ? (
          <button
            className={`hw__button ${connected ? 'hw__button--ghost' : ''}`}
            onClick={connected ? serial.disconnect : serial.connect}
            disabled={busy}
          >
            {connected ? 'Disconnect Arduino' : busy ? 'Connecting…' : 'Connect Arduino'}
          </button>
        ) : (
          <p className="hw__note">USB connection needs Chrome or Edge on a computer. You can still try the emulator below.</p>
        )}
        {serial.error && <p className="hw__error">{serial.error}</p>}

        {hw.active && (
          <>
            <SensorRow
              label="Entrance"
              pin="D34"
              cm={hw.reading?.entranceCm ?? null}
              thresholdCm={hw.entranceThresholdCm}
              detected={hw.entranceDetected}
              detectedText="CAR"
              clearText="clear"
            />
            <SensorRow
              label={`Spot ${spotId}`}
              pin="D35"
              cm={hw.reading?.spotCm ?? null}
              thresholdCm={hw.spotThresholdCm}
              detected={hw.spotOccupied}
              detectedText="TAKEN"
              clearText="open"
            />
            <label className="hw__switch-row">
              <span>Send cars to Spot {spotId}</span>
              <input
                type="checkbox"
                checked={preferRealSpot}
                onChange={(e) => onPreferRealSpot(e.target.checked)}
                aria-label={`Send cars to the real spot ${spotId}`}
              />
            </label>
            <p className="hw__note hw__note--tight">
              Test mode: new cars head for the real spot while it's free. Drag the HW tag on the lot to move it.
            </p>
            <div className="hw__tuning">
              <label>
                Entrance trigger
                <input
                  type="range"
                  min={3}
                  max={40}
                  value={hw.entranceThresholdCm}
                  onChange={(e) => hw.setEntranceThresholdCm(Number(e.target.value))}
                />
              </label>
              <label>
                Spot trigger
                <input
                  type="range"
                  min={3}
                  max={40}
                  value={hw.spotThresholdCm}
                  onChange={(e) => hw.setSpotThresholdCm(Number(e.target.value))}
                />
              </label>
            </div>
          </>
        )}

        {!connected && (
          <details className="hw__emulator" open={emulator.on}>
            <summary>No board? Emulate the sensors</summary>
            <label className="hw__switch-row">
              <span>Emulator on</span>
              <input
                type="checkbox"
                checked={emulator.on}
                onChange={(e) => emulator.setOn(e.target.checked)}
                aria-label="Emulator on"
              />
            </label>
            {emulator.on && (
              <div className="hw__tuning">
                <label>
                  Entrance distance: {emulator.entranceCm} cm
                  <input
                    type="range"
                    min={3}
                    max={80}
                    value={emulator.entranceCm}
                    onChange={(e) => emulator.setEntranceCm(Number(e.target.value))}
                    aria-label="Emulated entrance distance"
                  />
                </label>
                <label>
                  Spot distance: {emulator.spotCm} cm
                  <input
                    type="range"
                    min={3}
                    max={80}
                    value={emulator.spotCm}
                    onChange={(e) => emulator.setSpotCm(Number(e.target.value))}
                    aria-label="Emulated spot distance"
                  />
                </label>
                <p className="hw__note">Slide below the trigger distance to put a "car" in front of a sensor.</p>
              </div>
            )}
          </details>
        )}
      </div>
    </div>
  );
}
