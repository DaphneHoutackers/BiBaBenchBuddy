import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Dna, Eye, EyeOff, FolderOpen, Info, Plus, Play, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { useStoredState } from '@/components/tools/toolUtils';

const BASE_WIDTH = 30;
const LABEL_WIDTH = 112;
const ALIGNMENT_LIBRARY_KEY = 'seq_analyzer_saved_alignments_v1';
const ALIGNMENT_DRAFT_KEY = 'seq_analyzer_alignment_draft_v1';
const OVERVIEW_FEATURE_TYPES = new Set([
  'cds', 'gene', 'promoter', 'terminator', 'rep_origin', 'origin', 'operator',
  'enhancer', 'polya_signal', 'rrna', 'trna', 'ncrna', 'mrna',
]);

const COPY = {
  en: {
    overview: 'Sequence overview', overviewHelp: 'Your sample has real differences relative to the provided reference that are not explained by common sequencing artifacts.', mismatch: 'Mismatch', alignment: 'Alignment', copyImage: 'Copy image', copied: 'Copied!', capturing: 'Capturing...',
    baseTitle: 'Base-by-base alignment', baseHelp: 'Scroll horizontally; red bases are mismatches or gaps.', previousMismatch: 'Previous mismatch', nextMismatch: 'Next mismatch', mismatches: 'mismatches',
    pairwise: 'Pairwise Sequence Alignment', pairwiseHelp: 'Needleman-Wunsch global alignment — compare two DNA sequences', editSequences: 'Edit sequences', collapseSequences: 'Collapse sequences',
    aligning: 'Aligning...', runAgain: 'Run again', start: 'Start Alignment', sequence: 'Sequence', sample: 'Sample', reference: 'Reference', fromLibrary: 'From library...', name: 'Name...', paste: 'Paste DNA sequence or FASTA...',
    enterBoth: 'Enter two sequences.', maximum: 'Maximum 10,000 bp per sequence.', identicalBases: 'Identical bases', identical: 'identical', insertions: 'Insertions', deletions: 'Deletions',
    startHint: 'Start the alignment with the button above; the sequence fields will then collapse automatically.', position: 'Position', feature: 'Feature', type: 'Type', coordinates: 'Coordinates', gap: 'gap',
    savedAlignments: 'Saved alignments', noSaved: 'No saved alignments yet.', newAlignment: 'Add', save: 'Save', alignmentName: 'Alignment name', deleteAlignment: 'Delete alignment', deleteConfirm: 'Delete this saved alignment?', edited: 'Edited', collapsePanel: 'Collapse saved alignments', expandPanel: 'Expand saved alignments', showFeatures: 'Show features', hideFeature: 'Hide feature', length: 'Length',
  },
  nl: {
    overview: 'Sequence-overzicht', overviewHelp: 'Je sample bevat echte verschillen ten opzichte van de opgegeven referentie die niet worden verklaard door veelvoorkomende sequencingartefacten.', mismatch: 'Mismatch', alignment: 'Alignment', copyImage: 'Afbeelding kopiëren', copied: 'Gekopieerd!', capturing: 'Kopiëren...',
    baseTitle: 'Base-by-base alignment', baseHelp: 'Scroll horizontaal; rode bases zijn mismatches of gaps.', previousMismatch: 'Vorige mismatch', nextMismatch: 'Volgende mismatch', mismatches: 'mismatches',
    pairwise: 'Pairwise Sequence Alignment', pairwiseHelp: 'Needleman-Wunsch global alignment — vergelijk twee DNA-sequenties', editSequences: 'Sequences bewerken', collapseSequences: 'Sequences inklappen',
    aligning: 'Aligning...', runAgain: 'Opnieuw uitvoeren', start: 'Start Alignment', sequence: 'Sequentie', sample: 'Sample', reference: 'Referentie', fromLibrary: 'Uit library...', name: 'Naam...', paste: 'Plak DNA-sequentie of FASTA...',
    enterBoth: 'Voer twee sequenties in.', maximum: 'Maximaal 10.000 bp per sequentie.', identicalBases: 'Identieke basen', identical: 'identiek', insertions: 'Inserties', deletions: 'Deleties',
    startHint: 'Start de alignment met de knop bovenaan; de sequencevelden klappen daarna automatisch in.', position: 'Positie', feature: 'Feature', type: 'Type', coordinates: 'Coördinaten', gap: 'gap',
    savedAlignments: 'Opgeslagen alignments', noSaved: 'Nog geen alignments opgeslagen.', newAlignment: 'Toevoegen', save: 'Opslaan', alignmentName: 'Naam alignment', deleteAlignment: 'Alignment verwijderen', deleteConfirm: 'Deze opgeslagen alignment verwijderen?', edited: 'Bewerkt', collapsePanel: 'Opgeslagen alignments inklappen', expandPanel: 'Opgeslagen alignments uitklappen', showFeatures: 'Features tonen', hideFeature: 'Feature verbergen', length: 'Lengte',
  },
};

function readStoredJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage can be unavailable or full */ }
}

function needlemanWunsch(s1, s2, match = 1, mismatch = -1, gap = -2) {
  const n = s1.length, m = s2.length;
  if (n > 10000 || m > 10000) return null;
  const scores = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 0; i <= n; i++) scores[i][0] = i * gap;
  for (let j = 0; j <= m; j++) scores[0][j] = j * gap;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diagonal = scores[i - 1][j - 1] + (s1[i - 1] === s2[j - 1] ? match : mismatch);
      scores[i][j] = Math.max(diagonal, scores[i - 1][j] + gap, scores[i][j - 1] + gap);
    }
  }
  let aligned1 = '', aligned2 = '', midline = '', i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && scores[i][j] === scores[i - 1][j - 1] + (s1[i - 1] === s2[j - 1] ? match : mismatch)) {
      aligned1 = s1[--i] + aligned1;
      aligned2 = s2[--j] + aligned2;
      midline = (s1[i] === s2[j] ? '|' : '.') + midline;
    } else if (i > 0 && scores[i][j] === scores[i - 1][j] + gap) {
      aligned1 = s1[--i] + aligned1;
      aligned2 = '-' + aligned2;
      midline = ' ' + midline;
    } else {
      aligned1 = '-' + aligned1;
      aligned2 = s2[--j] + aligned2;
      midline = ' ' + midline;
    }
  }
  let matches = 0, mismatches = 0, gaps = 0, insertions = 0, deletions = 0;
  for (let k = 0; k < aligned1.length; k++) {
    // Sequence 1 is the sample and sequence 2 is the reference.
    if (aligned1[k] === '-') { gaps++; deletions++; }
    else if (aligned2[k] === '-') { gaps++; insertions++; }
    else if (aligned1[k] === aligned2[k]) matches++;
    else mismatches++;
  }
  return { aligned1, aligned2, midline, score: scores[n][m], length: aligned1.length, matches, mismatches, gaps, insertions, deletions, identity: ((matches / aligned1.length) * 100).toFixed(2) };
}

const cleanSequence = value => String(value || '').toUpperCase().replace(/[^ATGCN]/g, '');

function alignmentCoordinates(alignedSequence) {
  const sourceToAlignment = [];
  let sourceIndex = 0;
  for (let alignmentIndex = 0; alignmentIndex < alignedSequence.length; alignmentIndex++) {
    if (alignedSequence[alignmentIndex] !== '-') sourceToAlignment[sourceIndex++] = alignmentIndex;
  }
  sourceToAlignment[sourceIndex] = alignedSequence.length;
  return sourceToAlignment;
}

function mappedFeatures(features, alignedSequence) {
  const sourceToAlignment = alignmentCoordinates(alignedSequence);
  const priority = { promoter: 0, rep_origin: 1, origin: 1, operator: 2, terminator: 2, polya_signal: 2, cds: 3, gene: 4, rrna: 4, trna: 4, ncrna: 4, mrna: 4, enhancer: 5 };
  const candidates = (features || []).filter(feature => feature.visible !== false && OVERVIEW_FEATURE_TYPES.has(String(feature.type || '').toLowerCase())).map((feature, index) => {
    const sourceStart = Math.max(0, Number(feature.start) || 0);
    const sourceEnd = Math.max(sourceStart + 1, Number(feature.end) || sourceStart + 1);
    const start = sourceToAlignment[Math.min(sourceStart, sourceToAlignment.length - 1)] ?? 0;
    const end = sourceToAlignment[Math.min(sourceEnd, sourceToAlignment.length - 1)] ?? alignedSequence.length;
    return { ...feature, key: feature.id || `${feature.label}-${index}`, alignmentStart: start, alignmentEnd: Math.max(start + 1, end) };
  });
  return candidates
    .sort((a, b) => (priority[String(a.type).toLowerCase()] ?? 9) - (priority[String(b.type).toLowerCase()] ?? 9) || (b.alignmentEnd - b.alignmentStart) - (a.alignmentEnd - a.alignmentStart))
    .filter((feature, index, sorted) => !sorted.slice(0, index).some(kept => {
      const overlap = Math.max(0, Math.min(feature.alignmentEnd, kept.alignmentEnd) - Math.max(feature.alignmentStart, kept.alignmentStart));
      const shortest = Math.min(feature.alignmentEnd - feature.alignmentStart, kept.alignmentEnd - kept.alignmentStart);
      return overlap / Math.max(1, shortest) > 0.7;
    }))
    .sort((a, b) => a.alignmentStart - b.alignmentStart);
}

