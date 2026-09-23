"use strict";

class Pool {
  constructor(factory, reset, initialSize = 0) {
    this.factory = factory;
    this.reset = reset;
    this.free = [];
    this.created = 0;
    for (let index = 0; index < initialSize; index += 1) {
      this.free.push(this.create());
    }
  }

  create() {
    this.created += 1;
    return this.factory();
  }

  acquire(values = {}) {
    const item = this.free.pop() || this.create();
    this.reset(item, values);
    item.active = true;
    return item;
  }

  release(item) {
    if (!item || !item.active) return;
    item.active = false;
    this.free.push(item);
  }

  stats() {
    return { created: this.created, free: this.free.length };
  }
}

module.exports = { Pool };
