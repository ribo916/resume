/* ============================================================
   FARM ENGINE — all mechanics for the Career Valley experience.
   Reads everything from FARM_DATA (built in farm-data.js by
   merging shared RESUME_DATA content with farm presentation).

   Pure 2D canvas, classic script, no build step, file://-safe.
   Coordinates are in TILES; the camera converts to screen pixels.

   Layers, like voyage:
     content     ../shared/resume-data.js  (RESUME_DATA)
     presentation farm-data.js              (FARM_PRESENTATION → FARM_DATA)
     engine       this file                 (reads FARM_DATA only)

   Debug/test hook exposed as window.__farm (see bottom).
   ============================================================ */
(function () {
  "use strict";

  // ---- canvas / sizing ---------------------------------------
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var cssW = 0, cssH = 0, dpr = 1;
  var PX = 46; // pixels per tile (set in resize, smaller on phones)

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    PX = cssW < 700 ? 34 : cssW < 1100 ? 42 : 48;
  }
  window.addEventListener("resize", resize);
  resize();

  // ---- world layout from data --------------------------------
  // position {x,y} is each farm plot's top-left tile; plot {w,h} its size.
  var farms = FARM_DATA.farms.map(function (f) {
    var plot = f.plot || { w: 7, h: 6 };
    var pos = f.position || { x: 0, y: 0 };
    return {
      data: f,
      x: pos.x, y: pos.y, w: plot.w, h: plot.h,
      crop: f.crop || "#8fce5b",
      roof: f.roof || "#9a5b33",
      decor: f.decor || [],
      // signpost sits centered just in front (south) of the plot
      sign: { x: pos.x + plot.w / 2, y: pos.y + plot.h + 0.6 },
      visited: false,
    };
  });

  var MARGIN = 6;
  var world = (function () {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    farms.forEach(function (f) {
      minX = Math.min(minX, f.x);
      minY = Math.min(minY, f.y);
      maxX = Math.max(maxX, f.x + f.w);
      maxY = Math.max(maxY, f.sign.y + 2);
    });
    return {
      x0: minX - MARGIN, y0: minY - MARGIN,
      x1: maxX + MARGIN, y1: maxY + MARGIN,
    };
  })();
  world.w = world.x1 - world.x0;
  world.h = world.y1 - world.y0;

  // ---- player state ------------------------------------------
  var state = {
    pos: { x: farms[0].sign.x, y: farms[0].sign.y + 1.5 },
    vel: { x: 0, y: 0 },
    speed: 6.2,          // tiles / second
    dir: "down",         // facing
    moving: false,
    stepPhase: 0,        // walk-cycle accumulator
    target: null,        // {x,y} click-to-walk goal (tiles)
    autoVisit: null,     // farm to auto-open on arrival
    nearby: null,        // farm within visit range
    visiting: null,      // farm whose panel is open
    visitedCount: 0,
  };

  // ---- input -------------------------------------------------
  var keys = {};
  window.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase();
    if (k === "escape") { leave(); return; }
    if (k === "e") { if (state.nearby) visit(state.nearby); return; }
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].indexOf(k) >= 0) {
      keys[k] = true;
      state.target = null; state.autoVisit = null; // keyboard cancels click-walk
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });

  function screenToWorld(sx, sy) {
    return {
      x: (sx - cssW / 2) / PX + state.pos.x,
      y: (sy - cssH / 2) / PX + state.pos.y,
    };
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (state.visiting) return; // panel open swallows world clicks
    var w = screenToWorld(e.clientX, e.clientY);
    // clicking on/near a signpost: walk there and auto-visit on arrival
    var hit = null, best = 1.6;
    farms.forEach(function (f) {
      var d = Math.hypot(w.x - f.sign.x, w.y - f.sign.y);
      if (d < best) { best = d; hit = f; }
    });
    if (hit) {
      state.target = { x: hit.sign.x, y: hit.sign.y + 1.1 };
      state.autoVisit = hit;
    } else {
      state.target = { x: clamp(w.x, world.x0 + 0.5, world.x1 - 0.5),
                       y: clamp(w.y, world.y0 + 0.5, world.y1 - 0.5) };
      state.autoVisit = null;
    }
  });

  // ---- helpers -----------------------------------------------
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  // deterministic 0..1 hash for ground texture (no stored state)
  function hash(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  // ---- update ------------------------------------------------
  function update(dt) {
    var mvx = 0, mvy = 0;
    if (keys.w || keys.arrowup) mvy -= 1;
    if (keys.s || keys.arrowdown) mvy += 1;
    if (keys.a || keys.arrowleft) mvx -= 1;
    if (keys.d || keys.arrowright) mvx += 1;

    if ((mvx || mvy) === 0 && state.target) {
      // click-to-walk: steer toward target
      var tdx = state.target.x - state.pos.x;
      var tdy = state.target.y - state.pos.y;
      var td = Math.hypot(tdx, tdy);
      if (td < 0.12) {
        state.pos.x = state.target.x; state.pos.y = state.target.y;
        var av = state.autoVisit;
        state.target = null; state.autoVisit = null;
        if (av) visit(av);
      } else {
        mvx = tdx / td; mvy = tdy / td;
      }
    }

    var mag = Math.hypot(mvx, mvy);
    state.moving = mag > 0.001 && !state.visiting;
    if (state.moving) {
      mvx /= mag; mvy /= mag;
      state.pos.x += mvx * state.speed * dt;
      state.pos.y += mvy * state.speed * dt;
      // facing: dominant axis
      if (Math.abs(mvx) > Math.abs(mvy)) state.dir = mvx < 0 ? "left" : "right";
      else state.dir = mvy < 0 ? "up" : "down";
      state.stepPhase += dt * 9;
    } else {
      state.stepPhase = 0;
    }

    // keep inside the valley
    state.pos.x = clamp(state.pos.x, world.x0 + 0.5, world.x1 - 0.5);
    state.pos.y = clamp(state.pos.y, world.y0 + 0.5, world.y1 - 0.5);

    // nearest farm / visit prompt
    if (!state.visiting) {
      var near = null, bd = FARM_DATA.visitRadius;
      farms.forEach(function (f) {
        var d = Math.hypot(state.pos.x - f.sign.x, state.pos.y - f.sign.y);
        if (d < bd) { bd = d; near = f; }
      });
      if (near !== state.nearby) {
        state.nearby = near;
        updatePrompt();
      }
    }
  }

  // ---- screen transform --------------------------------------
  function applyCamera() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(cssW / 2 - state.pos.x * PX, cssH / 2 - state.pos.y * PX);
  }
  // tile-space draw helpers (operate after applyCamera)
  function rect(tx, ty, tw, th, color) {
    ctx.fillStyle = color;
    ctx.fillRect(tx * PX, ty * PX, tw * PX, th * PX);
  }

  // ---- render: ground ----------------------------------------
  function drawGround() {
    // out-of-bounds forest
    ctx.fillStyle = "#26331a";
    ctx.fillRect((world.x0 - 40) * PX, (world.y0 - 40) * PX, (world.w + 80) * PX, (world.h + 80) * PX);

    // grass field
    rect(world.x0, world.y0, world.w, world.h, "#6fb13f");

    // textured tiles, only those in view
    var vx0 = Math.floor(state.pos.x - cssW / 2 / PX) - 1;
    var vx1 = Math.ceil(state.pos.x + cssW / 2 / PX) + 1;
    var vy0 = Math.floor(state.pos.y - cssH / 2 / PX) - 1;
    var vy1 = Math.ceil(state.pos.y + cssH / 2 / PX) + 1;
    vx0 = Math.max(vx0, Math.floor(world.x0));
    vx1 = Math.min(vx1, Math.ceil(world.x1));
    vy0 = Math.max(vy0, Math.floor(world.y0));
    vy1 = Math.min(vy1, Math.ceil(world.y1));

    for (var ty = vy0; ty < vy1; ty++) {
      for (var tx = vx0; tx < vx1; tx++) {
        var h = hash(tx, ty);
        // gentle checker for tilled-field readability
        if ((tx + ty) % 2 === 0) rect(tx, ty, 1, 1, "rgba(255,255,255,0.025)");
        if (h > 0.86) { // grass tufts
          ctx.fillStyle = "#5a9433";
          ctx.fillRect((tx + 0.2) * PX, (ty + 0.55) * PX, 0.12 * PX, 0.22 * PX);
          ctx.fillRect((tx + 0.32) * PX, (ty + 0.5) * PX, 0.12 * PX, 0.27 * PX);
        } else if (h > 0.80) { // tiny wildflowers
          var fc = hash(ty, tx) > 0.5 ? "#f4d35e" : "#e8e0ec";
          ctx.fillStyle = fc;
          ctx.fillRect((tx + 0.55) * PX, (ty + 0.45) * PX, 0.16 * PX, 0.16 * PX);
        }
      }
    }
    drawPath();
    drawBorderTrees();
  }

  // meandering dirt road connecting the signposts (decorative)
  function drawPath() {
    var pts = farms.map(function (f) { return { x: f.sign.x, y: f.sign.y + 1.1 }; })
      .sort(function (a, b) { return a.x - b.x; });
    if (pts.length < 2) return;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = "#b9925a";
    ctx.lineWidth = 1.15 * PX;
    ctx.beginPath();
    ctx.moveTo(pts[0].x * PX, pts[0].y * PX);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * PX, pts[i].y * PX);
    ctx.stroke();
    ctx.strokeStyle = "#caa672";
    ctx.lineWidth = 0.7 * PX;
    ctx.stroke();
  }

  function drawBorderTrees() {
    // a ring of trees just outside the field edge to frame the valley
    var step = 2.2;
    for (var x = world.x0 - 1.5; x < world.x1 + 1.5; x += step) {
      tree(x + (hash(x, 1) - 0.5), world.y0 - 0.6 - hash(x, 2) * 0.6, 0.9);
      tree(x + (hash(x, 3) - 0.5), world.y1 + 0.4 + hash(x, 4) * 0.6, 0.9);
    }
    for (var y = world.y0 - 1; y < world.y1 + 1; y += step) {
      tree(world.x0 - 0.7 - hash(y, 5) * 0.5, y, 0.85);
      tree(world.x1 + 0.4 + hash(y, 6) * 0.5, y, 0.85);
    }
  }

  // ---- render: props -----------------------------------------
  function tree(tx, ty, s) {
    s = s || 1;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ellipse(tx, ty + 0.05, 0.5 * s, 0.18 * s);
    // trunk
    rect(tx - 0.12 * s, ty - 0.5 * s, 0.24 * s, 0.6 * s, "#6b4423");
    // canopy — layered toon greens
    ctx.fillStyle = "#2f6b27";
    ellipse(tx, ty - 1.05 * s, 0.78 * s, 0.7 * s);
    ctx.fillStyle = "#3c8a31";
    ellipse(tx - 0.18 * s, ty - 1.2 * s, 0.55 * s, 0.5 * s);
    ctx.fillStyle = "#54a83f";
    ellipse(tx - 0.28 * s, ty - 1.35 * s, 0.3 * s, 0.28 * s);
  }

  function ellipse(cx, cy, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(cx * PX, cy * PX, rx * PX, ry * PX, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function pond(tx, ty) {
    ctx.fillStyle = "#2f6f8f"; ellipse(tx, ty, 1.1, 0.7);
    ctx.fillStyle = "#4f9ec0"; ellipse(tx, ty - 0.05, 0.85, 0.5);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect((tx - 0.4) * PX, (ty - 0.18) * PX, 0.4 * PX, 0.06 * PX);
    ctx.fillRect((tx + 0.05) * PX, (ty + 0.05) * PX, 0.28 * PX, 0.05 * PX);
  }

  function scarecrow(tx, ty) {
    ctx.fillStyle = "rgba(0,0,0,0.15)"; ellipse(tx, ty + 0.05, 0.35, 0.12);
    rect(tx - 0.05, ty - 1.1, 0.1, 1.1, "#7a5a32");          // post
    rect(tx - 0.5, ty - 0.78, 1.0, 0.1, "#7a5a32");          // arms
    ctx.fillStyle = "#caa24a"; ellipse(tx, ty - 1.1, 0.26, 0.26); // straw head
    rect(tx - 0.3, ty - 1.28, 0.6, 0.12, "#8a6a2a");         // hat brim
    rect(tx - 0.16, ty - 1.5, 0.32, 0.22, "#8a6a2a");        // hat top
    ctx.fillStyle = "#3b2a14";
    ctx.fillRect((tx - 0.12) * PX, (ty - 1.14) * PX, 0.07 * PX, 0.07 * PX);
    ctx.fillRect((tx + 0.05) * PX, (ty - 1.14) * PX, 0.07 * PX, 0.07 * PX);
  }

  function flowers(tx, ty) {
    var cols = ["#e85d75", "#f4d35e", "#9b6dd6", "#e8e0ec"];
    for (var i = 0; i < 5; i++) {
      var fx = tx + (hash(tx + i, ty) - 0.5) * 1.2;
      var fy = ty + (hash(tx, ty + i) - 0.5) * 0.7;
      rect(fx - 0.03, fy, 0.06, 0.22, "#3c8a31");
      ctx.fillStyle = cols[i % cols.length];
      ellipse(fx, fy, 0.12, 0.12);
    }
  }

  function well(tx, ty) {
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ellipse(tx, ty + 0.1, 0.55, 0.18);
    rect(tx - 0.45, ty - 0.5, 0.9, 0.6, "#8a8f96");     // stone base
    rect(tx - 0.45, ty - 0.5, 0.9, 0.14, "#b6bcc4");
    ctx.fillStyle = "#3a2a18"; ellipse(tx, ty - 0.46, 0.34, 0.12); // water hole
    rect(tx - 0.5, ty - 1.25, 0.1, 0.8, "#6b4423");     // posts
    rect(tx + 0.4, ty - 1.25, 0.1, 0.8, "#6b4423");
    // roof
    ctx.fillStyle = "#9a4a32";
    ctx.beginPath();
    ctx.moveTo((tx - 0.7) * PX, (ty - 1.2) * PX);
    ctx.lineTo((tx + 0.7) * PX, (ty - 1.2) * PX);
    ctx.lineTo(tx * PX, (ty - 1.7) * PX);
    ctx.closePath(); ctx.fill();
  }

  function barn(tx, ty, roof) {
    ctx.fillStyle = "rgba(0,0,0,0.16)"; ellipse(tx, ty + 0.05, 1.1, 0.22);
    rect(tx - 1.0, ty - 1.3, 2.0, 1.35, "#b5462f");        // red wall
    rect(tx - 1.0, ty - 1.3, 2.0, 0.18, "#d6573b");
    // white trim doors
    rect(tx - 0.35, ty - 0.85, 0.7, 0.85, "#f3ead2");
    rect(tx - 0.02, ty - 0.85, 0.05, 0.85, "#b5462f");
    // gambrel roof
    ctx.fillStyle = roof || "#6b3a22";
    ctx.beginPath();
    ctx.moveTo((tx - 1.15) * PX, (ty - 1.3) * PX);
    ctx.lineTo((tx - 0.6) * PX, (ty - 1.95) * PX);
    ctx.lineTo((tx + 0.6) * PX, (ty - 1.95) * PX);
    ctx.lineTo((tx + 1.15) * PX, (ty - 1.3) * PX);
    ctx.closePath(); ctx.fill();
  }

  // ---- render: a farm ----------------------------------------
  function drawFarm(f) {
    // tilled field with crop rows (fills the plot interior)
    var fx = f.x + 0.5, fy = f.y + 0.5, fw = f.w - 1, fh = f.h - 1;
    rect(fx, fy, fw, fh, "#6a4326"); // soil base
    var rows = Math.max(2, Math.round(fh / 0.9));
    for (var r = 0; r < rows; r++) {
      var ry = fy + (r + 0.5) * (fh / rows);
      rect(fx, ry - 0.16, fw, 0.32, "#7d5230");            // furrow ridge
      rect(fx, ry + 0.16, fw, 0.06, "#553218");            // furrow shadow
      // crops along the row
      var n = Math.max(2, Math.round(fw / 0.8));
      for (var c = 0; c < n; c++) {
        var cx = fx + (c + 0.5) * (fw / n);
        var grow = 0.7 + hash(c + r * 7 + f.x, f.y) * 0.5;
        rect(cx - 0.03, ry - 0.18 * grow, 0.06, 0.2 * grow, "#3c7a2a"); // stem
        ctx.fillStyle = f.crop;
        ellipse(cx, ry - 0.2 * grow, 0.12 * grow, 0.13 * grow);          // fruit/leaf
      }
    }

    // fence around the plot
    drawFence(f.x, f.y, f.w, f.h);

    // cabin in the back-left corner of the plot
    cabin(f.x + 1.4, f.y + 0.2, f.roof);

    // decorations placed around the plot edges
    placeDecor(f);

    // signpost out front with the org name
    signpost(f);
  }

  function drawFence(x, y, w, h) {
    ctx.strokeStyle = "#8a6239";
    ctx.lineWidth = 0.12 * PX;
    // rails
    ctx.strokeRect(x * PX, y * PX, w * PX, h * PX);
    // posts
    ctx.fillStyle = "#6b4a2b";
    for (var px = 0; px <= w; px += 1) {
      ctx.fillRect((x + px - 0.06) * PX, (y - 0.12) * PX, 0.12 * PX, 0.4 * PX);
      ctx.fillRect((x + px - 0.06) * PX, (y + h - 0.28) * PX, 0.12 * PX, 0.4 * PX);
    }
    for (var py = 0; py <= h; py += 1) {
      ctx.fillRect((x - 0.06) * PX, (y + py - 0.12) * PX, 0.12 * PX, 0.4 * PX);
      ctx.fillRect((x + w - 0.06) * PX, (y + py - 0.12) * PX, 0.12 * PX, 0.4 * PX);
    }
  }

  function cabin(tx, ty, roof) {
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ellipse(tx + 0.9, ty + 2.2, 1.3, 0.25);
    // walls (log cabin tan)
    rect(tx, ty + 0.9, 1.9, 1.3, "#caa472");
    rect(tx, ty + 0.9, 1.9, 0.16, "#b08a55");
    // door + window
    rect(tx + 0.25, ty + 1.5, 0.5, 0.7, "#6b4423");
    rect(tx + 1.1, ty + 1.2, 0.55, 0.45, "#8fd0e8");
    rect(tx + 1.1, ty + 1.2, 0.55, 0.45, "rgba(0,0,0,0)");
    ctx.strokeStyle = "#6b4423"; ctx.lineWidth = 0.05 * PX;
    ctx.strokeRect((tx + 1.1) * PX, (ty + 1.2) * PX, 0.55 * PX, 0.45 * PX);
    // roof (farm color)
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo((tx - 0.25) * PX, (ty + 0.95) * PX);
    ctx.lineTo((tx + 0.95) * PX, (ty + 0.15) * PX);
    ctx.lineTo((tx + 2.15) * PX, (ty + 0.95) * PX);
    ctx.closePath(); ctx.fill();
    // chimney
    rect(tx + 1.55, ty + 0.25, 0.28, 0.5, "#8a5a3a");
  }

  function placeDecor(f) {
    // anchor points around the plot for decor items
    var spots = [
      { x: f.x + f.w + 0.9, y: f.y + f.h - 0.5 },  // right-bottom
      { x: f.x - 0.9, y: f.y + f.h - 0.6 },        // left-bottom
      { x: f.x + f.w + 0.9, y: f.y + 1.0 },        // right-top
      { x: f.x + f.w * 0.5, y: f.y - 0.9 },        // back
    ];
    f.decor.forEach(function (kind, i) {
      var s = spots[i % spots.length];
      if (kind === "tree") tree(s.x, s.y, 0.95);
      else if (kind === "pond") pond(s.x, s.y);
      else if (kind === "scarecrow") scarecrow(s.x, s.y);
      else if (kind === "flowers") flowers(s.x, s.y);
      else if (kind === "well") well(s.x, s.y);
      else if (kind === "barn") barn(s.x, s.y, f.roof);
    });
  }

  function signpost(f) {
    var sx = f.sign.x, sy = f.sign.y;
    ctx.fillStyle = "rgba(0,0,0,0.16)"; ellipse(sx, sy + 0.15, 0.5, 0.14);
    // posts
    rect(sx - 0.62, sy - 0.62, 0.12, 0.78, "#6b4423");
    rect(sx + 0.5, sy - 0.62, 0.12, 0.78, "#6b4423");
    // board
    rect(sx - 0.78, sy - 0.95, 1.56, 0.5, "#a9762f");
    rect(sx - 0.78, sy - 0.95, 1.56, 0.1, "#c08e44");
    // crop-colored accent strip
    rect(sx - 0.78, sy - 0.5, 1.56, 0.05, f.crop);
    // label text (screen-space size derived from PX)
    ctx.fillStyle = "#3b2410";
    ctx.font = "bold " + Math.round(PX * 0.3) + "px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    var name = f.data.name;
    ctx.fillText(name, sx * PX, (sy - 0.7) * PX);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  // ---- render: farmer ----------------------------------------
  function drawFarmer() {
    var fxp = state.pos.x * PX, fyp = state.pos.y * PX; // feet position (screen via camera)
    var u = PX / 16; // virtual sprite pixel
    var bob = state.moving ? Math.sin(state.stepPhase) : 0;
    var legSwing = state.moving ? Math.sin(state.stepPhase) * 2.2 * u : 0;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(fxp, fyp, 5 * u, 1.8 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    function r(ox, oy, w, h, col) { // ox,oy in sprite px relative to feet center
      ctx.fillStyle = col;
      ctx.fillRect(fxp + ox * u, fyp + (oy - bob * 0.6) * u, w * u, h * u);
    }

    var skin = "#e8b48a", skinSh = "#cf9468";
    var shirt = "#3f86c4", overall = "#2f5fa6", overallD = "#244b85";
    var boot = "#5a3b22", hat = "#e0c067", hatBand = "#9a6a2a", hair = "#5a3a1c";

    if (state.dir === "left" || state.dir === "right") {
      var flip = state.dir === "left" ? -1 : 1;
      // boots (front/back leg swing)
      r(-2 + legSwing / u, -2.5, 3.5, 2.5, boot);
      r(-2 - legSwing / u, -2.5, 3.5, 2.5, boot);
      // legs
      r(-2, -7, 4, 5, overall);
      // torso
      r(-3, -12, 6, 6, shirt);
      r(-3, -9, 6, 3, overall);
      r(flip > 0 ? 2 : -3, -12, 1, 6, overallD); // side seam
      // arm
      r(flip > 0 ? 1 : -3.5, -11, 2.5, 4, skin);
      // head
      r(-2.5, -17.5, 5, 5.5, skin);
      r(flip > 0 ? 1.5 : -2.5, -17.5, 1, 5.5, skinSh);
      // eye (toward facing side)
      r(flip > 0 ? 1 : -1.6, -15.5, 1.1, 1.3, "#2a1c10");
      // straw hat
      r(-4, -18.5, 8, 1.4, hat);
      r(-2.6, -20.5, 5.2, 2.2, hat);
      r(-2.6, -19, 5.2, 0.7, hatBand);
      // scale flip
      // (drawn symmetric enough; eye handles direction)
    } else {
      var back = state.dir === "up";
      // boots with walk swing
      r(-3.2, -2.5, 3, 2.5 + Math.max(0, legSwing / u), boot);
      r(0.2, -2.5, 3, 2.5 + Math.max(0, -legSwing / u), boot);
      // legs / overalls lower
      r(-3, -7.5, 6, 5.5, overall);
      r(-0.4, -7.5, 0.8, 5.5, overallD); // center seam
      // torso
      r(-3.5, -12.5, 7, 6, back ? overall : shirt);
      if (!back) { // overall bib + straps
        r(-2, -10.5, 4, 4, overall);
        r(-2.2, -12.3, 0.9, 3, overallD);
        r(1.3, -12.3, 0.9, 3, overallD);
      }
      // arms
      r(-4.8, -12, 2, 5, skin);
      r(2.8, -12, 2, 5, skin);
      // head
      r(-3, -18.5, 6, 6, skin);
      if (!back) {
        r(-1.7, -16, 1.2, 1.4, "#2a1c10"); // eyes
        r(0.5, -16, 1.2, 1.4, "#2a1c10");
        r(-0.8, -14.2, 1.6, 0.7, skinSh);  // smile/cheek
      } else {
        r(-3, -16.5, 6, 3, hair); // back of hair under hat
      }
      // straw hat
      r(-4.6, -19, 9.2, 1.5, hat);
      r(-2.8, -21.5, 5.6, 2.6, hat);
      r(-2.8, -19.6, 5.6, 0.8, hatBand);
    }
  }

  // ---- main render -------------------------------------------
  function render() {
    applyCamera();
    drawGround();
    // draw farms sorted by their front y so southern ones overlap correctly
    var ordered = farms.slice().sort(function (a, b) { return a.y - b.y; });
    ordered.forEach(drawFarm);
    drawFarmer();
    drawMinimap();
  }

  // ---- minimap -----------------------------------------------
  var mm = document.getElementById("minimap");
  var mmx = mm.getContext("2d");
  var mscale, moffx, moffy;
  function drawMinimap() {
    var W = mm.width, H = mm.height, pad = 8;
    mmx.clearRect(0, 0, W, H);
    // fit world into minimap preserving aspect
    mscale = Math.min((W - pad * 2) / world.w, (H - pad * 2) / world.h);
    moffx = (W - world.w * mscale) / 2;
    moffy = (H - world.h * mscale) / 2;
    function mX(wx) { return moffx + (wx - world.x0) * mscale; }
    function mY(wy) { return moffy + (wy - world.y0) * mscale; }
    // grass
    mmx.fillStyle = "#6fb13f";
    mmx.fillRect(mX(world.x0), mY(world.y0), world.w * mscale, world.h * mscale);
    // path
    var pts = farms.map(function (f) { return f.sign; }).slice().sort(function (a, b) { return a.x - b.x; });
    mmx.strokeStyle = "#b9925a"; mmx.lineWidth = 3; mmx.lineJoin = "round"; mmx.lineCap = "round";
    mmx.beginPath(); mmx.moveTo(mX(pts[0].x), mY(pts[0].y));
    for (var i = 1; i < pts.length; i++) mmx.lineTo(mX(pts[i].x), mY(pts[i].y));
    mmx.stroke();
    // farm dots
    farms.forEach(function (f) {
      mmx.fillStyle = f.crop;
      mmx.beginPath(); mmx.arc(mX(f.sign.x), mY(f.sign.y), 5, 0, Math.PI * 2); mmx.fill();
      mmx.lineWidth = 2;
      mmx.strokeStyle = f.visited ? "#fff4d6" : "rgba(0,0,0,0.35)";
      mmx.stroke();
    });
    // player marker
    mmx.fillStyle = "#fff";
    mmx.strokeStyle = "#2f5fa6"; mmx.lineWidth = 2;
    mmx.beginPath(); mmx.arc(mX(state.pos.x), mY(state.pos.y), 3.5, 0, Math.PI * 2);
    mmx.fill(); mmx.stroke();
  }
  mm.addEventListener("pointerdown", function (e) {
    if (state.visiting) return;
    var rectb = mm.getBoundingClientRect();
    var px = (e.clientX - rectb.left) / rectb.width * mm.width;
    var py = (e.clientY - rectb.top) / rectb.height * mm.height;
    var wx = (px - moffx) / mscale + world.x0;
    var wy = (py - moffy) / mscale + world.y0;
    // snap to a farm if the click is near one
    var hit = null, best = 2.2;
    farms.forEach(function (f) {
      var d = Math.hypot(wx - f.sign.x, wy - f.sign.y);
      if (d < best) { best = d; hit = f; }
    });
    if (hit) { state.target = { x: hit.sign.x, y: hit.sign.y + 1.1 }; state.autoVisit = hit; }
    else {
      state.target = { x: clamp(wx, world.x0 + 0.5, world.x1 - 0.5),
                       y: clamp(wy, world.y0 + 0.5, world.y1 - 0.5) };
      state.autoVisit = null;
    }
  });

  // ---- panel (visit a farm) ----------------------------------
  var ui = {
    panel: document.getElementById("panel"),
    accent: document.getElementById("panel-accent"),
    name: document.getElementById("panel-name"),
    role: document.getElementById("panel-role"),
    dates: document.getElementById("panel-dates"),
    sector: document.getElementById("panel-sector"),
    summary: document.getElementById("panel-summary"),
    highlights: document.getElementById("panel-highlights"),
    tech: document.getElementById("panel-tech"),
    prompt: document.getElementById("visit-prompt"),
    promptName: document.getElementById("visit-prompt-name"),
    progress: document.getElementById("progress"),
    help: document.getElementById("help"),
  };

  function updatePrompt() {
    if (state.nearby && !state.visiting) {
      ui.promptName.textContent = state.nearby.data.name;
      ui.prompt.classList.add("show");
    } else {
      ui.prompt.classList.remove("show");
    }
  }

  function visit(f) {
    state.visiting = f;
    state.target = null; state.autoVisit = null; state.nearby = f;
    var d = f.data;
    ui.accent.style.background = f.roof;
    ui.name.textContent = d.name;
    ui.role.textContent = d.role;
    ui.dates.textContent = d.dates + (d.current ? "  ·  Current" : "");
    ui.sector.textContent = d.sector || "";
    ui.summary.textContent = d.summary || "";
    ui.highlights.innerHTML = "";
    (d.highlights || []).forEach(function (h) {
      var li = document.createElement("li");
      li.textContent = h;
      ui.highlights.appendChild(li);
    });
    ui.tech.innerHTML = "";
    (d.tech || []).forEach(function (t) {
      var s = document.createElement("span");
      s.className = "tag"; s.textContent = t;
      ui.tech.appendChild(s);
    });
    ui.panel.classList.add("open");
    ui.prompt.classList.remove("show");
    if (!f.visited) { f.visited = true; state.visitedCount++; updateProgress(); }
  }

  function leave() {
    if (!state.visiting) return;
    state.visiting = null;
    ui.panel.classList.remove("open");
    updatePrompt();
  }
  document.getElementById("panel-close").addEventListener("click", leave);

  function updateProgress() {
    var total = farms.length, done = state.visitedCount;
    var s = '';
    for (var i = 0; i < total; i++) {
      s += '<span class="crop' + (i < done ? ' full' : '') + '">🌾</span>';
    }
    ui.progress.innerHTML = s + '<span class="crop-count">' + done + ' / ' + total + '</span>';
  }

  // ---- music (Web Audio chiptune loop) -----------------------
  var audio = (function () {
    var actx = null, master = null, lp = null, timer = null;
    var on = false, nextTime = 0, step = 0;
    // a gentle pentatonic loop (Hz). Lead + soft bass — original melody.
    var lead = [523, 587, 659, 784, 659, 587, 523, 587, 659, 784, 880, 784, 659, 587, 523, 0];
    var bass = [131, 0, 196, 0, 165, 0, 196, 0];
    var beat = 0.32;

    function ensure() {
      if (actx) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      master = actx.createGain(); master.gain.value = 0.0;
      lp = actx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
      lp.connect(master); master.connect(actx.destination);
    }
    function note(freq, t, dur, type, gain) {
      if (!freq) return;
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      o.connect(g); g.connect(lp);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
    }
    function schedule() {
      while (nextTime < actx.currentTime + 0.25) {
        note(lead[step % lead.length], nextTime, beat * 0.9, "square", 0.16);
        if (step % 2 === 0) note(bass[(step / 2) % bass.length], nextTime, beat * 1.6, "triangle", 0.22);
        nextTime += beat; step++;
      }
    }
    return {
      toggle: function () {
        ensure();
        if (!actx) return false;
        on = !on;
        if (on) {
          if (actx.state === "suspended") actx.resume();
          master.gain.linearRampToValueAtTime(0.6, actx.currentTime + 0.4);
          nextTime = actx.currentTime + 0.05;
          if (!timer) timer = setInterval(schedule, 90);
        } else {
          master.gain.linearRampToValueAtTime(0.0, actx.currentTime + 0.3);
          clearInterval(timer); timer = null;
        }
        return on;
      },
      isOn: function () { return on; },
    };
  })();

  var musicBtn = document.getElementById("music-toggle");
  musicBtn.addEventListener("click", function () {
    var on = audio.toggle();
    musicBtn.textContent = on ? "🎵 Music: on" : "🔇 Music: off";
  });

  // ---- loop --------------------------------------------------
  var last = performance.now();
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // init HUD + start
  updateProgress();
  setTimeout(function () { ui.help.classList.add("fade"); }, 9000);
  requestAnimationFrame(frame);

  // ---- debug / test hook -------------------------------------
  window.__farm = {
    visit: function (id) {
      var f = farms.find(function (o) { return o.data.id === id; });
      if (!f) return false;
      // walk the farmer to the farm so state is coherent, then open
      state.pos.x = f.sign.x; state.pos.y = f.sign.y + 1.1;
      visit(f);
      return true;
    },
    leave: leave,
    farms: farms.map(function (o) { return o.data.id; }),
    status: function () {
      return {
        x: state.pos.x, y: state.pos.y,
        walking: !!state.target,
        visiting: state.visiting ? state.visiting.data.id : null,
        visited: state.visitedCount,
      };
    },
    teleport: function (id) {
      var f = farms.find(function (o) { return o.data.id === id; });
      if (!f) return false;
      state.pos.x = f.sign.x; state.pos.y = f.sign.y + 1.5;
      state.target = null; state.autoVisit = null;
      return true;
    },
  };

  console.log("[farm] engine started — " + farms.length + " farms");
})();