function FeatureTrack({ name, features, alignedSequence, length, hidden, onHideFeature, t }) {
  const mapped = useMemo(() => mappedFeatures(features, alignedSequence).filter(feature => !hidden.has(feature.key)), [features, alignedSequence, hidden]);
  return (
    <div className="relative z-10 grid grid-cols-[140px_1fr] items-center gap-3">
      <div className="whitespace-normal text-right text-[10px] font-semibold leading-tight text-slate-500" title={name}>{name}</div>
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-300" />
        {mapped.map(feature => {
          const left = (feature.alignmentStart / length) * 100;
          const width = Math.max(0.7, ((feature.alignmentEnd - feature.alignmentStart) / length) * 100);
          const reverse = Number(feature.strand) === -1;
          const label = feature.label || feature.type || t.feature;
          return <button key={feature.key} type="button" className="group absolute top-1/2 z-10 h-6 -translate-y-1/2 focus:outline-none hover:z-40 focus:z-40" style={{ left: `${left}%`, width: `${width}%`, minWidth: 6 }} aria-label={`${label}, ${Number(feature.start) + 1}–${feature.end}`}>
            <span className="flex h-full w-full items-center justify-center overflow-hidden border-2 border-white px-2 text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: feature.color || '#0f766e', clipPath: reverse ? 'polygon(8px 0,100% 0,100% 100%,8px 100%,0 50%)' : 'polygon(0 0,calc(100% - 8px) 0,100% 50%,calc(100% - 8px) 100%,0 100%)' }}>{width > 8 && label.length <= Math.max(3, Math.floor(width / 2.2)) ? label : ''}</span>
            <span role="tooltip" className="pointer-events-none group-hover:pointer-events-auto absolute bottom-full left-1/2 z-[9999] mb-2 invisible min-w-48 opacity-0 transition-opacity delay-1000 group-hover:visible group-hover:opacity-100 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-xl">
              <strong className="block truncate text-xs text-slate-800">{label}</strong>
              <span className="mt-1 block text-[10px] font-medium text-slate-500">{t.type}: {feature.type || t.feature}</span>
              <span className="block text-[10px] text-slate-400">{t.coordinates}: {Number(feature.start) + 1}–{feature.end} bp</span>
              <span className="block text-[10px] text-slate-400">{t.length}: {Math.max(1, Number(feature.end) - Number(feature.start))} bp</span>
              <span role="button" tabIndex={0} onClick={event => { event.stopPropagation(); onHideFeature(feature); }} className="mt-2 flex items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"><EyeOff className="h-3 w-3" />{t.hideFeature}</span>
            </span>
          </button>;
        })}
      </div>
    </div>
  );
}

