import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality, GenerateContentResponse, VideoGenerationReferenceType, VideoGenerationReferenceImage } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { Upload, Sparkles, Video, Play, Loader2, CheckCircle2, AlertCircle, X, Image as ImageIcon, RotateCcw, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MarketingData {
  script: string;
  videoPrompt: string;
  overlays?: string[];
}

const THUMBNAIL_FONTS = [
  { name: 'Black Han Sans', label: '임팩트' },
  { name: 'Noto Sans KR', label: '클린' },
  { name: 'Jua', label: '귀여움' },
  { name: 'Do Hyeon', label: '도현체' },
  { name: 'Nanum Gothic', label: '고딕' },
  { name: 'Nanum Pen Script', label: '손글씨' },
];

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null, null]);
  const [storeName, setStoreName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [marketingData, setMarketingData] = useState<MarketingData | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [refImageIndex, setRefImageIndex] = useState(0);
  const [isGeneratingSlideshow, setIsGeneratingSlideshow] = useState(false);
  const [textOverlays, setTextOverlays] = useState<string[]>(['', '', '', '', '']);
  const [thumbnailTitle, setThumbnailTitle] = useState('');
  const [thumbnailDesc, setThumbnailDesc] = useState('');
  const [thumbnailTitleFont, setThumbnailTitleFont] = useState('Black Han Sans');
  const [thumbnailDescFont, setThumbnailDescFont] = useState('Noto Sans KR');
  const [thumbnailTitleColor, setThumbnailTitleColor] = useState('#ffffff');
  const [thumbnailDescColor, setThumbnailDescColor] = useState('#e5e5e5');
  const [thumbnailTitleSize, setThumbnailTitleSize] = useState(110);
  const [thumbnailDescSize, setThumbnailDescSize] = useState(57);
  const [thumbnailBgIndex, setThumbnailBgIndex] = useState(0);
  const [titlePos, setTitlePos] = useState({ x: 0.5, y: 0.47 });
  const [descPos, setDescPos] = useState({ x: 0.5, y: 0.63 });
  const [dragging, setDragging] = useState<'title' | 'desc' | null>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const thumbnailCanvasRef = useRef<HTMLCanvasElement>(null);

  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    checkApiKey();
    // Google Fonts 로드
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@700;900&family=Jua&family=Do+Hyeon&family=Nanum+Gothic:wght@700&family=Nanum+Pen+Script&display=swap';
    document.head.appendChild(link);
  }, []);

  const checkApiKey = async () => {
    try {
      if (process.env.GEMINI_API_KEY) {
        setHasApiKey(true);
        return;
      }
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    } catch (e) {
      console.error("Error checking API key:", e);
    }
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleReset = () => {
    setImages([null, null, null, null, null]);
    setStoreName('');
    setBusinessType('');
    setMarketingData(null);
    setVideoUrl(null);
    setError(null);
    setGenerationStatus('');
    setRefImageIndex(0);
    setIsGeneratingSlideshow(false);
    setTextOverlays(['', '', '', '', '']);
    setThumbnailTitle('');
    setThumbnailDesc('');
    setTitlePos({ x: 0.5, y: 0.47 });
    setDescPos({ x: 0.5, y: 0.63 });
    fileInputRefs.forEach(ref => {
      if (ref.current) ref.current.value = '';
    });
  };

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImages = [...images];
        newImages[index] = reader.result as string;
        setImages(newImages);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages[index] = null;
    setImages(newImages);
    if (fileInputRefs[index].current) {
      fileInputRefs[index].current!.value = '';
    }
  };

  const fetchTrendingShorts = async (type: string): Promise<string[]> => {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&regionCode=KR&order=viewCount&maxResults=10&q=${encodeURIComponent(type + ' 숏츠')}&key=${process.env.YOUTUBE_API_KEY}`
      );
      const data = await res.json();
      return (data.items || []).map((item: any) => item.snippet.title as string);
    } catch {
      return [];
    }
  };

  const generateMarketingContent = async () => {
    const validImages = images.filter(img => img !== null) as string[];
    if (validImages.length < 2) {
      setError("이미지를 최소 2장 이상 업로드해주세요.");
      return;
    }

    setIsGeneratingScript(true);
    setError(null);
    setGenerationStatus('YouTube 트렌딩 숏츠 수집 중...');
    const trendingTitles = await fetchTrendingShorts(businessType);
    setGenerationStatus('이미지 분석 및 스크립트 생성 중...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

      const imageParts = validImages.map(img => ({
        inlineData: {
          data: img.split(',')[1],
          mimeType: img.split(';')[0].split(':')[1] || "image/jpeg"
        }
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            parts: [
              ...imageParts,
              {
                text: `You are a Korean marketing copywriting expert.

Step 1 — Industry Recognition (internal only, do NOT include in output):
Analyze the 4 images and identify the exact business type and industry. Use this understanding to determine what marketing styles, tones, and phrases are currently trending and popular for that specific industry in Korea. This step is for your internal reasoning only.

Step 2 — Trending Reference (internal only, do NOT copy titles directly):
Here are the currently trending Korean YouTube Shorts titles for the "${businessType}" industry:
${trendingTitles.length > 0 ? trendingTitles.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(no data)'}
Study the tone, hooks, phrasing style, and energy from these titles. Use them as inspiration — do NOT copy them directly.

Step 3 — Script Generation:
Write a punchy 15-second Korean YouTube Shorts hook script for the store named "${storeName}".
- This is a VIDEO SCRIPT for YouTube Shorts, NOT a social media caption.
- Format: short punchy sentences spoken aloud, like a voiceover or on-screen text sequence.
- Naturally include the store name "${storeName}" in the script.
- Do NOT mention the business type or industry anywhere in the script.
- Do NOT use hashtags (#).
- Do NOT use emojis.
- Use trendy, catchy spoken language inspired by the trending titles above.
- The script should be formatted in Markdown as a sequence of short lines (1~2 sentences each).

Step 4 — Video Prompt:
Write a detailed English visual prompt for Veo describing the colors, textures, subjects, atmosphere, and key visual elements found across all uploaded images. The prompt should guide Veo to create a cohesive 15-second marketing video that reflects the visual identity of these images. Match the script's energy and tone.

Step 5 — Text Overlays:
Write exactly ${validImages.length} short Korean text overlays — one per scene (8 seconds each).
Each overlay is a punchy on-screen caption that fits the scene's mood and advances the marketing narrative.
Rules:
- Maximum 15 characters each
- No hashtags, no emojis
- Match the energy of the script

Return ONLY a JSON object with keys: "script", "videoPrompt", and "overlays" (array of exactly ${validImages.length} strings).`
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      if (!response.text) {
        throw new Error("Gemini 응답이 비어있습니다. 다시 시도해주세요.");
      }

      let data: MarketingData;
      try {
        data = JSON.parse(response.text) as MarketingData;
      } catch {
        throw new Error(`JSON 파싱 실패. 응답: ${response.text.slice(0, 200)}`);
      }

      if (!data.script || !data.videoPrompt) {
        throw new Error(`스크립트 또는 영상 프롬프트가 없습니다. 응답: ${JSON.stringify(data)}`);
      }

      setMarketingData(data);
      if (data.overlays && data.overlays.length > 0) {
        const filled = [...data.overlays];
        while (filled.length < 5) filled.push('');
        setTextOverlays(filled.slice(0, 5));
      }
    } catch (err: any) {
      setError("스크립트 생성 실패: " + err.message);
    } finally {
      setIsGeneratingScript(false);
      setGenerationStatus('');
    }
  };

  const mergeImagesGrid = (imgs: string[]): Promise<string> => {
    return new Promise((resolve) => {
      const size = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = size * 2;
      canvas.height = size * 2;
      const ctx = canvas.getContext('2d')!;
      const labels = ['A1', 'A2', 'A3', 'A4'];
      const positions = [
        [0, 0], [size, 0],
        [0, size], [size, size],
      ];
      let loaded = 0;
      imgs.forEach((src, i) => {
        const img = new Image();
        img.onload = () => {
          const [x, y] = positions[i];
          ctx.drawImage(img, x, y, size, size);

          // 라벨 배지
          const pad = 16;
          const fontSize = 48;
          ctx.font = `bold ${fontSize}px sans-serif`;
          const text = labels[i];
          const tw = ctx.measureText(text).width;
          const bw = tw + pad * 2;
          const bh = fontSize + pad;

          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.beginPath();
          ctx.roundRect(x + 20, y + 20, bw, bh, 10);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, x + 20 + pad, y + 20 + fontSize - 4);

          loaded++;
          if (loaded === imgs.length) {
            resolve(canvas.toDataURL('image/png').split(',')[1]);
          }
        };
        img.src = src;
      });
    });
  };

  // 텍스트 줄바꿈 (한국어 포함)
  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) => {
    const chars = text.split('');
    const lines: string[] = [];
    let current = '';
    for (const ch of chars) {
      if (ctx.measureText(current + ch).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current += ch;
      }
    }
    if (current) lines.push(current);
    const totalH = lines.length * lineHeight;
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y - totalH / 2 + i * lineHeight + lineHeight / 2);
    });
  };

  // 이미지를 2배씩 단계적으로 업스케일해서 target 크기 canvas 반환
  const stepUpscale = (img: HTMLImageElement, targetW: number, targetH: number): HTMLCanvasElement => {
    const ia = img.width / img.height;
    const ca = targetW / targetH;
    const dw = ia > ca ? targetH * ia : targetW;
    const dh = ia > ca ? targetH : targetW / ia;

    // 1단계: 원본을 canvas에 복사
    let cur = document.createElement('canvas');
    cur.width = img.width;
    cur.height = img.height;
    const curCtx = cur.getContext('2d')!;
    curCtx.imageSmoothingEnabled = true;
    curCtx.imageSmoothingQuality = 'high';
    curCtx.drawImage(img, 0, 0);

    // 2배씩 단계적으로 키우기
    while (cur.width < dw * 0.75 || cur.height < dh * 0.75) {
      const next = document.createElement('canvas');
      next.width = Math.min(cur.width * 2, Math.ceil(dw));
      next.height = Math.min(cur.height * 2, Math.ceil(dh));
      const nextCtx = next.getContext('2d')!;
      nextCtx.imageSmoothingEnabled = true;
      nextCtx.imageSmoothingQuality = 'high';
      nextCtx.drawImage(cur, 0, 0, next.width, next.height);
      cur = next;
    }

    // 최종 캔버스에 cover fit으로 그리기
    const final = document.createElement('canvas');
    final.width = targetW;
    final.height = targetH;
    const fCtx = final.getContext('2d')!;
    fCtx.imageSmoothingEnabled = true;
    fCtx.imageSmoothingQuality = 'high';
    fCtx.drawImage(cur, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);
    return final;
  };

  const drawThumbnail = useCallback(async (showHandles = true) => {
    const canvas = thumbnailCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    await document.fonts.ready;
    ctx.clearRect(0, 0, W, H);

    // 배경 이미지 (업스케일링 적용)
    const bgSrc = images[thumbnailBgIndex] ?? images.find(img => img !== null) ?? null;
    if (bgSrc) {
      await new Promise<void>(resolve => {
        const img = new Image();
        img.onload = () => {
          const upscaled = stepUpscale(img, W, H);
          ctx.drawImage(upscaled, 0, 0);
          resolve();
        };
        img.src = bgSrc;
      });
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, W, H);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 제목
    if (thumbnailTitle) {
      const fs = Math.round(W * (thumbnailTitleSize / 1000));
      const tx = titlePos.x * W;
      const ty = titlePos.y * H;
      ctx.font = `900 ${fs}px '${thumbnailTitleFont}', sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 28;
      ctx.fillStyle = thumbnailTitleColor;
      wrapText(ctx, thumbnailTitle, tx, ty, W * 0.84, fs * 1.35);
      if (showHandles) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        const tm = ctx.measureText(thumbnailTitle);
        ctx.strokeRect(tx - Math.min(tm.width / 2 + 20, W * 0.44), ty - fs * 0.85, Math.min(tm.width + 40, W * 0.88), fs * 1.7);
        ctx.setLineDash([]);
      }
    }

    // 설명
    if (thumbnailDesc) {
      const fs = Math.round(W * (thumbnailDescSize / 1000));
      const dx = descPos.x * W;
      const dy = descPos.y * H;
      ctx.font = `700 ${fs}px '${thumbnailDescFont}', sans-serif`;
      ctx.shadowBlur = 16;
      ctx.fillStyle = thumbnailDescColor;
      wrapText(ctx, thumbnailDesc, dx, dy, W * 0.8, fs * 1.45);
      if (showHandles) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 5]);
        const dm = ctx.measureText(thumbnailDesc);
        ctx.strokeRect(dx - Math.min(dm.width / 2 + 16, W * 0.42), dy - fs * 0.8, Math.min(dm.width + 32, W * 0.84), fs * 1.6);
        ctx.setLineDash([]);
      }
    }
  }, [thumbnailTitle, thumbnailDesc, thumbnailTitleFont, thumbnailDescFont, thumbnailTitleColor, thumbnailDescColor, thumbnailTitleSize, thumbnailDescSize, thumbnailBgIndex, titlePos, descPos, images]);

  useEffect(() => { drawThumbnail(true); }, [drawThumbnail]);

  const downloadThumbnail = async () => {
    // 점선 핸들 없이 클린 렌더링 후 다운로드, 이후 핸들 복원
    await drawThumbnail(false);
    const canvas = thumbnailCanvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `${storeName || 'thumbnail'}_shorts_thumbnail.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    // 프리뷰 핸들 복원
    drawThumbnail(true);
  };

  const upscaleThumbnail = async () => {
    setIsUpscaling(true);
    await drawThumbnail(false);
    const canvas = thumbnailCanvasRef.current;
    if (!canvas) { setIsUpscaling(false); return; }
    const scale = 2;
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width * scale;
    offscreen.height = canvas.height * scale;
    const ctx = offscreen.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);
    const a = document.createElement('a');
    a.download = `${storeName || 'thumbnail'}_shorts_thumbnail_4K.png`;
    a.href = offscreen.toDataURL('image/png');
    a.click();
    drawThumbnail(true);
    setIsUpscaling(false);
  };

  // 썸네일 드래그 핸들러
  const getCanvasFrac = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = thumbnailCanvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };
  const handleThumbMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getCanvasFrac(e);
    const td = Math.hypot(p.x - titlePos.x, p.y - titlePos.y);
    const dd = Math.hypot(p.x - descPos.x, p.y - descPos.y);
    if (thumbnailTitle && td < 0.12) setDragging('title');
    else if (thumbnailDesc && dd < 0.1) setDragging('desc');
  };
  const handleThumbMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const p = getCanvasFrac(e);
    const c = { x: Math.max(0.05, Math.min(0.95, p.x)), y: Math.max(0.05, Math.min(0.95, p.y)) };
    if (dragging === 'title') setTitlePos(c);
    else setDescPos(c);
  };
  const handleThumbMouseUp = () => setDragging(null);

  // 키네틱 타이포그래피: 씬별 progress(0→1)에 따라 텍스트 애니메이션 그리기
  const drawKineticText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    canvasW: number,
    canvasH: number,
    progress: number,
    effectIndex: number
  ) => {
    if (!text.trim()) return;

    const cx = canvasW / 2;
    const cy = canvasH * 0.76;
    const fontSize = Math.round(canvasW * 0.072);
    const effect = effectIndex % 4;

    ctx.save();

    let alpha = 1;
    let displayText = text;

    // 페이드아웃 공통 (마지막 15%)
    if (progress > 0.85) alpha *= 1 - (progress - 0.85) / 0.15;

    if (effect === 0) {
      // fadeScale: 작게 시작 → 커지며 페이드인
      const t = Math.min(progress / 0.35, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const scale = 0.6 + 0.4 * ease;
      if (progress < 0.35) alpha *= ease;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);

    } else if (effect === 1) {
      // slideUp: 아래에서 올라오며 등장
      const t = Math.min(progress / 0.3, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const offsetY = 80 * (1 - ease);
      if (progress < 0.3) alpha *= ease;
      ctx.translate(0, offsetY);

    } else if (effect === 2) {
      // typewriter: 한 글자씩 타이핑
      const chars = Math.ceil(text.length * Math.min(progress / 0.6, 1));
      displayText = text.slice(0, chars);
      if (chars < text.length && Math.floor(progress * 20) % 2 === 0) displayText += '|';

    } else {
      // bounce: 위에서 탄성 있게 튀어오름
      const t = Math.min(progress / 0.4, 1);
      // 탄성 이징 (overshoot)
      const bounced = t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos(t * Math.PI * 2.5);
      const offsetY = -120 * (1 - bounced);
      if (progress < 0.1) alpha *= progress / 0.1;
      ctx.translate(0, offsetY);
    }

    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.font = `900 ${fontSize}px 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 텍스트 뒤 반투명 배경 바
    const metrics = ctx.measureText(displayText);
    const padX = fontSize * 0.6;
    const padY = fontSize * 0.4;
    const rectW = metrics.width + padX * 2;
    const rectH = fontSize + padY * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(cx - rectW / 2, cy - rectH / 2, rectW, rectH, rectH / 2);
    ctx.fill();

    // 텍스트 그림자 + 본문
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(displayText, cx, cy);

    ctx.restore();
  };

  const generateSlideshow = async () => {
    const validImages = images.filter(img => img !== null) as string[];
    setIsGeneratingSlideshow(true);
    setError(null);
    setGenerationStatus('원본 이미지 로딩 중...');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d')!;

      const loadedImgs = await Promise.all(validImages.map(src =>
        new Promise<HTMLImageElement>(resolve => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = src;
        })
      ));

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm';

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      const recordingDone = new Promise<void>(resolve => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          setVideoUrl(URL.createObjectURL(blob));
          resolve();
        };
      });

      recorder.start(100);

      const SEC_PER_IMAGE = 15 / validImages.length;
      const TRANSITION_SEC = 0.5;

      const effects = [
        { sx: 1.0,  ex: 1.12, spx: 0,   epx: 0,   spy: 0,   epy: 0   },
        { sx: 1.12, ex: 1.0,  spx: -40, epx: 40,  spy: 0,   epy: 0   },
        { sx: 1.0,  ex: 1.12, spx: 30,  epx: -30, spy: 30,  epy: -30 },
        { sx: 1.12, ex: 1.0,  spx: 0,   epx: 0,   spy: -30, epy: 30  },
        { sx: 1.05, ex: 1.15, spx: -20, epx: 20,  spy: 20,  epy: -20 },
      ];

      const drawImg = (img: HTMLImageElement, scale: number, ox: number, oy: number, alpha: number) => {
        const ia = img.width / img.height;
        const ca = canvas.width / canvas.height;
        let dw = ia > ca ? canvas.height * scale * ia : canvas.width * scale;
        let dh = ia > ca ? canvas.height * scale : canvas.width * scale / ia;
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, (canvas.width - dw) / 2 + ox, (canvas.height - dh) / 2 + oy, dw, dh);
        ctx.globalAlpha = 1;
      };

      for (let i = 0; i < loadedImgs.length; i++) {
        setGenerationStatus(`슬라이드쇼 생성 중... (${i + 1}/${loadedImgs.length})`);
        const img = loadedImgs[i];
        const nextImg = loadedImgs[(i + 1) % loadedImgs.length];
        const ef = effects[i % effects.length];
        const nef = effects[(i + 1) % effects.length];
        const startTime = performance.now();

        await new Promise<void>(resolve => {
          let rafId: number;
          // setTimeout이 실제 지속 시간을 보장 (rAF throttling 방지)
          const timer = setTimeout(() => {
            cancelAnimationFrame(rafId);
            resolve();
          }, SEC_PER_IMAGE * 1000);

          const frame = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            const progress = Math.min(elapsed / SEC_PER_IMAGE, 1);
            const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            const scale = ef.sx + (ef.ex - ef.sx) * eased;
            const ox = ef.spx + (ef.epx - ef.spx) * eased;
            const oy = ef.spy + (ef.epy - ef.spy) * eased;

            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const timeLeft = SEC_PER_IMAGE - elapsed;
            if (timeLeft < TRANSITION_SEC && i < loadedImgs.length - 1) {
              const fade = 1 - timeLeft / TRANSITION_SEC;
              drawImg(img, scale, ox, oy, 1 - fade);
              drawImg(nextImg, nef.sx, nef.spx, nef.spy, fade);
            } else {
              drawImg(img, scale, ox, oy, 1);
            }

            // 자막 텍스트 오버레이 (하단 페이드인/아웃)
            const overlay = textOverlays[i] || '';
            if (overlay.trim()) {
              let subAlpha = 1;
              if (progress < 0.18) subAlpha = progress / 0.18;
              else if (progress > 0.78) subAlpha = (1 - progress) / 0.22;
              const subFs = Math.round(canvas.width * 0.063);
              const subY = canvas.height * 0.875;
              ctx.save();
              ctx.globalAlpha = Math.max(0, subAlpha);
              ctx.font = `700 ${subFs}px 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              const sm = ctx.measureText(overlay);
              const spx = subFs * 0.65, spy = subFs * 0.38;
              ctx.fillStyle = 'rgba(0,0,0,0.62)';
              ctx.beginPath();
              ctx.roundRect(canvas.width / 2 - sm.width / 2 - spx, subY - subFs / 2 - spy, sm.width + spx * 2, subFs + spy * 2, 10);
              ctx.fill();
              ctx.shadowColor = 'rgba(0,0,0,0.9)';
              ctx.shadowBlur = 10;
              ctx.fillStyle = '#ffffff';
              ctx.fillText(overlay, canvas.width / 2, subY);
              ctx.restore();
            }

            if (progress < 1) rafId = requestAnimationFrame(frame);
            else { clearTimeout(timer); resolve(); }
          };
          rafId = requestAnimationFrame(frame);
        });
      }

      recorder.stop();
      await recordingDone;
    } catch (err: any) {
      setError('슬라이드쇼 생성 실패: ' + err.message);
    } finally {
      setIsGeneratingSlideshow(false);
      setGenerationStatus('');
    }
  };

  // Step 1: Gemini가 스크립트 + 4장 이미지 분석 → 씬별 8초 프롬프트 4개 생성
  const generateScenePrompts = async (script: string, basePrompt: string, imgs: string[]): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const imageParts = imgs.map(img => ({
      inlineData: {
        data: img.split(',')[1],
        mimeType: img.split(';')[0].split(':')[1] || 'image/jpeg',
      }
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{
        parts: [
          ...imageParts,
          {
            text: `You are a video director creating a ${imgs.length * 8}-second marketing short film composed of ${imgs.length} scenes, each exactly 8 seconds long.

Marketing Script:
${script}

Visual Style Reference:
${basePrompt}

The ${imgs.length} uploaded images are your source material (Image 1 through ${imgs.length} in order).

Write ${imgs.length} distinct English Veo video prompts — one per image — that together tell a cohesive, punchy marketing story:
${[
  '- Scene 1 (Image 1): Attention-grabbing hook that stops the scroll',
  '- Scene 2 (Image 2): Product or service in action / showcase',
  '- Scene 3 (Image 3): Lifestyle atmosphere & emotional benefit',
  '- Scene 4 (Image 4): Powerful emotional close / call-to-action energy',
  '- Scene 5 (Image 5): Brand reveal / memorable outro',
].slice(0, imgs.length).join('\n')}

Each prompt must:
- Specifically reference the visual content of the corresponding image
- Include camera movement, lighting, mood, and subject action
- Be cinematic, detailed, in English
- Be designed for exactly 8 seconds of footage

Return ONLY a JSON array with exactly ${imgs.length} strings.`
          }
        ]
      }],
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text!) as string[];
    while (parsed.length < imgs.length) parsed.push(basePrompt);
    return parsed.slice(0, imgs.length);
  };

  // Step 2: 이미지 1장 + 씬 프롬프트 → Veo 8초 클립 1개 생성
  const generateVeoClip = async (prompt: string, imageBase64: string, clipIndex: number): Promise<Blob> => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const fullPrompt = prompt + ' Shot on iPhone 15 Pro, ultra-realistic handheld footage, natural lighting, shallow depth of field, photorealistic. 9:16 vertical format. NO speech, NO narration, NO voiceover. Ambient sound and background music only.';

    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: fullPrompt,
      image: {
        imageBytes: imageBase64.split(',')[1],
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        aspectRatio: '9:16',
      }
    });

    const MAX_POLLS = 36;
    let pollCount = 0;

    while (!operation.done) {
      if (pollCount >= MAX_POLLS) throw new Error(`씬 ${clipIndex + 1} 생성 시간 초과`);
      pollCount++;
      setGenerationStatus(`씬 ${clipIndex + 1} 생성 중... (${pollCount * 10}초 경과)`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      try {
        operation = await ai.operations.getVideosOperation({ operation });
      } catch (e: any) {
        if (e.message.includes("Requested entity was not found")) {
          setHasApiKey(false);
          throw new Error("API Key 세션이 만료되었습니다.");
        }
        throw e;
      }
      if ((operation as any).error) throw new Error(`씬 ${clipIndex + 1} 실패: ${JSON.stringify((operation as any).error)}`);
    }

    const generatedVideo = operation.response?.generatedVideos?.[0]?.video;
    if (!generatedVideo) throw new Error(`씬 ${clipIndex + 1} 생성 실패. RAI 차단 ${operation.response?.raiMediaFilteredCount}개`);

    if (generatedVideo.videoBytes) {
      const byteArray = Uint8Array.from(atob(generatedVideo.videoBytes), c => c.charCodeAt(0));
      return new Blob([byteArray], { type: generatedVideo.mimeType || 'video/mp4' });
    }

    if (generatedVideo.uri) {
      const res = await fetch(generatedVideo.uri, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! } });
      if (!res.ok) throw new Error(`씬 ${clipIndex + 1} 다운로드 실패: ${res.status}`);
      return res.blob();
    }

    throw new Error(`씬 ${clipIndex + 1} 데이터 없음`);
  };

  // Step 3: 4개 클립 → Canvas로 순서대로 재생하며 MediaRecorder로 합치기
  const concatenateVideoBlobs = async (blobs: Blob[]): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d')!;

    const audioCtx = new AudioContext();
    const audioDest = audioCtx.createMediaStreamDestination();
    const canvasStream = canvas.captureStream(30);
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ]);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus' : 'video/webm';

    const recorder = new MediaRecorder(combinedStream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    const recordingDone = new Promise<Blob>(resolve => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    recorder.start(100);

    for (let i = 0; i < blobs.length; i++) {
      setGenerationStatus(`영상 합치는 중... (${i + 1}/${blobs.length})`);
      const url = URL.createObjectURL(blobs[i]);
      const video = document.createElement('video');
      video.src = url;
      video.crossOrigin = 'anonymous';

      try {
        const source = audioCtx.createMediaElementSource(video);
        source.connect(audioDest);
      } catch (_) { /* 오디오 연결 실패 시 무시 */ }

      await new Promise<void>((resolve, reject) => {
        const fallback = setTimeout(() => { URL.revokeObjectURL(url); resolve(); }, 15000);

        video.onended = () => { clearTimeout(fallback); URL.revokeObjectURL(url); resolve(); };
        video.onerror = () => { clearTimeout(fallback); reject(new Error(`씬 ${i + 1} 재생 실패`)); };

        const drawFrame = () => {
          if (!video.ended && !video.paused) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            requestAnimationFrame(drawFrame);
          }
        };
        video.onplay = () => requestAnimationFrame(drawFrame);
        video.onloadedmetadata = () => video.play().catch(reject);
      });
    }

    recorder.stop();
    audioCtx.close();
    return recordingDone;
  };

  const generateVideo = async () => {
    if (!marketingData) return;
    if (!hasApiKey) await handleOpenKeySelector();

    setIsGeneratingVideo(true);
    setError(null);

    try {
      const validImages = images.filter(img => img !== null) as string[];

      // Step 1: Gemini가 스크립트 분석 → 씬별 기획
      setGenerationStatus(`AI가 스크립트 분석 및 ${validImages.length}개 씬 기획 중...`);
      const scenePrompts = await generateScenePrompts(marketingData.script, marketingData.videoPrompt, validImages);

      // Step 2: 이미지별 8초 클립 생성
      const videoBlobs: Blob[] = [];
      for (let i = 0; i < validImages.length; i++) {
        setGenerationStatus(`씬 ${i + 1}/${validImages.length} 생성 시작 중...`);
        const blob = await generateVeoClip(scenePrompts[i], validImages[i], i);
        videoBlobs.push(blob);
      }

      // Step 3: 클립 합쳐서 최종 영상 렌더링
      setGenerationStatus(`${validImages.length}개 씬 합치는 중...`);
      const finalBlob = await concatenateVideoBlobs(videoBlobs);
      setVideoUrl(URL.createObjectURL(finalBlob));
    } catch (err: any) {
      setError("Failed to generate video: " + err.message);
    } finally {
      setIsGeneratingVideo(false);
      setGenerationStatus('');
    }
  };

  const validImageCount = images.filter(img => img !== null).length;
  const canGenerate = validImageCount >= 2 && storeName.trim() !== '' && businessType.trim() !== '';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Video className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">ShortsAI <span className="text-emerald-500">Marketing</span></h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              다시 시작
            </button>
            {hasApiKey ? (
              <div className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-sm font-medium flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400">API 연결됨</span>
              </div>
            ) : (
              <button
                onClick={handleOpenKeySelector}
                className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-all flex items-center gap-2"
              >
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Setup API Key
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          <div className="lg:col-span-7 space-y-12">

            {/* Step 01 - 상호 & 업종 입력 */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm border border-white/10">01</span>
                  가게 정보
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/40 font-medium">상호명</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    placeholder="예) 스타벅스 강남점"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 focus:bg-emerald-500/5 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/40 font-medium">업종</label>
                  <input
                    type="text"
                    value={businessType}
                    onChange={e => setBusinessType(e.target.value)}
                    placeholder="예) 카페, 식당, 뷰티샵"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 focus:bg-emerald-500/5 transition-all"
                  />
                  <p className="text-xs text-white/20">스크립트에는 포함되지 않고 분석에만 사용됩니다</p>
                </div>
              </div>
            </section>

            {/* Step 02 - 이미지 업로드 */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm border border-white/10">02</span>
                  Source Assets
                </h2>
                <p className="text-white/40 text-sm">최대 5장 업로드 (최소 2장)</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group aspect-[3/4]">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRefs[idx]}
                      onChange={(e) => handleImageUpload(idx, e)}
                    />
                    {img ? (
                      <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 relative">
                        <img src={img} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          onClick={() => removeImage(idx)}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRefs[idx].current?.click()}
                        className="w-full h-full rounded-2xl border-2 border-dashed border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all flex flex-col items-center justify-center gap-3"
                      >
                        <div className="p-3 bg-white/5 rounded-full">
                          <Upload className="w-5 h-5 text-white/40" />
                        </div>
                        <span className="text-xs font-medium text-white/40">Upload {idx + 1}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <button
                  disabled={!canGenerate || isGeneratingScript}
                  onClick={generateMarketingContent}
                  className={cn(
                    "w-full py-4 rounded-2xl font-semibold text-lg transition-all flex items-center justify-center gap-3 shadow-xl",
                    canGenerate
                      ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20"
                      : "bg-white/5 text-white/20 cursor-not-allowed border border-white/5"
                  )}
                >
                  {isGeneratingScript ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Generating Script...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6" />
                      Generate Marketing Hook
                    </>
                  )}
                </button>
                {!canGenerate && (
                  <p className="text-center text-xs text-white/20 mt-3">
                    상호명, 업종 입력 및 이미지 최소 2장 업로드 후 생성 가능합니다
                  </p>
                )}
              </div>
            </section>

            {/* Step 03 - 스크립트 */}
            <AnimatePresence>
              {marketingData && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm border border-white/10">03</span>
                      Marketing Script
                    </h2>
                    <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Ready for Production
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-3xl p-8 prose prose-invert max-w-none">
                    <ReactMarkdown>{marketingData.script}</ReactMarkdown>
                  </div>

                  {/* 씬별 자막 텍스트 */}
                  <div className="space-y-3 p-5 bg-white/5 border border-white/10 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">씬별 자막 텍스트</p>
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                        <ImageIcon className="w-3 h-3" />
                        원본 슬라이드에 반영
                      </span>
                    </div>
                    <p className="text-xs text-white/30">AI가 자동 생성했습니다. 직접 수정하면 슬라이드쇼에 즉시 반영됩니다.</p>
                    <div className="grid grid-cols-2 gap-3">
                      {textOverlays.map((text, i) => (
                        <div key={i} className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/25 font-mono select-none">
                            씬{i + 1}
                          </div>
                          <input
                            type="text"
                            value={text}
                            maxLength={20}
                            onChange={e => {
                              const next = [...textOverlays];
                              next[i] = e.target.value;
                              setTextOverlays(next);
                            }}
                            placeholder={`씬 ${i + 1} 자막`}
                            className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 focus:bg-emerald-500/5 transition-all"
                          />
                          <span className={cn(
                            "absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums",
                            text.length >= 20 ? "text-red-400" : "text-white/25"
                          )}>
                            {text.length}/20
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      disabled={isGeneratingVideo || isGeneratingSlideshow}
                      onClick={generateVideo}
                      className={cn(
                        "w-full py-4 rounded-2xl font-semibold text-base transition-all flex items-center justify-center gap-2 shadow-xl",
                        "bg-white text-black hover:bg-zinc-200 shadow-white/10"
                      )}
                    >
                      {isGeneratingVideo ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />AI 생성 중...</>
                      ) : (
                        <><Sparkles className="w-5 h-5" />AI 영상</>
                      )}
                    </button>
                    <button
                      disabled={isGeneratingVideo || isGeneratingSlideshow}
                      onClick={generateSlideshow}
                      className={cn(
                        "w-full py-4 rounded-2xl font-semibold text-base transition-all flex items-center justify-center gap-2 shadow-xl",
                        "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20"
                      )}
                    >
                      {isGeneratingSlideshow ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />생성 중...</>
                      ) : (
                        <><ImageIcon className="w-5 h-5" />원본 슬라이드</>
                      )}
                    </button>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* 썸네일 메이커 */}
            <AnimatePresence>
              {marketingData && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm border border-white/10">04</span>
                      썸네일 메이커
                    </h2>
                  </div>

                  {/* 배경 이미지 선택 */}
                  <div className="space-y-2">
                    <p className="text-xs text-white/40 uppercase tracking-wider font-medium">배경 이미지</p>
                    <div className="flex gap-2">
                      {images.map((img, i) => img && (
                        <button key={i} onClick={() => setThumbnailBgIndex(i)}
                          className={cn("w-14 h-14 rounded-xl overflow-hidden border-2 transition-all",
                            thumbnailBgIndex === i ? "border-emerald-500 scale-110" : "border-white/10 hover:border-white/30")}>
                          <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 제목 스타일 */}
                  <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-xs text-white/40 uppercase tracking-wider font-medium">제목</p>
                    <div className="flex gap-2 items-center">
                      <input type="text" value={thumbnailTitle} onChange={e => setThumbnailTitle(e.target.value)}
                        placeholder="썸네일 제목"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-all"
                        style={{ fontFamily: thumbnailTitleFont }} />
                      <select value={thumbnailTitleSize} onChange={e => setThumbnailTitleSize(Number(e.target.value))}
                        className="bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all shrink-0 cursor-pointer">
                        {[60,70,80,90,100,110,120,140,160,180,200].map(s => (
                          <option key={s} value={s} className="bg-zinc-900">{s}</option>
                        ))}
                      </select>
                      <label className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/20 cursor-pointer shrink-0">
                        <input type="color" value={thumbnailTitleColor} onChange={e => setThumbnailTitleColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        <div className="w-full h-full rounded-lg" style={{ background: thumbnailTitleColor }} />
                      </label>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-0.5">
                      {THUMBNAIL_FONTS.map(f => (
                        <button key={f.name} onClick={() => setThumbnailTitleFont(f.name)}
                          className={cn("shrink-0 px-3 py-1.5 rounded-lg border text-xs transition-all",
                            thumbnailTitleFont === f.name ? "bg-emerald-500 border-emerald-500 text-black font-bold" : "bg-white/5 border-white/10 text-white/60 hover:border-white/30")}
                          style={{ fontFamily: f.name }}>{f.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* 설명 스타일 */}
                  <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-xs text-white/40 uppercase tracking-wider font-medium">설명</p>
                    <div className="flex gap-2 items-center">
                      <input type="text" value={thumbnailDesc} onChange={e => setThumbnailDesc(e.target.value)}
                        placeholder="짧은 설명"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-all"
                        style={{ fontFamily: thumbnailDescFont }} />
                      <select value={thumbnailDescSize} onChange={e => setThumbnailDescSize(Number(e.target.value))}
                        className="bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all shrink-0 cursor-pointer">
                        {[30,40,50,57,65,75,85,100,120].map(s => (
                          <option key={s} value={s} className="bg-zinc-900">{s}</option>
                        ))}
                      </select>
                      <label className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/20 cursor-pointer shrink-0">
                        <input type="color" value={thumbnailDescColor} onChange={e => setThumbnailDescColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        <div className="w-full h-full rounded-lg" style={{ background: thumbnailDescColor }} />
                      </label>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-0.5">
                      {THUMBNAIL_FONTS.map(f => (
                        <button key={f.name} onClick={() => setThumbnailDescFont(f.name)}
                          className={cn("shrink-0 px-3 py-1.5 rounded-lg border text-xs transition-all",
                            thumbnailDescFont === f.name ? "bg-emerald-500 border-emerald-500 text-black font-bold" : "bg-white/5 border-white/10 text-white/60 hover:border-white/30")}
                          style={{ fontFamily: f.name }}>{f.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* 캔버스 프리뷰 (드래그 가능) */}
                  <div className="space-y-1">
                    <p className="text-xs text-white/30">제목과 설명을 드래그해서 위치를 조정할 수 있습니다</p>
                    <div className="relative aspect-[9/16] rounded-2xl overflow-hidden border border-white/10 bg-zinc-900">
                      <canvas
                        ref={thumbnailCanvasRef}
                        width={1080}
                        height={1920}
                        className={cn("w-full h-full object-cover", dragging ? "cursor-grabbing" : "cursor-grab")}
                        onMouseDown={handleThumbMouseDown}
                        onMouseMove={handleThumbMouseMove}
                        onMouseUp={handleThumbMouseUp}
                        onMouseLeave={handleThumbMouseUp}
                      />
                    </div>
                  </div>

                  {/* 업스케일링 + 다운로드 */}
                  <button onClick={upscaleThumbnail} disabled={isUpscaling}
                    className="w-full py-3.5 rounded-2xl font-semibold text-base bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isUpscaling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    {isUpscaling ? '업스케일링 중...' : '업스케일링 (2× · 4K)'}
                  </button>
                  <button onClick={downloadThumbnail}
                    className="w-full py-3.5 rounded-2xl font-semibold text-base bg-white/10 hover:bg-white/20 border border-white/10 transition-all flex items-center justify-center gap-2">
                    <Download className="w-5 h-5" />
                    썸네일 다운로드 (PNG)
                  </button>
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          {/* 우측 - 프리뷰 */}
          <div className="lg:col-span-5">
            <div className="sticky top-28 space-y-8">
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm border border-white/10">05</span>
                    Preview
                  </h2>
                </div>

                <div className="aspect-[9/16] bg-zinc-900 rounded-[2.5rem] border-8 border-zinc-800 shadow-2xl relative overflow-hidden group">
                  {videoUrl ? (
                    <>
                      <video
                        src={videoUrl}
                        className="w-full h-full object-cover"
                        controls
                        autoPlay
                        loop
                      />
                      <a
                        href={videoUrl}
                        download={`${storeName}_shorts.mp4`}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-full flex items-center gap-2 text-sm shadow-lg shadow-emerald-500/30 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        다운로드
                      </a>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                        {isGeneratingVideo ? (
                          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                        ) : (
                          <Play className="w-10 h-10 text-white/20" />
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-medium text-white/60">
                          {isGeneratingVideo ? "Generating your short..." : "Your video will appear here"}
                        </p>
                        <p className="text-sm text-white/30 leading-relaxed">
                          {isGeneratingVideo
                            ? "This can take 1-3 minutes. We're using advanced AI to craft a high-quality marketing short."
                            : "Upload images and generate a script to start the video production process."}
                        </p>
                      </div>
                    </div>
                  )}

                  <AnimatePresence>
                    {generationStatus && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
                      >
                        <div className="w-16 h-16 mb-6 relative">
                          <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <p className="text-emerald-500 font-mono text-sm tracking-widest uppercase mb-2">Processing</p>
                        <p className="text-xl font-medium text-white">{generationStatus}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-red-500">Generation Error</p>
                    <p className="text-xs text-red-400/80 leading-relaxed">{error}</p>
                  </div>
                </div>
              )}

              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40">Tips for best results</h3>
                <ul className="space-y-3">
                  {[
                    "Use high-resolution product shots",
                    "Include at least one lifestyle image",
                    "Ensure consistent lighting across photos",
                    "Focus on clear product benefits"
                  ].map((tip, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-white/30 text-sm">© 2024 ShortsAI. Powered by Gemini & Veo.</p>
          <div className="flex items-center gap-8">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-white/30 hover:text-white text-sm transition-colors">Billing Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
