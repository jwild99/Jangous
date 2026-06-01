export function drawPremiumBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  baseColor: string = "#0a0e1a",
  accentColor: string = "rgba(59,130,246,0.06)"
) {
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.3, h * 0.2, w * 0.7);
  grad.addColorStop(0, accentColor);
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const grad2 = ctx.createRadialGradient(w * 0.8, h * 0.8, 0, w * 0.8, h * 0.8, w * 0.5);
  grad2.addColorStop(0, "rgba(139,92,246,0.04)");
  grad2.addColorStop(1, "transparent");
  ctx.fillStyle = grad2;
  ctx.fillRect(0, 0, w, h);
}

export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  intensity: number = 0.3
) {
  ctx.save();
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, color.replace(/[\d.]+\)$/, `${intensity})`));
  grad.addColorStop(0.5, color.replace(/[\d.]+\)$/, `${intensity * 0.3})`));
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

export function draw3DCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  shadowColor: string = "rgba(0,0,0,0.4)"
) {
  ctx.save();
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = radius * 0.4;
  ctx.shadowOffsetY = radius * 0.15;

  const grad = ctx.createRadialGradient(
    x - radius * 0.25, y - radius * 0.25, radius * 0.1,
    x, y, radius
  );
  grad.addColorStop(0, lightenColor(color, 40));
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, darkenColor(color, 30));

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const specGrad = ctx.createRadialGradient(
    x - radius * 0.3, y - radius * 0.3, 0,
    x - radius * 0.3, y - radius * 0.3, radius * 0.5
  );
  specGrad.addColorStop(0, "rgba(255,255,255,0.35)");
  specGrad.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = specGrad;
  ctx.fill();

  ctx.restore();
}

export function drawSmoothLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  width: number = 2
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function drawTextWithShadow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = "center",
  shadowColor: string = "rgba(0,0,0,0.5)",
  shadowBlur: number = 4
) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * percent / 100));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent / 100));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * percent / 100));
  return `rgb(${r},${g},${b})`;
}

export function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - Math.round(255 * percent / 100));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * percent / 100));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * percent / 100));
  return `rgb(${r},${g},${b})`;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class ScreenShake {
  private intensity = 0;
  private decay = 0.9;
  private offsetX = 0;
  private offsetY = 0;

  trigger(intensity: number) {
    this.intensity = intensity;
  }

  update(): { x: number; y: number } {
    if (this.intensity < 0.5) {
      this.offsetX = 0;
      this.offsetY = 0;
      this.intensity = 0;
      return { x: 0, y: 0 };
    }
    this.offsetX = (Math.random() - 0.5) * this.intensity;
    this.offsetY = (Math.random() - 0.5) * this.intensity;
    this.intensity *= this.decay;
    return { x: this.offsetX, y: this.offsetY };
  }
}

export class ParticleSystem {
  particles: Array<{
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    color: string;
    size: number;
  }> = [];

  emit(x: number, y: number, count: number, color: string, spread: number = 3, life: number = 30) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * spread,
        vy: (Math.random() - 0.5) * spread,
        life, maxLife: life,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.vx *= 0.98;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export function getCanvasScale(canvas: HTMLCanvasElement): number {
  const rect = canvas.getBoundingClientRect();
  return canvas.width / rect.width;
}

export function setupHighDPICanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }
  return ctx;
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
  fill?: string,
  stroke?: string,
  lineWidth: number = 1
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function pulseValue(time: number, min: number, max: number, speed: number = 1): number {
  return min + (max - min) * (0.5 + 0.5 * Math.sin(time * speed));
}
