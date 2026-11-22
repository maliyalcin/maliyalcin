// Basit parametrik 3B görüntüleyici: tasarım JSON'undaki "model3d.parts" listesinden sahne kurar.
// Birimler mm. Parça tipleri: box, cylinder, tube, gear, screw, belt, sphere.
// Hareket: anim.spin {rpm} (parçanın kendi ekseni etrafında), anim.slide {axis, amp, period}.
(() => {
  const THREE_URL = "vendor/three.min.js";
  const ORBIT_URL = "vendor/OrbitControls.js";

  function load(src) {
    return new Promise((ok, no) => {
      if (document.querySelector(`script[src="${src}"]`)) return ok();
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = no;
      document.head.appendChild(s);
    });
  }

  const AX = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

  // Y ekseninde üretilmiş geometriyi istenen eksene çevir
  function orientY(geo, axis) {
    if (axis === "x") geo.rotateZ(-Math.PI / 2);
    else if (axis === "z") geo.rotateX(Math.PI / 2);
    return geo;
  }
  // Z ekseninde (extrude) üretilmiş geometriyi istenen eksene çevir
  function orientZ(geo, axis) {
    if (axis === "x") geo.rotateY(Math.PI / 2);
    else if (axis === "y") geo.rotateX(-Math.PI / 2);
    return geo;
  }

  function gearGeo(T, p) {
    const z = Math.max(6, Math.round(p.teeth || 20));
    const ro = p.r || 20;
    const m = p.module || (2 * ro) / (z + 2);
    const rr = Math.max(ro - 2.25 * m, ro * 0.5);
    const shape = new T.Shape();
    const step = (Math.PI * 2) / z;
    for (let i = 0; i < z; i++) {
      const a = i * step;
      const pts = [
        [rr, a - step * 0.25], [ro, a - step * 0.12], [ro, a + step * 0.12], [rr, a + step * 0.25],
      ];
      pts.forEach(([r, t], j) => {
        const x = r * Math.cos(t), y = r * Math.sin(t);
        i === 0 && j === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
      });
    }
    shape.closePath();
    if (p.bore) {
      const h = new T.Path();
      h.absarc(0, 0, p.bore, 0, Math.PI * 2, true);
      shape.holes.push(h);
    }
    const w = p.h || 10;
    const g = new T.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -w / 2);
    return orientZ(g, p.axis || "z");
  }

  function screwGeo(T, p) {
    const L = p.length || 200, r = p.r || 8, pitch = p.pitch || 5;
    const turns = L / pitch;
    class Helix extends T.Curve {
      getPoint(t) {
        const a = t * turns * Math.PI * 2;
        return new T.Vector3(r * 0.92 * Math.cos(a), -L / 2 + t * L, r * 0.92 * Math.sin(a));
      }
    }
    const thread = new T.TubeGeometry(new Helix(), Math.min(2000, Math.ceil(turns * 24)), Math.max(pitch * 0.22, 0.4), 5, false);
    orientY(thread, p.axis || "x");
    const core = orientY(new T.CylinderGeometry(r * 0.78, r * 0.78, L, 24), p.axis || "x");
    return [core, thread];
  }

  function beltGeo(T, p) {
    // İki kasnak/dişli etrafında açık kayış/zincir. p1,p2: merkezler; r1,r2: yarıçaplar; axis: kasnak ekseni
    const axis = p.axis || "z";
    const pick = (v) => (axis === "z" ? [v[0], v[1]] : axis === "x" ? [v[1], v[2]] : [v[0], v[2]]);
    const fixed = (v) => (axis === "z" ? v[2] : axis === "x" ? v[0] : v[1]);
    const to3 = (u, w, c) => (axis === "z" ? new T.Vector3(u, w, c) : axis === "x" ? new T.Vector3(c, u, w) : new T.Vector3(u, c, w));
    const [x1, y1] = pick(p.p1), [x2, y2] = pick(p.p2), c = fixed(p.p1);
    const r1 = p.r1, r2 = p.r2;
    const d = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
    const b = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)));
    const pts = [], N = 40;
    for (let i = 0; i <= N; i++) { const t = a + b + (i / N) * (2 * Math.PI - 2 * b); pts.push(to3(x1 + r1 * Math.cos(t), y1 + r1 * Math.sin(t), c)); }
    for (let i = 0; i <= N; i++) { const t = a - b + (i / N) * (2 * b); pts.push(to3(x2 + r2 * Math.cos(t), y2 + r2 * Math.sin(t), c)); }
    const curve = new T.CatmullRomCurve3(pts, true);
    return new T.TubeGeometry(curve, 240, p.t || 2, 6, true);
  }

  function build(T, part) {
    const ax = part.axis || "y";
    switch (part.type) {
      case "box": { const [x, y, z] = part.size || [10, 10, 10]; return [new T.BoxGeometry(x, y, z)]; }
      case "cylinder": return [orientY(new T.CylinderGeometry(part.r || 5, part.r || 5, part.h || 10, 32), ax)];
      case "tube": {
        const s = new T.Shape(); s.absarc(0, 0, part.r || 10, 0, Math.PI * 2, false);
        const h = new T.Path(); h.absarc(0, 0, part.ri || 5, 0, Math.PI * 2, true); s.holes.push(h);
        const g = new T.ExtrudeGeometry(s, { depth: part.h || 10, bevelEnabled: false, curveSegments: 32 });
        g.translate(0, 0, -(part.h || 10) / 2);
        return [orientZ(g, ax)];
      }
      case "gear": return [gearGeo(T, part)];
      case "screw": return screwGeo(T, part);
      case "belt": return [beltGeo(T, part)];
      case "sphere": return [new T.SphereGeometry(part.r || 5, 24, 16)];
      default: return [];
    }
  }

  async function mount(el, model) {
    await load(THREE_URL);
    await load(ORBIT_URL);
    const T = window.THREE;
    el.innerHTML = "";
    const W = el.clientWidth, H = el.clientHeight;
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);

    const scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xffffff, 0x445566, 0.9));
    const sun = new T.DirectionalLight(0xffffff, 0.8); sun.position.set(1, 2, 1.5); scene.add(sun);
    const fill = new T.DirectionalLight(0xffffff, 0.35); fill.position.set(-1.5, 0.5, -1); scene.add(fill);

    const movers = [];
    const root = new T.Group();
    for (const part of model.parts || []) {
      const geos = build(T, part);
      if (!geos.length) continue;
      const mat = new T.MeshStandardMaterial({
        color: part.color || "#9aa4ae", metalness: part.metal === false ? 0.05 : 0.45, roughness: 0.45,
        transparent: part.opacity != null && part.opacity < 1, opacity: part.opacity ?? 1,
      });
      const g = new T.Group();
      geos.forEach((geo) => g.add(new T.Mesh(geo, mat)));
      const [px, py, pz] = part.pos || [0, 0, 0];
      g.position.set(px, py, pz);
      if (part.rot) g.rotation.set(...part.rot.map((d) => (d * Math.PI) / 180));
      root.add(g);
      if (part.anim) movers.push({ g, a: part.anim, axis: part.axis || "y", base: g.position.clone() });
    }
    scene.add(root);

    // Kamerayı modele sığdır
    const box = new T.Box3().setFromObject(root);
    const size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
    const R = Math.max(size.x, size.y, size.z) || 100;
    const camera = new T.PerspectiveCamera(40, W / H, R / 100, R * 50);
    const dir = new T.Vector3(...(model.camera || [1, 0.7, 1.2])).normalize();
    camera.position.copy(center).addScaledVector(dir, R * 1.9);
    const grid = new T.GridHelper(R * 2, 20, 0x888888, 0xcccccc);
    grid.position.set(center.x, box.min.y - R * 0.02, center.z);
    grid.material.opacity = 0.35; grid.material.transparent = true;
    scene.add(grid);

    const controls = new T.OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.update();

    // Kontroller
    let playing = true;
    const ctl = document.createElement("div");
    ctl.className = "ctl";
    ctl.innerHTML = '<button data-a="p">⏸ Durdur</button><button data-a="r">⟲</button>';
    el.appendChild(ctl);
    ctl.onclick = (e) => {
      const a = e.target.dataset.a;
      if (a === "p") { playing = !playing; e.target.textContent = playing ? "⏸ Durdur" : "▶ Oynat"; }
      if (a === "r") { camera.position.copy(center).addScaledVector(dir, R * 1.9); controls.target.copy(center); }
    };
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Döndürmek için sürükleyin · iki parmakla yakınlaştırın";
    el.appendChild(hint);

    const speed = model.anim_scale || 1;
    let t = 0, last = performance.now(), raf = 0, alive = true;
    function frame(now) {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (playing) {
        t += dt * speed;
        for (const m of movers) {
          if (m.a.spin) {
            const w = ((m.a.spin.rpm || 30) / 60) * Math.PI * 2 * dt * speed;
            const k = m.a.spin.axis || m.axis;
            m.g.rotation[k] += w;
          }
          if (m.a.slide) {
            const k = m.a.slide.axis || "x";
            const v = Math.sin((t / (m.a.slide.period || 4)) * Math.PI * 2) * (m.a.slide.amp || 20);
            m.g.position[k] = m.base[k] + v;
          }
        }
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return {
      dispose() {
        alive = false; cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        controls.dispose();
        scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        renderer.dispose();
      },
    };
  }

  window.Viewer3D = { mount };
})();
