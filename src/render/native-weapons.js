"use strict";
const { NATIVE_WEAPONS, WEAPON_PIXEL_PALETTE } = require("../content/weapon-expansion");

function drawNativeWeapon(ctx, id, x = 0, y = 0, scale = 1) {
  const spec = NATIVE_WEAPONS[id]; if (!spec) return false;
  for (const [px,py,w,h,color] of spec.shapes) { ctx.fillStyle=WEAPON_PIXEL_PALETTE[color];ctx.fillRect(x+px*scale,y+py*scale,w*scale,h*scale); }
  return true;
}
function nativeWeaponTexture(id, canvasFactory) {
  const spec=NATIVE_WEAPONS[id];if(!spec)return null;
  const canvas=canvasFactory(spec.width,spec.height);if(!canvas)return null;
  drawNativeWeapon(canvas.getContext("2d"),id);return canvas;
}
module.exports={drawNativeWeapon,nativeWeaponTexture};
