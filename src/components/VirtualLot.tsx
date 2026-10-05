import { useEffect, useRef, useState } from 'react';
import type { GridPoint, LotModel } from '../lot/types';

const CELL = 56;
const PAD = 28;

const COLORS = {
  laneFill: '#eef1f4',
  laneDash: '#d5dbe1',
  spotFree: '#ffffff',
  spotFreeBorder: '#d2d2d7',
  spotOccupied: '#eef1f4',
  spotOccupiedBorder: '#d2d2d7',
  spotTarget: '#e8f1ff',
  spotTargetBorder: '#007aff',
  entranceFill: '#34c759',
  text: '#6e6e73',
  car: '#007aff',
  carWindow: '#bfe0ff',
  ambientCar: '#af52de',
  ambientCarWindow: '#e6d3f7',
  route: '#007aff',
};

export interface CarVisual {
  row: number;
  col: number;
  angle: number; // degrees, 0 = facing right
}

export interface PingVisual {
  row: number;
  col: number;
  age: number; // 0..1
}

interface VirtualLotProps {
  lot: LotModel;
  car: CarVisual | null;
  ambientCars: CarVisual[];
  path: GridPoint[] | null;
  progress: number;
  targetSpotId: string | null;
  pings: PingVisual[];
  hardwareSpotId: string;
  hardwareActive: boolean;
  onMoveHardware: (spotId: string) => void;
  interactive: boolean;
  onToggleSpot: (spotId: string) => void;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx: CanvasRenderingContext2D, scale: number, body: string, window_: string) {
  ctx.fillStyle = body;
  roundRect(ctx, -16 * scale, -9 * scale, 32 * scale, 18 * scale, 6 * scale);
  ctx.fill();
  ctx.fillStyle = window_;
  roundRect(ctx, 2 * scale, -6 * scale, 9 * scale, 12 * scale, 3 * scale);
  ctx.fill();
}

function drawArrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, angleRad: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  ctx.fillStyle = COLORS.route;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.55, size * 0.62);
  ctx.lineTo(-size * 0.55, -size * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Which lane a parked spot faces, so its icon points the right way. */
function facingAngle(lot: LotModel, row: number, col: number): number {
  const above = lot.cells[row - 1]?.[col]?.type;
  if (above === 'lane' || above === 'entrance') return -90;
  return 90;
}

const TAG_W = 28;
const TAG_H = 15;

/** Where the draggable "HW" tag sits on a spot (canvas coordinates). */
function tagRect(spotX: number, spotY: number) {
  return { x: spotX + CELL - TAG_W - 3, y: spotY + 2, w: TAG_W, h: TAG_H };
}

function drawHwTag(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean, lifted: boolean) {
  ctx.save();
  if (lifted) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
  }
  roundRect(ctx, x, y, TAG_W, TAG_H, TAG_H / 2);
  ctx.fillStyle = active || lifted ? COLORS.route : '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  if (!active && !lifted) {
    ctx.strokeStyle = COLORS.route;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.font = '700 9px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
  ctx.fillStyle = active || lifted ? '#ffffff' : COLORS.route;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HW', x + TAG_W / 2, y + TAG_H / 2 + 0.5);
  ctx.restore();
}

