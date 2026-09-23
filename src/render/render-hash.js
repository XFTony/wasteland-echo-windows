"use strict";

function hash2(x, y) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  value = (value ^ (value >>> 13)) * 1274126177;
  return (value ^ (value >>> 16)) >>> 0;
}

module.exports = { hash2 };
