"use strict";

const { ART_ASSETS, validateArtCatalog } = require("./asset-catalog");

class ArtStore {
  constructor(options = {}) {
    this.catalog = validateArtCatalog(options.catalog || ART_ASSETS);
    this.images = Object.create(null);
    this.ImageCtor = options.ImageCtor || null;
    if (options.images) {
      for (const [id, image] of Object.entries(options.images)) {
        if (this.catalog[id]) this.images[id] = image;
      }
    }
    if (typeof this.ImageCtor === "function") this.loadEager();
  }

  loadEager() {
    for (const definition of Object.values(this.catalog)) {
      if (definition.eager) this.request(definition.id);
    }
  }

  loadAll() {
    for (const definition of Object.values(this.catalog)) this.request(definition.id);
  }

  request(id) {
    const definition = this.definition(id);
    if (!definition || !definition.active) return null;
    if (this.images[id]) return this.images[id];
    if (typeof this.ImageCtor !== "function") return null;
    const image = new this.ImageCtor();
    image.decoding = "async";
    image.src = definition.src;
    this.images[id] = image;
    return image;
  }

  get(id) {
    return this.images[id] || null;
  }

  definition(id) {
    return this.catalog[id] || null;
  }

  ready(id) {
    const image = this.request(id) || this.get(id);
    return Boolean(image && image.complete && image.naturalWidth && image.naturalHeight);
  }

  ids(group = null) {
    const ids = [];
    for (const definition of Object.values(this.catalog)) {
      if (!group || definition.group === group) ids.push(definition.id);
    }
    return ids;
  }

  releaseGroup(group, keepId = null) {
    let released = 0;
    for (const definition of Object.values(this.catalog)) {
      if (definition.group !== group || definition.id === keepId || !this.images[definition.id]) continue;
      delete this.images[definition.id];
      released += 1;
    }
    return released;
  }
}

function createDefaultArtStore() {
  const ImageCtor = typeof Image === "function" ? Image : null;
  return new ArtStore({ ImageCtor });
}

module.exports = { ArtStore, createDefaultArtStore };
