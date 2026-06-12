/* ============================================================
   VOYAGE ENGINE — game mechanics. You should not need to edit
   this file to change resume content; edit voyage-data.js.
   ============================================================ */
(function () {
  "use strict";

  const DATA = window.VOYAGE_DATA || VOYAGE_DATA;
  const SEA_HALF = 95; // world bounds
  const DOCK_RADIUS = DATA.dockRadius || 13;

  // ---------- Renderer / Scene / Camera ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("scene").appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x55c0ea); // bright cartoon-sky cyan
  scene.fog = new THREE.Fog(0x55c0ea, 150, 280);

  // ---------- Toon (cel) shading ----------
  // 3-step gradient map gives everything that chunky cel-shaded look
  const gradientMap = (function () {
    const steps = new Uint8Array([90, 170, 255]);
    const tex = new THREE.DataTexture(steps, steps.length, 1, THREE.LuminanceFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  })();
  function toonMat(color, extra) {
    return new THREE.MeshToonMaterial(Object.assign({ color: color, gradientMap: gradientMap }, extra || {}));
  }

  const camera = new THREE.PerspectiveCamera(
    50, window.innerWidth / window.innerHeight, 0.1, 500
  );
  const CAM_OFFSET = new THREE.Vector3(0, 42, 40);
  let camZoom = 1; // 0.45 (close) … 2.3 (far), mouse wheel / +/- keys

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0xfdf7e3, 0x3a82b5, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3d6, 0.95);
  sun.position.set(-60, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -130; sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
  sun.shadow.camera.far = 300;
  sun.shadow.bias = -0.0006; // prevents self-shadow shimmer on the boat
  scene.add(sun);

  // ---------- Water (voronoi-cell texture like clay/stone water) ----------
  function makeWaterTexture(size) {
    const n = 46; // seed cells
    const seeds = [];
    for (let i = 0; i < n; i++) seeds.push([Math.random() * size, Math.random() * size]);
    // tile seeds 3x3 for seamless wrap
    const all = [];
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++)
        for (const s of seeds) all.push([s[0] + ox * size, s[1] + oy * size]);

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    const base = [27, 119, 178], cellVar = 12, edge = [118, 190, 222];

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let d1 = 1e9, d2 = 1e9, idx1 = 0;
        for (let i = 0; i < all.length; i++) {
          const dx = x - all[i][0], dy = y - all[i][1];
          const d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; idx1 = i; }
          else if (d < d2) { d2 = d; }
        }
        const e = Math.sqrt(d2) - Math.sqrt(d1); // edge proximity
        let t = Math.max(0, Math.min(1, (3.2 - e) / 3.2)); // 1 = on edge
        t = t * t; // thinner, softer veins
        const v = ((idx1 * 7919) % 100) / 100 * cellVar - cellVar / 2;
        const p = (y * size + x) * 4;
        img.data[p]     = base[0] + v + (edge[0] - base[0]) * t;
        img.data[p + 1] = base[1] + v + (edge[1] - base[1]) * t;
        img.data[p + 2] = base[2] + v + (edge[2] - base[2]) * t;
        img.data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // hand-painted style foam swirls (Wind-Waker-ish curls), drawn twice with
    // wrapped offsets so the texture tiles seamlessly
    ctx.strokeStyle = "rgba(235, 250, 255, 0.55)";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    for (let i = 0; i < 10; i++) {
      const sx = Math.random() * size, sy = Math.random() * size;
      const a0 = Math.random() * Math.PI * 2;
      const r0 = 7 + Math.random() * 9;
      for (const [ox, oy] of [[0, 0], [-size, 0], [size, 0], [0, -size], [0, size]]) {
        ctx.beginPath();
        for (let s = 0; s <= 22; s++) {
          const ang = a0 + s * 0.28;
          const rr = r0 * (1 - s / 30);
          const x = sx + ox + Math.cos(ang) * rr;
          const y = sy + oy + Math.sin(ang) * rr * 0.8;
          s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(20, 20);
    return tex;
  }

  const waterTex = makeWaterTexture(256);
  const waterGeo = new THREE.PlaneGeometry(SEA_HALF * 5, SEA_HALF * 5, 64, 64);
  // unlit water = flat, saturated, cartoon-painted look
  const waterMat = new THREE.MeshBasicMaterial({ map: waterTex });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  scene.add(water);
  const waterBaseZ = waterGeo.attributes.position.array.slice();

  // ---------- Helpers ----------
  function box(w, h, d, color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMat(color));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cyl(rt, rb, h, color, seg) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 8), toonMat(color));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function labelTexture(text, opts) {
    const o = Object.assign({ font: "bold 44px Georgia, serif", fg: "#fdf6e3", bg: null, outline: null, pad: 18 }, opts);
    const c = document.createElement("canvas");
    const x = c.getContext("2d");
    x.font = o.font;
    const w = Math.ceil(x.measureText(text).width) + o.pad * 2;
    c.width = w; c.height = 72;
    const x2 = c.getContext("2d");
    if (o.bg) { x2.fillStyle = o.bg; x2.fillRect(0, 0, c.width, c.height); }
    x2.font = o.font;
    x2.textAlign = "center"; x2.textBaseline = "middle";
    if (o.outline) {
      x2.lineWidth = 8; x2.lineJoin = "round";
      x2.strokeStyle = o.outline;
      x2.strokeText(text, c.width / 2, c.height / 2 + 2);
    }
    x2.fillStyle = o.fg;
    x2.fillText(text, c.width / 2, c.height / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.userData = { aspect: c.width / c.height };
    return tex;
  }

  function makeTree(scale) {
    const g = new THREE.Group();
    const trunk = cyl(0.18 * scale, 0.26 * scale, 1.6 * scale, 0x8a5a33, 6);
    trunk.position.y = 0.8 * scale;
    g.add(trunk);
    const leaf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.85 * scale, 0),
      toonMat(0x3f9e4d)
    );
    leaf.castShadow = true;
    leaf.position.y = 1.9 * scale;
    g.add(leaf);
    return g;
  }

  // ---------- Islands ----------
  const islands = []; // { data, group, pos:Vector3, radius, clickMeshes, visited }
  const clickables = [];
  const pierClickables = [];

  function buildIsland(d) {
    const g = new THREE.Group();
    const R = 9 * (d.size || 1);

    // sand base + grass top (slightly irregular via flatShading + low segments)
    const sand = cyl(R, R * 0.86, 2.6, 0xd9b078, 10);
    sand.position.y = -0.4;
    g.add(sand);
    const grass = cyl(R * 0.96, R * 0.99, 1.1, 0x6abf4b, 10);
    grass.position.y = 1.35;
    g.add(grass);

    // path
    const path = new THREE.Mesh(
      new THREE.BoxGeometry(R * 1.1, 0.12, 2.2),
      toonMat(0xcaa97e)
    );
    path.position.y = 1.96;
    path.receiveShadow = true;
    g.add(path);

    // landmark building tinted by company color
    const c = new THREE.Color(d.color || "#888888");
    const b1 = box(2.6, 3.6, 2.6, c.getHex());
    b1.position.set(-R * 0.25, 3.7, -R * 0.2);
    g.add(b1);
    const roof = cyl(0, 2.1, 1.6, 0x5d4037, 4);
    roof.position.set(-R * 0.25, 5.5 + 0.7, -R * 0.2);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    const b2 = box(1.7, 2.0, 1.7, 0xefe6d0);
    b2.position.set(R * 0.22, 2.9, -R * 0.3);
    g.add(b2);

    // trees
    const t1 = makeTree(1.0); t1.position.set(R * 0.45, 1.9, R * 0.25); g.add(t1);
    const t2 = makeTree(0.7); t2.position.set(-R * 0.5, 1.9, R * 0.35); g.add(t2);

    // sign with island name
    const post = cyl(0.12, 0.12, 2.2, 0x7a4f2a, 6);
    post.position.set(0, 2.9, R * 0.55);
    g.add(post);
    const signTex = labelTexture(d.name, { font: "bold 40px Georgia, serif", fg: "#f6e7c8", bg: "#7a4f2a" });
    const sw = 3.4, sh = sw / signTex.userData.aspect * 1.4;
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(sw, Math.min(sh, 1.1), 0.18),
      [
        toonMat(0x7a4f2a), toonMat(0x7a4f2a), toonMat(0x7a4f2a),
        toonMat(0x7a4f2a), toonMat(0x7a4f2a, { map: signTex }), toonMat(0x7a4f2a),
      ]
    );
    sign.castShadow = true;
    sign.position.set(0, 3.6, R * 0.55);
    g.add(sign);

    // floating name sprite (always faces camera)
    const sprTex = labelTexture(d.name + (d.current ? "  ⭐" : ""), {
      font: "bold 46px 'Trebuchet MS', sans-serif", fg: "#ffffff", outline: "#14506e",
    });
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprTex, depthTest: false, opacity: 0.95 }));
    const sa = sprTex.userData.aspect;
    spr.scale.set(5.5 * sa / 3, 5.5 / 3, 1);
    spr.position.y = 9.5;
    g.add(spr);

    // wooden pier on the east (+x) side — click it to sail over and auto-dock
    const woodMat = toonMat(0x9c6b3f);
    const woodDark = toonMat(0x7a4f2a);
    const pierLen = 6.0;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(pierLen, 0.22, 2.0), woodMat);
    deck.castShadow = true; deck.receiveShadow = true;
    deck.position.set(R * 0.92 + pierLen / 2, 0.95, 0);
    g.add(deck);
    // plank lines
    for (let i = 0; i < 4; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 2.0), woodDark);
      strip.position.set(R * 0.92 + 1.0 + i * 1.35, 0.95, 0);
      g.add(strip);
    }
    // legs into the water
    for (const lx of [R * 0.92 + 1.0, R * 0.92 + pierLen - 0.6]) {
      for (const lz of [-0.8, 0.8]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.6, 6), woodDark);
        leg.position.set(lx, 0.15, lz);
        g.add(leg);
      }
    }
    // mooring post
    const moor = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.0, 6), woodDark);
    moor.position.set(R * 0.92 + pierLen - 0.4, 1.45, 0.75);
    g.add(moor);

    // shoreline foam ring (gently pulsing, Wind-Waker style)
    const foamRing = new THREE.Mesh(
      new THREE.RingGeometry(R + 0.3, R + 2.0, 28),
      new THREE.MeshBasicMaterial({ color: 0xeefaff, transparent: true, opacity: 0.7, depthWrite: false })
    );
    foamRing.rotation.x = -Math.PI / 2;
    foamRing.position.y = 0.62;
    g.add(foamRing);

    // dock-radius dotted ring
    const ringPts = [];
    const ringR = R + DOCK_RADIUS * 0.55;
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * ringR, 0.62, Math.sin(a) * ringR));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
    const ring = new THREE.Line(
      ringGeo,
      new THREE.LineDashedMaterial({ color: 0xbfeaff, dashSize: 1.2, gapSize: 1.2, transparent: true, opacity: 0.7 })
    );
    ring.computeLineDistances();
    g.add(ring);

    g.position.set(d.position.x, 0.4, d.position.z);
    scene.add(g);

    // invisible click cylinder covering the island
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(R + 2, R + 2, 12, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.copy(g.position);
    hit.userData.islandId = d.id;
    scene.add(hit);
    clickables.push(hit);

    // generous invisible hitbox over the pier (checked before the island hitbox)
    const pierHit = new THREE.Mesh(
      new THREE.BoxGeometry(pierLen + 3, 7, 6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    pierHit.position.set(g.position.x + R * 0.92 + pierLen / 2, 2, g.position.z);
    pierHit.userData.islandId = d.id;
    pierHit.userData.isPier = true;
    scene.add(pierHit);
    pierClickables.push(pierHit);

    return {
      data: d, group: g, sprite: spr, ring: ring, foamRing: foamRing,
      pos: g.position.clone(), radius: R, visited: false,
      foamPhase: Math.random() * Math.PI * 2,
    };
  }

  // ---------- Cartoon clouds ----------
  const clouds = [];
  (function buildClouds() {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 128;
    const x = c.getContext("2d");
    x.fillStyle = "#ffffff";
    const blobs = [[70, 85, 38], [115, 70, 46], [165, 82, 40], [200, 92, 26], [45, 95, 24], [140, 95, 42]];
    for (const b of blobs) { x.beginPath(); x.arc(b[0], b[1], b[2], 0, Math.PI * 2); x.fill(); }
    const tex = new THREE.CanvasTexture(c);
    for (let i = 0; i < 14; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.85, depthWrite: false,
      }));
      const s = 14 + Math.random() * 18;
      spr.scale.set(s, s * 0.5, 1);
      // kept in a band north of the course: the camera faces north, so these
      // hug the horizon at the top of the frame without covering gameplay
      spr.position.set(
        (Math.random() * 2 - 1) * 230,
        18 + Math.random() * 22,
        -70 - Math.random() * 170
      );
      spr.userData.speed = 0.6 + Math.random() * 0.9;
      scene.add(spr);
      clouds.push(spr);
    }
  })();

  // course line (dotted, oldest → newest)
  function buildCourse() {
    const pts = DATA.islands.map(d => new THREE.Vector3(d.position.x, 0.3, d.position.z));
    const curve = new THREE.CatmullRomCurve3(pts);
    const cPts = curve.getPoints(220);
    const geo = new THREE.BufferGeometry().setFromPoints(cPts);
    const line = new THREE.Line(
      geo,
      new THREE.LineDashedMaterial({ color: 0x9fdcf5, dashSize: 1.6, gapSize: 2.4, transparent: true, opacity: 0.55 })
    );
    line.computeLineDistances();
    scene.add(line);
  }

  // ---------- Boat ----------
  const boat = new THREE.Group();
  (function buildBoat() {
    const hullMat = toonMat(0x8b5a2b);
    const hullDark = toonMat(0x6f4521);

    // hull: lathe-like via tapered boxes
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 5.2), hullMat);
    hull.castShadow = true;
    boat.add(hull);
    // pointed bow: vertical triangular prism, one vertex facing forward (-z)
    const bow = new THREE.Mesh(new THREE.CylinderGeometry(1.19, 1.19, 1.06, 3), hullMat);
    bow.rotation.y = Math.PI / 2; // rotate triangle vertex from +x to -z
    bow.position.set(0, -0.02, -2.6); // top sits just under hull top: no coplanar z-fight
    bow.castShadow = true;
    boat.add(bow);
    // inner floor + benches (kept below hull top to avoid coplanar z-fighting)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 4.6), hullDark);
    floor.position.y = 0.38;
    boat.add(floor);
    const bench1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 0.5), hullDark);
    bench1.position.set(0, 0.62, 1.0); boat.add(bench1);
    const bench2 = bench1.clone(); bench2.position.z = -0.8; boat.add(bench2);

    // mast
    const mast = cyl(0.09, 0.12, 5.2, 0xa36c3a, 8);
    mast.position.set(0, 3.0, -0.4);
    boat.add(mast);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), toonMat(0xeac34f));
    knob.position.set(0, 5.65, -0.4);
    boat.add(knob);

    // sail: curved triangle shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, 4.4);
    shape.quadraticCurveTo(2.6, 2.6, 2.2, 0.25);
    shape.lineTo(0, 0);
    const sailGeo = new THREE.ShapeGeometry(shape, 8);
    // crimson sail — every great sea adventure needs one
    const sail = new THREE.Mesh(sailGeo, toonMat(0xc23b2e, {
      side: THREE.DoubleSide,
      emissive: 0x7e1f16, emissiveIntensity: 0.55,
    }));
    sail.castShadow = true;
    sail.position.set(0.06, 1.1, -0.38);
    sail.rotation.y = Math.PI / 2;
    boat.add(sail);
    // small jib
    const jib = new THREE.Mesh(sailGeo, sail.material);
    jib.scale.set(0.55, 0.7, 0.55);
    jib.position.set(0.03, 1.0, -1.1);
    jib.rotation.y = Math.PI / 2;
    boat.add(jib);

    // foam patch under boat
    // foam sits above the wave peaks so animated water never clips through it
    const foam = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 9),
      new THREE.MeshBasicMaterial({ color: 0xdff3fb, transparent: true, opacity: 0.45, depthWrite: false })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.y = 0.3;
    foam.scale.y = 1.5; // stretched along boat length (local Y after X-rotation)
    boat.add(foam);
  })();
  boat.position.set(DATA.islands[0].position.x + 16, 0.6, DATA.islands[0].position.z + 6);
  scene.add(boat);

  // ---------- State ----------
  const state = {
    heading: -Math.PI / 2, // radians; bow faces local -Z, so -π/2 = facing east (+x) along the course
    speed: 0,
    maxSpeed: 16,
    target: null,          // Vector3 click-to-sail target
    targetIsland: null,    // island object if user clicked an island
    autoDock: false,       // true when the target came from clicking a pier
    docked: null,          // island object while docked
    nearIsland: null,
    visitedCount: 0,
    keys: {},
  };

  // target marker
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.3, 24),
    new THREE.MeshBasicMaterial({ color: 0xf6d96b, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  // ---------- UI refs ----------
  const ui = {
    prompt: document.getElementById("dock-prompt"),
    promptName: document.getElementById("dock-prompt-name"),
    panel: document.getElementById("panel"),
    panelName: document.getElementById("panel-name"),
    panelRole: document.getElementById("panel-role"),
    panelDates: document.getElementById("panel-dates"),
    panelSector: document.getElementById("panel-sector"),
    panelSummary: document.getElementById("panel-summary"),
    panelHighlights: document.getElementById("panel-highlights"),
    panelTech: document.getElementById("panel-tech"),
    panelAccent: document.getElementById("panel-accent"),
    progress: document.getElementById("progress"),
    help: document.getElementById("help"),
    minimap: document.getElementById("minimap"),
  };

  // ---------- Minimap ----------
  const mm = (function () {
    const canvas = ui.minimap;
    const ctx = canvas.getContext("2d");
    const pad = 16;
    const scale = (canvas.height - pad * 2) / (SEA_HALF * 2); // uniform; canvas is wider than tall
    return { canvas, ctx, scale, cx: canvas.width / 2, cy: canvas.height / 2 };
  })();
  function worldToMap(x, z) {
    return [mm.cx + x * mm.scale, mm.cy + z * mm.scale];
  }
  function drawMinimap() {
    const ctx = mm.ctx, w = mm.canvas.width, h = mm.canvas.height;

    // parchment sea chart
    ctx.fillStyle = "#e9d7a8";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(120, 90, 40, 0.14)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 48) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 0; gy <= h; gy += 48) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    // sailing route in chart red
    ctx.strokeStyle = "rgba(170, 50, 35, 0.65)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    islandObjs.forEach((isl, i) => {
      const [px, py] = worldToMap(isl.pos.x, isl.pos.z);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // islands as inked landmasses
    for (const isl of islandObjs) {
      const [px, py] = worldToMap(isl.pos.x, isl.pos.z);
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = isl.visited ? "#7daa5c" : "#c9b988";
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#4a3318";
      ctx.stroke();
      if (isl === state.nearIsland) {
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(170, 50, 35, 0.9)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.font = "bold 15px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#4a3318";
      const above = islandObjs.indexOf(isl) % 2 === 1;
      ctx.fillText(isl.data.name.split(" ")[0], px, py + (above ? -16 : 28));
    }

    // destination marked with an X, as any proper chart demands
    if (marker.visible) {
      const [tx, ty] = worldToMap(marker.position.x, marker.position.z);
      ctx.strokeStyle = "#aa3223";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tx - 5, ty - 5); ctx.lineTo(tx + 5, ty + 5);
      ctx.moveTo(tx + 5, ty - 5); ctx.lineTo(tx - 5, ty + 5);
      ctx.stroke();
    }

    // boat: arrow pointing along heading (bow direction = (-sin h, -cos h))
    const [bx, by] = worldToMap(boat.position.x, boat.position.z);
    const a = Math.atan2(-Math.cos(state.heading), -Math.sin(state.heading)); // map angle (x right, z down)
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-7, 6.5);
    ctx.lineTo(-7, -6.5);
    ctx.closePath();
    ctx.fillStyle = "#c0392b";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#3a2410";
    ctx.stroke();
    ctx.restore();

    // compass rose, top-left
    ctx.save();
    ctx.translate(26, 28);
    ctx.strokeStyle = "#4a3318";
    ctx.fillStyle = "#4a3318";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-4, -5); ctx.lineTo(4, -5); ctx.closePath(); ctx.fill();
    ctx.font = "bold 13px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("N", 0, -17);
    ctx.restore();
  }

  // click the minimap to sail there (clicking an island dot targets that island)
  ui.minimap.addEventListener("pointerdown", (e) => {
    if (state.docked) { undock(); return; }
    const r = ui.minimap.getBoundingClientRect();
    const px = (e.clientX - r.left) * (mm.canvas.width / r.width);
    const py = (e.clientY - r.top) * (mm.canvas.height / r.height);
    // island dot hit?
    for (const isl of islandObjs) {
      const [ix, iy] = worldToMap(isl.pos.x, isl.pos.z);
      if (Math.hypot(px - ix, py - iy) < 16) {
        // minimap island click = sail to its pier and auto-dock
        state.target = new THREE.Vector3(isl.pos.x + isl.radius + 7.5, 0, isl.pos.z);
        state.targetIsland = isl;
        state.autoDock = true;
        marker.position.copy(state.target).setY(0.3);
        marker.visible = true;
        return;
      }
    }
    const wx = Math.max(-SEA_HALF, Math.min(SEA_HALF, (px - mm.cx) / mm.scale));
    const wz = Math.max(-SEA_HALF, Math.min(SEA_HALF, (py - mm.cy) / mm.scale));
    const p = new THREE.Vector3(wx, 0, wz);
    // if the point lands on an island, nudge it out to open water so it's reachable
    for (const isl of islandObjs) {
      const d = p.clone().sub(isl.pos).setY(0);
      const min = isl.radius + 4;
      if (d.length() < min) {
        if (d.lengthSq() < 0.01) d.set(1, 0, 0);
        p.copy(isl.pos).setY(0).add(d.normalize().multiplyScalar(min + 1.5));
      }
    }
    state.target = p;
    state.targetIsland = null;
    state.autoDock = false;
    marker.position.copy(state.target).setY(0.3);
    marker.visible = true;
  });

  function updateProgress() {
    // hearts, naturally
    let html = "";
    for (const isl of islandObjs) {
      html += '<span class="heart' + (isl.visited ? " full" : "") + '">♥</span>';
    }
    ui.progress.innerHTML = html + '<span class="heart-count">' + state.visitedCount + " / " + islandObjs.length + "</span>";
  }

  // ---------- Avatar (the little guy who ages island to island) ----------
  let activeAvatar = null; // { group, armR, head, isl }

  // A classic green-tunic adventurer: pointed cap, blond hair, elf ears.
  // (An homage to the archetype — original geometry, no copied designs.)
  function buildAvatar() {
    const g = new THREE.Group();
    const skinMat = toonMat(0xeec39a);
    const tunicMat = toonMat(0x3e8e41);
    const tunicDark = toonMat(0x2f6e33);
    const creamMat = toonMat(0xe6dcc0);
    const hairMat = toonMat(0xe3b94f);
    const bootMat = toonMat(0x6b4a26);
    const beltMat = toonMat(0x4a3318);

    function part(geo, mat, x, y, z) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.position.set(x, y, z);
      g.add(m);
      return m;
    }

    // legs + boots
    part(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 7), creamMat, -0.17, 0.45, 0);
    part(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 7), creamMat, 0.17, 0.45, 0);
    part(new THREE.BoxGeometry(0.24, 0.2, 0.34), bootMat, -0.17, 0.1, 0.04);
    part(new THREE.BoxGeometry(0.24, 0.2, 0.34), bootMat, 0.17, 0.1, 0.04);
    // tunic: torso + flared skirt
    part(new THREE.CylinderGeometry(0.34, 0.4, 0.85, 9), tunicMat, 0, 1.22, 0);
    part(new THREE.CylinderGeometry(0.41, 0.5, 0.38, 9), tunicDark, 0, 0.72, 0);
    // belt with gold buckle
    part(new THREE.CylinderGeometry(0.42, 0.42, 0.13, 9), beltMat, 0, 0.93, 0);
    part(new THREE.BoxGeometry(0.16, 0.12, 0.06), toonMat(0xd4af4e), 0, 0.93, 0.4);
    // head
    const head = part(new THREE.SphereGeometry(0.44, 12, 10), skinMat, 0, 2.05, 0);
    // eyes (face = +z)
    part(new THREE.SphereGeometry(0.035, 6, 6), toonMat(0x2b2b2b), -0.15, 2.1, 0.4);
    part(new THREE.SphereGeometry(0.035, 6, 6), toonMat(0x2b2b2b), 0.15, 2.1, 0.4);
    // pointed elf ears
    const earL = part(new THREE.ConeGeometry(0.08, 0.26, 6), skinMat, -0.46, 2.08, -0.02);
    earL.rotation.z = Math.PI / 2;
    const earR = part(new THREE.ConeGeometry(0.08, 0.26, 6), skinMat, 0.46, 2.08, -0.02);
    earR.rotation.z = -Math.PI / 2;
    // blond hair: fitted cap + fringe across the brow + sideburns
    const hairCap = part(new THREE.SphereGeometry(0.47, 12, 10), hairMat, 0, 2.12, -0.06);
    hairCap.scale.set(1, 0.85, 0.97);
    const fringe = [
      [-0.2, 2.38, 0.3, 0.9], [0, 2.4, 0.34, 1.0], [0.2, 2.38, 0.3, 0.9],
    ];
    for (const f of fringe) {
      const tuft = part(new THREE.ConeGeometry(0.09, 0.26, 5), hairMat, f[0], f[1], f[2]);
      tuft.rotation.x = f[3]; // angled down over the brow
    }
    part(new THREE.ConeGeometry(0.07, 0.3, 5), hairMat, -0.42, 1.92, 0.12).rotation.x = Math.PI;
    part(new THREE.ConeGeometry(0.07, 0.3, 5), hairMat, 0.42, 1.92, 0.12).rotation.x = Math.PI;
    // long pointed cap, flopping back
    const capBase = part(new THREE.ConeGeometry(0.46, 0.55, 9), tunicMat, 0, 2.62, -0.06);
    capBase.rotation.x = -0.25;
    const capMid = part(new THREE.ConeGeometry(0.28, 0.65, 8), tunicMat, 0, 2.86, -0.36);
    capMid.rotation.x = -0.85;
    const capTip = part(new THREE.ConeGeometry(0.13, 0.5, 7), tunicDark, 0, 2.92, -0.85);
    capTip.rotation.x = -1.5;
    // arms: tunic sleeves with bare hands (pivot groups at shoulders)
    function arm(side) { // side: -1 left, +1 right
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.44, 1.62, 0);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.85, 7), tunicMat);
      upper.castShadow = true;
      upper.position.y = -0.38;
      pivot.add(upper);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 6), skinMat);
      hand.castShadow = true;
      hand.position.y = -0.82;
      pivot.add(hand);
      g.add(pivot);
      return pivot;
    }
    const armL = arm(-1);
    armL.rotation.z = 0.25;
    const armR = arm(1);
    armR.rotation.z = Math.PI - 0.5; // raised overhead

    g.scale.setScalar(1.45); // readable at gameplay camera distance
    return { group: g, armR: armR, head: head };
  }

  function spawnAvatar(isl) {
    removeAvatar();
    const built = buildAvatar();
    // stand on the grass by the pier (east side), facing the boat
    built.group.position.set(isl.radius * 0.68, 1.55, 1.7);
    isl.group.add(built.group);
    const wp = new THREE.Vector3();
    built.group.getWorldPosition(wp);
    built.group.rotation.y = Math.atan2(boat.position.x - wp.x, boat.position.z - wp.z);
    activeAvatar = { group: built.group, armR: built.armR, head: built.head, isl: isl, baseY: built.group.position.y };
  }

  function removeAvatar() {
    if (!activeAvatar) return;
    activeAvatar.isl.group.remove(activeAvatar.group);
    activeAvatar.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    activeAvatar = null;
  }

  // ---------- Dock / Undock ----------
  function dockAt(isl) {
    state.docked = isl;
    state.speed = 0;
    state.target = null;
    state.targetIsland = null;
    marker.visible = false;
    if (!isl.visited) { isl.visited = true; state.visitedCount++; updateProgress(); }
    const d = isl.data;
    ui.panelName.textContent = d.name;
    ui.panelRole.textContent = d.role;
    ui.panelDates.textContent = d.dates + (d.current ? " · Current" : "");
    ui.panelSector.textContent = d.sector || "";
    ui.panelSummary.textContent = d.summary || "";
    ui.panelAccent.style.background = d.color || "#888";
    ui.panelHighlights.innerHTML = "";
    (d.highlights || []).forEach(h => {
      const li = document.createElement("li");
      li.textContent = h;
      ui.panelHighlights.appendChild(li);
    });
    ui.panelTech.innerHTML = "";
    (d.tech || []).forEach(t => {
      const s = document.createElement("span");
      s.className = "tag";
      s.textContent = t;
      ui.panelTech.appendChild(s);
    });
    ui.panel.classList.add("open");
    ui.prompt.classList.remove("show");
    spawnAvatar(isl);
  }
  function undock() {
    state.docked = null;
    ui.panel.classList.remove("open");
    removeAvatar();
  }
  // moor the boat at the island's pier and dock right away;
  // the camera glides over, leaving island + greeter clear of the panel
  function teleportDock(isl) {
    state.target = null; state.targetIsland = null; state.autoDock = false;
    marker.visible = false;
    boat.position.set(isl.pos.x + isl.radius + 5.5, boat.position.y, isl.pos.z);
    state.heading = Math.PI / 2; // bow faces the island (west)
    state.speed = 0;
    dockAt(isl);
  }
  document.getElementById("panel-close").addEventListener("click", undock);
  ui.prompt.addEventListener("click", () => { if (state.nearIsland) dockAt(state.nearIsland); });

  // ---------- Input ----------
  window.addEventListener("keydown", (e) => {
    state.keys[e.code] = true;
    if (e.code === "KeyE" && !state.docked && state.nearIsland) dockAt(state.nearIsland);
    if (e.code === "Escape" && state.docked) undock();
    if (e.code === "Equal" || e.code === "NumpadAdd") camZoom = Math.max(0.45, camZoom * 0.85);
    if (e.code === "Minus" || e.code === "NumpadSubtract") camZoom = Math.min(2.3, camZoom * 1.18);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => { state.keys[e.code] = false; });

  // zoom with the mouse wheel / trackpad (canvas only, so the panel still scrolls)
  renderer.domElement.addEventListener("wheel", (e) => {
    e.preventDefault();
    camZoom = Math.min(2.3, Math.max(0.45, camZoom * (1 + e.deltaY * 0.0012)));
  }, { passive: false });

  const raycaster = new THREE.Raycaster();
  const mouseV = new THREE.Vector2();
  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (state.docked) { undock(); return; } // click anywhere off the panel = set sail
    mouseV.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseV.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouseV, camera);

    // pier click first: moor at the pier and dock immediately
    const pierHits = raycaster.intersectObjects(pierClickables, false);
    if (pierHits.length) {
      const isl = islandObjs.find(o => o.data.id === pierHits[0].object.userData.islandId);
      if (isl) { teleportDock(isl); return; }
    }

    // island click: sail to the near side (no auto-dock)
    const hits = raycaster.intersectObjects(clickables, false);
    if (hits.length) {
      const isl = islandObjs.find(o => o.data.id === hits[0].object.userData.islandId);
      if (isl) {
        // sail to a point on the island's near side (manual dock; click the pier to auto-dock)
        const dir = boat.position.clone().sub(isl.pos).setY(0).normalize();
        state.target = isl.pos.clone().add(dir.multiplyScalar(isl.radius + DOCK_RADIUS * 0.5));
        state.targetIsland = isl;
        state.autoDock = false;
        marker.position.copy(state.target).setY(0.3);
        marker.visible = true;
        return;
      }
    }
    // water click
    const wHits = raycaster.intersectObject(water, false);
    if (wHits.length) {
      const p = wHits[0].point;
      p.x = Math.max(-SEA_HALF, Math.min(SEA_HALF, p.x));
      p.z = Math.max(-SEA_HALF, Math.min(SEA_HALF, p.z));
      state.target = new THREE.Vector3(p.x, 0, p.z);
      state.targetIsland = null;
      state.autoDock = false;
      marker.position.copy(state.target).setY(0.3);
      marker.visible = true;
    }
  });

  // ---------- Build world ----------
  const islandObjs = DATA.islands.map(buildIsland);
  buildCourse();
  updateProgress();

  // ---------- Loop ----------
  const clock = new THREE.Clock();
  let camInit = false;

  function angleLerp(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // water motion
    waterTex.offset.x = t * 0.008;
    waterTex.offset.y = t * 0.005;
    const posAttr = waterGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const ox = waterBaseZ[i * 3], oy = waterBaseZ[i * 3 + 1];
      posAttr.array[i * 3 + 2] = Math.sin(ox * 0.08 + t * 1.2) * 0.25 + Math.cos(oy * 0.06 + t * 0.9) * 0.25;
    }
    posAttr.needsUpdate = true;

    if (!state.docked) {
      // keyboard
      const fwd = state.keys["KeyW"] || state.keys["ArrowUp"];
      const back = state.keys["KeyS"] || state.keys["ArrowDown"];
      const left = state.keys["KeyA"] || state.keys["ArrowLeft"];
      const right = state.keys["KeyD"] || state.keys["ArrowRight"];

      if (fwd || back || left || right) { state.target = null; state.targetIsland = null; state.autoDock = false; marker.visible = false; }

      if (left) state.heading += 1.8 * dt * (0.4 + Math.min(Math.abs(state.speed) / state.maxSpeed, 1) * 0.6);
      if (right) state.heading -= 1.8 * dt * (0.4 + Math.min(Math.abs(state.speed) / state.maxSpeed, 1) * 0.6);
      if (fwd) state.speed = Math.min(state.speed + 14 * dt, state.maxSpeed);
      else if (back) state.speed = Math.max(state.speed - 14 * dt, -state.maxSpeed * 0.4);
      else state.speed *= Math.pow(0.4, dt); // drag

      // click-to-sail
      if (state.target) {
        const to = state.target.clone().sub(boat.position).setY(0);
        const dist = to.length();
        if (dist < 1.6) {
          // arrived — auto-dock only when the user clicked the pier
          if (state.targetIsland && state.autoDock) dockAt(state.targetIsland);
          state.target = null; state.targetIsland = null; state.autoDock = false; marker.visible = false;
          state.speed *= 0.3;
        } else {
          // obstacle avoidance: if an island blocks the straight line, steer
          // toward a waypoint that skirts around its near side
          let aim = to;
          const dirN = to.clone().normalize();
          let blocker = null, blockerProj = Infinity;
          for (const isl of islandObjs) {
            const rel = isl.pos.clone().sub(boat.position).setY(0);
            const proj = rel.dot(dirN);
            if (proj <= 0 || proj >= dist) continue; // island not between boat and target
            const perp2 = rel.lengthSq() - proj * proj;
            const clear = isl.radius + 4.5;
            if (perp2 < clear * clear && proj < blockerProj) { blocker = isl; blockerProj = proj; }
          }
          if (blocker) {
            // closest point of the path to the island center → push waypoint
            // out past the shore on whichever side the path already favors
            const cp = boat.position.clone().add(dirN.clone().multiplyScalar(blockerProj)).setY(0);
            let v = cp.sub(blocker.pos.clone().setY(0));
            if (v.lengthSq() < 0.01) v = new THREE.Vector3(-dirN.z, 0, dirN.x); // path through center: pick a side
            const waypoint = blocker.pos.clone().setY(0).add(v.normalize().multiplyScalar(blocker.radius + 7));
            aim = waypoint.sub(boat.position).setY(0);
          }
          const desired = Math.atan2(-aim.x, -aim.z); // heading whose bow direction (-sin,-cos) points at aim
          state.heading = angleLerp(state.heading, desired, Math.min(1, 3.0 * dt));
          const aligned = Math.cos(state.heading - desired) > 0.5;
          const targetSpeed = Math.min(state.maxSpeed, Math.max(3, dist * 1.2));
          if (aligned) state.speed += (targetSpeed - state.speed) * Math.min(1, 2 * dt);
          else state.speed *= Math.pow(0.5, dt);
        }
      }

      // integrate — bow points along local -Z, so forward velocity is (-sin, -cos)
      const vx = -Math.sin(state.heading) * state.speed * dt;
      const vz = -Math.cos(state.heading) * state.speed * dt;
      boat.position.x = Math.max(-SEA_HALF, Math.min(SEA_HALF, boat.position.x + vx));
      boat.position.z = Math.max(-SEA_HALF, Math.min(SEA_HALF, boat.position.z + vz));

      // island collision: push out of land
      for (const isl of islandObjs) {
        const d = boat.position.clone().sub(isl.pos).setY(0);
        const minD = isl.radius + 2.4;
        if (d.length() < minD) {
          d.normalize().multiplyScalar(minD);
          boat.position.x = isl.pos.x + d.x;
          boat.position.z = isl.pos.z + d.z;
          state.speed *= 0.5;
        }
      }
    }

    // boat bobbing + orientation
    boat.position.y = 0.55 + Math.sin(t * 1.6) * 0.12;
    boat.rotation.y = state.heading;
    boat.rotation.z = Math.sin(t * 1.3) * 0.03 + (state.keys["KeyA"] || state.keys["ArrowLeft"] ? 0.05 : 0) - (state.keys["KeyD"] || state.keys["ArrowRight"] ? 0.05 : 0);
    boat.rotation.x = Math.cos(t * 1.1) * 0.025;

    // nearest dockable island
    let near = null, nearD = 1e9;
    for (const isl of islandObjs) {
      const d = boat.position.distanceTo(isl.pos);
      if (d < isl.radius + DOCK_RADIUS && d < nearD) { near = isl; nearD = d; }
    }
    state.nearIsland = near;
    if (near && !state.docked) {
      ui.promptName.textContent = near.data.name;
      ui.prompt.classList.add("show");
    } else {
      ui.prompt.classList.remove("show");
    }
    // highlight rings
    for (const isl of islandObjs) {
      isl.ring.material.opacity = isl === near ? 0.95 : 0.45;
    }

    // clouds drift; foam rings pulse
    for (const cl of clouds) {
      cl.position.x += cl.userData.speed * dt;
      if (cl.position.x > 250) cl.position.x = -250;
    }
    for (const isl of islandObjs) {
      const s = 1 + Math.sin(t * 1.4 + isl.foamPhase) * 0.03;
      isl.foamRing.scale.set(s, s, 1);
      isl.foamRing.material.opacity = 0.55 + Math.sin(t * 1.4 + isl.foamPhase) * 0.15;
    }

    // avatar wave + bounce while docked
    if (activeAvatar) {
      activeAvatar.armR.rotation.z = Math.PI - 0.5 + Math.sin(t * 6) * 0.35;
      activeAvatar.armR.rotation.x = Math.sin(t * 3) * 0.08;
      activeAvatar.group.position.y = activeAvatar.baseY + Math.abs(Math.sin(t * 3.2)) * 0.12;
      activeAvatar.head.rotation.z = Math.sin(t * 3.2) * 0.07;
    }

    drawMinimap();

    // marker pulse
    if (marker.visible) {
      const s = 1 + Math.sin(t * 5) * 0.15;
      marker.scale.set(s, s, 1);
    }

    // camera follow (with zoom)
    const camTarget = boat.position.clone().add(CAM_OFFSET.clone().multiplyScalar(camZoom));
    if (!camInit) { camera.position.copy(camTarget); camInit = true; }
    camera.position.lerp(camTarget, Math.min(1, 3.2 * dt));
    const look = boat.position.clone(); look.y = 2;
    camera.lookAt(look);

    renderer.render(scene, camera);
  }

  // ---------- Resize ----------
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // hide help after a while
  setTimeout(() => ui.help.classList.add("fade"), 9000);

  animate();

  // small debug/test hook (harmless to leave in)
  window.__voyage = {
    dock: function (id) {
      const isl = islandObjs.find(o => o.data.id === id);
      if (!isl) return false;
      teleportDock(isl);
      return true;
    },
    undock: undock,
    islands: islandObjs.map(o => o.data.id),
    status: function () {
      return {
        x: boat.position.x, z: boat.position.z,
        sailing: !!state.target, docked: state.docked ? state.docked.data.id : null,
      };
    },
    pierScreen: function (id) {
      const isl = islandObjs.find(o => o.data.id === id);
      if (!isl) return null;
      const p = new THREE.Vector3(isl.pos.x + isl.radius * 0.92 + 3, 1.2, isl.pos.z);
      p.project(camera);
      return { x: (p.x + 1) / 2 * window.innerWidth, y: (-p.y + 1) / 2 * window.innerHeight };
    },
  };

  console.log("[voyage] engine started — " + islandObjs.length + " islands");
})();
