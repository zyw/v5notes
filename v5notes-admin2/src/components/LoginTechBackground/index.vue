<template>
  <div ref="rootRef" class="tech-bg" aria-hidden="true">
    <canvas ref="canvasRef" class="tech-canvas"></canvas>
    <div class="glow g1"></div>
    <div class="glow g2"></div>
    <div class="grid"></div>
    <div class="sweep"></div>
    <div class="scrim"></div>
  </div>
</template>

<script setup lang="ts" name="LoginTechBackground">
/**
 * 登录页左侧科技感动效背景。
 * 纯 Canvas + CSS，无外部素材；prefers-reduced-motion 下只保留静态渐变。
 */
const rootRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  pulse: number;
}
interface NoteCard {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  vx: number;
  vy: number;
}
interface Packet {
  a: number;
  b: number;
  t: number;
  sp: number;
}

let rafId = 0;
let observer: ResizeObserver | null = null;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
let disposed = false;

const nodes: Node[] = [];
const cards: NoteCard[] = [];
const packets: Packet[] = [];
const mouse = { x: -999, y: -999, active: false };

let ctx: CanvasRenderingContext2D | null = null;
let W = 0;
let H = 0;
let sprite: HTMLCanvasElement | null = null;

const isMobile = () => window.innerWidth <= 920;
const nodeCount = () => (isMobile() ? 42 : 88);

function buildSprite() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const sctx = c.getContext('2d');
  if (!sctx) return null;
  const g = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(143,224,188,1)');
  g.addColorStop(0.35, 'rgba(143,224,188,.32)');
  g.addColorStop(1, 'rgba(143,224,188,0)');
  sctx.fillStyle = g;
  sctx.fillRect(0, 0, 64, 64);
  return c;
}

function newPacket(): Packet {
  const a = Math.floor(Math.random() * nodes.length);
  let b = Math.floor(Math.random() * nodes.length);
  if (b === a) b = (a + 1) % nodes.length;
  return { a, b, t: Math.random(), sp: 0.0028 + Math.random() * 0.0035 };
}

function seed() {
  nodes.length = 0;
  cards.length = 0;
  packets.length = 0;
  for (let i = 0; i < nodeCount(); i++) {
    nodes.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.16,
      vy: (Math.random() - 0.5) * 0.16,
      r: Math.random() * 1.25 + 0.55,
      a: Math.random() * 0.45 + 0.28,
      pulse: Math.random() * Math.PI * 2
    });
  }
  const cardCount = isMobile() ? 2 : 5;
  for (let i = 0; i < cardCount; i++) {
    cards.push({
      x: Math.random() * W * 0.9,
      y: Math.random() * H * 0.9,
      w: 24 + Math.random() * 12,
      h: 16 + Math.random() * 6,
      rot: (Math.random() - 0.5) * 0.5,
      vx: (Math.random() - 0.5) * 0.09,
      vy: (Math.random() - 0.5) * 0.09
    });
  }
  for (let i = 0; i < 4; i++) packets.push(newPacket());
}

function resize() {
  const canvas = canvasRef.value;
  const root = rootRef.value;
  if (!canvas || !root) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = root.clientWidth;
  H = root.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  seed();
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

let last = 0;
function frame(ts: number) {
  if (disposed || !ctx) return;
  const c = ctx;
  const dt = last ? Math.min(48, ts - last) / 16.67 : 1;
  last = ts;
  c.clearRect(0, 0, W, H);

  /* 细流线：缓慢起伏 */
  const tsec = ts * 0.00012;
  for (let s = 0; s < 3; s++) {
    const baseY = H * (0.2 + s * 0.27);
    const amp = 24 + s * 14;
    c.beginPath();
    for (let xx = -40; xx <= W + 40; xx += 16) {
      const yy = baseY + Math.sin(xx / 150 + tsec * (1 + s * 0.4) + s) * amp + Math.sin(xx / 47 + tsec * 2) * 6;
      if (xx === -40) c.moveTo(xx, yy);
      else c.lineTo(xx, yy);
    }
    c.strokeStyle = 'rgba(143,224,188,.09)';
    c.lineWidth = 1;
    c.stroke();
    c.setLineDash([2, 12]);
    c.lineDashOffset = -(ts * 0.03 * (1 + s * 0.3));
    c.strokeStyle = 'rgba(190,255,227,.2)';
    c.stroke();
    c.setLineDash([]);
  }

  /* 悬浮的笔记卡片 */
  for (const cd of cards) {
    cd.x += cd.vx * dt;
    cd.y += cd.vy * dt;
    if (cd.x < -40) cd.x = W + 30;
    if (cd.x > W + 40) cd.x = -30;
    if (cd.y < -40) cd.y = H + 30;
    if (cd.y > H + 40) cd.y = -30;
    c.save();
    c.translate(cd.x, cd.y);
    c.rotate(cd.rot);
    c.fillStyle = 'rgba(143,224,188,.035)';
    c.strokeStyle = 'rgba(143,224,188,.12)';
    c.lineWidth = 1;
    roundRect(c, -cd.w / 2, -cd.h / 2, cd.w, cd.h, 3);
    c.fill();
    c.stroke();
    c.strokeStyle = 'rgba(143,224,188,.1)';
    c.beginPath();
    c.moveTo(-cd.w / 2 + 5, -cd.h / 2 + 6);
    c.lineTo(cd.w / 2 - 8, -cd.h / 2 + 6);
    c.moveTo(-cd.w / 2 + 5, -cd.h / 2 + 10);
    c.lineTo(cd.w / 2 - 13, -cd.h / 2 + 10);
    c.stroke();
    c.restore();
  }

  /* 节点与连线 */
  const maxD = isMobile() ? 126 : 158;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.pulse += 0.012 * dt;
    if (a.x < 0 || a.x > W) a.vx *= -1;
    if (a.y < 0 || a.y > H) a.vy *= -1;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < maxD) {
        c.strokeStyle = 'rgba(79,191,148,' + ((1 - d / maxD) * 0.24).toFixed(3) + ')';
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }
    }
    if (mouse.active) {
      const dx = a.x - mouse.x;
      const dy = a.y - mouse.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 170) {
        c.strokeStyle = 'rgba(143,224,188,' + ((1 - d / 170) * 0.3).toFixed(3) + ')';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(mouse.x, mouse.y);
        c.stroke();
      }
    }
  }

  /* 节点光点 */
  if (sprite) {
    for (const a of nodes) {
      const tw = 0.72 + Math.sin(a.pulse) * 0.28;
      c.globalAlpha = a.a * tw * 0.55;
      c.drawImage(sprite, a.x - a.r * 8, a.y - a.r * 8, a.r * 16, a.r * 16);
      c.globalAlpha = a.a * tw;
      c.fillStyle = '#c8f5e0';
      c.beginPath();
      c.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
  }

  /* 沿连线流动的数据脉冲 */
  for (let i = 0; i < packets.length; i++) {
    const pk = packets[i];
    pk.t += pk.sp * dt;
    const na = nodes[pk.a];
    const nb = nodes[pk.b];
    if (!na || !nb) {
      packets[i] = newPacket();
      continue;
    }
    const px = na.x + (nb.x - na.x) * pk.t;
    const py = na.y + (nb.y - na.y) * pk.t;
    if (sprite) {
      c.globalAlpha = 0.9;
      c.drawImage(sprite, px - 9, py - 9, 18, 18);
      c.globalAlpha = 1;
    }
    c.fillStyle = 'rgba(225,255,240,.92)';
    c.beginPath();
    c.arc(px, py, 1.5, 0, Math.PI * 2);
    c.fill();
    if (pk.t >= 1) packets[i] = newPacket();
  }

  rafId = requestAnimationFrame(frame);
}

