"use strict";

const DEFAULT_NAV_CELL_SIZE = 64;
const DEFAULT_NAV_CLEARANCE = 32;
const UNREACHABLE = -1;
const CARDINAL_DIRECTIONS = Object.freeze([
  Object.freeze([1, 0]),
  Object.freeze([-1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([0, -1])
]);
const FLOW_DIRECTIONS = Object.freeze([
  Object.freeze([1, 0]), Object.freeze([-1, 0]), Object.freeze([0, 1]), Object.freeze([0, -1]),
  Object.freeze([1, 1]), Object.freeze([1, -1]), Object.freeze([-1, 1]), Object.freeze([-1, -1])
]);

class NavigationGrid {
  constructor(layout, options = {}) {
    if (!layout || !(Number(layout.worldSize) > 0) || !Array.isArray(layout.obstacles)) {
      throw new TypeError("NavigationGrid requires a world layout with worldSize and obstacles");
    }
    this.layoutId = layout.id || "anonymous";
    this.worldSize = Number(layout.worldSize);
    this.cellSize = Math.max(16, Math.round(Number(options.cellSize) || DEFAULT_NAV_CELL_SIZE));
    this.clearance = Math.max(0, Number(options.clearance) || DEFAULT_NAV_CLEARANCE);
    this.columns = Math.ceil(this.worldSize / this.cellSize);
    this.rows = Math.ceil(this.worldSize / this.cellSize);
    this.cellCount = this.columns * this.rows;
    this.walkable = new Uint8Array(this.cellCount);
    this.walkable.fill(1);
    this.bake(layout.obstacles);
  }

  index(cellX, cellY) {
    return cellY * this.columns + cellX;
  }

  contains(cellX, cellY) {
    return cellX >= 0 && cellY >= 0 && cellX < this.columns && cellY < this.rows;
  }

  isWalkable(cellX, cellY) {
    return this.contains(cellX, cellY) && this.walkable[this.index(cellX, cellY)] === 1;
  }

  worldToCellX(x) {
    return Math.max(0, Math.min(this.columns - 1, Math.floor(Number(x) / this.cellSize)));
  }

  worldToCellY(y) {
    return Math.max(0, Math.min(this.rows - 1, Math.floor(Number(y) / this.cellSize)));
  }

  worldIndex(x, y) {
    return this.index(this.worldToCellX(x), this.worldToCellY(y));
  }

  isWorldWalkable(x, y) {
    return this.walkable[this.worldIndex(x, y)] === 1;
  }

  cellCenterX(cellX) {
    return Math.min(this.worldSize - this.clearance, (cellX + 0.5) * this.cellSize);
  }

  cellCenterY(cellY) {
    return Math.min(this.worldSize - this.clearance, (cellY + 0.5) * this.cellSize);
  }

  bake(obstacles) {
    const clearance = this.clearance;
    for (let cellY = 0; cellY < this.rows; cellY += 1) {
      const centerY = (cellY + 0.5) * this.cellSize;
      const cellMinY = cellY * this.cellSize;
      const cellMaxY = Math.min(this.worldSize, (cellY + 1) * this.cellSize);
      for (let cellX = 0; cellX < this.columns; cellX += 1) {
        const centerX = (cellX + 0.5) * this.cellSize;
        const cellMinX = cellX * this.cellSize;
        const cellMaxX = Math.min(this.worldSize, (cellX + 1) * this.cellSize);
        const index = this.index(cellX, cellY);
        if (centerX < clearance || centerY < clearance || centerX > this.worldSize - clearance || centerY > this.worldSize - clearance) {
          this.walkable[index] = 0;
          continue;
        }
        for (let obstacleIndex = 0; obstacleIndex < obstacles.length; obstacleIndex += 1) {
          const obstacle = obstacles[obstacleIndex];
          const obstacleMinX = obstacle.x - clearance;
          const obstacleMaxX = obstacle.x + obstacle.w + clearance;
          const obstacleMinY = obstacle.y - clearance;
          const obstacleMaxY = obstacle.y + obstacle.h + clearance;
          const centerInsideExpandedObstacle = (
            centerX >= obstacleMinX && centerX <= obstacleMaxX
            && centerY >= obstacleMinY && centerY <= obstacleMaxY
          );
          const rawObstacleCrossesCell = (
            cellMaxX > obstacle.x && cellMinX < obstacle.x + obstacle.w
            && cellMaxY > obstacle.y && cellMinY < obstacle.y + obstacle.h
          );
          if (
            centerInsideExpandedObstacle || rawObstacleCrossesCell
          ) {
            this.walkable[index] = 0;
            break;
          }
        }
      }
    }
  }

  nearestWalkableIndex(worldX, worldY, maximumRadius = 5) {
    const originX = this.worldToCellX(worldX);
    const originY = this.worldToCellY(worldY);
    if (this.isWalkable(originX, originY)) return this.index(originX, originY);
    for (let radius = 1; radius <= maximumRadius; radius += 1) {
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) continue;
          const cellX = originX + offsetX;
          const cellY = originY + offsetY;
          if (this.isWalkable(cellX, cellY)) return this.index(cellX, cellY);
        }
      }
    }
    return UNREACHABLE;
  }
}

