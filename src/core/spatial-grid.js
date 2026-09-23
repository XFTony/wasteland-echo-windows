"use strict";

class SpatialGrid {
  constructor(cellSize = 96, columns = 32) {
    this.cellSize = cellSize;
    this.columns = columns;
    this.cells = new Map();
    this.usedKeys = [];
  }

  clear() {
    for (const key of this.usedKeys) this.cells.get(key).length = 0;
    this.usedKeys.length = 0;
  }

  keyFor(cellX, cellY) {
    return cellY * this.columns + cellX;
  }

  insertInCell(entity, cellX, cellY) {
    const key = this.keyFor(cellX, cellY);
    let bucket = this.cells.get(key);
    if (!bucket) {
      bucket = [];
      this.cells.set(key, bucket);
    }
    if (bucket.length === 0) this.usedKeys.push(key);
    bucket.push(entity);
  }

  insert(entity) {
    this.insertInCell(entity, Math.floor(entity.x / this.cellSize), Math.floor(entity.y / this.cellSize));
  }

  insertBounds(entity, minX, minY, maxX, maxY) {
    const minCellX = Math.floor(minX / this.cellSize);
    const maxCellX = Math.floor(maxX / this.cellSize);
    const minCellY = Math.floor(minY / this.cellSize);
    const maxCellY = Math.floor(maxY / this.cellSize);
    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) this.insertInCell(entity, cellX, cellY);
    }
  }

  queryCircle(x, y, radius, output) {
    output.length = 0;
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);
    for (let cellY = minY; cellY <= maxY; cellY += 1) {
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        const bucket = this.cells.get(this.keyFor(cellX, cellY));
        if (!bucket) continue;
        for (let index = 0; index < bucket.length; index += 1) output.push(bucket[index]);
      }
    }
    return output;
  }

  queryCircleUnique(x, y, radius, output, seen) {
    output.length = 0;
    seen.clear();
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);
    for (let cellY = minY; cellY <= maxY; cellY += 1) {
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        const bucket = this.cells.get(this.keyFor(cellX, cellY));
        if (!bucket) continue;
        for (let index = 0; index < bucket.length; index += 1) {
          const entity = bucket[index];
          if (seen.has(entity)) continue;
          seen.add(entity);
          output.push(entity);
        }
      }
    }
    return output;
  }

  get activeCellCount() {
    return this.usedKeys.length;
  }
}

module.exports = { SpatialGrid };
