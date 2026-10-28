"use strict";

// Original synthesized game sounds: body, transient, filtered texture and mechanism.
const SHOT_PROFILES = Object.freeze({
  scrap_pistol: Object.freeze({ body: [120, 45, .075, .12, "sine"], crack: [1800, 520, .014, .022, "square"], noise: [.058, .12, 2400], mechanism: [720, 230, .022, .018, "triangle", .055] }),
  swarm_smg: Object.freeze({ body: [165, 65, .043, .07, "triangle"], crack: [2300, 780, .010, .015, "square"], noise: [.033, .085, 3200], mechanism: [1050, 410, .014, .012, "triangle", .034] }),
  breaker_shotgun: Object.freeze({ body: [80, 30, .15, .19, "sine"], crack: [1050, 190, .023, .034, "square"], noise: [.125, .21, 1550], mechanism: [430, 180, .028, .035, "triangle", .17], echo: [65, 36, .11, .045, "triangle", .028] }),
  needle_rifle: Object.freeze({ body: [145, 48, .08, .13, "triangle"], crack: [2850, 740, .013, .023, "square"], noise: [.063, .14, 4200], mechanism: [980, 310, .023, .023, "triangle", .08], echo: [210, 95, .075, .018, "sine", .028] }),
  rust_revolver: Object.freeze({ body: [96, 35, .115, .16, "sine"], crack: [1680, 360, .019, .028, "square"], noise: [.079, .16, 2050], mechanism: [540, 170, .024, .024, "triangle", .072], echo: [84, 42, .09, .025, "triangle", .025] }),
  ember_carbine: Object.freeze({ body: [140, 52, .06, .105, "triangle"], crack: [2180, 650, .012, .019, "square"], noise: [.047, .11, 3150], mechanism: [870, 340, .018, .017, "triangle", .045] }),
  coil_cannon: Object.freeze({ body: [70, 29, .19, .17, "sine"], crack: [1850, 220, .045, .025, "triangle"], noise: [.115, .09, 3650], mechanism: [1180, 340, .075, .018, "sine", .11], echo: [440, 105, .19, .04, "sine", .025] })
});

module.exports = { SHOT_PROFILES };
