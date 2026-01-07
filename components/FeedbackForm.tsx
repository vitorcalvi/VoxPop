import React, { useState, useRef, useEffect } from 'react';
import { FeedbackItem } from '../types';
import { useI18n } from '../i18n';

const getApiBase = () => '/api';

interface Props {
  onAdd: (feedback: FeedbackItem) => void;
}

export const FeedbackForm: React.FC<Props> = ({ onAdd }) => {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHover, setDragHover] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());

  // Constants for validation
  const MAX_IMAGES = 20;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
  const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  // Analysis steps for progress tracking
  const ANALYSIS_STEPS = [
    { id: 'init', label: t('aiAnalysis.initializing'), icon: 'fa-cog' },
    { id: 'text', label: t('aiAnalysis.analyzingText'), icon: 'fa-file-lines' },
    { id: 'images', label: t('aiAnalysis.processingImages'), icon: 'fa-images' },
    { id: 'insights', label: t('aiAnalysis.generatingInsights'), icon: 'fa-lightbulb' },
    { id: 'final', label: t('aiAnalysis.finalizing'), icon: 'fa-wand-magic-sparkles' },
  ];

  // Cleanup progress interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Start progress simulation
  const startProgressSimulation = () => {
    setCurrentStep(0);
    setProgress(0);

    let step = 0;
    let prog = 0;

    progressIntervalRef.current = setInterval(() => {
      prog += Math.random() * 3 + 1;

      if (prog >= 100) {
        prog = 95;
      }

      if (prog > 20 && step === 0) step = 1;
      if (prog > 40 && step === 1) step = 2;
      if (prog > 60 && step === 2) step = 3;
      if (prog > 80 && step === 3) step = 4;

      setProgress(Math.min(prog, 95));
      setCurrentStep(step);
    }, 300);
  };

  // Stop progress simulation and complete
  const stopProgressSimulation = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgress(100);
    setCurrentStep(ANALYSIS_STEPS.length - 1);
  };

  // Compress image to reduce payload size for Vercel's 4.5MB limit
  const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // Scale down if larger than maxWidth
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to JPEG with compression (smaller than PNG)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Check total image count limit
    if (screenshots.length + files.length > MAX_IMAGES) {
      setUploadError(t('errors.maxImagesExceeded') || `Maximum of ${MAX_IMAGES} images allowed. Please remove some images first.`);
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    // Set loading state
    setUploadingFiles(new Set(files.map(f => f.name)));

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(t('errors.fileTooLarge') || `File too large. Maximum size is 5MB per file.`);
        setTimeout(() => setUploadError(null), 5000);
        setUploadingFiles(new Set());
        return;
      }

      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setUploadError(t('errors.invalidFileTypeDetailed') || 'Invalid file type. Only JPG, PNG, GIF, and WebP are supported.');
        setTimeout(() => setUploadError(null), 5000);
        setUploadingFiles(new Set());
        return;
      }

      try {
        // Compress image before storing (reduces ~80% size typically)
        const compressedImage = await compressImage(file);
        setScreenshots((prev) => [...prev, compressedImage]);
        setUploadingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(file.name);
          return newSet;
        });
      } catch (error) {
        console.error('Image compression failed:', error);
        // Fallback to original if compression fails
        const reader = new FileReader();
        reader.onloadend = () => {
          setScreenshots((prev) => [...prev, reader.result as string]);
          setUploadingFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(file.name);
            return newSet;
          });
        };
        reader.readAsDataURL(file);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeScreenshot = (indexToRemove: number) => {
    setScreenshots((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHover(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHover(false);
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHover(false);
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);

    // Check total image count limit
    if (screenshots.length + files.length > MAX_IMAGES) {
      setUploadError(t('errors.maxImagesExceeded') || `Maximum of ${MAX_IMAGES} images allowed. Please remove some images first.`);
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    // Set loading state
    setUploadingFiles(new Set(files.map(f => f.name)));

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(t('errors.fileTooLarge') || `File too large. Maximum size is 5MB per file.`);
        setTimeout(() => setUploadError(null), 5000);
        setUploadingFiles(new Set());
        return;
      }

      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setUploadError(t('errors.invalidFileTypeDetailed') || 'Invalid file type. Only JPG, PNG, GIF, and WebP are supported.');
        setTimeout(() => setUploadError(null), 5000);
        setUploadingFiles(new Set());
        return;
      }

      try {
        const compressedImage = await compressImage(file);
        setScreenshots((prev) => [...prev, compressedImage]);
        setUploadError(null);
        setUploadingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(file.name);
          return newSet;
        });
      } catch (error) {
        console.error('Image compression failed:', error);
        setUploadError(t('errors.imageProcessingFailed') || 'Failed to process image. Please try again.');
        setTimeout(() => setUploadError(null), 5000);
        setUploadingFiles(new Set());
      }
    }
  };

  // Calculate payload size in bytes
  const calculatePayloadSize = (data: object): number => {
    return new Blob([JSON.stringify(data)]).size;
  };

  // Max payload size (4MB to stay under Vercel's 4.5MB limit with margin)
  const MAX_PAYLOAD_SIZE = 4 * 1024 * 1024;

  const handleAIPostFeedback = async () => {
    if (!title || !description || isAnalyzing || isSubmitting) return;

    // Validate payload size before sending
    const payload = {
      subject: title,
      details: description,
      images: screenshots
    };

    const payloadSize = calculatePayloadSize(payload);
    const payloadSizeMB = (payloadSize / (1024 * 1024)).toFixed(2);

    console.log(`📦 Payload size: ${payloadSizeMB} MB`);

    if (payloadSize > MAX_PAYLOAD_SIZE) {
      alert(t('errors.payloadTooLarge') || `Images too large (${payloadSizeMB}MB). Please use fewer or smaller images.`);
      return;
    }

    setIsAnalyzing(true);
    setAiSummary(null);
    startProgressSimulation();

    try {
      const response = await fetch(`${getApiBase()}/ai/comprehensive-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('AI analysis failed');
      }

      const data = await response.json();
      stopProgressSimulation();
      setAiSummary(data.summary);
      setIsAnalyzed(true);

      if (data.enhancedSubject) {
        setTitle(data.enhancedSubject);
      }
      if (data.enhancedDetails) {
        setDescription(data.enhancedDetails);
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      stopProgressSimulation();
      setProgress(0);
      setCurrentStep(0);
      alert(t('errors.analysisFailed'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!isAnalyzed || !title || !description || isSubmitting) {
      if (!isAnalyzed) {
        alert(t('feedbackForm.attachScreenshotsToEnable'));
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const newFeedback: FeedbackItem = {
        id: '',
        title,
        description,
        category: 'General',
        votes: 1,
        status: 'open',
        createdAt: new Date().toISOString(),
        screenshots: screenshots.length > 0 ? screenshots : undefined
      };

      await onAdd(newFeedback);
      setTitle('');
      setDescription('');
      setScreenshots([]);
      setIsAnalyzed(false);
      setAiSummary(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-indigo-50 relative overflow-hidden z-10">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" style={{ zIndex: -1 }}></div>

      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
          <i className="fa-solid fa-plus"></i>
        </div>
        {t('feedbackForm.title')}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
            {t('feedbackForm.subjectLabel')}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 border border-gray-100 bg-gray-50/50 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:bg-white transition-all outline-none font-medium"
            placeholder={t('feedbackForm.subjectPlaceholder')}
            disabled={isSubmitting}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
            {t('feedbackForm.detailsLabel')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 border border-gray-100 bg-gray-50/50 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:bg-white transition-all outline-none font-medium resize-none"
            rows={4}
            placeholder={t('feedbackForm.detailsPlaceholder')}
            disabled={isSubmitting}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
            {t('feedbackForm.visualContextLabel')}
          </label>
          <div className="mt-2">
            {screenshots.length === 0 ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                aria-label={t('feedbackForm.attachScreenshot')}
                className={`w-full py-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 group transition-all ${
                  dragHover
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                    : 'border-gray-200 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/50'
                } ${isSubmitting || uploadingFiles.size > 0 ? 'opacity-50 cursor-wait' : ''}`}
              >
                {uploadingFiles.size > 0 ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-2xl text-indigo-500"></i>
                    <span className="text-sm font-bold text-indigo-600">
                      Processing {uploadingFiles.size} file{uploadingFiles.size !== 1 ? 's' : ''}...
                    </span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-cloud-upload text-2xl group-hover:scale-110 transition-transform"></i>
                    <span className="text-sm font-bold">
                      {dragHover
                        ? t('feedbackForm.releaseToUpload') || 'Release to upload'
                        : t('feedbackForm.attachScreenshot')}
                    </span>
                    <span className="text-xs font-medium opacity-60">{t('feedbackForm.attachDescription')}</span>
                  </>
                )}
              </div>
            ) : (
              <div className="w-full">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-3">
                  {screenshots.map((screenshot, index) => (
                    <div
                      key={index}
                      className="relative group rounded-xl overflow-hidden aspect-video bg-gray-100"
                    >
                      <img
                        src={screenshot}
                        alt={`Screenshot ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                      <button
                        type="button"
                        onClick={() => removeScreenshot(index)}
                        className="absolute top-1.5 right-1.5 bg-white/90 text-red-500 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
                      >
                        <i className="fa-solid fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-500 hover:border-indigo-500 hover:bg-indigo-50 transition-all flex items-center gap-2 text-sm font-bold"
                    disabled={isSubmitting || uploadingFiles.size > 0 || screenshots.length >= MAX_IMAGES}
                  >
                    <i className="fa-solid fa-plus"></i>
                    {t('feedbackForm.addMore')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScreenshots([]);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-4 py-2 border-2 border-gray-200 rounded-xl text-gray-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center gap-2 text-sm font-bold"
                    disabled={isSubmitting}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                    {t('feedbackForm.clearAll')}
                  </button>
                </div>
                {screenshots.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2 font-medium">
                    {t('feedbackForm.imageCounter', { count: screenshots.length })}
                  </p>
                )}
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              multiple
              className="hidden"
            />
            {uploadError && (
              <div role="alert" className="mt-2 text-xs text-red-500 font-medium animate-in fade-in duration-300">
                <i className="fa-solid fa-exclamation-circle mr-1"></i>
                {uploadError}
              </div>
            )}
          </div>
        </div>

        {/* AI Analysis Progress */}
        {isAnalyzing && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-4 animate-in fade-in duration-300">
            {/* Progress Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <i className={`fa-solid ${ANALYSIS_STEPS[currentStep].icon} text-indigo-600 animate-pulse`}></i>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-indigo-900">{t('aiAnalysis.inProgress')}</h4>
                  <p className="text-xs text-indigo-600 font-medium">{ANALYSIS_STEPS[currentStep].label}</p>
                </div>
              </div>
              <span className="text-lg font-black text-indigo-600">{Math.round(progress)}%</span>
            </div>

            {/* Progress Bar */}
            <div className="relative h-2 bg-indigo-200 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>

            {/* Step Indicators */}
            <div className="flex justify-between">
              {ANALYSIS_STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                    index <= currentStep ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all duration-300 ${
                      index < currentStep
                        ? 'bg-green-500 text-white'
                        : index === currentStep
                          ? 'bg-indigo-600 text-white ring-4 ring-indigo-200'
                          : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {index < currentStep ? (
                      <i className="fa-solid fa-check"></i>
                    ) : (
                      <i className={`fa-solid ${step.icon}`}></i>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-gray-500 hidden sm:block">
                    {step.id.charAt(0).toUpperCase() + step.id.slice(1)}
                  </span>
                </div>
              ))}
            </div>

            {/* Skeleton Loader for Expected Output */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-indigo-600 font-bold uppercase tracking-wider">
                <i className="fa-solid fa-robot"></i>
                {t('aiAnalysis.preparingSummary')}
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-indigo-200/60 rounded-full animate-pulse" style={{ width: '90%' }} />
                <div className="h-3 bg-indigo-200/60 rounded-full animate-pulse" style={{ width: '75%' }} />
                <div className="h-3 bg-indigo-200/60 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        )}

        {/* AI Summary Display */}
        {aiSummary && !isAnalyzing && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-green-700 text-xs font-black uppercase tracking-wider mb-2">
              <i className="fa-solid fa-check-circle"></i>
              {t('aiAnalysis.summaryComplete')}
            </div>
            <p className="text-sm text-green-900/70 font-medium">{aiSummary}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={isAnalyzed ? handleSubmit : handleAIPostFeedback}
            disabled={isAnalyzing || isSubmitting || uploadingFiles.size > 0 || !title || !description || screenshots.length === 0}
            className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-3 tracking-widest uppercase text-sm ${
              isAnalyzing || uploadingFiles.size > 0
                ? 'bg-indigo-300 cursor-wait text-white'
                : !title || !description || screenshots.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : isAnalyzed
                    ? 'bg-green-500 hover:bg-green-600 active:scale-[0.98] shadow-lg shadow-green-200 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-200 text-white'
            }`}
          >
            {isAnalyzing ? (
              <>
                <i className="fa-solid fa-wand-magic-sparkles animate-pulse"></i>
                {t('feedbackForm.analyzing')}
              </>
            ) : isAnalyzed ? (
              <>
                <i className="fa-solid fa-check"></i>
                {t('feedbackForm.aiPostFeedback')}
              </>
            ) : (
              <>
                <i className="fa-solid fa-robot"></i>
                {t('feedbackForm.aiPostFeedback')}
              </>
            )}
          </button>
        </div>
        <p className="text-[9px] text-center text-gray-400 font-bold uppercase tracking-wider">
          {isAnalyzed
            ? t('feedbackForm.analysisComplete')
            : screenshots.length > 0
              ? t('feedbackForm.aiWillAnalyze')
              : t('feedbackForm.attachScreenshotsToEnable')}
        </p>
      </form>
    </div>
  );
};
