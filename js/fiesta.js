// Lluvia de confeti con los colores del pasaporte. Sin dependencias.
const COLORES = ['#c8d93f', '#d9e66b', '#ffffff', '#102d6a', '#3f5f8f', '#607d9c', '#9fb7d8'];

export function fiesta(duracion = 4200) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lienzo = document.createElement('canvas');
  lienzo.className = 'fiesta';
  document.body.append(lienzo);
  const ctx = lienzo.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = innerWidth;
  const H = innerHeight;
  lienzo.width = W * dpr;
  lienzo.height = H * dpr;
  ctx.scale(dpr, dpr);

  const piezas = [];
  const lanzar = (x, y, angulo, cantidad, fuerza) => {
    for (let i = 0; i < cantidad; i++) {
      const a = angulo + (Math.random() - 0.5) * 0.9;
      const v = fuerza * (0.55 + Math.random() * 0.6);
      piezas.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        giro: Math.random() * Math.PI,
        vgiro: (Math.random() - 0.5) * 0.35,
        ancho: 6 + Math.random() * 7,
        alto: 4 + Math.random() * 5,
        forma: Math.random() < 0.25 ? 'circulo' : 'papel',
        color: COLORES[(Math.random() * COLORES.length) | 0],
        vida: 1,
      });
    }
  };
  const fuerza = Math.max(W, H) * 0.028;
  lanzar(0, H, -Math.PI / 3, 90, fuerza);
  lanzar(W, H, (-2 * Math.PI) / 3, 90, fuerza);
  setTimeout(() => lanzar(W / 2, H * 0.35, -Math.PI / 2, 120, fuerza * 0.8), 350);

  const inicio = performance.now();
  const cuadro = (t) => {
    const transcurrido = t - inicio;
    ctx.clearRect(0, 0, W, H);
    for (const p of piezas) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.giro += p.vgiro;
      if (transcurrido > duracion - 900) p.vida = Math.max(0, (duracion - transcurrido) / 900);
      ctx.save();
      ctx.globalAlpha = p.vida;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.giro);
      ctx.fillStyle = p.color;
      if (p.forma === 'circulo') {
        ctx.beginPath();
        ctx.arc(0, 0, p.alto / 1.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // El coseno del giro simula la hoja de papel volteándose en el aire.
        ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto * Math.abs(Math.cos(p.giro * 1.7)) + 1);
      }
      ctx.restore();
    }
    if (transcurrido < duracion) requestAnimationFrame(cuadro);
    else lienzo.remove();
  };
  requestAnimationFrame(cuadro);
}