export default function VirtualLot({
  lot,
  car,
  ambientCars,
  path,
  progress,
  targetSpotId,
  pings,
  hardwareSpotId,
  hardwareActive,
  onMoveHardware,
  interactive,
  onToggleSpot,
}: VirtualLotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverSpot, setHoverSpot] = useState<string | null>(null);
  const [hoverTag, setHoverTag] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const width = lot.cols * CELL + PAD * 2;
  const height = lot.rows * CELL + PAD * 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const cx = (col: number) => PAD + col * CELL + CELL / 2;
    const cy = (row: number) => PAD + row * CELL + CELL / 2;

    // Lanes
    for (const row of lot.cells) {
      for (const cell of row) {
        if (cell.type !== 'lane') continue;
        const x = PAD + cell.col * CELL;
        const y = PAD + cell.row * CELL;
        ctx.fillStyle = COLORS.laneFill;
        roundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 8);
        ctx.fill();
      }
    }

    // Dashed lane center-lines for a "road" feel
    ctx.strokeStyle = COLORS.laneDash;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(cx(0), PAD);
    ctx.lineTo(cx(0), height - PAD);
    ctx.stroke();
    for (const laneRow of [1, 5, 7]) {
      ctx.beginPath();
      ctx.moveTo(PAD, cy(laneRow));
      ctx.lineTo(width - PAD, cy(laneRow));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Spots
    for (const spot of lot.spots) {
      const x = PAD + spot.col * CELL;
      const y = PAD + spot.row * CELL;
      const isTarget = spot.id === targetSpotId;
      const isHover = spot.id === hoverSpot && interactive;

      let fill = COLORS.spotFree;
      let border = COLORS.spotFreeBorder;
      if (spot.occupied) {
        fill = COLORS.spotOccupied;
        border = COLORS.spotOccupiedBorder;
      } else if (isTarget) {
        fill = COLORS.spotTarget;
        border = COLORS.spotTargetBorder;
      }

      ctx.fillStyle = fill;
      roundRect(ctx, x + 5, y + 5, CELL - 10, CELL - 10, 10);
      ctx.fill();
      ctx.lineWidth = isTarget ? 2.5 : 1.5;
      ctx.strokeStyle = border;
      ctx.stroke();

      if (isHover && !spot.occupied) {
        ctx.strokeStyle = COLORS.spotTargetBorder;
        ctx.lineWidth = 2;
        roundRect(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 11);
        ctx.stroke();
      }

      if (spot.occupied) {
        ctx.save();
        ctx.translate(x + CELL / 2, y + CELL / 2);
        ctx.rotate((facingAngle(lot, spot.row, spot.col) * Math.PI) / 180);
        drawCarShape(ctx, 0.8, COLORS.car, COLORS.carWindow);
        ctx.restore();
      } else {
        ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        ctx.fillStyle = isTarget ? COLORS.spotTargetBorder : COLORS.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(spot.id, x + CELL / 2, y + CELL / 2);
      }

      if (spot.id === hardwareSpotId) {
        const tag = tagRect(x, y);
        drawHwTag(ctx, tag.x, tag.y, hardwareActive, false);
      }
    }

    // Entrance marker
    const ex = PAD + lot.entrance.col * CELL;
    const ey = PAD + lot.entrance.row * CELL;
    ctx.fillStyle = COLORS.entranceFill;
    roundRect(ctx, ex + 4, ey + 4, CELL - 8, CELL - 8, 10);
    ctx.fill();
    ctx.font = '700 9px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('IN', ex + CELL / 2, ey + CELL / 2);

    // Route: flowing dashed line + big directional arrows
    if (path && path.length > 1) {
      const pts = path.map(([r, c]) => [cx(c), cy(r)] as const);

      ctx.save();
      ctx.strokeStyle = 'rgba(0, 122, 255, 0.5)';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([2, 18]);
      ctx.lineDashOffset = -((progress * 90) % 20);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      ctx.restore();

      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const isFinal = i === pts.length - 2;
        drawArrowHead(ctx, (x1 + x2) / 2, (y1 + y2) / 2, angle, isFinal ? 15 : 12);
      }
    }

    // Ambient (background) traffic
    for (const ac of ambientCars) {
      ctx.save();
      ctx.translate(cx(ac.col), cy(ac.row));
      ctx.rotate((ac.angle * Math.PI) / 180);
      ctx.globalAlpha = 0.85;
      drawCarShape(ctx, 0.85, COLORS.ambientCar, COLORS.ambientCarWindow);
      ctx.restore();
    }

    // Your car
    if (car) {
      ctx.save();
      ctx.translate(cx(car.col), cy(car.row));
      ctx.rotate((car.angle * Math.PI) / 180);
      drawCarShape(ctx, 1, COLORS.car, COLORS.carWindow);
      ctx.restore();
    }

    // Dragging the HW tag: highlight the spot it would land on and show the tag under the cursor.
    if (dragPos) {
      const col = Math.floor((dragPos.x - PAD) / CELL);
      const row = Math.floor((dragPos.y - PAD) / CELL);
      const target = lot.cells[row]?.[col];
      if (target?.type === 'spot') {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = COLORS.route;
        ctx.lineWidth = 2.5;
        roundRect(ctx, PAD + col * CELL + 3, PAD + row * CELL + 3, CELL - 6, CELL - 6, 11);
        ctx.stroke();
        ctx.restore();
      }
      drawHwTag(ctx, dragPos.x - TAG_W / 2, dragPos.y - TAG_H / 2, true, true);
    }

    // Sensor ping ripples
    for (const p of pings) {
      const radius = Math.max(0, 8 + p.age * 26);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.age);
      ctx.strokeStyle = COLORS.route;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx(p.col), cy(p.row), radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }, [lot, car, ambientCars, path, progress, targetSpotId, pings, hardwareSpotId, hardwareActive, dragPos, hoverSpot, interactive, width, height]);

  const pointFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const cellAt = (x: number, y: number) => lot.cells[Math.floor((y - PAD) / CELL)]?.[Math.floor((x - PAD) / CELL)];

  const isOverHwTag = (x: number, y: number) => {
    const spot = lot.spots.find((s) => s.id === hardwareSpotId);
    if (!spot) return false;
    const tag = tagRect(PAD + spot.col * CELL, PAD + spot.row * CELL);
    const slop = 3;
    return x >= tag.x - slop && x <= tag.x + tag.w + slop && y >= tag.y - slop && y <= tag.y + tag.h + slop;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const pt = pointFromEvent(e);
    if (!isOverHwTag(pt.x, pt.y)) return;
    e.preventDefault();
    suppressClickRef.current = true;
    setDragPos(pt);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragPos) {
      const pt = pointFromEvent(e);
      const cell = cellAt(pt.x, pt.y);
      if (cell?.type === 'spot' && cell.spotId) onMoveHardware(cell.spotId);
      setDragPos(null);
    }
    // The click that follows a mouse-up must not also toggle the spot underneath.
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || suppressClickRef.current) return;
    const pt = pointFromEvent(e);
    const cell = cellAt(pt.x, pt.y);
    if (cell?.type === 'spot' && cell.spotId) onToggleSpot(cell.spotId);
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = pointFromEvent(e);
    if (dragPos) setDragPos(pt);
    const cell = cellAt(pt.x, pt.y);
    setHoverSpot(cell?.type === 'spot' ? (cell.spotId ?? null) : null);
    setHoverTag(interactive && isOverHwTag(pt.x, pt.y));
  };

  const handleLeave = () => {
    setHoverSpot(null);
    setHoverTag(false);
    setDragPos(null);
  };

  const cursor = dragPos ? 'grabbing' : hoverTag ? 'grab' : interactive && hoverSpot ? 'pointer' : 'default';

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ cursor, display: 'block' }}
    />
  );
}
