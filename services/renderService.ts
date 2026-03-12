import { PinConfig, PinVariation } from '../types';

export const renderPinToDataUrl = async (variation: PinVariation, config: PinConfig): Promise<string> => {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1500;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Load background image
  let bgImage: HTMLImageElement | null = null;
  if (variation.imageUrl) {
    bgImage = await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = variation.imageUrl!;
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });
  }

  // Helper: Draw Rounded Rect
  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Helper: Get Lines
  const getLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const words = text.split(" ");
    const lines = [];
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) currentLine += " " + word;
      else { lines.push(currentLine); currentLine = word; }
    }
    lines.push(currentLine);
    return lines;
  };

  // Helper: Font size
  const calculateOptimalFontSize = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxHeight: number, fontFace: string) => {
    let minSize = 40;
    let maxSize = 400;
    let optimal = minSize;
    while (minSize <= maxSize) {
      const mid = Math.floor((minSize + maxSize) / 2);
      ctx.font = `bold ${mid}px ${fontFace}`;
      const words = text.split(" ");
      let valid = true;
      for (const word of words) {
        if (ctx.measureText(word).width > maxWidth) { valid = false; break; }
      }
      if (valid) {
        const lines = getLines(ctx, text, maxWidth);
        if (lines.length * mid * 1.2 > maxHeight) valid = false;
      }
      if (valid) { optimal = mid; minSize = mid + 1; }
      else { maxSize = mid - 1; }
    }
    return optimal;
  };

  // Render logic (mirrored from CanvasPreview)
  ctx.clearRect(0, 0, 1000, 1500);
  if (bgImage && !variation.fallbackMode) {
    const scale = Math.max(1000 / bgImage.width, 1500 / bgImage.height);
    const w = bgImage.width * scale;
    const h = bgImage.height * scale;
    ctx.drawImage(bgImage, (1000 - w) / 2, (1500 - h) / 2, w, h);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 1000, 1500);
    grad.addColorStop(0, '#f87171'); grad.addColorStop(1, '#c026d3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1000, 1500);
  }

  let alpha = 0.2;
  let textCol = config.textColor;
  let outCol = config.outlineColor;

  if (config.colorScheme === 'dark-overlay') { alpha = 0.6; textCol = '#ffffff'; }
  else if (config.colorScheme === 'monochrome') {
     ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'black'; ctx.fillRect(0,0,1000,1500); ctx.restore();
     textCol = '#ffffff'; outCol = '#000000';
  }
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fillRect(0, 0, 1000, 1500);

  const headline = variation.headline; // Use variation's headline
  if (headline) {
    const size = calculateOptimalFontSize(ctx, headline, 1000 * 0.9, 1500 * 0.55, config.fontFamily);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${size}px ${config.fontFamily}`;
    const lines = getLines(ctx, headline, 1000 * 0.9);
    const lh = size * 1.2;
    let cy = (1500 * (config.textYPos / 100)) - ((lines.length * lh) / 2) + (lh / 2);
    lines.forEach(l => {
      ctx.strokeStyle = outCol; ctx.lineWidth = size * 0.25; ctx.lineJoin = 'round'; ctx.strokeText(l, 1000/2, cy);
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
      ctx.fillStyle = textCol; ctx.fillText(l, 1000/2, cy);
      ctx.shadowColor = 'transparent'; cy += lh;
    });
  }

  const ctaText = variation.ctaText; // Use variation's CTA
  if (config.showCta && ctaText) {
    const py = 1500 * 0.92; const bw = 1000 * 0.9; const bh = 120;
    let fs = 45; ctx.font = `bold ${fs}px ${config.fontFamily}`;
    const tw = ctx.measureText(ctaText).width;
    if (tw > bw * 0.8) fs *= (bw * 0.8 / tw);
    ctx.font = `bold ${fs}px ${config.fontFamily}`;
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 15; ctx.shadowOffsetY = 8;
    ctx.fillStyle = config.ctaBgColor;
    drawRoundedRect(ctx, (1000 - bw) / 2, py - (bh/2), bw, bh, bh/2);
    ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.fillStyle = config.ctaTextColor; ctx.textAlign = 'center';
    ctx.fillText(ctaText, 1000/2, py + 4);
  }

  if (config.brandText) {
    ctx.font = `bold 24px ${config.fontFamily}`; ctx.fillStyle = config.brandColor;
    ctx.fillText(config.brandText, 1000/2, config.showCta ? 1500 * 0.85 : 1500 - 40);
  }

  return canvas.toDataURL('image/jpeg', 0.4);
};
