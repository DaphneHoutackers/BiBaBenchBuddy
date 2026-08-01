import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Beaker, Plus, Trash2, FlaskConical, Copy, Check } from 'lucide-react';
import { HiMiniChartBar } from "react-icons/hi2";
import { HiMiniTableCells } from "react-icons/hi2";
import { BsGraphUpArrow } from "react-icons/bs";
import { copyAsHtmlTable } from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { useHistory } from '@/context/HistoryContext';
import { makeId } from '@/utils/makeId';


const formatNumber = (val) => {
  if (val === undefined || val === null) return '';
  const num = Number(val);
  if (isNaN(num)) return val;
  return num.toString();
};

function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const rSS = points.reduce((s, p) => s + Math.pow(p.y - (slope * p.x + intercept), 2), 0);
  const tSS = points.reduce((s, p) => s + Math.pow(p.y - sumY / n, 2), 0);
  const r2 = tSS > 0 ? 1 - rSS / tSS : 1;
  return { slope, intercept, r2 };
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

// Default standards: 0, 0.25, 0.5, 1, 2, 5, 10, 20, 40 µg/mL
const DEFAULT_STD_CONCS = [0, 0.25, 0.5, 1, 2, 5, 10, 20, 40];
// BSA stock = 2 mg/mL = 2000 µg/mL → µL needed per 1 mL WR = conc / 2000 * 1000
const bsaVolForStd = (conc) => (conc / 2000 * 1000); // µL per 1 mL WR

