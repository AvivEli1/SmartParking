import './StatsHeader.css';

interface StatsHeaderProps {
  free: number;
  total: number;
  liveTraffic: boolean;
  onToggleLiveTraffic: (v: boolean) => void;
}

export default function StatsHeader({ free, total, liveTraffic, onToggleLiveTraffic }: StatsHeaderProps) {
  const occupied = total - free;
  const pct = total === 0 ? 0 : occupied / total;
  const r = 19;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);

  return (
    <div className="stats-header">
      <div className="stats-header__brand">
        <span className="stats-header__dot" />
        <div>
          <div className="stats-header__title">Smart Parking Lot</div>
          <div className="stats-header__subtitle">Software Simulation</div>
        </div>
      </div>

      <div className="stats-header__right">
        <label className="stats-header__toggle">
          <span className="stats-header__toggle-label">Live Traffic</span>
          <span className={`switch ${liveTraffic ? 'switch--on' : ''}`} onClick={() => onToggleLiveTraffic(!liveTraffic)}>
            <span className="switch__knob" />
          </span>
        </label>

        <div className="stats-header__divider" />

        <div className="stats-header__occupancy">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r={r} fill="none" stroke="#eef1f4" strokeWidth="5" />
            <circle
              cx="24"
              cy="24"
              r={r}
              fill="none"
              stroke="#007aff"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 24 24)"
              style={{ transition: 'stroke-dashoffset 0.4s ease' }}
            />
          </svg>
          <div className="stats-header__occupancy-text">
            <div className="stats-header__occupancy-value">{free}</div>
            <div className="stats-header__occupancy-label">free / {total}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
