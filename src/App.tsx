import React, { useState, useRef, useEffect } from 'react';
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
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null]);
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

  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    checkApiKey();
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
    setImages([null, null, null, null]);
    setStoreName('');
    setBusinessType('');
    setMarketingData(null);
    setVideoUrl(null);
    setError(null);
    setGenerationStatus('');
    setRefImageIndex(0);
    setIsGeneratingSlideshow(false);
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
    if (validImages.length < 4) {
      setError("Please upload all 4 images to continue.");
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
          mimeType: "image/png"
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

Step 3 — Video Prompt:
Write a detailed English visual prompt for Veo describing the colors, textures, subjects, atmosphere, and key visual elements found across all 4 images. The prompt should guide Veo to create a cohesive 15-second marketing video that reflects the visual identity of these images. Match the script's energy and tone.

Return ONLY a JSON object with keys: "script" and "videoPrompt".`
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
        { sx: 1.0, ex: 1.12, spx: 0,   epx: 0,   spy: 0,   epy: 0   },
        { sx: 1.12, ex: 1.0, spx: -40, epx: 40,  spy: 0,   epy: 0   },
        { sx: 1.0, ex: 1.12, spx: 30,  epx: -30, spy: 30,  epy: -30 },
        { sx: 1.12, ex: 1.0, spx: 0,   epx: 0,   spy: -30, epy: 30  },
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

            if (progress < 1) requestAnimationFrame(frame);
            else resolve();
          };
          requestAnimationFrame(frame);
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

  const generateVideo = async () => {
    if (!marketingData) return;
    if (!hasApiKey) {
      await handleOpenKeySelector();
    }

    setIsGeneratingVideo(true);
    setError(null);
    setGenerationStatus('Initializing video engine...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const validImages = images.filter(img => img !== null) as string[];

      setGenerationStatus('Generating cinematic 15-second short...');

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: marketingData.videoPrompt + ` Shot on iPhone 15 Pro, ultra-realistic handheld footage, natural lighting, slight camera movement and subtle shake for authenticity, shallow depth of field, true-to-life colors, photorealistic textures, real-world environment. Style: candid documentary feel mixed with modern lifestyle content. 15-second vertical marketing short. NO speech, NO narration, NO voiceover, NO TTS. Add only ambient sound effects and background music that naturally fit the scene atmosphere and mood.`,
        image: {
          imageBytes: validImages[refImageIndex % validImages.length].split(',')[1],
          mimeType: 'image/png',
        },
        config: {
          numberOfVideos: 1,
          aspectRatio: '9:16',
        }
      });

      const MAX_POLLS = 36; // 최대 6분 대기
      let pollCount = 0;

      while (!operation.done) {
        if (pollCount >= MAX_POLLS) {
          throw new Error("영상 생성 시간이 초과되었습니다. 다시 시도해주세요.");
        }
        pollCount++;
        setGenerationStatus(`영상 생성 중... (${pollCount * 10}초 경과)`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        try {
          operation = await ai.operations.getVideosOperation({ operation: operation });
        } catch (e: any) {
          if (e.message.includes("Requested entity was not found")) {
            setHasApiKey(false);
            throw new Error("API Key 세션이 만료되었습니다. 다시 시도해주세요.");
          }
          throw e;
        }

        // 작업 실패 감지
        if ((operation as any).error) {
          throw new Error("영상 생성 실패: " + JSON.stringify((operation as any).error));
        }
      }

      console.log('Operation response:', JSON.stringify(operation, null, 2));

      const generatedVideo = operation.response?.generatedVideos?.[0]?.video;

      if (!generatedVideo) {
        const filteredCount = operation.response?.raiMediaFilteredCount;
        throw new Error(`영상 생성 실패. RAI 차단 ${filteredCount}개 | 응답: ${JSON.stringify(operation.response)}`);
      }

      // videoBytes로 반환된 경우
      if (generatedVideo.videoBytes) {
        const byteArray = Uint8Array.from(atob(generatedVideo.videoBytes), c => c.charCodeAt(0));
        const blob = new Blob([byteArray], { type: generatedVideo.mimeType || 'video/mp4' });
        setVideoUrl(URL.createObjectURL(blob));
        setRefImageIndex(prev => (prev + 1) % validImages.length);
        return;
      }

      // uri로 반환된 경우
      if (generatedVideo.uri) {
        const videoResponse = await fetch(generatedVideo.uri, {
          method: 'GET',
          headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! },
        });
        if (!videoResponse.ok) throw new Error(`영상 다운로드 실패: ${videoResponse.status}`);
        const blob = await videoResponse.blob();
        setVideoUrl(URL.createObjectURL(blob));
        setRefImageIndex(prev => (prev + 1) % validImages.length);
        return;
      }

      throw new Error(`영상 데이터 없음: ${JSON.stringify(generatedVideo)}`);
    } catch (err: any) {
      setError("Failed to generate video: " + err.message);
    } finally {
      setIsGeneratingVideo(false);
      setGenerationStatus('');
    }
  };

  const allImagesUploaded = images.every(img => img !== null);
  const canGenerate = allImagesUploaded && storeName.trim() !== '' && businessType.trim() !== '';

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
                <p className="text-white/40 text-sm">Upload 4 key images for your product</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                    상호명, 업종 입력 및 이미지 4장 업로드 후 생성 가능합니다
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
          </div>

          {/* 우측 - 프리뷰 */}
          <div className="lg:col-span-5">
            <div className="sticky top-28 space-y-8">
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm border border-white/10">04</span>
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
