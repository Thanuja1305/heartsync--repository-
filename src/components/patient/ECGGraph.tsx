import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut, Maximize2, Minimize2, Move, HelpCircle } from 'lucide-react';
import { processECGBatchForDisplay, assessSignalQuality } from '../../services/ecgPipeline';

interface ECGGraphProps {
  bpm: number;
  liveEcg?: number | number[] | string;
  spo2?: number;
  classification?: string;
  leadsOff?: boolean;
  isConnected?: boolean;
  onSimulate?: () => void;
}

const ECGGraph: React.FC<ECGGraphProps> = ({ bpm: rawBpm, liveEcg, spo2, classification, leadsOff, isConnected, onSimulate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<number[]>([]);
  const phaseRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accumulatedPixelsRef = useRef<number>(0);

  // Phase 7: Interactive States
  const [isPaused, setIsPaused] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // References for smoothing real-time data input
  const latestEcgRef = useRef<number>(0);
  const smoothEcgRef = useRef<number | null>(null);
  const baselineRef = useRef<number | null>(null);
  const currentBpmRef = useRef<number>(rawBpm || 72);

  // Mouse interaction refs for panning
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const panOffsetRef = useRef(0);

  // Buffer and queue for real-time array streaming
  const sampleQueueRef = useRef<Array<{y: number, landmark?: string}>>([]);
  const lastProcessedEcgRef = useRef<string>("");

  // Beat markers and landmark history for label placements
  // Stores { x: number, y: number, label: string, isAbnormal: boolean, id: number }
  const landmarkLabelsRef = useRef<Array<{ x: number; y: number; label: string; isAbnormal: boolean; id: number }>>([]);
  const labelIdCounterRef = useRef(0);

  // Sync latest passed liveEcg value (or array of values) to queue
  useEffect(() => {
    if (isPaused) return;

    if (Array.isArray(liveEcg)) {
      const arrayKey = liveEcg.slice(-10).join(",");
      if (arrayKey !== lastProcessedEcgRef.current) {
        lastProcessedEcgRef.current = arrayKey;
        
        const processed = processECGBatchForDisplay(liveEcg);
        const newItems = processed.cleaned.map((val, idx) => ({ y: val, landmark: processed.landmarks[idx] }));
        
        if (sampleQueueRef.current.length < 10) {
          sampleQueueRef.current.push(...newItems);
        } else {
          const appendCount = Math.min(newItems.length, 5);
          sampleQueueRef.current.push(...newItems.slice(-appendCount));
        }
      }
    } else if (typeof liveEcg === 'number') {
      latestEcgRef.current = liveEcg;
      sampleQueueRef.current.push({ y: 0 }); // Fallback for single numbers, though we expect arrays
    }
    
    // Bounds check to prevent infinite accumulation
    if (sampleQueueRef.current.length > 250) {
      sampleQueueRef.current = sampleQueueRef.current.slice(-100);
    }
  }, [liveEcg, isPaused]);

  // Clean heart rate (BPM) value
  const bpm = isConnected !== false && typeof rawBpm === 'number' && !isNaN(rawBpm) && rawBpm > 0 ? rawBpm : 0;
  const isStringEcg = isConnected !== false && typeof liveEcg === 'string';
  const hasEcgValues = isConnected !== false && !isStringEcg && ((typeof liveEcg === 'number' && liveEcg > 0) || (Array.isArray(liveEcg) && liveEcg.length > 0));
  const hasSignal = hasEcgValues || isStringEcg || bpm > 0;

  // Signal quality evaluation using raw array data or defaults
  const [qualityGrade, setQualityGrade] = useState<'Excellent' | 'Good' | 'Fair' | 'Poor'>('Excellent');
  useEffect(() => {
    if (Array.isArray(liveEcg) && liveEcg.length > 10) {
      const q = assessSignalQuality(liveEcg);
      setQualityGrade(q.rating);
    } else {
      setQualityGrade(bpm > 0 ? 'Good' : 'Poor');
    }
  }, [liveEcg, bpm]);

  // Handle pan adjustments via mouse drag
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    startXRef.current = e.clientX;
    
    // Shift the view offset
    panOffsetRef.current += dx;
    setPanOffset(panOffsetRef.current);
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  // Replay / Reset action
  const handleReplay = () => {
    pointsRef.current = [];
    landmarkLabelsRef.current = [];
    panOffsetRef.current = 0;
    setPanOffset(0);
    phaseRef.current = 0;
    sampleQueueRef.current = [];
    lastTimeRef.current = 0;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = isFullscreen ? window.innerHeight - 100 : 200; // Stretch in fullscreen
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const ecgStatus = typeof liveEcg === 'string' ? liveEcg.trim() : '';

    // Medically accurate physiological PQRST shape generator
    const getSimulatedPQRSTValue = (phase: number, centerY: number): { y: number; landmark?: string } => {
      // 1. Flatline / Asystole Condition or 0 BPM
      if (bpm === 0 || /flatline|asystole/i.test(ecgStatus) || ecgStatus === 'Flatline') {
        return { y: centerY + (Math.random() - 0.5) * 1.0 };
      }

      // 2. Ventricular Fibrillation (Chaotic low-voltage rapid waves)
      if (/fibrillation|v-fib|vf/i.test(ecgStatus)) {
        return { y: centerY + (Math.random() - 0.5) * 16 + Math.sin(phase * 12 * Math.PI) * 4 };
      }

      // 3. Ventricular Tachycardia or ultra-high BPM
      if (bpm > 135 || /tachycardia|v-tach/i.test(ecgStatus)) {
        const amplitude = 38;
        return { y: centerY - amplitude * Math.sin(phase * 2 * Math.PI) - 6 * Math.sin(phase * 4 * Math.PI) };
      }

      const isExtremeBrady = bpm < 40;

      // Adjust active duration based on heart rate
      let activeDurationSec = 0.45;
      if (bpm > 100) {
        activeDurationSec = 0.35;
      } else if (bpm < 60) {
        activeDurationSec = 0.55;
      }

      const beatIntervalSec = bpm > 0 ? 60 / bpm : 1.0;
      const activeRatio = Math.min(0.85, activeDurationSec / beatIntervalSec);

      if (phase > activeRatio) {
        const baselineNoise = (Math.random() - 0.5) * 0.5;
        return { y: centerY + baselineNoise };
      }

      const p = phase / activeRatio;
      const oxygen = typeof spo2 === 'number' && spo2 > 0 ? spo2 : 98;
      
      let stOffset = 0;
      let tAmplitude = 14; 
      
      if (oxygen < 90) {
        const hypoxiaSeverity = Math.min(1.0, (90 - oxygen) / 15);
        stOffset = hypoxiaSeverity * 15;
        tAmplitude = 14 - (hypoxiaSeverity * 28);
      } else if (oxygen < 94) {
        const hypoxiaSeverity = (94 - oxygen) / 4;
        stOffset = hypoxiaSeverity * 6;
        tAmplitude = 14 - (hypoxiaSeverity * 9);
      }

      if (isExtremeBrady) {
        stOffset += 8;
        tAmplitude = -8;
      }

      // Landmark Identification triggers based on phase
      if (p < 0.12) {
        const subPhase = p / 0.12;
        const pHeight = isExtremeBrady ? 4 : 8;
        const yVal = centerY - pHeight * Math.sin(subPhase * Math.PI);
        // Tag P-wave near peak
        return { y: yVal, landmark: Math.abs(subPhase - 0.5) < 0.05 ? 'P' : undefined };
      } else if (p < 0.18) {
        return { y: centerY };
      } else if (p < 0.22) {
        const subPhase = (p - 0.18) / 0.04;
        return { y: centerY + 6 * Math.sin(subPhase * Math.PI), landmark: p > 0.20 ? 'Q' : undefined };
      } else if (p < 0.32) {
        const subPhase = (p - 0.22) / 0.10;
        const rHeight = isExtremeBrady ? 65 : 82;
        const yVal = centerY - rHeight * Math.sin(subPhase * Math.PI);
        return { y: yVal, landmark: Math.abs(subPhase - 0.5) < 0.08 ? 'R' : undefined };
      } else if (p < 0.38) {
        const subPhase = (p - 0.32) / 0.06;
        const sDepth = isExtremeBrady ? 24 : 18;
        return { y: centerY + sDepth * Math.sin(subPhase * Math.PI), landmark: p > 0.34 ? 'S' : undefined };
      } else if (p < 0.46) {
        const subPhase = (p - 0.38) / 0.08;
        return { y: centerY + (stOffset * Math.sin(subPhase * Math.PI)) };
      } else if (p < 0.68) {
        const subPhase = (p - 0.46) / 0.22;
        const stTransitionOffset = stOffset * Math.cos((p - 0.46) / 0.22 * Math.PI / 2);
        const yVal = centerY + stTransitionOffset - tAmplitude * Math.sin(subPhase * Math.PI);
        return { y: yVal, landmark: Math.abs(subPhase - 0.5) < 0.05 ? 'T' : undefined };
      } else {
        return { y: centerY };
      }
    };

    const draw = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
        animationId = requestAnimationFrame(draw);
        return;
      }

      const dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Realtime tracing shifts points only if not paused
      if (!isPaused) {
        // Scroll speed (150 pixels per second)
        const scrollSpeed = 150;
        const pixelsToAdvance = dt * scrollSpeed;
        accumulatedPixelsRef.current += pixelsToAdvance;

        const timePerPixel = 1 / scrollSpeed;

        // Re-initialize buffer to fit component width
        if (pointsRef.current.length !== width) {
          const currentPoints = [...pointsRef.current];
          if (currentPoints.length < width) {
            while (currentPoints.length < width) {
              currentPoints.push(centerY);
            }
          } else {
            currentPoints.length = width;
          }
          pointsRef.current = currentPoints;
        }

        // Advance and scroll pixels
        while (accumulatedPixelsRef.current >= 1) {
          pointsRef.current.shift();

          // Shift coordinates of active labels leftward
          landmarkLabelsRef.current = landmarkLabelsRef.current
            .map(label => ({ ...label, x: label.x - 1 }))
            .filter(label => label.x > -50); // Keep slightly off-canvas left labels for clean exits

          let targetY = centerY;
          let landmarkStr: string | undefined = undefined;

          if (hasEcgValues) {
            // 1. REAL ECG STREAM: Read pre-processed values from pipeline
            let normalizedY = 0;
            if (sampleQueueRef.current.length > 0) {
              const item = sampleQueueRef.current.shift()!;
              normalizedY = item.y;
              if (item.landmark) landmarkStr = item.landmark;
            }

            // The pipeline returns values mostly in [-1, 1]. Scale to canvas pixels.
            let scaledDeviation = normalizedY * 82;
            targetY = centerY - scaledDeviation;
          } else if (isStringEcg || bpm > 0) {
            // 2. SIMULATED ECG GENERATOR: Draw heartbeat synchronized with active BPM and classification
            const simResult = getSimulatedPQRSTValue(phaseRef.current, centerY);
            targetY = simResult.y;
            landmarkStr = simResult.landmark;
            
            // Calculate dynamic arrhythmia speeds
            let effectiveBpm = bpm || 72;
            if (/arrhythmia|irregular|sinus_arrhythmia|ectopic/i.test(ecgStatus)) {
              if (phaseRef.current === 0) {
                currentBpmRef.current = (bpm || 72) * (0.65 + Math.random() * 0.7);
              }
              effectiveBpm = currentBpmRef.current;
            } else if (/tachycardia/i.test(ecgStatus)) {
              effectiveBpm = Math.max(bpm, 115);
            } else if (/bradycardia/i.test(ecgStatus)) {
              effectiveBpm = Math.min(bpm, 45);
            } else {
              effectiveBpm = bpm || 72;
            }

            const adjustedBeatIntervalSec = effectiveBpm > 0 ? 60 / effectiveBpm : 1.0;
            const adjustedPhaseIncrement = timePerPixel / adjustedBeatIntervalSec;

            phaseRef.current = phaseRef.current + adjustedPhaseIncrement;
            if (phaseRef.current >= 1.0) {
              phaseRef.current = 0;
            }
          } else {
            // 3. NO SIGNAL: Draw a completely flat, plain line
            smoothEcgRef.current = null;
            baselineRef.current = null;
            phaseRef.current = 0;
            targetY = centerY;
          }

          pointsRef.current.push(targetY);

          // If a landmark occurred, append a labeling node at the rightmost edge
          if (landmarkStr && hasSignal) {
            // Prevent duplicated labels in close proximity
            const tooClose = landmarkLabelsRef.current.some(
              l => l.label === landmarkStr && l.x > width - 40
            );
            if (!tooClose) {
              const isAbnormal = (bpm > 100 && landmarkStr === 'R') || bpm < 50 || /arrhythmia|fibrillation/i.test(ecgStatus);
              landmarkLabelsRef.current.push({
                x: width - 1,
                y: targetY,
                label: landmarkStr,
                isAbnormal,
                id: labelIdCounterRef.current++
              });
            }
          }

          accumulatedPixelsRef.current -= 1;
        }
      }

      ctx.clearRect(0, 0, width, height);

      // Dark premium background for ECG
      ctx.fillStyle = '#1A1A1A'; // Very dark gray, almost black
      ctx.fillRect(0, 0, width, height);

      // Apply zoom & panning transformations cleanly on the grid rendering
      const scaleX = zoom;
      const xShift = panOffset;

      // 1. Draw minor grids: 10px spacing, faint light lines
      ctx.save();
      ctx.translate(xShift % (10 * scaleX), 0);
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      const extendedWidth = width / scaleX + Math.abs(xShift) / scaleX + 50;
      for (let x = -50; x < extendedWidth; x += 10) {
        if (x % 50 !== 0) {
          ctx.beginPath();
          ctx.moveTo(x * scaleX, 0);
          ctx.lineTo(x * scaleX, height);
          ctx.stroke();
        }
      }
      ctx.restore();

      ctx.save();
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      for (let y = 0; y < height; y += 10) {
        if (y % 50 !== 0) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }
      ctx.restore();

      // 2. Draw major grids: 50px spacing, slightly more distinct light lines
      ctx.save();
      ctx.translate(xShift % (50 * scaleX), 0);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      for (let x = -50; x < extendedWidth; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x * scaleX, 0);
        ctx.lineTo(x * scaleX, height);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      for (let y = 0; y < height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Draw central horizontal axis line (reference isoline)
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // 4. Draw pristine waveform trace with clinical rhythm-specific color-coding
      ctx.save();
      ctx.beginPath();
      
      let traceColor = '#ff4d4d'; // bright glowing red for contrast on dark bg
      const activeClassification = classification || ecgStatus;
      if (activeClassification) {
        if (/normal|sinus/i.test(activeClassification)) {
          traceColor = '#ff4d4d'; // Keep it red/maroon for the brand aesthetic
        } else if (/pvc|premature|contraction/i.test(activeClassification)) {
          traceColor = '#f97316'; // Orange for PVC
        } else if (/afib|fibrillation/i.test(activeClassification)) {
          traceColor = '#8b5cf6'; // Purple for AFib
        } else if (/tachycardia|bradycardia|flatline|v-fib|asystole/i.test(activeClassification)) {
          traceColor = '#ef4444'; // Red for severe abnormalities (tachy, brady, arrest)
        }
      } else if (bpm > 0) {
        if (bpm > 100 || bpm < 50) {
          traceColor = '#ef4444'; // Red
        } else {
          traceColor = '#ff4d4d'; // Keep it red
        }
      }

      // Add subtle glow
      ctx.shadowBlur = 6;
      ctx.shadowColor = traceColor;
      ctx.strokeStyle = traceColor;
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const totalPoints = pointsRef.current.length;
      for (let i = 0; i < totalPoints; i++) {
        // Apply zoom scale and panning to horizontal index coordinate
        const xPos = i * scaleX + xShift;
        const yPos = pointsRef.current[i];
        if (i === 0) {
          ctx.moveTo(xPos, yPos);
        } else {
          ctx.lineTo(xPos, yPos);
        }
      }
      ctx.stroke();
      ctx.restore();

      // 5. Draw Dynamic Clinical Landmark Annotations (P, Q, R, S, T)
      ctx.save();
      landmarkLabelsRef.current.forEach(label => {
        const xPos = label.x * scaleX + xShift;
        if (xPos < 0 || xPos > width) return; // ignore offscreen

        // Beat marker circle pulse
        if (label.label === 'R') {
          ctx.beginPath();
          ctx.arc(xPos, label.y, label.isAbnormal ? 7 : 5, 0, 2 * Math.PI);
          
          let pulseColorBg = 'rgba(16, 185, 129, 0.25)';
          let pulseColorMain = '#10b981';
          if (traceColor === '#f97316') {
            pulseColorBg = 'rgba(249, 115, 22, 0.25)';
            pulseColorMain = '#f97316';
          } else if (traceColor === '#8b5cf6') {
            pulseColorBg = 'rgba(139, 92, 246, 0.25)';
            pulseColorMain = '#8b5cf6';
          } else if (traceColor === '#ef4444') {
            pulseColorBg = 'rgba(239, 68, 68, 0.25)';
            pulseColorMain = '#ef4444';
          }
          
          ctx.fillStyle = pulseColorBg;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(xPos, label.y, 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = pulseColorMain;
          ctx.fill();
        }

        // Draw letter labels
        let labelColor = '#1e293b';
        if (traceColor === '#f97316') labelColor = '#c2410c';
        else if (traceColor === '#8b5cf6') labelColor = '#6d28d9';
        else if (traceColor === '#ef4444') labelColor = '#b91c1c';
        else if (traceColor === '#10b981') labelColor = '#047857';

        ctx.fillStyle = labelColor;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        
        // Offset PQRST letters beautifully above or below baseline peaks
        const yOffset = label.label === 'Q' || label.label === 'S' ? 16 : -14;
        ctx.fillText(label.label, xPos, label.y + yOffset);
      });
      ctx.restore();

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(timestamp => {
      lastTimeRef.current = timestamp;
      draw(timestamp);
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [bpm, hasSignal, hasEcgValues, isPaused, zoom, panOffset, isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(3.0, prev + 0.25));
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const next = Math.max(1.0, prev - 0.25);
      if (next === 1.0) {
        setPanOffset(0);
        panOffsetRef.current = 0;
      }
      return next;
    });
  };

  const graphContent = (
    <div className={`w-full text-slate-800 flex flex-col gap-3 relative select-none ${
      isFullscreen ? 'fixed inset-0 bg-slate-900 p-6 z-[9999] flex flex-col justify-between' : 'h-full'
    }`}>
      {/* Header and status indicators */}
      <div className="flex justify-between items-center bg-slate-50/80 p-3 rounded-xl border border-slate-200/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${isPaused ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-ping'}`}></span>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            {isPaused ? 'Telemetry Frozen' : 'Live ECG Stream Node'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom & Pan feedback */}
          {zoom > 1.0 && (
            <span className="text-[9px] font-semibold font-mono bg-slate-200/60 px-2 py-0.5 rounded text-slate-600 flex items-center gap-1">
              <Move className="w-3 h-3 text-slate-500" />
              <span>Zoom: {zoom.toFixed(2)}x (Drag to Pan)</span>
            </span>
          )}

          {/* Quality Indicator */}
          <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
            qualityGrade === 'Excellent'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : qualityGrade === 'Good'
              ? 'bg-teal-50 border-teal-200 text-teal-700'
              : qualityGrade === 'Fair'
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            Quality: {qualityGrade}
          </span>
        </div>
      </div>

      {/* Canvas container with dark premium styling */}
      <div className="w-full grow rounded-2xl overflow-hidden border border-[#2A2A2A] shadow-inner relative bg-[#1A1A1A] cursor-grab active:cursor-grabbing">
        <canvas 
          ref={canvasRef} 
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="block w-full h-full bg-[#1A1A1A]" 
        />

        {/* Clinical center warning only if no real ECG values are passed and heart rate is 0 */}
        {isConnected !== false && !hasSignal && !leadsOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[1px] pointer-events-none">
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 shadow-md text-red-800 font-bold text-xs tracking-wider font-mono animate-pulse flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              NO TELEMETRY FEED IDENTIFIED
            </div>
          </div>
        )}

        {isConnected !== false && leadsOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 backdrop-blur-[1.5px] pointer-events-none">
            <div className="bg-[#1E293B] border border-amber-500/30 rounded-xl px-5 py-3 shadow-md text-amber-400 font-black text-xs tracking-widest uppercase font-mono animate-pulse flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
              ⚠️ Leads Off — Attach ECG Electrodes
            </div>
          </div>
        )}

        {isConnected === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-[1.5px] p-4 text-center pointer-events-none">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-3 shadow-md text-red-500 font-black text-xs tracking-widest uppercase font-mono animate-pulse flex items-center gap-2.5 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              ⚠️ CRITICAL: DEVICE DISCONNECTED - NO SIGNAL
            </div>
            {onSimulate && (
              <button 
                onClick={() => onSimulate()}
                className="px-4 py-2 bg-accent-maroon hover:bg-[#630b0d] text-white rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-lg shadow-accent-maroon/20 pointer-events-auto cursor-pointer"
              >
                Simulate IoT Device
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );

  return (
    <div className={`w-full relative ${isFullscreen ? 'z-[9999]' : 'h-full'}`}>
      {isFullscreen ? (
        <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6 z-[99999]">
          <div className="w-full max-w-7xl h-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
            {graphContent}
          </div>
        </div>
      ) : (
        graphContent
      )}
    </div>
  );
};

export default ECGGraph;
