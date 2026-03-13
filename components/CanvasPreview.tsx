import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Calendar, Video, Loader2, Image as ImageIcon } from 'lucide-react';
import { PinConfig, PinVariation } from '../types';

export interface CanvasPreviewHandle {
  getCanvas: () => HTMLCanvasElement | null;
}

interface CanvasPreviewProps {
  variation: PinVariation | null;
  config: PinConfig;
  imageUrl: string | null | undefined;
  isLoadingImage: boolean;
  onImageDownloadStart?: () => void;
  isGeneratingText: boolean;
  onSchedule?: () => void;
  isPublishing?: boolean;
}

export const CanvasPreview = forwardRef<CanvasPreviewHandle, CanvasPreviewProps>(({
  variation,
  config,
  imageUrl,
  isLoadingImage,
  isGeneratingText,
  onSchedule,
  isPublishing
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgImageObj, setBgImageObj] = useState<HTMLImageElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }));

  useEffect(() => {
    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      img.onload = () => setBgImageObj(img);
      img.onerror = () => setBgImageObj(null);
    } else {
      setBgImageObj(null);
    }
  }, [imageUrl]);

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

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const renderPin = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, scaleFactor: number = 1.0) => {
    ctx.clearRect(0, 0, width, height);
    if (bgImageObj && !variation?.fallbackMode) {
      const scale = Math.max(width / bgImageObj.width, height / bgImageObj.height) * scaleFactor;
      const w = bgImageObj.width * scale;
      const h = bgImageObj.height * scale;
      ctx.drawImage(bgImageObj, (width - w) / 2, (height - h) / 2, w, h);
    } else {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#f87171'); grad.addColorStop(1, '#c026d3');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    let alpha = 0.2;
    let textCol = config.textColor;
    let outCol = config.outlineColor;

    if (config.colorScheme === 'dark-overlay') { alpha = 0.6; textCol = '#ffffff'; }
    else if (config.colorScheme === 'monochrome') {
       ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'black'; ctx.fillRect(0,0,width,height); ctx.restore();
       textCol = '#ffffff'; outCol = '#000000';
    }
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, width, height);

    if (config.headline) {
      const size = calculateOptimalFontSize(ctx, config.headline, width * 0.9, height * 0.55, config.fontFamily);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${size}px ${config.fontFamily}`;
      const lines = getLines(ctx, config.headline, width * 0.9);
      const lh = size * 1.2;
      let cy = (height * (config.textYPos / 100)) - ((lines.length * lh) / 2) + (lh / 2);
      lines.forEach(l => {
        ctx.strokeStyle = outCol; ctx.lineWidth = size * 0.25; ctx.lineJoin = 'round'; ctx.strokeText(l, width/2, cy);
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
        ctx.fillStyle = textCol; ctx.fillText(l, width/2, cy);
        ctx.shadowColor = 'transparent'; cy += lh;
      });
    }

    if (config.showCta && config.ctaText) {
      const py = height * 0.92; const bw = width * 0.9; const bh = 120;
      let fs = 45; ctx.font = `bold ${fs}px ${config.fontFamily}`;
      const tw = ctx.measureText(config.ctaText).width;
      if (tw > bw * 0.8) fs *= (bw * 0.8 / tw);
      ctx.font = `bold ${fs}px ${config.fontFamily}`;
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 15; ctx.shadowOffsetY = 8;
      ctx.fillStyle = config.ctaBgColor;
      drawRoundedRect(ctx, (width - bw) / 2, py - (bh/2), bw, bh, bh/2);
      ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.fillStyle = config.ctaTextColor; ctx.textAlign = 'center';
      ctx.fillText(config.ctaText, width/2, py + 4);
    }

    if (config.brandText) {
      ctx.font = `bold 24px ${config.fontFamily}`; ctx.fillStyle = config.brandColor;
      ctx.fillText(config.brandText, width/2, config.showCta ? height * 0.85 : height - 40);
    }
  }, [variation, config, bgImageObj]);

  useEffect(() => {
    if (isRecording) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    c.width = 1000; c.height = 1500;
    renderPin(ctx, 1000, 1500, 1.0);
  }, [renderPin, isRecording]);

  const handleDownload = () => {
    const c = canvasRef.current; if (!c) return;

    // Automatically copy title to clipboard
    if (variation?.seoTitle) {
      navigator.clipboard.writeText(variation.seoTitle).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }).catch(err => {
        console.error('Failed to copy title to clipboard:', err);
      });
    }

    const link = document.createElement('a');
    link.download = `pin-${Date.now()}.png`; link.href = c.toDataURL('image/png'); link.click();
  };

  const handleRecord = () => {
    const c = canvasRef.current; if (!c || !bgImageObj) return;
    setIsRecording(true);
    
    // Detect best supported format for MP4 request
    const types = [
      'video/mp4',
      'video/mp4;codecs=h264',
      'video/webm;codecs=h264',
      'video/webm'
    ];
    const supportedType = types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
    
    const stream = c.captureStream(30);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: supportedType });
    
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const b = new Blob(chunks, { type: supportedType });
      const l = document.createElement('a');
      l.download = `pin-video-${Date.now()}.mp4`; // Always download as .mp4
      l.href = URL.createObjectURL(b); 
      l.click();
      setIsRecording(false);
    };
    
    recorder.start();
    const ctx = c.getContext('2d');
    const start = performance.now();
    const animate = (t: number) => {
      const prog = Math.min((t - start) / 5000, 1);
      setRecordingProgress(Math.round(prog * 100));
      if (ctx) renderPin(ctx, 1000, 1500, 1.1 - (0.1 * prog));
      if (prog < 1) requestAnimationFrame(animate); else recorder.stop();
    };
    requestAnimationFrame(animate);
  };

  return (
    <div className="flex flex-col items-center">
      {variation && (
        <div className="w-full max-w-[500px] flex justify-start items-center mb-4 gap-2">
          <button 
            onClick={handleDownload} 
            disabled={isRecording} 
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 border ${isCopied ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-700 border-slate-200 hover:border-red-600'}`}
          >
            <ImageIcon className="w-4 h-4" />
            {isCopied ? 'Title Copied!' : 'Download Image'}
          </button>
          <button 
            onClick={handleRecord} 
            disabled={isRecording || !bgImageObj} 
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 border ${isRecording ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-slate-700 border-slate-200 hover:border-red-600'}`}
          >
            {isRecording ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
            {isRecording ? `${recordingProgress}%` : 'Video'}
          </button>
        </div>
      )}
      <div className="relative shadow-2xl rounded-2xl overflow-hidden bg-white ring-1 ring-slate-900/5 aspect-[2/3] w-full max-w-[500px]">
        {(isGeneratingText || isLoadingImage) && (
          <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-10 h-10 animate-spin text-red-600 mb-4" />
            <p className="font-bold text-xs uppercase tracking-widest">{isGeneratingText ? 'Planning Content...' : 'Developing Aesthetic...'}</p>
          </div>
        )}
        {!variation && !isGeneratingText && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 bg-slate-50">
            <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">Pin Studio</p>
          </div>
        )}
        <canvas ref={canvasRef} className="w-full h-full object-contain block" />
      </div>
    </div>
  );
});