export default function ProteinConcCalculator({ externalTab, onTabChange, historyData, isActive, tabs }) {
  const { addHistoryItem } = useHistory();
  const sessionId = useRef(makeId());
  const standardsTableRef = useRef(null);
  const samplesTableRef = useRef(null);
  const prepTableRef = useRef(null);
  
  const [tab, setTab] = useState(externalTab || 'standards');
  useEffect(() => { if (externalTab) setTab(externalTab); }, [externalTab]);

  // Standard curve
  const [wrVolume, setWrVolume] = useState('1'); // mL
  const [sampleVolInWR, setSampleVolInWR] = useState('10'); // µL
  const [standards, setStandards] = useState(DEFAULT_STD_CONCS.map((c, i) => ({ id: i + 1, conc: c, abs: '' })));
  const [unknowns, setUnknowns] = useState([
    { id: 1, name: 'Sample 1', abs: '' },
    { id: 2, name: 'Sample 2', abs: '' },
  ]);
  const [regression, setRegression] = useState(null);
  const [unknownResults, setUnknownResults] = useState([]);
  const [copiedStd, setCopiedStd] = useState(false);
  const [copiedSamples, setCopiedSamples] = useState(false);
  const [rowMenu, setRowMenu] = useState(null);
  const [copiedPrep, setCopiedPrep] = useState(false);

  // SDS-PAGE prep
  const [proteinLoad, setProteinLoad] = useState('15'); // µg
  const [sampleBufferX, setSampleBufferX] = useState('6'); // 6×
  const [prepTotalVol, setPrepTotalVol] = useState('40'); // µL

  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (historyData && historyData.toolId === 'protein') {
      setIsRestoring(true);
      const d = historyData.data;
      if (d) {
        if (d.tab) setTab(d.tab);
        if (d.wrVolume !== undefined) setWrVolume(d.wrVolume);
        if (d.sampleVolInWR !== undefined) setSampleVolInWR(d.sampleVolInWR);
        if (d.standards !== undefined) setStandards(d.standards);
        if (d.unknowns !== undefined) setUnknowns(d.unknowns);
        if (d.proteinLoad !== undefined) setProteinLoad(d.proteinLoad);
        if (d.sampleBufferX !== undefined) setSampleBufferX(d.sampleBufferX);
        if (d.prepTotalVol !== undefined) setPrepTotalVol(d.prepTotalVol);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  useEffect(() => {
    if (
      isRestoring ||
      (tab === 'standards' &&
        standards.every(s => !s.abs) &&
        unknowns.every(u => !u.abs))
    ) return;
    if (!isActive) return;

    const debounce = setTimeout(() => {
      let preview = 'Protein concentration calculation';

      if (tab === 'standards') {
        const numValidUnknowns = unknowns.filter(u => u.abs).length;
        const numValidStds = standards.filter(s => s.abs).length;

        if (numValidUnknowns > 0) {
          preview = `${numValidUnknowns} sample${numValidUnknowns > 1 ? 's' : ''} calculated`;
        } else {
          preview = `Standard curve, ${numValidStds} point${numValidStds !== 1 ? 's' : ''}`;
        }
      } else if (tab === 'prep') {
        const prepCount = unknownResults.filter(r => r.lysateConc_ngul).length;
        preview = prepCount > 0
          ? `SDS-PAGE prep, ${prepCount} sample${prepCount > 1 ? 's' : ''}`
          : 'SDS-PAGE sample prep';
      }

      addHistoryItem({
        id: sessionId.current,
        toolId: 'protein',
        toolName: 'BCA assay',
        data: {
          preview,
          tab,
          wrVolume,
          sampleVolInWR,
          standards,
          unknowns,
          proteinLoad,
          sampleBufferX,
          prepTotalVol
        }
      });
    }, 1000);

    return () => clearTimeout(debounce);
  }, [
    tab,
    wrVolume,
    sampleVolInWR,
    standards,
    unknowns,
    proteinLoad,
    sampleBufferX,
    prepTotalVol,
    unknownResults,
    isRestoring,
    addHistoryItem
  ]);
  const wrVol = parseFloat(wrVolume) || 1;
  const sVol = parseFloat(sampleVolInWR) || 10;

  // Regression
  useEffect(() => {
    const points = standards
      .map(s => ({ x: parseFloat(s.conc), y: parseFloat(s.abs) }))
      .filter(p => !isNaN(p.x) && !isNaN(p.y) && String(standards.find(s => s.x === p.x)?.abs) !== '');
    const validPoints = standards
      .filter(s => s.abs !== '' && !isNaN(parseFloat(s.abs)) && !isNaN(parseFloat(s.conc)))
      .map(s => ({ x: parseFloat(s.conc), y: parseFloat(s.abs) }));
    if (validPoints.length < 2) { setRegression(null); return; }
    const nextRegression = linearRegression(validPoints);
    setRegression(nextRegression && Object.values(nextRegression).every(Number.isFinite) ? nextRegression : null);
  }, [standards]);

  const addStandard = () => {
    const id = Math.max(...standards.map(s => s.id)) + 1;
    setStandards([...standards, { id, conc: '', abs: '' }]);
  };

  const pastedValues = text => text.split(/\r?\n|\t/).map(v => v.trim()).filter(Boolean).map(v => v.replace(',', '.'));
  const pasteStandards = (event, start, field) => {
    const values = pastedValues(event.clipboardData.getData('text'));
    if (values.length < 2) return;
    event.preventDefault();
    setStandards(previous => {
      const next = previous.map(row => ({ ...row }));
      while (next.length < start + values.length) next.push({ id: makeId(), conc: '', abs: '' });
      values.forEach((value, offset) => { next[start + offset][field] = value; });
      return next;
    });
  };
  const pasteSamples = (event, start, field) => {
    const values = pastedValues(event.clipboardData.getData('text'));
    if (values.length < 2) return;
    event.preventDefault();
    setUnknowns(previous => {
      const next = previous.map(row => ({ ...row }));
      while (next.length < start + values.length) next.push({ id: makeId(), name: `Sample ${next.length + 1}`, abs: '' });
      values.forEach((value, offset) => { next[start + offset][field] = value; });
      return next;
    });
  };
  const insertRowAfter = () => {
    if (!rowMenu) return;
    if (rowMenu.type === 'standard') setStandards(rows => [...rows.slice(0, rowMenu.index + 1), { id: makeId(), conc: '', abs: '' }, ...rows.slice(rowMenu.index + 1)]);
    else setUnknowns(rows => [...rows.slice(0, rowMenu.index + 1), { id: makeId(), name: `Sample ${rows.length + 1}`, abs: '' }, ...rows.slice(rowMenu.index + 1)]);
    setRowMenu(null);
  };
  const deleteContextRow = () => {
    if (!rowMenu) return;
    if (rowMenu.type === 'standard' && standards.length > 2) setStandards(rows => rows.filter((_, index) => index !== rowMenu.index));
    if (rowMenu.type === 'sample' && unknowns.length > 1) setUnknowns(rows => rows.filter((_, index) => index !== rowMenu.index));
    setRowMenu(null);
  };
  useEffect(() => { const close = () => setRowMenu(null); window.addEventListener('click', close); return () => window.removeEventListener('click', close); }, []);

  // Unknown results
  useEffect(() => {
    if (!regression) { setUnknownResults([]); return; }
    const dilutionFactor = (sVol + wrVol * 1000) / sVol;
    const results = unknowns.map(u => {
      const abs = parseFloat(u.abs);
      if (isNaN(abs)) return { ...u, concInWR: null, lysateConc_ugmL: null, lysateConc_ngul: null };
      const concInWR = (abs - regression.intercept) / regression.slope; // µg/mL
      const lysateConc_ugmL = concInWR * dilutionFactor; // µg/mL original
      const lysateConc_ngul = lysateConc_ugmL; // µg/mL = ng/µL (same numerically)
      return { ...u, concInWR: concInWR.toFixed(3), lysateConc_ugmL: lysateConc_ugmL.toFixed(2), lysateConc_ngul: lysateConc_ngul.toFixed(2) };
    });
    setUnknownResults(results);
  }, [unknowns, regression, sampleVolInWR, wrVolume]);

  // SDS-PAGE prep calculations per sample
  const load = parseFloat(proteinLoad) || 15;
  const bufX = parseFloat(sampleBufferX) || 6;
  const totalVol = parseFloat(prepTotalVol) || 40;
  const bufferVol = totalVol / bufX;

  // Get samples with known concentration for prep
  const prepSamples = unknownResults.filter(r => r.lysateConc_ngul);

  const prepCalcs = prepSamples.map(s => {
    const conc_ngul = parseFloat(s.lysateConc_ngul); // ng/µL
    const conc_ugul_actual = conc_ngul / 1000; // µg/µL
    const lysateVol = load / conc_ugul_actual;

    // Check if lysate volume alone exceeds the desired total volume
    const overflow = lysateVol > totalVol;
    // If overflow: new total = lysateVol + adjusted buffer vol (1X = newTotal/bufX)
    // newTotal = lysateVol + newTotal/bufX  →  newTotal * (1 - 1/bufX) = lysateVol
    const adjTotalVol = overflow ? lysateVol / (1 - 1 / bufX) : totalVol;
    const adjBufferVol = adjTotalVol / bufX;
    const lysisVol = Math.max(0, adjTotalVol - lysateVol - adjBufferVol);

    return {
      ...s,
      lysateVol: lysateVol.toFixed(2),
      bufferVol: adjBufferVol.toFixed(2),
      lysisVol: lysisVol.toFixed(2),
      isLow: lysateVol < 0.5,
      overflow,
      adjTotalVol: adjTotalVol.toFixed(2),
    };
  });

  const copyStandards = () => {
    const rows = [['Std (µg/mL)', 'BSA 2mg/mL (µL) per WR', 'A₅₆₂']];
    standards.forEach(s => {
      const c = parseFloat(s.conc);
      rows.push([s.conc, !isNaN(c) ? (c === 0 ? '0' : (bsaVolForStd(c) * wrVol).toFixed(3)) : '—', s.abs || '']);
    });
    copyAsHtmlTable(rows);
    setCopiedStd(true);
    setTimeout(() => setCopiedStd(false), 2000);
  };

  const copySamples = () => {
    const rows = [['Sample', 'Absorbance', 'Conc in WR (µg/mL)', 'Lysate Conc (ng/µL)']];
    unknownResults.forEach(r => rows.push([r.name, r.abs, r.concInWR || '', r.lysateConc_ngul || '']));
    copyAsHtmlTable(rows);
    setCopiedSamples(true);
    setTimeout(() => setCopiedSamples(false), 2000);
  };

  const copyPrep = () => {
    if (!prepCalcs.length) return;
    const rows = [['Component', ...prepCalcs.map(s => s.name)]];
    rows.push([`Lysis buffer (µL)`, ...prepCalcs.map(s => s.lysisVol)]);
    rows.push([`Lysate (${load} µg)`, ...prepCalcs.map(s => s.lysateVol)]);
    rows.push([`${bufX}× Sample Buffer (µL)`, ...prepCalcs.map(s => s.bufferVol)]);
    rows.push(['Total (µL)', ...prepCalcs.map(s => s.overflow ? s.adjTotalVol : String(totalVol))]);
    copyAsHtmlTable(rows);
    setCopiedPrep(true);
    setTimeout(() => setCopiedPrep(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-sm">
          <HiMiniChartBar className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">BCA assay</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">BCA / Bradford standard curve & SDS-PAGE sample prep</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v); onTabChange?.(v); }}>
        <TabsList className="bg-slate-200/90 dark:bg-slate-950/80 border border-slate-300/40 dark:border-slate-800/60 shadow-sm p-1">
          <TabsTrigger value="standards" className="flex items-center gap-2">
            <BsGraphUpArrow className="w-4 h-4" />
            Standard Curve & Samples
          </TabsTrigger>
          <TabsTrigger value="prep" className="flex items-center gap-2">
            <HiMiniTableCells className="w-4 h-4" />
            SDS-PAGE Sample Prep
          </TabsTrigger>
        </TabsList>

        {tabs}

        {/* ─── STANDARDS ─── */}
        <TabsContent value="standards" className="mt-3 grid gap-4 min-[1180px]:grid-cols-2">
          <Card className="border-0 shadow-sm bg-white dark:bg-white/10 min-[1180px]:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-slate-800 dark:text-slate-200">Assay Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-full space-y-2 sm:w-60">
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-200">Working reagent (WR) volume</Label>
                  <div className="flex items-center gap-2">
                    <NumInput value={wrVolume} onChange={e => setWrVolume(e.target.value)} placeholder="1" className="border-slate-200 dark:border-slate-700 h-9 text-sm" />
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-6">mL</span>
                  </div>
                </div>

                <div className="w-full space-y-2 sm:w-60">
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-200">Sample volume added to WR</Label>
                  <div className="flex items-center gap-2">
                    <NumInput value={sampleVolInWR} onChange={e => setSampleVolInWR(e.target.value)} placeholder="10" className="border-slate-200 dark:border-slate-700 h-9 text-sm" />
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-6">µL</span>
                  </div>
                </div>

                <div className="flex items-end pb-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-800/50">
                    <span>Dilution factor:</span>
                    <span className="font-bold text-black-600 dark:text-white-400">
                      ×{((sVol + wrVol * 1000) / sVol).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Standards table */}
          <div className="contents">
            {/* Standards table */}
            <Card className="order-1 border-0 shadow-sm bg-white dark:bg-white/10">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">a) Standards Table</CardTitle>
                  <div className="flex items-center gap-2">
                    <button onClick={copyStandards} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg transition-colors">
                      {copiedStd ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copiedStd ? 'Copied!' : 'Copy'}
                    </button>
                    <CopyImageButton targetRef={standardsTableRef} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div ref={standardsTableRef} className="space-y-2 bg-white dark:bg-slate-900 p-1 rounded-xl">
                  <p className="px-2 text-[11px] text-slate-400">Tip: paste a spreadsheet column directly into the first editable cell.</p>
                  <div><table className="mx-auto w-full max-w-[760px] table-fixed text-xs">
                    <thead>
                      <tr className="bg-pink-50">
                        <th className="w-[24%] py-1 px-1 text-center font-bold text-slate-700 dark:text-slate-200">Std (µg/mL)</th>
                        <th className="w-[46%] py-1 px-1 text-center font-bold text-slate-700 dark:text-slate-200">2mg/mL BSA (µL) per {wrVolume}mL WR</th>
                        <th className="w-[30%] py-1 px-1 text-center font-bold text-slate-700 dark:text-slate-200">Absorbance (A<sub>562</sub>)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standards.map((s, i) => {
                        const c = parseFloat(s.conc);
                        return (
                          <tr key={s.id} onContextMenu={e=>{e.preventDefault();setRowMenu({type:'standard',index:i,x:e.clientX,y:e.clientY})}} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-1 px-2 text-center">
                              <NumInput value={s.conc} onPaste={e=>pasteStandards(e,i,'conc')} onChange={e => setStandards(standards.map(x => x.id === s.id ? { ...x, conc: e.target.value } : x))}
                                className="h-7 w-full border-0 bg-transparent px-0 text-center text-sm shadow-none focus-visible:ring-0" placeholder="µg/mL" />
                            </td>
                            <td className="py-1 px-2 text-center font-roboto text-pink-700 text-sm">
                              {!isNaN(c) ? (c === 0 ? '0' : formatNumber((bsaVolForStd(c) * wrVol).toFixed(3))) : '—'}
                            </td>
                            <td className="py-1 px-1 text-center">
                              <NumInput value={s.abs} onPaste={e=>pasteStandards(e,i,'abs')} onChange={e => setStandards(standards.map(x => x.id === s.id ? { ...x, abs: e.target.value } : x))}
                                className="h-7 w-full border-0 bg-transparent px-0 text-center text-sm shadow-none focus-visible:ring-0" placeholder="0.000" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table></div>
                </div>
                <button onClick={addStandard} className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded-lg w-full justify-center mt-1">
                  <Plus className="w-3 h-3" /> Add Standard
                </button>
              </CardContent>
            </Card>

            {/* Regression */}
            <Card className="order-3 border-0 shadow-sm bg-gradient-to-br from-pink-50 to-rose-50 flex flex-col h-full min-[1180px]:col-start-1 min-[1180px]:row-start-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <BsGraphUpArrow className="w-4 h-4 text-pink-600" /> Standard Curve
                </CardTitle>
              </CardHeader>
              <CardContent className="grid flex-1 items-stretch gap-4 sm:grid-cols-2">
                {regression ? (
                  <>
                    <div className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-pink-100/70 bg-white/45 p-3">
                      <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Standard Curve Plot</h4>
                      <div className="w-full bg-white/80 dark:bg-slate-900/90 rounded-xl p-2 border border-pink-100 shadow-inner relative group overflow-hidden max-w-[360px] aspect-[1.2/1]">
                        <svg viewBox="0 0 100 80" className="w-full h-full overflow-visible">
                          <line x1="15" y1="10" x2="15" y2="65" stroke="#e2e8f0" strokeWidth="0.5" />
                          <line x1="15" y1="65" x2="95" y2="65" stroke="#e2e8f0" strokeWidth="0.5" />
                          <text x="55" y="76" textAnchor="middle" className="text-[5px] fill-slate-400 font-medium">Conc (µg/mL)</text>
                          <text x="6" y="37.5" textAnchor="middle" transform="rotate(-90 6,37.5)" className="text-[5px] fill-slate-400 font-medium">Absorbance</text>
                          {(() => {
                            const validPoints = standards.filter(s => s.abs !== '' && !isNaN(parseFloat(s.abs)) && !isNaN(parseFloat(s.conc))).map(s => ({ x: parseFloat(s.conc), y: parseFloat(s.abs) }));
                            if (validPoints.length < 2) return null;
                            const minX = Math.min(...validPoints.map(p => p.x)),maxX = Math.max(...validPoints.map(p => p.x)),maxY = Math.max(...validPoints.map(p => p.y)) * 1.1;
                            const scaleX = x => 15 + ((x - minX) / (maxX - minX || 1)) * 80;
                            const scaleY = y => Number.isFinite(y) && Number.isFinite(maxY) && maxY > 0 ? 65 - (y / maxY) * 55 : 65;
                            const x1 = minX,y1 = regression.slope * x1 + regression.intercept,x2 = maxX,y2 = regression.slope * x2 + regression.intercept;
                            return <><line x1={scaleX(x1)} y1={scaleY(y1)} x2={scaleX(x2)} y2={scaleY(y2)} stroke="#db2777" strokeWidth="1" strokeDasharray="2,2" />{validPoints.map((p,idx)=><circle key={idx} cx={scaleX(p.x)} cy={scaleY(p.y)} r="1.5" fill="#ec4899" className="drop-shadow-sm"/>)}</>;
                          })()}
                        </svg>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 rounded-xl border border-pink-100/70 bg-white/45 p-3">
                      <div className="flex justify-between items-center bg-white/60 dark:bg-slate-900/40 rounded-lg p-2 border border-pink-100/50">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Slope (m)</span>
                        <span className="text-sm font-bold text-pink-700">{regression.slope.toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between items-center bg-white/60 dark:bg-slate-900/40 rounded-lg p-2 border border-pink-100/50">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Intercept (c)</span>
                        <span className="text-sm font-bold text-pink-700">{regression.intercept.toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between items-center bg-white/60 dark:bg-slate-900/40 rounded-lg p-2 border border-pink-100/50">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">R²</span>
                        <span className={`text-sm font-bold ${regression.r2 >= 0.99 ? 'text-green-600' : 'text-amber-600'}`}>
                          {regression.r2.toFixed(5)}
                        </span>
                      </div>
                      
                      {/* Formula directly under R2 */}
                      <div className="mt-1 flex flex-1 flex-col items-center justify-center rounded-xl bg-white/45 px-3 py-4">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                          <span className="text-[14px]">Conc =</span>
                          <div className="flex flex-col items-center">
                            <span className="text-[14px] px-1 border-b border-slate-400 pb-0.5 whitespace-nowrap">
                              (Absorbance − {regression.intercept.toFixed(5)})
                            </span>
                            <span className="text-[14px] pt-0.5">
                              {regression.slope.toFixed(6)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center p-6 bg-white/40 rounded-xl border border-dashed border-pink-200">
                    <p className="text-xs text-slate-500">Enter at least 2 standard absorbances to view the curve and calculations.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* b) Samples table */}
          <Card className="order-2 border-0 shadow-sm bg-white dark:bg-white/10 min-[1180px]:col-start-2 min-[1180px]:row-start-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">b) Samples Table</CardTitle>
                <div className="flex items-center gap-2">
                  <button onClick={copySamples} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg">
                    {copiedSamples ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copiedSamples ? 'Copied!' : 'Copy'}
                  </button>
                  <CopyImageButton targetRef={samplesTableRef} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div ref={samplesTableRef} className="space-y-2 rounded-xl bg-white p-1 dark:bg-slate-900">
              <p className="px-2 text-[11px] text-slate-400">Paste names or absorbances as a column; rows are added automatically.</p>
              <div><table className="mx-auto w-full max-w-[900px] table-fixed text-sm">
                <thead>
                  <tr className="bg-pink-50">
                    <th className="w-[24%] py-2 px-1 text-left font-bold text-slate-700 dark:text-slate-200">Sample ID</th>
                    <th className="w-[18%] py-2 px-1 text-center font-bold text-slate-700 dark:text-slate-200">Absorbance</th>
                    <th className="w-[24%] py-2 px-1 text-center font-bold text-slate-700 dark:text-slate-200">Conc in WR (µg/mL)</th>
                    <th className="w-[27%] py-2 px-1 text-center font-bold text-slate-700 dark:text-slate-200">Lysate Conc (ng/µL)</th>
                    <th className="w-[7%] py-2 px-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {unknowns.map((u, i) => {
                    const res = unknownResults[i];
                    return (
                      <tr key={u.id} onContextMenu={e=>{e.preventDefault();setRowMenu({type:'sample',index:i,x:e.clientX,y:e.clientY})}} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1.5 px-3">
                          <Input value={u.name} onPaste={e=>pasteSamples(e,i,'name')} onChange={e => setUnknowns(unknowns.map(x => x.id === u.id ? { ...x, name: e.target.value } : x))}
                            className="h-7 w-full border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0" />
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <NumInput value={u.abs} placeholder="0.000" onPaste={e=>pasteSamples(e,i,'abs')}
                            onChange={e => setUnknowns(unknowns.map(x => x.id === u.id ? { ...x, abs: e.target.value } : x))}
                            className="ml-auto h-7 w-full border-0 bg-transparent px-0 text-right text-sm shadow-none focus-visible:ring-0" />
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-pink-700">
                          {res?.concInWR ? formatNumber(res.concInWR) : '—'}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          {res?.lysateConc_ngul ? (
                            <span className="bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full font-semibold text-xs">
                              {formatNumber(res.lysateConc_ngul)} ng/µL
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-1.5 px-2">
                          {unknowns.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-red-400"
                              onClick={() => setUnknowns(unknowns.filter(x => x.id !== u.id))}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
              </div>
              <button onClick={() => {
                const id = Math.max(...unknowns.map(u => u.id)) + 1;
                setUnknowns([...unknowns, { id, name: `Sample ${id}`, abs: '' }]);
              }} className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded-lg w-full justify-center mt-1">
                <Plus className="w-3 h-3" /> Add Sample
              </button>
              {!regression && <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Enter standard absorbances above to enable sample calculations.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── SDS-PAGE PREP ─── */}
        <TabsContent value="prep" className="mt-6 space-y-6">
          <Card className="border-0 shadow-sm bg-white dark:bg-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">Sample Parameters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600 dark:text-slate-200">Protein to load (µg)</Label>
                  <NumInput value={proteinLoad} onChange={e => setProteinLoad(e.target.value)} placeholder="15" className="border-slate-200 dark:border-slate-700" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600 dark:text-slate-200">Sample buffer stock (×)</Label>
                  <NumInput value={sampleBufferX} onChange={e => setSampleBufferX(e.target.value)} placeholder="6" className="border-slate-200 dark:border-slate-700" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600 dark:text-slate-200">Total volume (µL)</Label>
                  <NumInput value={prepTotalVol} onChange={e => setPrepTotalVol(e.target.value)} placeholder="40" className="border-slate-200 dark:border-slate-700" />
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Samples are auto-imported from the Standard Curve tab. Complete sample up to {prepTotalVol} µL with <strong>lysis buffer</strong>.</p>
            </CardContent>
          </Card>

          {prepCalcs.length > 0 ? (
            <Card className="border-0 shadow-sm bg-gradient-to-br from-pink-50 to-rose-50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-pink-600" /> Sample preparaten mix ({prepCalcs.length} samples)
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <button onClick={copyPrep} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg">
                      {copiedPrep ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copiedPrep ? 'Copied!' : 'Copy Table'}
                    </button>
                    <CopyImageButton targetRef={prepTableRef} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div ref={prepTableRef} className="space-y-4 bg-white dark:bg-slate-900 p-2 rounded-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-blue-50 dark:bg-blue-900/30">
                        <th className="text-left py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Component</th>
                        {prepCalcs.map(s => (
                          <th key={s.id} className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200">{s.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">Lysis buffer</td>
                        {prepCalcs.map(s => (
                          <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(s.lysisVol)}</td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                          Lysate <span className="text-rose-600 dark:text-rose-400 font-semibold">({load} µg)</span>
                        </td>
                        {prepCalcs.map(s => (
                          <td key={s.id} className={`py-2 px-3 text-right font-bold text-rose-600 dark:text-rose-400 ${s.isLow ? '' : s.overflow ? '' : ''}`}>
                            {formatNumber(s.lysateVol)}{s.isLow ? '*' : ''}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{bufX}× Sample Buffer</td>
                        {prepCalcs.map(s => (
                          <td key={s.id} className={`py-2 px-3 text-right font-bold ${s.overflow ? 'text-red-600 dark:text-red-400' : ''}`}>
                            {formatNumber(s.bufferVol)}
                          </td>
                        ))}
                      </tr>
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        <td className="py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Total (µL)</td>
                        {prepCalcs.map(s => (
                         <td key={s.id} className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-100">
                            {s.overflow ? formatNumber(s.adjTotalVol) : formatNumber(prepTotalVol)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                {prepCalcs.filter(s => s.overflow).map((s, i) => (
                  <div key={`ov-${i}`} className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-700 font-semibold">⚠ {s.name}: sample too dilute — lysate volume ({s.lysateVol} µL) exceeds the desired total volume ({prepTotalVol} µL).</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Adjusted total volume: <strong>{s.adjTotalVol} µL</strong> &nbsp;|&nbsp;
                      Adjusted {bufX}× sample buffer: <strong>{s.bufferVol} µL</strong> (to maintain 1× final concentration)
                    </p>
                    <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">Consider concentrating the sample or reducing the protein load.</p>
                  </div>
                ))}
                {prepCalcs.some(s => s.isLow) && prepCalcs.filter(s => s.isLow).map((s, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-400 mt-1">⚠ <strong>{s.name}</strong> requires only {s.lysateVol} µL (&lt;0.5 µL) — consider reducing protein load or using a more concentrated sample.</p>
                ))}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg mt-2">
                  <p className="text-xs text-blue-700 dark:text-blue-300">Heat at 95°C for 5-10 min before loading. Keep on ice until loading.</p>
                </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <Beaker className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Enter sample absorbances in the Standard Curve tab to auto-populate samples here.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      {rowMenu && <div className="fixed z-[120] w-52 rounded-xl border border-slate-200 bg-white p-1.5 text-sm shadow-xl" style={{left:rowMenu.x,top:rowMenu.y}} onClick={e=>e.stopPropagation()}>
        <button onClick={insertRowAfter} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-pink-50"><Plus className="h-4 w-4"/>Add {rowMenu.type} below</button>
        <button onClick={deleteContextRow} disabled={(rowMenu.type==='standard'&&standards.length<=2)||(rowMenu.type==='sample'&&unknowns.length<=1)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 className="h-4 w-4"/>Delete {rowMenu.type}</button>
      </div>}
    </div>
  );
}