function onPointerMove(e: PointerEvent) {
  const root = rootRef.value;
  if (!root) return;
  const rect = root.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  mouse.active = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
  mouse.x = x;
  mouse.y = y;
}
function onPointerLeave() {
  mouse.active = false;
}

onMounted(() => {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  sprite = buildSprite();
  resize();
  if (!ctx) return;
  rafId = requestAnimationFrame(frame);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave);
  if (rootRef.value && 'ResizeObserver' in window) {
    observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!disposed) resize();
      }, 160);
    });
    observer.observe(rootRef.value);
  }
});

onBeforeUnmount(() => {
  disposed = true;
  cancelAnimationFrame(rafId);
  observer?.disconnect();
  if (resizeTimer) clearTimeout(resizeTimer);
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerleave', onPointerLeave);
});
</script>

<style lang="scss" scoped>
.tech-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #06120e;
  pointer-events: none;
}

.tech-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);

  &.g1 {
    width: 620px;
    height: 620px;
    left: -140px;
    top: -120px;
    background: rgba(47, 158, 107, 0.3);
    animation: drift1 22s ease-in-out infinite alternate;
  }

  &.g2 {
    width: 520px;
    height: 520px;
    right: -160px;
    bottom: -180px;
    background: rgba(79, 191, 148, 0.2);
    animation: drift2 26s ease-in-out infinite alternate;
  }
}

.grid {
  position: absolute;
  inset: -20% -10%;
  background-image:
    linear-gradient(rgba(143, 224, 188, 0.075) 1px, transparent 1px),
    linear-gradient(90deg, rgba(143, 224, 188, 0.075) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse at 30% 40%, #000 0%, rgba(0, 0, 0, 0.55) 45%, transparent 78%);
  animation: gridflow 30s linear infinite;
}

.sweep {
  position: absolute;
  inset: -10% -20%;
  background: linear-gradient(112deg, transparent 42%, rgba(143, 224, 188, 0.07) 50%, transparent 58%);
  transform: translateX(-70%);
  animation: sweep 11s ease-in-out infinite;
}

.scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    102deg,
    rgba(4, 15, 11, 0.92) 0%,
    rgba(4, 15, 11, 0.72) 38%,
    rgba(4, 15, 11, 0.18) 62%,
    rgba(4, 15, 11, 0.05) 100%
  );
}

@keyframes drift1 {
  to {
    transform: translate3d(90px, 70px, 0) scale(1.12);
  }
}

@keyframes drift2 {
  to {
    transform: translate3d(-70px, -50px, 0) scale(1.08);
  }
}

@keyframes gridflow {
  to {
    transform: translate3d(0, -44px, 0);
  }
}

@keyframes sweep {
  0%,
  62% {
    transform: translateX(-70%);
  }
  100% {
    transform: translateX(85%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .glow,
  .grid,
  .sweep {
    animation: none;
  }

  .tech-canvas {
    display: none;
  }

  .tech-bg {
    background: radial-gradient(circle at 30% 30%, #0d2b21, #06120e 70%);
  }
}
</style>
