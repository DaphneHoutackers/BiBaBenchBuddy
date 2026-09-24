import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, Clock } from 'lucide-react';
import CopyImageButton from '@/components/shared/CopyImageButton';

const POLYMERASES = {
  'Phusion High-Fidelity': {
    label: 'Phusion High-Fidelity',
    buffer: '5× Phusion HF Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    initDenatTemp: 98,
    defaultInitDenat: '00:30',
    cycleDenatTemp: 98,
    cycleDenatSecs: 10,
    cycleExtTemp: 72,
  },
  'Q5 High-Fidelity': {
    label: 'Q5 High-Fidelity',
    buffer: '5× Q5 Reaction Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    initDenatTemp: 98,
    defaultInitDenat: '00:30',
    cycleDenatTemp: 98,
    cycleDenatSecs: 10,
    cycleExtTemp: 72,
  },
  'PrimeSTAR GXL': {
    label: 'PrimeSTAR GXL',
    buffer: '5× PrimeSTAR GXL Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    initDenatTemp: 98,
    defaultInitDenat: '01:00',
    cycleDenatTemp: 98,
    cycleDenatSecs: 10,
    cycleExtTemp: 68,
  },
  'KAPA HiFi': {
    label: 'KAPA HiFi',
    buffer: '5× KAPA HiFi Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    initDenatTemp: 95,
    defaultInitDenat: '03:00',
    cycleDenatTemp: 98,
    cycleDenatSecs: 20,
    cycleExtTemp: 72,
  },
  'Platinum SuperFi II': {
    label: 'Platinum SuperFi II',
    buffer: '5× SuperFi II Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    initDenatTemp: 98,
    defaultInitDenat: '00:30',
    cycleDenatTemp: 98,
    cycleDenatSecs: 10,
    cycleExtTemp: 72,
  },
  'Taq Polymerase': {
    label: 'Taq Polymerase',
    buffer: '10× Taq Buffer',
    bufferX: 10,
    dntpFinal: 0.2,
    initDenatTemp: 95,
    defaultInitDenat: '03:00',
    cycleDenatTemp: 95,
    cycleDenatSecs: 30,
    cycleExtTemp: 72,
  },
  'OneTaq': {
    label: 'OneTaq',
    buffer: '5× OneTaq Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    initDenatTemp: 94,
    defaultInitDenat: '00:30',
    cycleDenatTemp: 94,
    cycleDenatSecs: 30,
    cycleExtTemp: 68,
  },
  'DreamTaq': {
    label: 'DreamTaq',
    buffer: '10× DreamTaq Buffer',
    bufferX: 10,
    dntpFinal: 0.2,
    initDenatTemp: 95,
    defaultInitDenat: '03:00',
    cycleDenatTemp: 95,
    cycleDenatSecs: 30,
    cycleExtTemp: 72,
  },
  'Pfu Polymerase': {
    label: 'Pfu Polymerase',
    buffer: '10× Pfu Buffer',
    bufferX: 10,
    dntpFinal: 0.2,
    initDenatTemp: 95,
    defaultInitDenat: '03:00',
    cycleDenatTemp: 95,
    cycleDenatSecs: 30,
    cycleExtTemp: 72,
  },
};

const EXTENSION_SPEEDS = {
  'Q5 High-Fidelity': { simple: 10, complex: 30 },
  'Phusion High-Fidelity': { simple: 15, complex: 30 },
  'PrimeSTAR GXL': { simple: 5, complex: 20 },
  'KAPA HiFi': { simple: 15, complex: 30 },
  'Platinum SuperFi II': { simple: 15, complex: 30 },
  'Taq Polymerase': { simple: 60, complex: 60 },
  'OneTaq': { simple: 60, complex: 60 },
  'DreamTaq': { simple: 60, complex: 60 },
  'Pfu Polymerase': { simple: 120, complex: 120 },
};

function formatTime(sec) {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  if (parts.length === 2) {
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }
  return parseInt(timeStr, 10) || 0;
}

function NumInput({ value, onChange, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = e => e.preventDefault();
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const handleChange = (e) => {
    if (props.type === "number") {
      if (onChange) onChange(e);
      return;
    }
    const el = e.target;
    const originalValue = el.value;
    const originalSelStart = el.selectionStart;
    let cleaned = originalValue.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    const diff = cleaned.length - originalValue.length;
    if (onChange) {
      onChange({ ...e, target: { ...e.target, value: cleaned } });
    }
    if (originalSelStart !== null) {
      requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.setSelectionRange(originalSelStart + diff, originalSelStart + diff);
        }
      });
    }
  };

  return <Input ref={ref} type={props.type || "text"} inputMode={props.type === "number" ? undefined : "decimal"} value={value} onChange={handleChange} {...props} />;
}

