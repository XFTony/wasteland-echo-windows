"use strict";

class Random {
  constructor(seed = Date.now()) {
    const numeric = Number(seed) || 1;
    this.state = numeric >>> 0;
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  next() {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(min, maxInclusive) {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  pick(items) {
    if (!items.length) return undefined;
    return items[this.int(0, items.length - 1)];
  }

  weighted(items, weightOf = (item) => item.weight || 1) {
    const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0);
    if (total <= 0) return items[0];
    let cursor = this.next() * total;
    for (const item of items) {
      cursor -= Math.max(0, weightOf(item));
      if (cursor <= 0) return item;
    }
    return items[items.length - 1];
  }
}

module.exports = { Random };
