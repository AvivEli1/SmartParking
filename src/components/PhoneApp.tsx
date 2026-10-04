import type { DirectionStep } from '../lot/directions';
import './PhoneApp.css';

export type NavStatus = 'idle' | 'detecting' | 'searching' | 'navigating' | 'arrived';

interface PhoneAppProps {
  status: NavStatus;
  targetSpotId: string | null;
  steps: DirectionStep[];
  currentStepIndex: number;
  freeCount: number;
  totalCount: number;
  rerouteNotice: string | null;
  onFindSpot: () => void;
  onReset: () => void;
}

export default function PhoneApp({
  status,
  targetSpotId,
  steps,
  currentStepIndex,
  freeCount,
  totalCount,
  rerouteNotice,
  onFindSpot,
  onReset,
}: PhoneAppProps) {
  return (
    <div className="phone">
      <div className="phone__notch" />
      <div className="phone__statusbar">
        <span>9:41</span>
        <span className="phone__statusbar-icons">••• 🔋</span>
      </div>

      <div className="phone__screen">
        <div className="phone__app-header">
          <div className="phone__app-title">Smart Parking</div>
          <div className="phone__app-subtitle">
            {freeCount} of {totalCount} spots free
          </div>
        </div>

        {status === 'idle' && (
          <div className="phone__panel phone__panel--center">
            <div className="phone__pin">📍</div>
            <button className="phone__button" onClick={onFindSpot} disabled={freeCount === 0}>
              {freeCount === 0 ? 'Lot Full' : 'Simulate Car Arrival'}
            </button>
          </div>
        )}

        {status === 'detecting' && (
          <div className="phone__panel phone__panel--center">
            <div className="phone__pin phone__pin--pulse">🚗</div>
            <p className="phone__hint phone__hint--strong phone__hint--pulse">CAR DETECTED</p>
          </div>
        )}

        {status === 'searching' && (
          <div className="phone__panel phone__panel--center">
            <div className="phone__spinner" />
            <p className="phone__hint">Finding nearest spot…</p>
          </div>
        )}

        {status === 'navigating' && targetSpotId && (
          <div className="phone__panel">
            {rerouteNotice && <div className="phone__reroute">⚠️ {rerouteNotice}</div>}
            <div className="phone__target">
              <span className="phone__target-label">Heading to</span>
              <span className="phone__target-spot">Spot {targetSpotId}</span>
            </div>
            <ol className="phone__steps">
              {steps.map((step, i) => (
                <li
                  key={i}
                  className={
                    i === currentStepIndex
                      ? 'phone__step phone__step--active'
                      : i < currentStepIndex
                        ? 'phone__step phone__step--done'
                        : 'phone__step'
                  }
                >
                  {step.text}
                </li>
              ))}
            </ol>
            <button className="phone__button phone__button--ghost" onClick={onReset}>
              Cancel
            </button>
          </div>
        )}

        {status === 'arrived' && targetSpotId && (
          <div className="phone__panel phone__panel--center">
            <div className="phone__check">✓</div>
            <p className="phone__hint phone__hint--strong">You've arrived!</p>
            <p className="phone__hint">Parked at Spot {targetSpotId}</p>
            <button className="phone__button" onClick={onReset}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