export default function PCRProgram({ historyData }) {
  const programTableRef = useRef(null);

  const [isRestoring, setIsRestoring] = useState(false);

  const [polymerase, setPolymerase] = useState(() => localStorage.getItem('bbb_pcrprog_poly') || localStorage.getItem('bbb_pcr_poly') || 'Phusion High-Fidelity');
  const [templateType, setTemplateType] = useState(() => localStorage.getItem('bbb_pcrprog_templatetype') || 'simple');
  const [productLength, setProductLength] = useState(() => localStorage.getItem('bbb_pcrprog_length') || '1000');
  const [initDenatCustom, setInitDenatCustom] = useState(() => localStorage.getItem('bbb_pcrprog_initdenat') || '');
  const [finalExtCustom, setFinalExtCustom] = useState(() => localStorage.getItem('bbb_pcrprog_finalext') || '05:00');
  const [annealTimeCustom, setAnnealTimeCustom] = useState(() => localStorage.getItem('bbb_pcrprog_annealtime') || '00:30');
  const [annealTemp, setAnnealTemp] = useState(() => localStorage.getItem('bbb_pcrprog_annealtemp') || '60');
  const [cycleCount, setCycleCount] = useState(() => localStorage.getItem('bbb_pcrprog_cycles') || '30');
  const [customExtensionTime, setCustomExtensionTime] = useState(() => localStorage.getItem('bbb_pcrprog_custext') || '');

  const [copiedProgram, setCopiedProgram] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    if (!isRestoring) {
      localStorage.setItem('bbb_pcrprog_poly', polymerase);
      localStorage.setItem('bbb_pcr_poly', polymerase); // Also sync with PCR Mix
      localStorage.setItem('bbb_pcrprog_templatetype', templateType);
      localStorage.setItem('bbb_pcrprog_length', productLength);
      localStorage.setItem('bbb_pcrprog_initdenat', initDenatCustom);
      localStorage.setItem('bbb_pcrprog_finalext', finalExtCustom);
      localStorage.setItem('bbb_pcrprog_annealtime', annealTimeCustom);
      localStorage.setItem('bbb_pcrprog_annealtemp', annealTemp);
      localStorage.setItem('bbb_pcrprog_cycles', cycleCount);
      localStorage.setItem('bbb_pcrprog_custext', customExtensionTime);
    }
  }, [
    polymerase, templateType, productLength, initDenatCustom,
    finalExtCustom, annealTimeCustom, annealTemp, cycleCount,
    customExtensionTime, isRestoring
  ]);

  // Restore from history
  useEffect(() => {
    if (historyData && (historyData.toolId === 'pcr' || historyData.toolId === 'pcr_program')) {
      const d = historyData.data;
      if (d) {
        setIsRestoring(true);
        if (d.polymerase) setPolymerase(d.polymerase);
        if (d.templateType) setTemplateType(d.templateType);
        if (d.productLength) setProductLength(String(d.productLength));
        if (d.initDenatCustom !== undefined) setInitDenatCustom(d.initDenatCustom);
        if (d.finalExtCustom !== undefined) setFinalExtCustom(d.finalExtCustom);
        if (d.annealTimeCustom !== undefined) setAnnealTimeCustom(d.annealTimeCustom);
        if (d.annealTemp !== undefined) setAnnealTemp(String(d.annealTemp));
        if (d.cycleCount !== undefined) setCycleCount(String(d.cycleCount));
        if (d.customExtensionTime !== undefined) setCustomExtensionTime(d.customExtensionTime);
        setTimeout(() => setIsRestoring(false), 50);
      }
    }
  }, [historyData]);

  // Polymerase profile calculations
  const polyProfile = POLYMERASES[polymerase] || POLYMERASES['Phusion High-Fidelity'];
  const isHighFid = ['Phusion High-Fidelity', 'Q5 High-Fidelity', 'PrimeSTAR GXL', 'KAPA HiFi', 'Platinum SuperFi II'].includes(polymerase);
  
  const initDenatTemp = polyProfile.initDenatTemp || (isHighFid ? 98 : 95);
  const cycleDenatTemp = polyProfile.cycleDenatTemp || (isHighFid ? 98 : 95);
  const cycleDenatSecs = polyProfile.cycleDenatSecs || (isHighFid ? 10 : 30);
  const cycleExtTemp = polyProfile.cycleExtTemp || 72;

  // Auto extension time calculation based on length and speed
  const speedObj = EXTENSION_SPEEDS[polymerase] || { simple: 15, complex: 30 };
  const extensionSpeed = templateType === 'complex' ? speedObj.complex : speedObj.simple;
  const bpLength = parseFloat(productLength) || 0;
  const autoExtensionSecs = bpLength > 0 ? Math.max(1, Math.ceil((bpLength / 1000) * extensionSpeed)) : 0;
  const autoExtensionStr = formatTime(autoExtensionSecs);

  const prevAutoExtensionStr = useRef(autoExtensionStr);

  useEffect(() => {
    if (!customExtensionTime || customExtensionTime === prevAutoExtensionStr.current) {
      setCustomExtensionTime(autoExtensionStr);
    }
    prevAutoExtensionStr.current = autoExtensionStr;
  }, [autoExtensionStr]);

  const customTimeVal = customExtensionTime && customExtensionTime !== autoExtensionStr ? parseTimeToSeconds(customExtensionTime) : null;
  const extTimeSecs = customTimeVal !== null ? customTimeVal : autoExtensionSecs;

  const initDenatTime = initDenatCustom || polyProfile.defaultInitDenat || (isHighFid ? '00:30' : '03:00');
  const cycleDenatTime = formatTime(cycleDenatSecs);
  const cycleAnnealTime = annealTimeCustom || '00:30';
  const finalExtTime = finalExtCustom || '05:00';
  const cycles = parseInt(cycleCount, 10) || 30;

  // Total program duration
  const totalCycleSecs = (cycleDenatSecs + parseTimeToSeconds(cycleAnnealTime) + extTimeSecs) * cycles;
  const totalProgramSecs = parseTimeToSeconds(initDenatTime) + totalCycleSecs + parseTimeToSeconds(finalExtTime);

  const formatTotalDuration = (totalSecs) => {
    if (!totalSecs || totalSecs <= 0) return '0m 0s';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const totalDurationStr = formatTotalDuration(totalProgramSecs);

  const copyProgramProtocol = () => {
    const text = `PCR Program Protocol
Polymerase: ${polymerase}
Template: ${templateType === 'complex' ? 'Complex / genomic DNA' : 'Simple / non-genomic DNA'}
Product Size: ${productLength || '0'} bp
Extension Speed: ${extensionSpeed} s/kb

Program:
1. Initial Denaturation: ${initDenatTemp}°C for ${initDenatTime} (1x)
2. Cycling (${cycles} Cycles):
   - Denaturation: ${cycleDenatTemp}°C for ${cycleDenatTime}
   - Annealing: ${annealTemp}°C for ${cycleAnnealTime}
   - Extension: ${cycleExtTemp}°C for ${formatTime(extTimeSecs)}
3. Final Extension: ${cycleExtTemp}°C for ${finalExtTime} (1x)
4. Hold: 4°C (∞)
Est. Duration: ${totalDurationStr}`;

    navigator.clipboard.writeText(text);
    setCopiedProgram(true);
    setTimeout(() => setCopiedProgram(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Program Settings */}
        <div className="space-y-4">
          <Card className="border-t border-slate-100 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/40 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">Program Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Row 1: Polymerase & DNA Template Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-1">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600 dark:text-slate-300">Polymerase</Label>
                  <Select value={polymerase} onValueChange={setPolymerase}>
                    <SelectTrigger className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(POLYMERASES).map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600 dark:text-slate-300">DNA Template Type</Label>
                  <Select value={templateType} onValueChange={setTemplateType}>
                    <SelectTrigger className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Simple / non-genomic DNA</SelectItem>
                      <SelectItem value="complex">Complex / genomic DNA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Product Length & Cycles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-1">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600 dark:text-slate-300">Product Length (bp)</Label>
                  <div className="flex items-center gap-1.5">
                    <NumInput 
                      value={productLength} 
                      onChange={e => setProductLength(e.target.value)} 
                      placeholder="e.g. 1000" 
                      className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-normal" 
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">bp</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600 dark:text-slate-300">Cycles</Label>
                  <div className="flex items-center gap-1.5">
                    <NumInput 
                      value={cycleCount} 
                      onChange={e => setCycleCount(e.target.value)} 
                      placeholder="30" 
                      className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-normal" 
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">x</span>
                  </div>
                </div>
              </div>

              {/* Row 3: Initial Denaturation, Final Extension, Annealing Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-0">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600 dark:text-slate-300">Initial Denaturation</Label>
                  <Input 
                    value={initDenatCustom} 
                    onChange={e => setInitDenatCustom(e.target.value)} 
                    placeholder={polyProfile.defaultInitDenat || '00:30'} 
                    className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-normal" 
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600 dark:text-slate-300">Final Extension</Label>
                  <Input 
                    value={finalExtCustom} 
                    onChange={e => setFinalExtCustom(e.target.value)} 
                    placeholder="05:00" 
                    className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-normal" 
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600 dark:text-slate-300">Annealing Time</Label>
                  <Input 
                    value={annealTimeCustom} 
                    onChange={e => setAnnealTimeCustom(e.target.value)} 
                    placeholder="00:30" 
                    className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-normal" 
                  />
                </div>
              </div>

              {/* Row 4: Annealing Temp & Custom Extension Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600 dark:text-slate-300">Annealing Temp (°C)</Label>
                  <NumInput 
                    value={annealTemp} 
                    onChange={e => setAnnealTemp(e.target.value)} 
                    placeholder="60" 
                    className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-normal" 
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600 dark:text-slate-300">Extension Time</Label>
                  <Input 
                    value={customExtensionTime} 
                    onChange={e => setCustomExtensionTime(e.target.value)} 
                    onBlur={() => {
                      if (!customExtensionTime.trim()) {
                        setCustomExtensionTime(autoExtensionStr);
                      }
                    }}
                    placeholder={autoExtensionStr} 
                    className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-normal" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: PCR Program Display */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" /> PCR Program
                </CardTitle>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={copyProgramProtocol} 
                    className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {copiedProgram ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copiedProgram ? 'Copied!' : 'Copy'}
                  </button>
                  <CopyImageButton targetRef={programTableRef} label="Copy Image" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div ref={programTableRef} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 p-0">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-400/100 dark:bg-slate-800/40 border-b border-slate-300 dark:border-slate-700 text-[13px] text-white dark:text-white font-bold">
                      <th className="py-2.5 px-3">Step</th>
                      <th className="py-2.5 px-3 text-right">Temp</th>
                      <th className="py-2.5 px-3 text-right">Time</th>
                      <th className="py-2.5 px-3 text-center">Cycles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                    <tr className="bg-slate-100/50 dark:bg-slate-800/40">
                      <td className="py-2.5 px-3 pl-5">Initial Denaturation</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{initDenatTemp}°C</td>
                      <td className="py-2.5 px-3 text-right font-bold">{initDenatTime}</td>
                      <td className="py-2.5 px-3 text-center font-bold">1x</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 pl-5">Denaturation</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{cycleDenatTemp}°C</td>
                      <td className="py-2.5 px-3 text-right font-bold">{cycleDenatTime}</td>
                      <td className="py-2.5 px-3 text-center font-bold" rowSpan={3}>{cycles}x</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 pl-5">Annealing</td>
                      <td className="py-2.5 px-3 text-right font-bold text-red-600 dark:text-red-400">{annealTemp}°C</td>
                      <td className="py-2.5 px-3 text-right font-bold">{cycleAnnealTime}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 pl-5">Extension</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{cycleExtTemp}°C</td>
                      <td className="py-2.5 px-3 text-right font-bold text-red-600 dark:text-red-400">{formatTime(extTimeSecs)}</td>
                    </tr>
                    <tr className="bg-slate-100/50 dark:bg-slate-800/40">
                      <td className="py-2.5 px-3 pl-5">Final Extension</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{cycleExtTemp}°C</td>
                      <td className="py-2.5 px-3 text-right font-bold">{finalExtTime}</td>
                      <td className="py-2.5 px-3 text-center font-bold">1x</td>
                    </tr>
                    <tr className="bg-slate-100/50 dark:bg-slate-800/40">
                      <td className="py-2.5 px-3 pl-5">Hold</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">4°C</td>
                      <td className="py-2.5 px-3 text-center pr-0 font-bold">∞</td>
                      <td className="py-2.5 px-3 text-center font-bold">1x</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Parameter Explanation / Duration */}
              <div className="p-3 bg-pink-100/30 dark:bg-pink-950/10 border border-pink-100/50 dark:border-pink-900/30 rounded-xl space-y-2.5">
                <h5 className="text-[12px] font-bold text-pink-500 dark:text-pink-400 uppercase tracking-wider flex items-center gap-1">
                  Calculation Parameters &amp; Duration
                </h5>
                <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400 font-medium">
                  <li className="flex justify-between">
                    <span>Selected Polymerase:</span> 
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{polymerase}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>DNA Template Type:</span> 
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {templateType === 'complex' ? 'Complex / genomic DNA' : 'Simple / non-genomic DNA'}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Expected Product Size:</span> 
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{productLength || '0'} bp</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Extension Speed:</span> 
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{extensionSpeed} s/kb</span>
                  </li>
                  <li className="flex justify-between border-t border-pink-100/50 dark:border-pink-900/30 pt-1.5 mt-1.5 text-pink-900 dark:text-pink-300 font-bold">
                    <span className="flex items-center gap-1 font-sans">
                      <Clock className="w-3.5 h-3.5" /> Total Program Duration:
                    </span> 
                    <span>{totalDurationStr}</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