class NavigationFlowField {
  constructor(grid) {
    if (!(grid instanceof NavigationGrid)) throw new TypeError("NavigationFlowField requires a NavigationGrid");
    this.grid = grid;
    this.distances = new Int32Array(grid.cellCount);
    this.directionX = new Int8Array(grid.cellCount);
    this.directionY = new Int8Array(grid.cellCount);
    this.queue = new Int32Array(grid.cellCount);
    this.targetIndex = UNREACHABLE;
    this.rebuildCount = 0;
    this.clear();
  }

  clear() {
    this.distances.fill(UNREACHABLE);
    this.directionX.fill(0);
    this.directionY.fill(0);
    this.targetIndex = UNREACHABLE;
  }

  rebuild(targetX, targetY) {
    this.clear();
    const grid = this.grid;
    const targetIndex = grid.nearestWalkableIndex(targetX, targetY);
    if (targetIndex === UNREACHABLE) return false;
    this.targetIndex = targetIndex;
    this.distances[targetIndex] = 0;
    let read = 0;
    let write = 0;
    this.queue[write++] = targetIndex;
    while (read < write) {
      const index = this.queue[read++];
      const cellX = index % grid.columns;
      const cellY = Math.floor(index / grid.columns);
      const nextDistance = this.distances[index] + 1;
      for (let directionIndex = 0; directionIndex < CARDINAL_DIRECTIONS.length; directionIndex += 1) {
        const direction = CARDINAL_DIRECTIONS[directionIndex];
        const nextX = cellX + direction[0];
        const nextY = cellY + direction[1];
        if (!grid.isWalkable(nextX, nextY)) continue;
        const nextIndex = grid.index(nextX, nextY);
        if (this.distances[nextIndex] !== UNREACHABLE) continue;
        this.distances[nextIndex] = nextDistance;
        this.queue[write++] = nextIndex;
      }
    }

    for (let index = 0; index < grid.cellCount; index += 1) {
      const distance = this.distances[index];
      if (distance <= 0) continue;
      const cellX = index % grid.columns;
      const cellY = Math.floor(index / grid.columns);
      let bestDistance = distance;
      let bestX = 0;
      let bestY = 0;
      for (let directionIndex = 0; directionIndex < FLOW_DIRECTIONS.length; directionIndex += 1) {
        const direction = FLOW_DIRECTIONS[directionIndex];
        const nextX = cellX + direction[0];
        const nextY = cellY + direction[1];
        if (!grid.isWalkable(nextX, nextY)) continue;
        if (direction[0] !== 0 && direction[1] !== 0 && (!grid.isWalkable(cellX + direction[0], cellY) || !grid.isWalkable(cellX, cellY + direction[1]))) continue;
        const nextIndex = grid.index(nextX, nextY);
        const nextDistance = this.distances[nextIndex];
        if (nextDistance >= 0 && nextDistance < bestDistance) {
          bestDistance = nextDistance;
          bestX = direction[0];
          bestY = direction[1];
        }
      }
      this.directionX[index] = bestX;
      this.directionY[index] = bestY;
    }
    this.rebuildCount += 1;
    return true;
  }

  sampleIndex(worldX, worldY) {
    const directIndex = this.grid.worldIndex(worldX, worldY);
    if (this.distances[directIndex] >= 0) return directIndex;
    const nearest = this.grid.nearestWalkableIndex(worldX, worldY, 2);
    return nearest >= 0 && this.distances[nearest] >= 0 ? nearest : UNREACHABLE;
  }
}

function createNavigation(layout, options = {}) {
  const grid = new NavigationGrid(layout, options);
  return { grid, flow: new NavigationFlowField(grid) };
}

module.exports = {
  DEFAULT_NAV_CELL_SIZE,
  DEFAULT_NAV_CLEARANCE,
  UNREACHABLE,
  NavigationGrid,
  NavigationFlowField,
  createNavigation
};
