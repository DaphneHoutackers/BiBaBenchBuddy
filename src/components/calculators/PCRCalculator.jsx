import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dna, FlaskConical, Clock, Plus, Trash2, AlertTriangle, FileCode, Info } from 'lucide-react';
import { BiTransferAlt } from 'react-icons/bi';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import PCRProgram from './PCRProgram';
import OEPCRCalculator from './OEPCRCalculator';
import PCRProductGenerator from './PCRProductGenerator';
import CopyTableButton from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';
import SaveHistoryButton from '@/components/shared/SaveHistoryButton';
import { useHistory } from '@/context/HistoryContext';
import { makeId } from '@/utils/makeId';
import { getDilutionSuggestion, generateDilutionWarning } from '@/utils/dilutionHelper';
const formatNumber = (val) => {
  if (val === undefined || val === null) return '';
  const num = Number(val);
  if (isNaN(num)) return val;
  return num.toString();
};

const POLYMERASES = {
  'Phusion High-Fidelity': {
    label: 'Phusion High-Fidelity',
    buffer: '5× Phusion HF Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'Q5 High-Fidelity': {
    label: 'Q5 High-Fidelity',
    buffer: '5× Q5 Reaction Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'PrimeSTAR GXL': {
    label: 'PrimeSTAR GXL',
    buffer: '5× PrimeSTAR GXL Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'KAPA HiFi': {
    label: 'KAPA HiFi',
    buffer: '5× KAPA HiFi Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'Platinum SuperFi II': {
    label: 'Platinum SuperFi II',
    buffer: '5× SuperFi II Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'Taq Polymerase': {
    label: 'Taq Polymerase',
    buffer: '10× Taq Buffer',
    bufferX: 10,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'OneTaq': {
    label: 'OneTaq',
    buffer: '5× OneTaq Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'DreamTaq': {
    label: 'DreamTaq',
    buffer: '10× DreamTaq Buffer',
    bufferX: 10,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'Pfu Polymerase': {
    label: 'Pfu Polymerase',
    buffer: '10× Pfu Buffer',
    bufferX: 10,
    dntpFinal: 0.2,
    naEqM: 0.05,
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

const formatSeconds = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const parseTimeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }
  return parseInt(timeStr, 10) || 0;
};


export default function PCRCalculator({ externalTab, onTabChange, historyData, isActive, tabs }) {
  const { addHistoryItem } = useHistory();
  const sessionId = useRef(makeId());
  const tableRef = useRef(null);
  const programTableRef = useRef(null);
  const [tab, setTab] = useState(() => {
    if (externalTab) return externalTab;
    return localStorage.getItem('bbb_pcr_tab') || 'mix';
  });
  const [isRestoring, setIsRestoring] = useState(false);
  useEffect(() => { if (externalTab) setTab(externalTab); }, [externalTab]);

  // ── MIX TAB ──
  const [polymerase, setPolymerase] = useState(() => localStorage.getItem('bbb_pcr_poly') || 'Phusion High-Fidelity');
  const [totalVolume, setTotalVolume] = useState(() => localStorage.getItem('bbb_pcr_totvol') || '50');
  const [primerConc, setPrimerConc] = useState(() => localStorage.getItem('bbb_pcr_primerconc') || '10');
  const [betaineVol, setBetaineVol] = useState(() => localStorage.getItem('bbb_pcr_betaine') || '20');
  const [samples, setSamples] = useState(() => {
    try {
      const s = localStorage.getItem('bbb_pcr_samples');
      return s ? JSON.parse(s) : [{ id: 1, name: 'Sample 1', conc: '', desiredNg: '10', autoDilute: true, minVol: '0.5', productLength: '2000' }];
    } catch {
      return [{ id: 1, name: 'Sample 1', conc: '', desiredNg: '10', autoDilute: true, minVol: '0.5', productLength: '2000' }];
    }
  });
  const [primersIdentical, setPrimersIdentical] = useState(() => {
    const s = localStorage.getItem('bbb_pcr_primersidentical');
    return s !== null ? s === 'true' : true;
  });
  const [mastermixEnabled, setMastermixEnabled] = useState(() => localStorage.getItem('bbb_pcr_mastermix') === 'true');
  const [reactionsInput, setReactionsInput] = useState(() => localStorage.getItem('bbb_pcr_reactions') || '');
  const [templateType, setTemplateType] = useState(() => localStorage.getItem('bbb_pcr_templatetype') || 'simple');
  const [annealTemp, setAnnealTemp] = useState(() => localStorage.getItem('bbb_pcr_annealtemp') || '60');
  const [cycleCount, setCycleCount] = useState(() => localStorage.getItem('bbb_pcr_cycles') || '30');
  const [initDenatCustom, setInitDenatCustom] = useState(() => localStorage.getItem('bbb_pcr_initdenat') || '05:00');
  const [finalExtCustom, setFinalExtCustom] = useState(() => localStorage.getItem('bbb_pcr_finalext') || '05:00');
  const [annealTimeCustom, setAnnealTimeCustom] = useState(() => localStorage.getItem('bbb_pcr_annealtime') || '00:30');
  const [customExtensionTime, setCustomExtensionTime] = useState(() => localStorage.getItem('bbb_pcr_custext') || '');
  const [copiedProgram, setCopiedProgram] = useState(false);

  const useBetaine = (parseFloat(betaineVol) || 0) > 0;

  // Auto-save states to localStorage
  useEffect(() => {
    if (!isRestoring) {
      localStorage.setItem('bbb_pcr_tab', tab);
      localStorage.setItem('bbb_pcr_poly', polymerase);
      localStorage.setItem('bbb_pcr_totvol', totalVolume);
      localStorage.setItem('bbb_pcr_primerconc', primerConc);
      localStorage.setItem('bbb_pcr_betaine', betaineVol);
      localStorage.setItem('bbb_pcr_samples', JSON.stringify(samples));
      localStorage.setItem('bbb_pcr_primersidentical', String(primersIdentical));
      localStorage.setItem('bbb_pcr_mastermix', String(mastermixEnabled));
      localStorage.setItem('bbb_pcr_reactions', reactionsInput);
      localStorage.setItem('bbb_pcr_templatetype', templateType);
      localStorage.setItem('bbb_pcr_annealtemp', annealTemp);
      localStorage.setItem('bbb_pcr_cycles', cycleCount);
      localStorage.setItem('bbb_pcr_initdenat', initDenatCustom);
      localStorage.setItem('bbb_pcr_finalext', finalExtCustom);
      localStorage.setItem('bbb_pcr_annealtime', annealTimeCustom);
      localStorage.setItem('bbb_pcr_custext', customExtensionTime);
    }
  }, [
    tab, polymerase, totalVolume, primerConc, betaineVol, samples, primersIdentical,
    mastermixEnabled, reactionsInput, templateType, annealTemp, cycleCount,
    initDenatCustom, finalExtCustom, annealTimeCustom, customExtensionTime,
    isRestoring
  ]);

  // Restore from history
  useEffect(() => {
    if (historyData && historyData.toolId === 'pcr') {
      setIsRestoring(true);
      if (historyData.id) sessionId.current = historyData.id;
      const d = historyData.data;
      if (d.tab !== undefined) {
        setTab(d.tab);
        localStorage.setItem('bbb_pcr_tab', d.tab);
      }
      if (d.polymerase !== undefined) {
        setPolymerase(d.polymerase);
        localStorage.setItem('bbb_pcr_poly', d.polymerase);
      }
      if (d.totalVolume !== undefined) {
        setTotalVolume(d.totalVolume);
        localStorage.setItem('bbb_pcr_totvol', d.totalVolume);
      }
      if (d.primerConc !== undefined) {
        setPrimerConc(d.primerConc);
        localStorage.setItem('bbb_pcr_primerconc', d.primerConc);
      }
      if (d.betaineVol !== undefined) {
        setBetaineVol(d.betaineVol);
        localStorage.setItem('bbb_pcr_betaine', d.betaineVol);
      } else if (d.useBetaine === false) {
        setBetaineVol('0');
        localStorage.setItem('bbb_pcr_betaine', '0');
      }
      if (d.templateType !== undefined) {
        setTemplateType(d.templateType);
        localStorage.setItem('bbb_pcr_templatetype', d.templateType);
      }
      if (d.annealTemp !== undefined) {
        setAnnealTemp(d.annealTemp);
        localStorage.setItem('bbb_pcr_annealtemp', d.annealTemp);
      }
      if (d.cycleCount !== undefined) {
        setCycleCount(d.cycleCount);
        localStorage.setItem('bbb_pcr_cycles', d.cycleCount);
      }
      if (d.initDenatCustom !== undefined) {
        setInitDenatCustom(d.initDenatCustom);
        localStorage.setItem('bbb_pcr_initdenat', d.initDenatCustom);
      }
      if (d.finalExtCustom !== undefined) {
        setFinalExtCustom(d.finalExtCustom);
        localStorage.setItem('bbb_pcr_finalext', d.finalExtCustom);
      }
      if (d.annealTimeCustom !== undefined) {
        setAnnealTimeCustom(d.annealTimeCustom);
        localStorage.setItem('bbb_pcr_annealtime', d.annealTimeCustom);
      }
      if (d.customExtensionTime !== undefined) {
        setCustomExtensionTime(d.customExtensionTime);
        localStorage.setItem('bbb_pcr_custext', d.customExtensionTime);
      }
      if (d.samples !== undefined) {
        setSamples(d.samples);
        localStorage.setItem('bbb_pcr_samples', JSON.stringify(d.samples));
      }
      if (d.primersIdentical !== undefined) {
        setPrimersIdentical(d.primersIdentical);
        localStorage.setItem('bbb_pcr_primersidentical', String(d.primersIdentical));
      }
      if (d.mastermixEnabled !== undefined) {
        setMastermixEnabled(d.mastermixEnabled);
        localStorage.setItem('bbb_pcr_mastermix', String(d.mastermixEnabled));
      }
      if (d.reactionsInput !== undefined) {
        setReactionsInput(d.reactionsInput);
        localStorage.setItem('bbb_pcr_reactions', d.reactionsInput);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  const handleSaveToHistory = () => {
    let preview = '';
    if (tab === 'mix') {
      preview = `PCR mix, ${samples.length} sample${samples.length > 1 ? 's' : ''}`;
    } else if (tab === 'program') {
      preview = `PCR program, ${polymerase}`;
    } else {
      preview = `PCR (${tab})`;
    }

    addHistoryItem({
      id: sessionId.current,
      toolId: 'pcr',
      toolName: 'PCR Calculator',
      data: {
        preview,
        tab,
        polymerase,
        totalVolume,
        primerConc,
        useBetaine,
        betaineVol,
        samples,
        primersIdentical,
        mastermixEnabled,
        reactionsInput,
        templateType,
        annealTemp,
        cycleCount,
        initDenatCustom,
        finalExtCustom,
        annealTimeCustom,
        customExtensionTime,
      }
    });
  };

  // Auto-manage Mastermix toggle & reactions input
  const prevSamplesLength = useRef(samples.length);
  useEffect(() => {
    if (isRestoring) return;
    const currentN = samples.length;
    if (currentN !== prevSamplesLength.current) {
      if (currentN >= 2) {
        setMastermixEnabled(true);
        setReactionsInput(String(currentN + 1));
      } else {
        setMastermixEnabled(false);
        setReactionsInput('2');
      }
      prevSamplesLength.current = currentN;
    }
  }, [samples.length, isRestoring]);

  const poly = POLYMERASES[polymerase];
  const vol = parseFloat(totalVolume) || 50;
  const n = samples.length;

  const defaultMultiplier = n >= 2 ? n + 1 : 2;
  const mmMultiplier = mastermixEnabled ? (parseFloat(reactionsInput) || defaultMultiplier) : 1;

  // Fixed volumes per reaction
  const bufferVol = vol / poly.bufferX;
  const dntpVol = (poly.dntpFinal * vol) / 10;
  const primerFinal = 0.5; // 0.5 µM final concentration
  const primerVol = (primerFinal * vol) / parseFloat(primerConc || 10);
  const polyVol = 0.5;
  const betaineActualVol = parseFloat(betaineVol) || 0;

  // Per-sample template calculations
  const sampleCalcs = samples.map(s => {
    const rawVol = s.conc && s.desiredNg ? parseFloat(s.desiredNg) / parseFloat(s.conc) : 1;
    const isAutoDilute = s.autoDilute !== false;
    const threshold = parseFloat(s.minVol) || 0.5;
    const dilution = isAutoDilute ? getDilutionSuggestion(s.conc, s.desiredNg, threshold) : null;
    const templateVol = dilution ? parseFloat(dilution.newVol) : rawVol;
    const fixedVol = bufferVol + dntpVol + (primersIdentical ? primerVol * 2 : 0) + polyVol + betaineActualVol;
    const mqVol = vol - fixedVol - (!primersIdentical ? primerVol * 2 : 0) - templateVol;
    return { ...s, templateVol: templateVol > 0 ? templateVol : 1, rawTemplateVol: rawVol, dilution, mqVol: Math.max(0, mqVol), threshold };
  });

  // MQ in mastermix: only if all template vols are identical and primers are in MM (always true if only 1 sample)
  const allTemplatesIdentical = sampleCalcs.every(s => Math.abs(s.templateVol - sampleCalcs[0].templateVol) < 0.001);
  const mqInMM = n === 1 || (primersIdentical && allTemplatesIdentical);
  // ── PCR Program calculations ──
  const speedObj = EXTENSION_SPEEDS[polymerase] || { simple: 30, complex: 30 };
  const extensionSpeed = templateType === 'complex' ? speedObj.complex : speedObj.simple;
  const lengths = samples.map(s => parseFloat(s.productLength) || 0);
  const longestProductLength = Math.max(...lengths, 0);
  const autoExtensionSecs = longestProductLength > 0 ? Math.max(1, Math.ceil((longestProductLength / 1000) * extensionSpeed)) : 0;
  const autoExtensionStr = formatSeconds(autoExtensionSecs);

  const prevAutoExtensionStr = useRef(autoExtensionStr);

  useEffect(() => {
    if (!customExtensionTime || customExtensionTime === prevAutoExtensionStr.current) {
      setCustomExtensionTime(autoExtensionStr);
    }
    prevAutoExtensionStr.current = autoExtensionStr;
  }, [autoExtensionStr]);

  const extensionSecs = customExtensionTime ? parseTimeToSeconds(customExtensionTime) : autoExtensionSecs;

  const isHighFid = ['Phusion High-Fidelity', 'Q5 High-Fidelity', 'Platinum SuperFi II', 'KAPA HiFi'].includes(polymerase);
  const initDenatTemp = isHighFid ? 98 : 95;

  const cycleDenatTemp = isHighFid ? 98 : 95;
  const cycleDenatSecs = isHighFid ? 10 : 30;

  const cycleExtTemp = polymerase === 'PrimeSTAR GXL' ? 68 : 72;

  const initDenatTime = initDenatCustom || '05:00';
  const cycleDenatTime = formatSeconds(cycleDenatSecs);
  const cycleAnnealTime = annealTimeCustom || '00:30';
  const finalExtTime = finalExtCustom || '05:00';
  const extensionTimeStr = customExtensionTime ? customExtensionTime : formatSeconds(autoExtensionSecs);

  // Auto-calculated total program duration
  const totalCycleSecs = (cycleDenatSecs + parseTimeToSeconds(cycleAnnealTime) + extensionSecs) * (parseInt(cycleCount, 10) || 30);
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
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 text-white shadow-sm">
            <BiTransferAlt className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">PCR Calculator</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Mix calculator with mastermix support &amp; PCR program</p>
          </div>
        </div>
        <SaveHistoryButton onSave={handleSaveToHistory} />
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v); onTabChange?.(v); }}>
        <TabsList className="bg-slate-200/90 dark:bg-slate-950/80 border border-slate-300/40 dark:border-slate-800/60 shadow-sm p-1">
          <TabsTrigger value="mix" className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            PCR Mix
          </TabsTrigger>
          <TabsTrigger value="program" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            PCR Program
          </TabsTrigger>
          <TabsTrigger value="oepcr" className="flex items-center gap-2">
            <Dna className="w-4 h-4" />
            OE-PCR
          </TabsTrigger>
          <TabsTrigger value="product" className="flex items-center gap-2">
            <FileCode className="w-4 h-4" />
            Product Sequence
          </TabsTrigger>
        </TabsList>

        {tabs}

        {/* ─── PCR MIX ─── */}
        <TabsContent value="mix" forceMount className={tab === 'mix' ? 'mt-6' : 'hidden'}>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">General Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    {/* General Settings: Total Volume, Primer Stock & Betaine */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-1">
                      <div className="space-y-1.5">
                        <div className="h-5 flex items-center">
                          <Label className="text-xs text-slate-600 dark:text-slate-200">Total volume</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <NumInput value={totalVolume} onChange={e => setTotalVolume(e.target.value)} className="border-slate-200 dark:border-slate-700 h-8 text-xs text-left w-20 flex-1" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">µL</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="h-5 flex items-center">
                          <Label className="text-xs text-slate-600 dark:text-slate-200">Primer stock</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <NumInput value={primerConc} onChange={e => setPrimerConc(e.target.value)} className="border-slate-200 dark:border-slate-700 h-8 text-xs text-left w-20 flex-1" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">µM</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="h-5 flex items-center gap-1">
                          <Label className="text-xs text-slate-600 dark:text-slate-200">Betaine</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger type="button" className="focus:outline-none">
                                <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 cursor-default" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs max-w-xs leading-normal">
                                  Betaine reduces secondary structures.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <NumInput value={betaineVol} onChange={e => setBetaineVol(e.target.value)} className="border-slate-200 dark:border-slate-700 h-8 text-xs text-left w-20 flex-1" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">µL</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mastermix Settings inside General Settings */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                    <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Mastermix Settings</h4>
                    
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={mastermixEnabled} 
                          onCheckedChange={setMastermixEnabled} 
                          id="pcr-mastermix-enabled" 
                        />
                        <Label htmlFor="pcr-mastermix-enabled" className="text-[13px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                          Mastermix
                        </Label>
                        <div className="flex items-center gap-1.5 ml-1 flex-shrink-0">
                          <NumInput 
                            value={reactionsInput} 
                            onChange={e => setReactionsInput(e.target.value)} 
                            disabled={!mastermixEnabled}
                            min="1.0" 
                            step="1.0" 
                            className="w-11 border-slate-200 dark:border-slate-700 h-8 text-xs text-center font-mono px-1 disabled:opacity-40 disabled:bg-slate-50 dark:disabled:bg-slate-900/50" 
                            placeholder={String(samples.length >= 2 ? samples.length + 1 : 2)}
                          />
                          <Label className="text-xs text-slate-500 dark:text-slate-400 font-normal">reactions</Label>
                        </div>
                      </div>

                      {/* Primers identical toggle: always visible */}
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="pcr-primers-identical" 
                          checked={primersIdentical} 
                          onChange={(e) => setPrimersIdentical(e.target.checked)}
                          className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500 cursor-pointer" 
                        />
                        <Label htmlFor="pcr-primers-identical" className="text-[13px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1.5">
                          Include primers in mastermix
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger type="button" className="focus:outline-none">
                                <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 cursor-default" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs max-w-xs leading-normal">
                                  If enabled, primers will be included in the mastermix. Useful if all samples use the same primers.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Template DNA Samples */}
              <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">Template DNA Samples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {samples.map(s => (
                    <div key={s.id} className="relative p-3 border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/20 dark:bg-slate-900/10 space-y-2 pr-10">
                      {/* Trash button positioned absolute top-right */}
                      {samples.length > 1 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute top-2 right-2 h-7 w-7 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-transparent" 
                          onClick={() => setSamples(samples.filter(x => x.id !== s.id))}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_0.8fr_0.55fr_1.1fr] gap-3">
                        {/* Sample ID */}
                        <div className="space-y-1">
                          <div className="h-5 flex items-center">
                            <Label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Sample ID</Label>
                          </div>
                          <Input 
                            value={s.name} 
                            onChange={e => setSamples(samples.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))} 
                            className="text-xs border-slate-200 dark:border-slate-700 h-8 w-full text-left" 
                          />
                        </div>

                        {/* Concentration */}
                        <div className="space-y-1">
                          <div className="h-5 flex items-center">
                            <Label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Conc. (ng/µL)</Label>
                          </div>
                          <NumInput 
                            placeholder="e.g., 50" 
                            value={s.conc} 
                            onChange={e => setSamples(samples.map(x => x.id === s.id ? { ...x, conc: e.target.value } : x))} 
                            className="text-xs border-slate-200 dark:border-slate-700 h-8 w-full text-left" 
                          />
                        </div>

                        {/* Amount */}
                        <div className="space-y-1">
                          <div className="h-5 flex items-center">
                            <Label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Amount (ng)</Label>
                          </div>
                          <NumInput 
                            value={s.desiredNg} 
                            onChange={e => setSamples(samples.map(x => x.id === s.id ? { ...x, desiredNg: e.target.value } : x))} 
                            className="text-xs border-slate-200 dark:border-slate-700 h-8 w-full text-left" 
                          />
                        </div>

                        {/* Auto-Dilution checkbox in label + min volume input */}
                        <div className="space-y-1 pl-2">
                          <div className="flex items-center gap-1.5">
                            <Switch
                              id={`pcr-auto-dilute-${s.id}`}
                              checked={s.autoDilute !== false}
                              onCheckedChange={(checked) => setSamples(samples.map(x => x.id === s.id ? { ...x, autoDilute: checked } : x))}
                              className="scale-75"
                            />
                            <Label htmlFor={`pcr-auto-dilute-${s.id}`} className="text-[11px] font-medium text-slate-500 dark:text-slate-400 cursor-pointer flex items-center gap-1">
                              Auto-Dilute
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger type="button" className="focus:outline-none">
                                    <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 cursor-default" />
                                  </TooltipTrigger>
                                  <TooltipContent><p className="text-xs max-w-xs leading-normal">Automatically suggests pre-dilution steps if the template volume is below the threshold.</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </Label>
                          </div>
                          {s.autoDilute !== false && (
                            <div className="flex items-center gap-1 pl-1">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 select-none">If vol &lt;</span>
                              <Input
                                type="number" step="0.1" value={s.minVol !== undefined ? s.minVol : '0.5'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setSamples(samples.map(x => x.id === s.id ? { ...x, minVol: e.target.value } : x))}
                                className="h-7 w-14 text-[11px] border-slate-200 dark:border-slate-700 px-1 text-center bg-white dark:bg-slate-900 focus:ring-1 focus:ring-violet-500/20"
                              />
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 select-none">µL</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="gap-1 h-8 w-full" onClick={() => {
                    const id = Math.max(...samples.map(s => s.id)) + 1;
                    setSamples([...samples, { id, name: `Sample ${id}`, conc: '', desiredNg: '10', autoDilute: true, minVol: '0.5' }]);
                  }}>
                    <Plus className="w-3 h-3" /> Add Sample
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      PCR Mix
                    </CardTitle>
                    {(mastermixEnabled || samples.length > 1) && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 ml-6">
                        {mastermixEnabled ? `${samples.length} Sample${samples.length > 1 ? 's' : ''}, Mastermix n=${mmMultiplier}` : `${samples.length} Sample${samples.length > 1 ? 's' : ''}`}
                      </div>
                    )}
                  </div>
                    <div className="flex items-center gap-2">
                      <CopyTableButton getData={() => {
                        const showMM = mastermixEnabled;
                        const showSamples = n > 1 || mastermixEnabled;

                        if (!showSamples) {
                          const rows = [['Component', 'Volume (µL)']];
                          const sc = sampleCalcs[0];
                          rows.push(['MQ', sc.mqVol.toFixed(2)]);
                          rows.push([`Template DNA (${samples[0].desiredNg} ng)`, (sc.dilution ? '*' : '') + sc.templateVol.toFixed(2)]);
                          rows.push([`${poly.buffer} (${poly.bufferX}×)`, bufferVol.toFixed(2)]);
                          if (useBetaine) rows.push(['Betaine', betaineActualVol.toFixed(2)]);
                          rows.push(['10mM dNTPs', dntpVol.toFixed(2)]);
                          rows.push([polymerase, polyVol.toFixed(2)]);
                          rows.push([`Forward Primer (${primerConc}µM)`, primerVol.toFixed(2)]);
                          rows.push([`Reverse Primer (${primerConc}µM)`, primerVol.toFixed(2)]);
                          rows.push(['Total', vol]);
                          return rows;
                        }

                        const header = ['Component', ...samples.map(s => s.name)];
                        if (showMM) header.push(`MM ×${mmMultiplier}`);
                        const rows = [header];

                        rows.push([
                          'MQ', 
                          ...sampleCalcs.map(s => s.mqVol.toFixed(2)), 
                          ...(showMM ? [mqInMM ? (sampleCalcs[0].mqVol * mmMultiplier).toFixed(2) : '—'] : [])
                        ]);
                        rows.push([
                          'Template DNA', 
                          ...sampleCalcs.map(s => (s.dilution ? '*' : '') + s.templateVol.toFixed(2)), 
                          ...(showMM ? [n === 1 ? (sampleCalcs[0].templateVol * mmMultiplier).toFixed(2) : '—'] : [])
                        ]);
                        rows.push([
                          `${poly.buffer} (${poly.bufferX}×)`, 
                          ...samples.map(() => bufferVol.toFixed(2)), 
                          ...(showMM ? [(bufferVol * mmMultiplier).toFixed(2)] : [])
                        ]);
                        if (useBetaine) rows.push([
                          'Betaine', 
                          ...samples.map(() => betaineActualVol.toFixed(2)), 
                          ...(showMM ? [(betaineActualVol * mmMultiplier).toFixed(2)] : [])
                        ]);
                        rows.push([
                          '10mM dNTPs', 
                          ...samples.map(() => dntpVol.toFixed(2)), 
                          ...(showMM ? [(dntpVol * mmMultiplier).toFixed(2)] : [])
                        ]);
                        rows.push([
                          polymerase, 
                          ...samples.map(() => polyVol.toFixed(2)), 
                          ...(showMM ? [(polyVol * mmMultiplier).toFixed(2)] : [])
                        ]);
                        rows.push([
                          `Fwd Primer (${primerConc}µM)`, 
                          ...samples.map(() => primerVol.toFixed(2)), 
                          ...(showMM ? [primersIdentical ? (primerVol * mmMultiplier).toFixed(2) : '—'] : [])
                        ]);
                        rows.push([
                          `Rev Primer (${primerConc}µM)`, 
                          ...samples.map(() => primerVol.toFixed(2)), 
                          ...(showMM ? [primersIdentical ? (primerVol * mmMultiplier).toFixed(2) : '—'] : [])
                        ]);
                        rows.push([
                          'Total', 
                          ...samples.map(() => vol), 
                          ...(showMM ? [''] : [])
                        ]);
                        return rows;
                      }} />
                      <CopyImageButton targetRef={tableRef} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto bg-white dark:bg-slate-900 p-4 rounded-lg" ref={tableRef}>
                    {sampleCalcs.some(s => s.dilution) && (
                      <Card className="border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/5 shadow-none mb-3 rounded-xl">
                        <CardContent className="p-2 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-400 text-xs mb-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Dilution Suggestions</span>
                          </div>
                          {sampleCalcs.filter(s => s.dilution).map(s => (
                            <div key={s.id} className="text-xs font-medium text-red-700 dark:text-red-400 pl-5">
                              {generateDilutionWarning(samples.find(sm => sm.id === s.id)?.name || `Sample ${s.id}`, s.dilution, parseFloat(s.minVol) || 0.5)}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-blue-50 dark:bg-blue-900/30">
                          <th className="text-left py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Component</th>
                          {n > 1 || mastermixEnabled ? samples.map(s => (
                            <th key={s.id} className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200">{s.name}</th>
                          )) : <th className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Vol (µL)</th>}
                          {mastermixEnabled && <th className="text-right py-2 px-3 font-bold text-blue-700 dark:text-blue-300">MM ×{mmMultiplier}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {/* MQ */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
                            MQ {mastermixEnabled && !mqInMM && <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">(per tube)</span>}
                          </td>
                          {n > 1 || mastermixEnabled ? sampleCalcs.map(s => (
                            <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(s.mqVol.toFixed(2))}</td>
                          )) : <td className="py-2 px-3 text-right font-bold">{formatNumber(sampleCalcs[0].mqVol.toFixed(2))}</td>}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{mqInMM ? formatNumber((sampleCalcs[0].mqVol * mmMultiplier).toFixed(2)) : '—'}</td>}
                        </tr>
                        {/* Template DNA */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                            Template DNA {n === 1 && <span className="text-rose-600 dark:text-rose-400 font-semibold">({formatNumber(samples[0].desiredNg)} ng)</span>}
                            {n > 1 && <span className="text-xs text-slate-400 dark:text-slate-500 font-normal ml-1">(per tube)</span>}
                          </td>
                          {n > 1 || mastermixEnabled ? sampleCalcs.map(s => (
                            <td key={s.id} className={`py-2 px-3 text-right font-bold text-red-600 dark:text-red-400 ${s.dilution ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                              {s.dilution ? '*' : ''}{formatNumber(s.templateVol.toFixed(2))}
                            </td>
                          )) : (
                            <td className={`py-2 px-3 text-right font-bold text-red-600 dark:text-red-400 ${sampleCalcs[0].dilution ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                              {sampleCalcs[0].dilution ? '*' : ''}{formatNumber(sampleCalcs[0].templateVol.toFixed(2))}
                            </td>
                          )}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{n === 1 ? formatNumber((sampleCalcs[0].templateVol * mmMultiplier).toFixed(2)) : '—'}</td>}
                        </tr>
                        {/* Buffer */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{poly.buffer} ({poly.bufferX}×)</td>
                          {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(bufferVol.toFixed(2))}</td>) : <td className="py-2 px-3 text-right font-bold">{formatNumber(bufferVol.toFixed(2))}</td>}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{formatNumber((bufferVol * mmMultiplier).toFixed(2))}</td>}
                        </tr>
                        {/* Betaine */}
                        {useBetaine && (
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300">Betaine</td>
                            {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(betaineActualVol.toFixed(2))}</td>) : <td className="py-2 px-3 text-right font-bold">{formatNumber(betaineActualVol.toFixed(2))}</td>}
                            {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{formatNumber((betaineActualVol * mmMultiplier).toFixed(2))}</td>}
                          </tr>
                        )}
                        {/* dNTPs */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">10mM dNTPs</td>
                          {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(dntpVol.toFixed(2))}</td>) : <td className="py-2 px-3 text-right font-bold">{formatNumber(dntpVol.toFixed(2))}</td>}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{formatNumber((dntpVol * mmMultiplier).toFixed(2))}</td>}
                        </tr>
                        {/* Polymerase */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{polymerase}</td>
                          {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(polyVol.toFixed(2))}</td>) : <td className="py-2 px-3 text-right font-bold">{formatNumber(polyVol.toFixed(2))}</td>}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{formatNumber((polyVol * mmMultiplier).toFixed(2))}</td>}
                        </tr>
                        {/* Fwd primer */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">Forward Primer ({primerConc}µM) {mastermixEnabled && !primersIdentical && <span className="text-xs text-slate-400 dark:text-slate-500">(per tube)</span>}</td>
                          {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(primerVol.toFixed(2))}</td>) : <td className="py-2 px-3 text-right font-bold">{formatNumber(primerVol.toFixed(2))}</td>}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{primersIdentical ? formatNumber((primerVol * mmMultiplier).toFixed(2)) : '—'}</td>}
                        </tr>
                        {/* Rev primer */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">Reverse Primer ({primerConc}µM) {mastermixEnabled && !primersIdentical && <span className="text-xs text-slate-400 dark:text-slate-500">(per tube)</span>}</td>
                          {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(primerVol.toFixed(2))}</td>) : <td className="py-2 px-3 text-right font-bold">{formatNumber(primerVol.toFixed(2))}</td>}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{primersIdentical ? formatNumber((primerVol * mmMultiplier).toFixed(2)) : '—'}</td>}
                        </tr>
                        <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50">
                          <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-100">Total (µL)</td>
                          {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-100">{formatNumber(vol)}</td>) : <td className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-100">{formatNumber(vol)}</td>}
                          {mastermixEnabled && <td className="py-2 px-3"></td>}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {sampleCalcs.some(s => s.dilution) && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">* Volume below threshold — see dilution suggestion above.</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>


        {/* ─── OE-PCR ─── */}
        <TabsContent value="oepcr" forceMount className={tab === 'oepcr' ? 'mt-6' : 'hidden'}>
          <OEPCRCalculator isActive={isActive} />
        </TabsContent>

        {/* ─── PCR PROGRAM ─── */}
        <TabsContent value="program" forceMount className={tab === 'program' ? 'mt-6' : 'hidden'}>
          <PCRProgram isActive={isActive} />
        </TabsContent>
        {/* ─── Product Sequence ─── */}
        <TabsContent value="product" forceMount className={tab === 'product' ? 'mt-6' : 'hidden'}>
          <PCRProductGenerator />
        </TabsContent>
      </Tabs>
    </div>
  );
}