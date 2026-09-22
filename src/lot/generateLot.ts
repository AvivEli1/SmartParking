import type { Cell, CellType, LotModel } from './types';

// Layout: two aisles of parking spots connected by a vertical drive lane
// at column 0, which leads down to the entrance at the bottom.
//
// row 0: spots (aisle 1, top)
// row 1: lane  (aisle 1 drive lane)
// row 2: spots (aisle 1, bottom)
// row 3: gap   (visual separation)
// row 4: spots (aisle 2, top)
// row 5: lane  (aisle 2 drive lane)
// row 6: spots (aisle 2, bottom)
// row 7: lane  (entrance road) — entrance sits at col 0
const ROWS = 8;
const COLS = 9;
const SPOT_ROWS = [0, 2, 4, 6];
const LANE_ROWS = [1, 5, 7];
const ENTRANCE = { row: 7, col: 0 };

export function generateLot(): LotModel {
  const cells: Cell[][] = [];
  const spots: LotModel['spots'] = [];
  let spotCounter = 1;

  for (let row = 0; row < ROWS; row++) {
    const rowCells: Cell[] = [];
    for (let col = 0; col < COLS; col++) {
      let type: CellType = 'empty';
      let spotId: string | undefined;

      if (col === 0) {
        type = row === ENTRANCE.row ? 'entrance' : 'lane';
      } else if (SPOT_ROWS.includes(row)) {
        type = 'spot';
        spotId = `S${spotCounter++}`;
      } else if (LANE_ROWS.includes(row)) {
        type = 'lane';
      }

      rowCells.push({ row, col, type, spotId });
      if (type === 'spot' && spotId) {
        spots.push({ id: spotId, row, col, occupied: false });
      }
    }
    cells.push(rowCells);
  }

  return { rows: ROWS, cols: COLS, cells, spots, entrance: ENTRANCE };
}
