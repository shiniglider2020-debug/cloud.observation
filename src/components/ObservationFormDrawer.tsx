import { Camera, LocateFixed, Loader2, ScanSearch, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  COMMON_CLASSIFICATIONS,
  ETAGES,
  WMO_GENERA,
  getEtageForGenus,
  inferAbbreviationFromTitle,
  inferGenusFromTitle,
} from '../data/wmoTaxonomy';
import type {
  CloudEtage,
  CloudIdentificationResult,
  CloudObservation,
  GeneratedObservationDraft,
  GenusCode,
  WeatherConditions,
} from '../types/cloud';
import { compressImageToDataUrl } from '../utils/csvAndImage';
import { StarRating } from './StarRating';

interface ObservationFormDrawerProps {
  isOpen: boolean;
  editingObservation: CloudObservation | null;
  defaultGenus?: GenusCode | null;
  lastObserver: string;
  existingAlbums: string[];
  onClose: () => void;
  onSave: (observation: CloudObservation) => void;
  onDraftChange?: (
    draft: {
      field: string;
      title: string;
      abbreviation: string;
      notes: string;
      author?: string;
    } | null
  ) => void;
}

function getCurrentLocalDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

export function ObservationFormDrawer({
  isOpen,
  editingObservation,
  defaultGenus,
  lastObserver,
  existingAlbums,
  onClose,
  onSave,
  onDraftChange,
}: ObservationFormDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [genusCode, setGenusCode] = useState<GenusCode>('Cu');
  const [etage, setEtage] = useState<CloudEtage>('Low (CL < 2 km)');
  const [observedAt, setObservedAt] = useState(getCurrentLocalDateTime());
  const [observer, setObserver] = useState(lastObserver);
  const [location, setLocation] = useState('');
  const [album, setAlbum] = useState('');
  const [oktas, setOktas] = useState<number | null>(null);
  const [altitudeEstimate, setAltitudeEstimate] = useState('');
  const [rating, setRating] = useState(3);
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  // Surface Weather Conditions
  const [tempInput, setTempInput] = useState('');
  const [humidityInput, setHumidityInput] = useState('');
  const [windSpeedInput, setWindSpeedInput] = useState('');
  const [windDirInput, setWindDirInput] = useState('');
  const [pressureInput, setPressureInput] = useState('');
  const [weatherSource, setWeatherSource] = useState<'auto' | 'manual'>('manual');
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // AI Assistant Controls
  const [aiPrompt, setAiPrompt] = useState('');
  const [genNameAndAbbr, setGenNameAndAbbr] = useState(true);
  const [genFields, setGenFields] = useState(true);
  const [genPicture, setGenPicture] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!onDraftChange) return;
    if (!isOpen) {
      onDraftChange(null);
      return;
    }
    onDraftChange({
      field: editingObservation ? 'Editing Entry' : 'New Observation',
      title,
      abbreviation,
      notes: description,
      author: observer.trim() || lastObserver,
    });
  }, [isOpen, editingObservation, title, abbreviation, description, observer, lastObserver, onDraftChange]);

  useEffect(() => {
    if (!isOpen) return;
    setAiError(null);
    setFormError(null);
    setWeatherError(null);
    setAiPrompt('');

    if (editingObservation) {
      setTitle(editingObservation.title);
      setAbbreviation(
        editingObservation.abbreviation ||
          inferAbbreviationFromTitle(editingObservation.title, editingObservation.genusCode)
      );
      setGenusCode(editingObservation.genusCode);
      setEtage(editingObservation.etage);
      setObservedAt(editingObservation.observedAt);
      setObserver(editingObservation.observer);
      setLocation(editingObservation.location);
      setAlbum(editingObservation.album || '');
      setOktas(editingObservation.oktas);
      setAltitudeEstimate(editingObservation.altitudeEstimate);
      setRating(editingObservation.rating);
      setDescription(editingObservation.description);
      setPhotoDataUrl(editingObservation.photoDataUrl);
      const w = editingObservation.weather;
      setTempInput(w?.temperatureC !== null && w?.temperatureC !== undefined ? String(w.temperatureC) : '');
      setHumidityInput(w?.humidityPct !== null && w?.humidityPct !== undefined ? String(w.humidityPct) : '');
      setWindSpeedInput(w?.windSpeedKmh !== null && w?.windSpeedKmh !== undefined ? String(w.windSpeedKmh) : '');
      setWindDirInput(w?.windDirection || '');
      setPressureInput(w?.pressureHpa !== null && w?.pressureHpa !== undefined ? String(w.pressureHpa) : '');
      setWeatherSource(w?.source || 'manual');
    } else if (defaultGenus) {
      const genusDef = WMO_GENERA.find((g) => g.code === defaultGenus);
      const nextTitle = genusDef ? genusDef.latinName : '';
      setTitle(nextTitle);
      setAbbreviation(defaultGenus);
      setGenusCode(defaultGenus);
      setEtage(getEtageForGenus(defaultGenus));
      setObservedAt(getCurrentLocalDateTime());
      setObserver(lastObserver);
      setLocation('');
      setAlbum('');
      setOktas(null);
      setAltitudeEstimate(genusDef ? genusDef.altitudeRange : '');
      setRating(3);
      setDescription('');
      setPhotoDataUrl(null);
      setTempInput('');
      setHumidityInput('');
      setWindSpeedInput('');
      setWindDirInput('');
      setPressureInput('');
      setWeatherSource('manual');
    } else {
      setTitle('');
      setAbbreviation('');
      setGenusCode('Unknown');
      setEtage('Unclassified');
      setObservedAt(getCurrentLocalDateTime());
      setObserver(lastObserver);
      setLocation('');
      setAlbum('');
      setOktas(null);
      setAltitudeEstimate('');
      setRating(3);
      setDescription('');
      setPhotoDataUrl(null);
      setTempInput('');
      setHumidityInput('');
      setWindSpeedInput('');
      setWindDirInput('');
      setPressureInput('');
      setWeatherSource('manual');
    }
  }, [isOpen, editingObservation, defaultGenus, lastObserver]);

  if (!isOpen) return null;

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    const inferred = inferGenusFromTitle(nextTitle);
    if (inferred.genusCode !== 'Unknown') {
      setGenusCode(inferred.genusCode);
      setEtage(inferred.etage);
    }
    const inferredAbbr = inferAbbreviationFromTitle(nextTitle, inferred.genusCode);
    if (inferredAbbr) {
      setAbbreviation(inferredAbbr);
    }
  };

  const handleGenusChange = (nextGenus: GenusCode) => {
    setGenusCode(nextGenus);
    setEtage(getEtageForGenus(nextGenus));
    if (!abbreviation.trim() && nextGenus !== 'Unknown') {
      setAbbreviation(nextGenus);
    }
  };

  const handleFetchLocalWeather = () => {
    if (!navigator.geolocation) {
      setWeatherError('Geolocation is not supported by this browser. Enter weather manually below.');
      return;
    }

    setIsFetchingWeather(true);
    setWeatherError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const response = await fetch(
            `/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
          );
          const data = (await response.json()) as WeatherConditions & { error?: string };
          if (!response.ok) {
            throw new Error(data.error || 'Failed to retrieve local weather telemetry.');
          }

          if (data.temperatureC !== null && data.temperatureC !== undefined) {
            setTempInput(String(data.temperatureC));
          }
          if (data.humidityPct !== null && data.humidityPct !== undefined) {
            setHumidityInput(String(data.humidityPct));
          }
          if (data.windSpeedKmh !== null && data.windSpeedKmh !== undefined) {
            setWindSpeedInput(String(data.windSpeedKmh));
          }
          if (data.windDirection) {
            setWindDirInput(data.windDirection);
          }
          if (data.pressureHpa !== null && data.pressureHpa !== undefined) {
            setPressureInput(String(data.pressureHpa));
          }
          setWeatherSource('auto');

          if (!location.trim()) {
            setLocation(`${lat.toFixed(3)}, ${lon.toFixed(3)}`);
          }
        } catch (err) {
          setWeatherError(
            err instanceof Error ? err.message : 'Unable to fetch local weather conditions.'
          );
        } finally {
          setIsFetchingWeather(false);
        }
      },
      (geoErr) => {
        setIsFetchingWeather(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setWeatherError(
            'Location permission was denied. Enable location access or enter surface weather manually.'
          );
        } else {
          setWeatherError(
            'Unable to determine current coordinates. You can enter surface weather manually.'
          );
        }
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const handleClearWeather = () => {
    setTempInput('');
    setHumidityInput('');
    setWindSpeedInput('');
    setWindDirInput('');
    setPressureInput('');
    setWeatherSource('manual');
    setWeatherError(null);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiError(null);
    try {
      const compressed = await compressImageToDataUrl(file);
      setPhotoDataUrl(compressed);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to process selected image.');
    }
  };

  const handleAiGenerate = async () => {
    if (!genNameAndAbbr && !genFields && !genPicture) {
      setAiError('Select at least one output (Name & Abbreviation, Fields, or Picture) to generate.');
      return;
    }
    setIsGeneratingAi(true);
    setAiError(null);
    try {
      const response = await fetch('/api/generate-observation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          existingTitle: title.trim(),
          existingDescription: description.trim(),
          generateNameAndAbbr: genNameAndAbbr,
          generateFields: genFields,
          generatePicture: genPicture,
        }),
      });
      const data = (await response.json()) as GeneratedObservationDraft & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'AI generation failed.');
      }

      if (data.title) setTitle(data.title);
      if (data.abbreviation) setAbbreviation(data.abbreviation);
      if (data.genusCode) setGenusCode(data.genusCode);
      if (data.etage) setEtage(data.etage);
      if (typeof data.oktas === 'number') setOktas(Math.min(8, Math.max(0, data.oktas)));
      if (data.altitudeEstimate) setAltitudeEstimate(data.altitudeEstimate);
      if (data.album && !album.trim()) setAlbum(data.album);
      if (typeof data.rating === 'number') setRating(Math.min(5, Math.max(0, Math.round(data.rating))));
      if (data.description) setDescription(data.description);
      if (data.photoDataUrl) setPhotoDataUrl(data.photoDataUrl);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate observation details.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleAnalyzePhotoWithAi = async () => {
    if (!photoDataUrl) return;
    setIsAnalyzingPhoto(true);
    setAiError(null);
    try {
      const mimeMatch = photoDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      const response = await fetch('/api/identify-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: photoDataUrl,
          mimeType,
          notes: description,
        }),
      });
      const data = (await response.json()) as CloudIdentificationResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to classify sky photograph.');
      }

      if (data.title) setTitle(data.title);
      if (data.abbreviation) setAbbreviation(data.abbreviation);
      if (data.genusCode) setGenusCode(data.genusCode);
      if (data.etage) setEtage(data.etage);
      if (typeof data.oktas === 'number') setOktas(Math.min(8, Math.max(0, data.oktas)));
      if (data.altitudeEstimate) setAltitudeEstimate(data.altitudeEstimate);
      if (data.description) setDescription(data.description);
      if (typeof data.suggestedRating === 'number') {
        setRating(Math.min(5, Math.max(0, Math.round(data.suggestedRating))));
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to classify sky photograph.');
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('Please enter a cloud classification or observation title.');
      return;
    }

    const parsedTemp = tempInput.trim() !== '' && !Number.isNaN(Number(tempInput)) ? Number(tempInput) : null;
    const parsedHumidity =
      humidityInput.trim() !== '' && !Number.isNaN(Number(humidityInput))
        ? Math.min(100, Math.max(0, Number(humidityInput)))
        : null;
    const parsedWindSpeed =
      windSpeedInput.trim() !== '' && !Number.isNaN(Number(windSpeedInput))
        ? Math.max(0, Number(windSpeedInput))
        : null;
    const parsedPressure =
      pressureInput.trim() !== '' && !Number.isNaN(Number(pressureInput))
        ? Number(pressureInput)
        : null;
    const trimmedWindDir = windDirInput.trim();

    const hasWeather =
      parsedTemp !== null ||
      parsedHumidity !== null ||
      parsedWindSpeed !== null ||
      Boolean(trimmedWindDir) ||
      parsedPressure !== null;

    const weather: WeatherConditions | null = hasWeather
      ? {
          temperatureC: parsedTemp,
          humidityPct: parsedHumidity,
          windSpeedKmh: parsedWindSpeed,
          windDirection: trimmedWindDir,
          pressureHpa: parsedPressure,
          source: weatherSource,
        }
      : null;

    const now = new Date().toISOString();
    const record: CloudObservation = {
      id: editingObservation?.id ?? `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: trimmedTitle,
      abbreviation:
        abbreviation.trim() || inferAbbreviationFromTitle(trimmedTitle, genusCode),
      genusCode,
      etage,
      observedAt: observedAt || getCurrentLocalDateTime(),
      observer: observer.trim() || '-',
      location: location.trim(),
      album: album.trim(),
      oktas,
      altitudeEstimate: altitudeEstimate.trim(),
      weather,
      rating,
      description: description.trim(),
      photoDataUrl,
      createdAt: editingObservation?.createdAt ?? now,
    };

    onSave(record);
    onClose();
  };

  const hasAnyWeatherInput = Boolean(
    tempInput || humidityInput || windSpeedInput || windDirInput || pressureInput
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="observation-drawer-title"
    >
      <div className="flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2
              id="observation-drawer-title"
              className="font-display text-base font-semibold text-slate-900"
            >
              {editingObservation ? 'Edit Cloud Observation' : 'New Cloud Observation'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Log WMO cloud taxonomy, surface weather conditions, and visual plates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close observation form"
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {formError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
              {formError}
            </div>
          )}

          {/* On-Demand AI Observation Generator */}
          <section className="space-y-3 rounded-md border border-sky-200 bg-sky-50/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-900">
                <Sparkles className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />
                AI Observation Assistant
              </span>
              <span className="text-[11px] text-sky-800/80">On-demand generation</span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe sky (e.g., golden hour Kelvin-Helmholtz wave cloud)..."
                aria-label="Prompt for AI observation generator"
                className="flex-1 rounded-md border border-sky-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              <button
                type="button"
                disabled={isGeneratingAi}
                onClick={handleAiGenerate}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-sky-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Generate with AI
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-700">
              <label className="inline-flex cursor-pointer items-center gap-1.5 select-none">
                <input
                  type="checkbox"
                  checked={genNameAndAbbr}
                  onChange={(e) => setGenNameAndAbbr(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                />
                Cloud Name &amp; Abbreviation
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 select-none">
                <input
                  type="checkbox"
                  checked={genFields}
                  onChange={(e) => setGenFields(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                />
                Oktas, Altitude &amp; Notes
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 select-none">
                <input
                  type="checkbox"
                  checked={genPicture}
                  onChange={(e) => setGenPicture(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                />
                Sky Picture (Illustration)
              </label>
            </div>
          </section>

          {/* Sky Photo Capture + AI Classification */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Sky Photograph / Visual Plate
              </label>
              {photoDataUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(null)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  Remove picture
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelected}
              className="hidden"
            />

            {photoDataUrl ? (
              <div className="mt-2 space-y-2.5">
                <div className="aspect-[16/10] w-full overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                  <img
                    src={photoDataUrl}
                    alt="Sky observation visual plate"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Replace Photo
                  </button>
                  <button
                    type="button"
                    disabled={isAnalyzingPhoto}
                    onClick={handleAnalyzePhotoWithAi}
                    className="inline-flex items-center gap-1.5 rounded-md border border-sky-700 bg-white px-3.5 py-1.5 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-50 disabled:opacity-60 whitespace-nowrap"
                  >
                    {isAnalyzingPhoto ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        Identifying...
                      </>
                    ) : (
                      <>
                        <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />
                        Identify Cloud from Photo
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 flex w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition-colors hover:border-sky-500 hover:bg-sky-50/40"
              >
                <Camera className="h-5 w-5 text-slate-400" aria-hidden="true" />
                <span className="text-xs font-medium text-slate-700">
                  Upload sky photograph (or check &ldquo;Sky Picture&rdquo; above for AI)
                </span>
              </button>
            )}

            {aiError && (
              <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {aiError}
              </div>
            )}
          </div>

          {/* Title & WMO Abbreviation */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="obs-title" className="block text-xs font-semibold text-slate-700">
                Title (WMO Cloud Name) <span className="text-rose-600">*</span>
              </label>
              <input
                id="obs-title"
                type="text"
                list="wmo-classification-suggestions"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Cumulus humilis radiatus"
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              <datalist id="wmo-classification-suggestions">
                {COMMON_CLASSIFICATIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="obs-abbr" className="block text-xs font-semibold text-slate-700">
                Abbreviation
              </label>
              <input
                id="obs-abbr"
                type="text"
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value)}
                placeholder="e.g. Cu hum ra"
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
          </div>

          {/* Genus & Étage */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="obs-genus" className="block text-xs font-semibold text-slate-700">
                WMO Genus Code
              </label>
              <select
                id="obs-genus"
                value={genusCode}
                onChange={(e) => handleGenusChange(e.target.value as GenusCode)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              >
                {WMO_GENERA.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.code} — {g.latinName}
                  </option>
                ))}
                <option value="Unknown">Unknown / Unclassified</option>
              </select>
            </div>

            <div>
              <label htmlFor="obs-etage" className="block text-xs font-semibold text-slate-700">
                Atmospheric Étage
              </label>
              <select
                id="obs-etage"
                value={etage}
                onChange={(e) => setEtage(e.target.value as CloudEtage)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              >
                {ETAGES.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date & Observer */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="obs-date" className="block text-xs font-semibold text-slate-700">
                Observation Date &amp; Time
              </label>
              <input
                id="obs-date"
                type="datetime-local"
                value={observedAt}
                onChange={(e) => setObservedAt(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>

            <div>
              <label htmlFor="obs-observer" className="block text-xs font-semibold text-slate-700">
                Observer (Person)
              </label>
              <input
                id="obs-observer"
                type="text"
                value={observer}
                onChange={(e) => setObserver(e.target.value)}
                placeholder="e.g. Atlas Kaytser"
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
          </div>

          {/* Location & Album */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="obs-location" className="block text-xs font-semibold text-slate-700">
                Location / Station
              </label>
              <input
                id="obs-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Khet Huai Khwang"
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>

            <div>
              <label htmlFor="obs-album" className="block text-xs font-semibold text-slate-700">
                Photo Album (Collection)
              </label>
              <input
                id="obs-album"
                type="text"
                list="existing-albums-list"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="e.g. Dawn Wave Series"
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              <datalist id="existing-albums-list">
                {existingAlbums.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Surface Weather Conditions (Optional Manual or Geolocation Auto-Fetch) */}
          <section className="space-y-3 rounded-md border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-800">
                  Surface Weather Conditions (Optional)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Fetch current telemetry via location services or enter manually.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasAnyWeatherInput && (
                  <button
                    type="button"
                    onClick={handleClearWeather}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  disabled={isFetchingWeather}
                  onClick={handleFetchLocalWeather}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-600 hover:text-sky-700 disabled:opacity-60 whitespace-nowrap"
                >
                  {isFetchingWeather ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
                      Fetch Local Weather
                    </>
                  )}
                </button>
              </div>
            </div>

            {weatherError && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                {weatherError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="wx-temp" className="block text-[11px] font-medium text-slate-600">
                  Temp (°C)
                </label>
                <input
                  id="wx-temp"
                  type="number"
                  step="0.1"
                  value={tempInput}
                  onChange={(e) => {
                    setTempInput(e.target.value);
                    setWeatherSource('manual');
                  }}
                  placeholder="e.g. 28.4"
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="wx-rh" className="block text-[11px] font-medium text-slate-600">
                  Humidity (%)
                </label>
                <input
                  id="wx-rh"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={humidityInput}
                  onChange={(e) => {
                    setHumidityInput(e.target.value);
                    setWeatherSource('manual');
                  }}
                  placeholder="e.g. 68"
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="wx-press" className="block text-[11px] font-medium text-slate-600">
                  Pressure (hPa)
                </label>
                <input
                  id="wx-press"
                  type="number"
                  step="0.1"
                  value={pressureInput}
                  onChange={(e) => {
                    setPressureInput(e.target.value);
                    setWeatherSource('manual');
                  }}
                  placeholder="e.g. 1012.4"
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="wx-wind" className="block text-[11px] font-medium text-slate-600">
                  Wind Speed (km/h)
                </label>
                <input
                  id="wx-wind"
                  type="number"
                  min="0"
                  step="0.1"
                  value={windSpeedInput}
                  onChange={(e) => {
                    setWindSpeedInput(e.target.value);
                    setWeatherSource('manual');
                  }}
                  placeholder="e.g. 14.5"
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div className="col-span-2 sm:col-span-2">
                <label htmlFor="wx-dir" className="block text-[11px] font-medium text-slate-600">
                  Wind Direction
                </label>
                <input
                  id="wx-dir"
                  type="text"
                  value={windDirInput}
                  onChange={(e) => {
                    setWindDirInput(e.target.value);
                    setWeatherSource('manual');
                  }}
                  placeholder="e.g. 225° SW"
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Base Altitude & Rating */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="obs-altitude" className="block text-xs font-semibold text-slate-700">
                Est. Cloud Base Altitude
              </label>
              <input
                id="obs-altitude"
                type="text"
                value={altitudeEstimate}
                onChange={(e) => setAltitudeEstimate(e.target.value)}
                placeholder="e.g. 1,200 m"
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Rating (0–5)
              </label>
              <div className="mt-2 flex h-8 items-center">
                <StarRating value={rating} onChange={setRating} size="md" />
              </div>
            </div>
          </div>

          {/* Oktas */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Sky Cover (Oktas 0–8)
              </label>
              {oktas !== null && (
                <button
                  type="button"
                  onClick={() => setOktas(null)}
                  className="text-[11px] text-slate-500 hover:text-slate-800"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mt-1.5 grid grid-cols-9 gap-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((val) => {
                const active = oktas === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setOktas(val)}
                    className={`rounded border py-1.5 font-mono text-xs font-medium tabular-nums transition-colors ${
                      active
                        ? 'border-sky-700 bg-sky-700 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="obs-desc" className="block text-xs font-semibold text-slate-700">
              Field Description &amp; Synoptic Notes
            </label>
            <textarea
              id="obs-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe morphology, alignment (radiatus/undulatus), optical thickness, or observed transformations..."
              className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-sky-700 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap"
            >
              {editingObservation ? 'Save Changes' : 'Add Observation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
