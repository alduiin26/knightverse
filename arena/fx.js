// KnightVerse Arena - visual effects: particles, rings, beams, slashes, projectiles, meteors
import * as THREE from 'three';
import { rand, ease } from './core.js';
import { makeCircleTexture, makeBeamMaterial, makeTargetTexture } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class FX {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.glowTex = world.glowTex;
    this.circleTex = [makeCircleTexture(0), makeCircleTexture(1)];
    this.targetTex = makeTargetTexture();
    this.items = [];
    this._initParticles(5000);
    this._initLights(3);
  }

  // ------------------------------------------------------------- particles
  _initParticles(N) {
    this.N = N; this.cursor = 0;
    this.pos = new Float32Array(N * 3); this.vel = new Float32Array(N * 3);
    this.col = new Float32Array(N * 3); this.size = new Float32Array(N); this.alpha = new Float32Array(N);
    this.life = new Float32Array(N); this.max = new Float32Array(N); this.grav = new Float32Array(N);
    this.drag = new Float32Array(N); this.base = new Float32Array(N); this.grow = new Float32Array(N);
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos); geo.setAttribute('pcolor', this.aCol);
    geo.setAttribute('psize', this.aSize); geo.setAttribute('palpha', this.aAlpha);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this.glowTex }, uPR: { value: this.world.renderer.getPixelRatio() } },
      vertexShader: `
        attribute vec3 pcolor; attribute float psize; attribute float palpha; uniform float uPR;
        varying vec3 vC; varying float vA;
        void main(){ vC = pcolor; vA = palpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = psize * uPR * 320.0 / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D uMap; varying vec3 vC; varying float vA;
        void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC * 1.3, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; pts.renderOrder = 5;
    this.scene.add(pts);
  }

  // o: {pos, count, spread, color|colors, speed:[a,b], dir, cone, up, life:[a,b], size:[a,b], gravity, drag, grow, ring}
  emit(o) {
    const count = o.count || 20;
    const colors = (o.colors || [o.color ?? 0xffffff]).map(c => new THREE.Color(c));
    const sp = o.speed || [1, 3], lf = o.life || [0.5, 1], sz = o.size || [0.3, 0.6];
    const spread = o.spread ?? 0.2;
    const dir = o.dir ? o.dir.clone().normalize() : null;
    const cone = o.cone ?? 1;
    const tmp = new THREE.Vector3();
    for (let n = 0; n < count; n++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.N;
      const i3 = i * 3;
      // position
      if (o.ring) {
        const a = Math.random() * Math.PI * 2, r = o.ring * (0.85 + Math.random() * 0.3);
        this.pos[i3] = o.pos.x + Math.cos(a) * r; this.pos[i3 + 1] = o.pos.y + rand(0, spread); this.pos[i3 + 2] = o.pos.z + Math.sin(a) * r;
      } else {
        this.pos[i3] = o.pos.x + rand(-spread, spread); this.pos[i3 + 1] = o.pos.y + rand(-spread, spread); this.pos[i3 + 2] = o.pos.z + rand(-spread, spread);
      }
      // velocity
      tmp.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      if (dir) tmp.lerp(dir, 1 - cone).normalize();
      const s = rand(sp[0], sp[1]);
      this.vel[i3] = tmp.x * s; this.vel[i3 + 1] = tmp.y * s + (o.up || 0); this.vel[i3 + 2] = tmp.z * s;
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.col[i3] = c.r; this.col[i3 + 1] = c.g; this.col[i3 + 2] = c.b;
      this.max[i] = this.life[i] = rand(lf[0], lf[1]);
      this.base[i] = this.size[i] = rand(sz[0], sz[1]);
      this.grav[i] = o.gravity ?? 0; this.drag[i] = o.drag ?? 1.5; this.grow[i] = o.grow ?? 0;
      this.alpha[i] = 1;
    }
  }

  _updateParticles(dt) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; } continue; }
      this.life[i] -= dt;
      const i3 = i * 3, d = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= d; this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt; this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      this.alpha[i] = Math.min(1, k * 2.2);
      this.size[i] = this.base[i] * (1 + this.grow[i] * (1 - k));
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }

  // ------------------------------------------------------------- flash lights
  _initLights(n) {
    this.lights = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 14, 2);
      l.userData = { t: 0, life: 0, peak: 0 };
      this.scene.add(l); this.lights.push(l);
    }
  }
  light(pos, color, peak = 40, life = 0.5) {
    const l = this.lights.find(x => x.userData.t >= x.userData.life)
      || this.lights.reduce((a, b) => (a.intensity < b.intensity ? a : b));
    l.position.copy(pos); l.color.setHex(color);
    l.userData = { t: 0, life, peak };
    l.intensity = peak;
  }

  // ------------------------------------------------------------- generic timed items
  add(life, update, dispose) {
    const it = { t: 0, life, update, dispose };
    this.items.push(it);
    return it;
  }

  update(dt) {
    this._updateParticles(dt);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = Math.min(1, it.t / it.life);
      it.update && it.update(k, dt);
      if (k >= 1) { it.dispose && it.dispose(); this.items.splice(i, 1); }
    }
    for (const l of this.lights) {
      const u = l.userData;
      if (u.t < u.life) { u.t += dt; const k = Math.min(1, u.t / u.life); l.intensity = u.peak * (1 - k) * (1 - k); }
      else l.intensity = 0;
    }
  }

  _mesh(geo, mat) {
    const m = new THREE.Mesh(geo, mat);
    this.scene.add(m);
    return m;
  }
  _kill(m) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }

  // ------------------------------------------------------------- effects
  ring(pos, color, { r0 = 0.3, r1 = 4, life = 0.6, y = 0.06, width = 0.18, opacity = 1 } = {}) {
    const m = this._mesh(new THREE.RingGeometry(1 - width, 1, 64),
      new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, y, pos.z);
    this.add(life, k => { const s = r0 + (r1 - r0) * ease.out(k); m.scale.set(s, s, s); m.material.opacity = opacity * (1 - k); }, () => this._kill(m));
  }

  circle(pos, color, { size = 3, life = 1.2, spin = 1, variant = 0, y = 0.05, opacity = 0.9 } = {}) {
    const m = this._mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.circleTex[variant], color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, y, pos.z);
    this.add(life, (k, dt) => {
      const a = Math.min(1, k * 6) * (1 - Math.max(0, (k - 0.75) / 0.25));
      const s = size * (0.6 + 0.4 * ease.out(Math.min(1, k * 3)));
      m.scale.set(s, s, s); m.rotation.z += dt * spin; m.material.opacity = a * opacity;
    }, () => this._kill(m));
    return m;
  }

  // persistent decal (active unit marker, target markers). Returns handle with .remove()
  marker(color, { size = 2.4, variant = 0, opacity = 0.8, target = false } = {}) {
    const m = this._mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: target ? this.targetTex : this.circleTex[variant], color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.scale.set(size, size, size);
    m.renderOrder = 2;
    return m;
  }
  removeMarker(m) { if (m && m.parent) this._kill(m); }

  beam(pos, color, { radius = 1, height = 14, life = 0.8, intensity = 1.6, y = 0 } = {}) {
    const m = this._mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), makeBeamMaterial(color, intensity));
    m.position.set(pos.x, y + height / 2, pos.z);
    this.add(life, (k, dt) => {
      const r = radius * (k < 0.2 ? ease.outBack(k / 0.2) : 1 - ease.in((k - 0.2) / 0.8) * 0.9);
      m.scale.set(Math.max(0.01, r), height, Math.max(0.01, r));
      m.material.uniforms.uTime.value += dt;
      m.material.uniforms.uIntensity.value = intensity * (1 - Math.max(0, (k - 0.6) / 0.4));
    }, () => this._kill(m));
  }

  glow(pos, color, { scale = 3, life = 0.4, opacity = 1 } = {}) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity }));
    s.position.copy(pos); this.scene.add(s);
    this.add(life, k => { const sc = scale * (0.6 + 0.6 * ease.out(k)); s.scale.set(sc, sc, 1); s.material.opacity = opacity * (1 - k); },
      () => { this.scene.remove(s); s.material.dispose(); });
  }

  // curved slash arc. `dirY` = facing angle of the attacker.
  slash(pos, dirY, color, { radius = 1.5, tilt = 0.4, life = 0.28, flip = false } = {}) {
    const g = new THREE.Group();
    g.position.copy(pos); g.rotation.set(0, dirY, 0);
    const inner = new THREE.Group(); inner.rotation.set(Math.PI / 2 + (flip ? -tilt : tilt), 0, flip ? Math.PI : 0); g.add(inner);
    const mk = (r, w, op) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, w, 4, 40, Math.PI * 1.2),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.scale.z = 0.25; inner.add(m); return m;
    };
    const a = mk(radius, 0.09, 1), b = mk(radius * 0.92, 0.035, 0.9);
    const w = mk(radius * 0.96, 0.02, 1); w.material.color.set(0xffffff);
    this.scene.add(g);
    this.add(life, k => {
      inner.rotation.z = (flip ? Math.PI : 0) + (flip ? 1 : -1) * (-0.6 + k * 2.2);
      const o = 1 - k;
      a.material.opacity = o; b.material.opacity = o * 0.9; w.material.opacity = o;
      const s = 1 + k * 0.25; inner.scale.set(s, s, s);
    }, () => { this.scene.remove(g); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); });
  }

  // impact burst: glow + sparks + light
  impact(pos, color, power = 1) {
    this.glow(pos, color, { scale: 2.2 * power, life: 0.3 });
    this.glow(pos, 0xffffff, { scale: 1.1 * power, life: 0.18 });
    this.emit({ pos, count: Math.round(26 * power), color, colors: [color, 0xffffff], speed: [3, 8 * power], life: [0.25, 0.6], size: [0.12, 0.3], gravity: 6, drag: 2.5 });
    this.light(pos, color, 30 * power, 0.35);
  }

  explosion(pos, color, power = 1) {
    this.glow(pos, color, { scale: 5 * power, life: 0.55 });
    this.glow(pos, 0xfff2c0, { scale: 2.4 * power, life: 0.3 });
    this.emit({ pos, count: Math.round(70 * power), colors: [color, 0xffd27a, 0xffffff], speed: [3, 11 * power], up: 2, life: [0.4, 1.0], size: [0.2, 0.55], gravity: 7, drag: 2 });
    this.emit({ pos: V(pos.x, 0.3, pos.z), count: Math.round(30 * power), colors: [0x6b5a4a, 0x8a7a66], speed: [1, 4], up: 1.5, life: [0.6, 1.3], size: [0.5, 1.0], gravity: 0.5, drag: 2, grow: 1.5 });
    this.ring(pos, color, { r0: 0.3, r1: 3.6 * power, life: 0.55, width: 0.25 });
    this.light(pos, color, 70 * power, 0.6);
  }

  // projectile along an arc; resolves on impact
  projectile(from, to, color, { duration = 0.45, arc = 1.2, size = 1.1, trail = true } = {}) {
    return new Promise(resolve => {
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const hot = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      core.scale.set(size, size, 1); hot.scale.set(size * 0.45, size * 0.45, 1);
      this.scene.add(core); this.scene.add(hot);
      const mid = from.clone().lerp(to, 0.5); mid.y += arc;
      const p = new THREE.Vector3(), prev = from.clone();
      this.add(duration, k => {
        const a = from.clone().lerp(mid, k), b = mid.clone().lerp(to, k);
        p.copy(a.lerp(b, k));
        core.position.copy(p); hot.position.copy(p);
        if (trail) this.emit({ pos: p, count: 4, colors: [color, 0xffffff], speed: [0.2, 1.2], life: [0.2, 0.45], size: [0.18, 0.4], spread: 0.08 });
        prev.copy(p);
      }, () => {
        this.scene.remove(core); this.scene.remove(hot); core.material.dispose(); hot.material.dispose();
        resolve();
      });
    });
  }

  // meteor from the sky; resolves on impact
  meteor(target, color) {
    return new Promise(resolve => {
      const start = target.clone().add(V(rand(-6, 6), 22, rand(-10, -4)));
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), new THREE.MeshStandardMaterial({ color: 0x3a2418, emissive: color, emissiveIntensity: 2.2, flatShading: true }));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.set(4, 4, 1);
      this.scene.add(rock); this.scene.add(halo);
      const p = new THREE.Vector3();
      this.add(0.7, (k, dt) => {
        p.copy(start).lerp(target, ease.in(k));
        rock.position.copy(p); halo.position.copy(p);
        rock.rotation.x += dt * 8; rock.rotation.y += dt * 6;
        this.emit({ pos: p, count: 9, colors: [color, 0xffcc66, 0x553322], speed: [0.5, 2], life: [0.3, 0.8], size: [0.4, 0.9], spread: 0.35, grow: 0.8 });
      }, () => {
        this.scene.remove(rock); this.scene.remove(halo); rock.geometry.dispose(); rock.material.dispose(); halo.material.dispose();
        this.explosion(target, color, 1.3);
        resolve();
      });
    });
  }

  // little rotating stars over a stunned unit
  stunStars(pos, life = 0.9) {
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffe866, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.scale.set(0.45, 0.45, 1); this.scene.add(s);
      this.add(life, k => {
        const a = k * Math.PI * 4 + (i * Math.PI * 2) / 3;
        s.position.set(pos.x + Math.cos(a) * 0.55, pos.y + 0.1 * Math.sin(a * 2), pos.z + Math.sin(a) * 0.55);
        s.material.opacity = 1 - Math.max(0, (k - 0.7) / 0.3);
      }, () => { this.scene.remove(s); s.material.dispose(); });
    }
  }
}