function AlignmentOverview({ result, name1, name2, features1, features2, differences, viewport, onJump, onNavigate, hidden1, hidden2, onHide1, onHide2, onShow1, onShow2, onHideFeature, t }) {
  const length = result.length || 1;
  const overviewRef = useRef(null);
  const featureOptions = useMemo(() => {
    const options = new Map();
    [[features1, result.aligned1], [features2, result.aligned2]].forEach(([items, aligned], track) => {
      mappedFeatures(items, aligned).forEach(feature => {
        const label = feature.label || feature.type || t.feature;
        const normalized = label.toLowerCase();
        const option = options.get(normalized) || { label, entries: [] };
        option.entries.push({ track, key: feature.key });
        options.set(normalized, option);
      });
    });
    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [features1, features2, result.aligned1, result.aligned2, t.feature]);
  const differenceRuns = useMemo(() => differences.reduce((runs, difference, differenceArrayIndex) => {
    const previous = runs[runs.length - 1];
    if (previous && difference.index <= previous.end + 1) {
      previous.end = Math.max(previous.end, difference.index);
      return runs;
    }
    runs.push({ start: difference.index, end: difference.index, differenceArrayIndex, difference });
    return runs;
  }, []), [differences]);
  return (
    <section className="overflow-visible max-md:overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/70" aria-label="Alignment overview">
      <div ref={overviewRef} className="min-w-[680px] px-3 py-3 sm:px-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5"><h4 className="text-sm font-bold text-slate-700">{t.overview}</h4><span className="group relative inline-flex" tabIndex={0}><Info className="h-3.5 w-3.5 cursor-help text-slate-400" aria-label={t.overviewHelp} /><span role="tooltip" className="pointer-events-none invisible absolute left-0 top-full z-[10000] mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-relaxed text-slate-600 opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100"><strong className="mb-1 block text-slate-800">{t.mismatch}</strong>{t.overviewHelp}</span></span></div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500"><details data-html2canvas-ignore="true" className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.removeAttribute('open'); }}><summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-md border border-slate-200 bg-white px-2 font-semibold"><Eye className="h-3 w-3" />{t.showFeatures}</summary><div className="absolute right-0 z-[9999] mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-2xl">{featureOptions.map(option => { const hidden = option.entries.every(entry => entry.track === 0 ? hidden1.has(entry.key) : hidden2.has(entry.key)); return <button key={option.label} type="button" onClick={() => option.entries.forEach(entry => entry.track === 0 ? (hidden ? onShow1(entry.key) : onHide1(entry.key)) : (hidden ? onShow2(entry.key) : onHide2(entry.key)))} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-slate-50">{hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}<span className="truncate">{option.label}</span></button>; })}</div></details><CopyImageButton targetRef={overviewRef} label={t.copyImage} copiedLabel={t.copied} capturingLabel={t.capturing} data-html2canvas-ignore="true" className="h-7 gap-1.5 px-2 text-[10px]" /></div>
      </div>
      <div className="relative space-y-1" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); const x = Math.max(0, event.clientX - rect.left - 152); if (x >= 0) onNavigate(Math.min(length - 1, Math.floor((x / Math.max(1, rect.width - 152)) * length))); }}>
        <div data-html2canvas-ignore="true" className="pointer-events-none absolute inset-y-0 z-20 rounded-sm bg-slate-400/30 transition-[left,width] duration-100" style={{ left: `calc(152px + (100% - 152px) * ${viewport.start / length})`, width: `max(6px, calc((100% - 152px) * ${(viewport.end - viewport.start) / length}))` }} />
        <FeatureTrack name={name1} features={features1} alignedSequence={result.aligned1} length={length} hidden={hidden1} onHideFeature={onHideFeature} t={t} />
        <FeatureTrack name={name2} features={features2} alignedSequence={result.aligned2} length={length} hidden={hidden2} onHideFeature={onHideFeature} t={t} />
        {differenceRuns.map(run => <span key={`${run.start}-${run.end}`} className="contents"><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-[1] border-x border-red-300/25 bg-red-400/15" style={{ left: `calc(152px + (100% - 152px) * ${run.start / length})`, width: `max(2px, calc((100% - 152px) * ${(run.end - run.start + 1) / length}))` }} /><button type="button" onClick={event => { event.stopPropagation(); onJump(run.differenceArrayIndex); }} className="absolute bottom-0 top-0 z-30 w-5 -translate-x-1/2 bg-transparent" style={{ left: `calc(152px + (100% - 152px) * ${((run.start + run.end) / 2 + .5) / length})` }} title={`${t.mismatch} ${run.differenceArrayIndex + 1}: ${run.difference.base1} → ${run.difference.base2}`}><AlertTriangle className="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2 fill-red-500 text-white" /></button></span>)}
      </div>
      </div>
    </section>
  );
}

function BaseRow({ label, sequence, otherSequence, selectedIndex, onSelect, t }) {
  return <div className="flex h-10 items-center"><div className="sticky left-0 z-20 flex h-full w-28 flex-none items-center border-r border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-[4px_0_8px_-7px_rgba(15,23,42,.5)]"><span className="truncate" title={label}>{label}</span></div>{sequence.split('').map((base, index) => { const differs = base !== otherSequence[index]; const selected = selectedIndex === index; return <button type="button" key={index} onClick={() => onSelect(index)} className={`flex h-8 w-[30px] flex-none items-center justify-center border-y font-mono text-sm font-semibold transition-colors ${differs ? 'border-red-300 bg-red-50 text-red-600' : selected ? 'border-slate-300 bg-slate-200 text-slate-800' : 'border-slate-100 text-slate-600 hover:bg-slate-100'} ${selected && differs ? 'bg-red-100 ring-2 ring-inset ring-slate-400' : ''} ${base === '-' ? 'text-slate-300' : ''}`} title={`${t.position} ${index + 1}: ${base}`}>{base}</button>; })}</div>;
}

function SequenceViewer({ result, name1, name2, differences, activeDifference, onActiveDifference, requestedIndex, viewport, onViewport, t }) {
  const scrollRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const scrollToDifference = index => {
    if (!differences.length) return;
    const normalized = (index + differences.length) % differences.length;
    onActiveDifference(normalized);
    const element = scrollRef.current;
    if (element) element.scrollTo({ left: Math.max(0, differences[normalized].index * BASE_WIDTH - element.clientWidth / 2), behavior: 'smooth' });
  };
  useEffect(() => {
    if (activeDifference < 0 || activeDifference >= differences.length) return;
    setSelectedIndex(differences[activeDifference].index);
    const element = scrollRef.current;
    if (element) element.scrollTo({ left: Math.max(0, differences[activeDifference].index * BASE_WIDTH - element.clientWidth / 2), behavior: 'smooth' });
  }, [activeDifference, differences]);
  useEffect(() => {
    if (requestedIndex == null) return;
    setSelectedIndex(requestedIndex);
    const element = scrollRef.current;
    if (element) element.scrollTo({ left: Math.max(0, requestedIndex * BASE_WIDTH - element.clientWidth / 2), behavior: 'smooth' });
  }, [requestedIndex]);
  const updateViewport = () => {
    const element = scrollRef.current;
    if (!element) return;
    const visibleWidth = Math.max(1, element.clientWidth - LABEL_WIDTH);
    const start = Math.max(0, Math.floor(element.scrollLeft / BASE_WIDTH));
    const end = Math.min(result.length, Math.ceil((element.scrollLeft + visibleWidth) / BASE_WIDTH));
    onViewport({ start, end });
  };
  useEffect(() => {
    updateViewport();
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateViewport);
    observer.observe(element);
    return () => observer.disconnect();
  }, [result.length]);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2"><h4 className="text-sm font-bold text-slate-700">{t.baseTitle}</h4><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600">bp {viewport.start + 1}–{Math.max(viewport.start + 1, viewport.end)}</span></div>
      <div ref={scrollRef} onScroll={updateViewport} className="overflow-x-auto scroll-smooth pb-2" tabIndex={0} aria-label="Scrollable aligned sequences">
        <div style={{ width: LABEL_WIDTH + result.length * BASE_WIDTH }}>
          <div className="flex h-8 items-end border-b border-slate-100 pb-1 text-[9px] text-slate-400"><span className="sticky left-0 z-20 w-28 flex-none bg-white" />{result.aligned1.split('').map((_, index) => { const mismatch = result.aligned1[index] !== result.aligned2[index]; const selected = selectedIndex === index; return <span key={index} className={`w-[30px] flex-none text-center leading-none ${mismatch ? 'font-extrabold text-red-500' : selected ? 'font-extrabold text-slate-900' : ''}`}>{mismatch || selected || index % 10 === 0 ? index + 1 : ''}</span>; })}</div>
          <BaseRow label={name1} sequence={result.aligned1} otherSequence={result.aligned2} selectedIndex={selectedIndex} onSelect={setSelectedIndex} t={t} />
          <BaseRow label={name2} sequence={result.aligned2} otherSequence={result.aligned1} selectedIndex={selectedIndex} onSelect={setSelectedIndex} t={t} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2"><button type="button" onClick={() => scrollToDifference(activeDifference - 1)} disabled={!differences.length} className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-teal-700 disabled:opacity-30" aria-label={t.previousMismatch}><ChevronLeft className="h-4 w-4" /></button><span className="min-w-32 text-center text-xs font-semibold text-slate-600">{differences.length ? `${activeDifference + 1} / ${differences.length} ${t.mismatches}` : `0 ${t.mismatches}`}</span><button type="button" onClick={() => scrollToDifference(activeDifference + 1)} disabled={!differences.length} className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-teal-700 disabled:opacity-30" aria-label={t.nextMismatch}><ChevronRight className="h-4 w-4" /></button></div>
    </section>
  );
}

function SavedAlignmentPanel({ items, activeId, onOpen, onDelete, onNew, collapsed, onToggle, t, language }) {
  if (collapsed) {
    return (
      <aside className="flex min-h-48 flex-col items-center border-l border-slate-200 bg-slate-50/70 py-3">
        <button type="button" onClick={onToggle} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-100 hover:text-slate-800" aria-label={t.expandPanel} title={t.expandPanel}><ChevronLeft className="h-4 w-4" /></button>
      </aside>
    );
  }
  return (
    <aside className="min-h-48 overflow-hidden border-l border-slate-200 bg-slate-50/70 xl:sticky xl:top-3 xl:max-h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-2 py-2">
        <div className="flex min-w-0 items-center gap-1"><button type="button" onClick={onToggle} className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700" aria-label={t.collapsePanel} title={t.collapsePanel}><ChevronRight className="h-4 w-4" /></button><h4 className="truncate text-xs font-bold text-slate-700">{t.savedAlignments}</h4></div>
        <button type="button" onClick={onNew} className="flex h-7 flex-none items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"><Plus className="h-3 w-3" />{t.newAlignment}</button>
      </div>
      <div className="max-h-[calc(100vh-165px)] overflow-y-auto p-2">
        {items.length === 0 && <div className="px-3 py-8 text-center"><FolderOpen className="mx-auto mb-2 h-5 w-5 text-slate-300" /><p className="text-[11px] text-slate-400">{t.noSaved}</p></div>}
        {items.map(item => (
          <div key={item.id} className={`group mb-1 flex items-start gap-1 rounded-lg border px-2 py-2 ${activeId === item.id ? 'border-slate-300 bg-white shadow-sm' : 'border-transparent hover:bg-white'}`}>
            <button type="button" onClick={() => onOpen(item)} className="min-w-0 flex-1 text-left">
              <strong className="block truncate text-xs text-slate-700">{item.title}</strong>
              <span className="mt-0.5 block truncate text-[10px] text-slate-400">{item.name1} × {item.name2}</span>
              <span className="mt-1 block text-[9px] text-slate-400">{t.edited} {new Date(item.updatedAt).toLocaleDateString(language === 'nl' ? 'nl-NL' : 'en-US')}</span>
            </button>
            <button type="button" onClick={() => onDelete(item.id)} className="rounded p-1 text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 focus:opacity-100" aria-label={t.deleteAlignment}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function AlignmentView({ seq, seqName, features = [], library = [], language = 'en', storageScope = 'guest', draftId = 'default' }) {
  const draftStorageKey = `${ALIGNMENT_DRAFT_KEY}_${storageScope}_${draftId}`;
  const libraryStorageKey = `${ALIGNMENT_LIBRARY_KEY}_${storageScope}`;
  const initialDraftRef = useRef(readStoredJson(draftStorageKey, null));
  const initialDraft = initialDraftRef.current;
  const [seq1, setSeq1] = useState(initialDraft?.seq1 ?? seq ?? '');
  const [seq2, setSeq2] = useState(initialDraft?.seq2 ?? '');
  const [name1, setName1] = useState(initialDraft?.name1 ?? seqName ?? 'Sample');
  const [name2, setName2] = useState(initialDraft?.name2 ?? (language === 'nl' ? 'Referentie' : 'Reference'));
  const [features1, setFeatures1] = useState(initialDraft?.features1 ?? features ?? []);
  const [features2, setFeatures2] = useState(initialDraft?.features2 ?? []);
  const [result, setResult] = useState(initialDraft?.result ?? null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [inputCollapsed, setInputCollapsed] = useState(initialDraft?.inputCollapsed ?? false);
  const [activeDifference, setActiveDifference] = useState(initialDraft?.activeDifference ?? 0);
  const [viewport, setViewport] = useState({ start: 0, end: 1 });
  const [requestedIndex, setRequestedIndex] = useState(null);
  const [hiddenFeatures1, setHiddenFeatures1] = useState(() => new Set());
  const [hiddenFeatures2, setHiddenFeatures2] = useState(() => new Set());
  const [savedAlignments, setSavedAlignments] = useStoredState(libraryStorageKey, []);
  const [activeSavedId, setActiveSavedId] = useState(initialDraft?.activeSavedId ?? null);
  const [alignmentTitle, setAlignmentTitle] = useState(initialDraft?.alignmentTitle ?? '');
  const [savedPanelCollapsed, setSavedPanelCollapsed] = useState(false);
  const t = COPY[language] || COPY.en;
  const differences = useMemo(() => result ? result.aligned1.split('').flatMap((base1, index) => base1 === result.aligned2[index] ? [] : [{ index, base1, base2: result.aligned2[index] }]) : [], [result]);

  const initializeFeatureVisibility = (nextResult, nextFeatures1 = features1, nextFeatures2 = features2) => {
    const initiallyHidden = (items, aligned) => new Set(mappedFeatures(items, aligned)
      .filter(feature => !['cds', 'promoter', 'terminator', 'rep_origin', 'origin', 'operator'].includes(String(feature.type || '').toLowerCase()))
      .map(feature => feature.key));
    setHiddenFeatures1(initiallyHidden(nextFeatures1, nextResult.aligned1));
    setHiddenFeatures2(initiallyHidden(nextFeatures2, nextResult.aligned2));
  };
  const hideFeatureByLabel = feature => {
    if (!result || !feature) return;
    const label = String(feature.label || feature.type || '').toLowerCase();
    setHiddenFeatures1(previous => new Set([...previous, ...mappedFeatures(features1, result.aligned1).filter(item => String(item.label || item.type || '').toLowerCase() === label).map(item => item.key)]));
    setHiddenFeatures2(previous => new Set([...previous, ...mappedFeatures(features2, result.aligned2).filter(item => String(item.label || item.type || '').toLowerCase() === label).map(item => item.key)]));
  };

  useEffect(() => {
    writeStoredJson(draftStorageKey, { seq1, seq2, name1, name2, features1, features2, result, inputCollapsed, activeDifference, activeSavedId, alignmentTitle });
  }, [draftStorageKey, seq1, seq2, name1, name2, features1, features2, result, inputCollapsed, activeDifference, activeSavedId, alignmentTitle]);

  const runAlignment = () => {
    const first = cleanSequence(seq1), second = cleanSequence(seq2);
    if (!first || !second) { setError(t.enterBoth); return; }
    if (first.length > 10000 || second.length > 10000) { setError(t.maximum); return; }
    setError(''); setRunning(true);
    setTimeout(() => {
      const nextResult = needlemanWunsch(first, second);
      setResult(nextResult); setActiveDifference(0); setViewport({ start: 0, end: Math.min(nextResult.length, 60) }); setInputCollapsed(true); setRunning(false);
      initializeFeatureVisibility(nextResult);
      if (!alignmentTitle.trim()) setAlignmentTitle(`${name1} vs ${name2}`);
    }, 50);
  };
  const selectLibraryEntry = (entry, number) => {
    if (!entry) return;
    if (number === 1) { setSeq1(entry.sequence); setName1(entry.name); setFeatures1(entry.features || []); }
    else { setSeq2(entry.sequence); setName2(entry.name); setFeatures2(entry.features || []); }
    setResult(null);
    setInputCollapsed(false);
  };
  const jumpToDifference = index => { if (differences.length) setActiveDifference((index + differences.length) % differences.length); };
  const persistSavedAlignments = next => {
    setSavedAlignments(next);
  };
  const saveAlignment = () => {
    if (!result) return;
    const now = new Date().toISOString();
    const id = activeSavedId || `alignment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const previous = savedAlignments.find(item => item.id === id);
    const item = {
      id, title: alignmentTitle.trim() || `${name1} vs ${name2}`, name1, name2, seq1, seq2,
      features1, features2, result, createdAt: previous?.createdAt || now, updatedAt: now,
    };
    const next = [item, ...savedAlignments.filter(saved => saved.id !== id)];
    persistSavedAlignments(next);
    setActiveSavedId(id);
    setAlignmentTitle(item.title);
  };
  const openSavedAlignment = item => {
    setSeq1(item.seq1); setSeq2(item.seq2); setName1(item.name1); setName2(item.name2);
    setFeatures1(item.features1 || []); setFeatures2(item.features2 || []); setResult(item.result || needlemanWunsch(cleanSequence(item.seq1), cleanSequence(item.seq2)));
    initializeFeatureVisibility(item.result || needlemanWunsch(cleanSequence(item.seq1), cleanSequence(item.seq2)), item.features1 || [], item.features2 || []);
    setInputCollapsed(true); setActiveDifference(0); setViewport({ start: 0, end: Math.min(item.result?.length || 60, 60) });
    setActiveSavedId(item.id); setAlignmentTitle(item.title); setError('');
  };
  const deleteSavedAlignment = id => {
    if (!window.confirm(t.deleteConfirm)) return;
    persistSavedAlignments(savedAlignments.filter(item => item.id !== id));
    if (activeSavedId === id) setActiveSavedId(null);
  };
  const startNewAlignment = () => {
    setSeq1(seq || ''); setSeq2(''); setName1(seqName || 'Sample'); setName2(language === 'nl' ? 'Referentie' : 'Reference');
    setFeatures1(features || []); setFeatures2([]); setResult(null); setInputCollapsed(false); setActiveDifference(0); setViewport({ start: 0, end: 1 });
    setActiveSavedId(null); setAlignmentTitle(''); setError('');
  };

  return (
    <div className={`grid min-h-0 transition-[grid-template-columns] duration-200 ${savedPanelCollapsed ? 'md:grid-cols-[minmax(0,1fr)_44px]' : 'md:grid-cols-[minmax(0,1fr)_280px]'}`}>
      <div className="min-w-0 space-y-2 p-4">
      <div className="space-y-1 pr-0 md:pr-2">
        <h3 className="text-base font-semibold text-slate-700">{t.pairwise}</h3>
        <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
          <input value={alignmentTitle} onChange={event => setAlignmentTitle(event.target.value)} placeholder={t.alignmentName} className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
          <div className="flex flex-none items-center gap-2">
            {result && <Button variant="outline" size="sm" onClick={() => setInputCollapsed(value => !value)} className="h-9 gap-1.5 whitespace-nowrap px-3 text-xs">{inputCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}{inputCollapsed ? t.editSequences : t.collapseSequences}</Button>}
            <Button variant="outline" size="sm" onClick={saveAlignment} disabled={!result} className="h-9 gap-1.5 whitespace-nowrap px-3 text-xs"><Save className="h-3.5 w-3.5" />{t.save}</Button>
            <Button onClick={runAlignment} disabled={running} size="sm" className="h-9 gap-1.5 whitespace-nowrap bg-teal-600 px-3 hover:bg-teal-700">{running ? <RotateCcw className="h-4 w-4 animate-spin" /> : result ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}{running ? t.aligning : result ? t.runAgain : t.start}</Button>
          </div>
        </div>
      </div>
      <div className={`mr-0 grid overflow-hidden transition-[max-height,opacity] duration-300 md:mr-4 md:grid-cols-2 md:gap-3 ${inputCollapsed ? 'max-h-0 opacity-0' : 'max-h-[650px] opacity-100'}`} aria-hidden={inputCollapsed}>
        {[{ number: 1, role: t.sample, name: name1, setName: setName1, sequence: seq1, setSequence: setSeq1 }, { number: 2, role: t.reference, name: name2, setName: setName2, sequence: seq2, setSequence: setSeq2 }].map(field => <div key={field.number} className="pb-1"><label className="mb-1 block text-xs font-medium text-slate-600">{field.role} <span className="text-slate-400">({cleanSequence(field.sequence).length} bp)</span></label><div className="mb-1 flex gap-1"><input value={field.name} onChange={event => field.setName(event.target.value)} placeholder={t.name} className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs" />{library.length > 0 && <select className="w-28 truncate rounded-md border border-slate-200 bg-white px-1 py-1 text-xs text-slate-600" onChange={event => { selectLibraryEntry(library.find(item => item.id === event.target.value), field.number); event.target.value = ''; }} defaultValue=""><option value="" disabled>{t.fromLibrary}</option>{library.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div><Textarea value={field.sequence} onChange={event => { field.setSequence(event.target.value); setResult(null); }} placeholder={t.paste} className="h-[260px] min-h-[180px] resize-y border-slate-200 bg-white font-mono text-xs leading-relaxed" /></div>)}
      </div>
      {error && <p className="mr-0 text-xs text-red-500 md:mr-4">{error}</p>}
      {result && <div className="mr-0 space-y-2 md:mr-2"><div className="grid grid-cols-[minmax(240px,2fr)_repeat(3,minmax(88px,1fr))] overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 text-slate-700"><div className="border-r border-slate-200 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t.identicalBases}</p><div className="mt-0.5 flex items-baseline gap-3 whitespace-nowrap"><strong className="text-sm font-bold text-slate-800">{result.matches.toLocaleString()} / {result.length.toLocaleString()} bp</strong><span className="text-xs font-semibold text-slate-500">{result.identity}% {t.identical}</span></div></div>{[[t.mismatch, result.mismatches], [t.insertions, result.insertions], [t.deletions, result.deletions]].map(([label, value]) => <div key={label} className="border-r border-slate-200 px-3 py-2 last:border-r-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 text-sm font-bold text-slate-800">{value.toLocaleString()}</p></div>)}</div><AlignmentOverview result={result} name1={name1} name2={name2} features1={features1} features2={features2} differences={differences} viewport={viewport} onJump={jumpToDifference} onNavigate={setRequestedIndex} hidden1={hiddenFeatures1} hidden2={hiddenFeatures2} onHide1={key => setHiddenFeatures1(previous => new Set(previous).add(key))} onHide2={key => setHiddenFeatures2(previous => new Set(previous).add(key))} onShow1={key => setHiddenFeatures1(previous => { const next = new Set(previous); next.delete(key); return next; })} onShow2={key => setHiddenFeatures2(previous => { const next = new Set(previous); next.delete(key); return next; })} onHideFeature={hideFeatureByLabel} t={t} /><SequenceViewer result={result} name1={name1} name2={name2} differences={differences} activeDifference={activeDifference} onActiveDifference={setActiveDifference} requestedIndex={requestedIndex} viewport={viewport} onViewport={setViewport} t={t} /></div>}
      {!result && !inputCollapsed && <div className="mr-0 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 md:mr-4"><Dna className="h-4 w-4" />{t.startHint}</div>}
      </div>
      <SavedAlignmentPanel items={savedAlignments} activeId={activeSavedId} onOpen={openSavedAlignment} onDelete={deleteSavedAlignment} onNew={startNewAlignment} collapsed={savedPanelCollapsed} onToggle={() => setSavedPanelCollapsed(value => !value)} t={t} language={language} />
    </div>
  );
}
