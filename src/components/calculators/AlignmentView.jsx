import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Dna, Eye, EyeOff, FolderOpen, Info, Plus, Play, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { useStoredState } from '@/components/tools/toolUtils';

const BASE_WIDTH = 28;
const LABEL_WIDTH = 100;
const ALIGNMENT_LIBRARY_KEY = 'seq_analyzer_saved_alignments_v1';
const ALIGNMENT_DRAFT_KEY = 'seq_analyzer_alignment_draft_v1';
const _OVERVIEW_FEATURE_TYPES = new Set([
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

const revComp = s => {
  if (!s) return '';
  const complement = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G', 'N': 'N', 'a': 't', 't': 'a', 'g': 'c', 'c': 'g', 'n': 'n' };
  return s.split('').reverse().map(b => complement[b] || b).join('');
};

function gotohAlign(s1, s2, { freeEndGaps1 = false, freeEndGaps2 = false, match = 2, mismatch = -3, gapOpen = -7, gapExtend = -1 } = {}) {
  const n = s1.length;
  const m = s2.length;
  if (n === 0 || m === 0) {
    const aligned1 = s1 || '-'.repeat(m);
    const aligned2 = s2 || '-'.repeat(n);
    return { aligned1, aligned2, score: 0, matches: 0, mismatches: 0, gaps: Math.max(n, m), insertions: m, deletions: n, length: Math.max(n, m), identity: '0.00' };
  }

  const NEG_INF = -1e9;
  const stride = m + 1;
  const size = (n + 1) * (m + 1);
  const M = new Float32Array(size);
  const X = new Float32Array(size);
  const Y = new Float32Array(size);

  M.fill(NEG_INF);
  X.fill(NEG_INF);
  Y.fill(NEG_INF);

  M[0] = 0;

  for (let i = 1; i <= n; i++) {
    const cost = freeEndGaps1 ? 0 : (gapOpen + (i - 1) * gapExtend);
    Y[i * stride + 0] = cost;
  }
  for (let j = 1; j <= m; j++) {
    const cost = freeEndGaps2 ? 0 : (gapOpen + (j - 1) * gapExtend);
    X[0 * stride + j] = cost;
  }

  for (let i = 1; i <= n; i++) {
    const s1_char = s1[i - 1];
    const rowOffset = i * stride;
    const prevRowOffset = (i - 1) * stride;

    for (let j = 1; j <= m; j++) {
      const idx = rowOffset + j;
      const s2_char = s2[j - 1];
      const matchScore = (s1_char === s2_char) ? match : mismatch;

      // X: Gap in s1
      const xOpen = M[rowOffset + (j - 1)] + gapOpen;
      const xExt = X[rowOffset + (j - 1)] + gapExtend;
      const yToX = Y[rowOffset + (j - 1)] + gapOpen;
      X[idx] = Math.max(xOpen, xExt, yToX);

      // Y: Gap in s2
      const yOpen = M[prevRowOffset + j] + gapOpen;
      const yExt = Y[prevRowOffset + j] + gapExtend;
      const xToY = X[prevRowOffset + j] + gapOpen;
      Y[idx] = Math.max(yOpen, yExt, xToY);

      // M: Match/Mismatch
      const mMatch = M[prevRowOffset + (j - 1)] + matchScore;
      const xMatch = X[prevRowOffset + (j - 1)] + matchScore;
      const yMatch = Y[prevRowOffset + (j - 1)] + matchScore;
      M[idx] = Math.max(mMatch, xMatch, yMatch);
    }
  }

  // Find optimal ending cell
  let currentI = n;
  let currentJ = m;
  let currentMatrix = 'M';

  if (freeEndGaps1 || freeEndGaps2) {
    let bestScore = NEG_INF;
    if (freeEndGaps1) {
      for (let i = 1; i <= n; i++) {
        const idx = i * stride + m;
        const score = Math.max(M[idx], X[idx], Y[idx]);
        if (score > bestScore) {
          bestScore = score;
          currentI = i;
          currentJ = m;
          currentMatrix = M[idx] >= X[idx] && M[idx] >= Y[idx] ? 'M' : X[idx] >= Y[idx] ? 'X' : 'Y';
        }
      }
    }
    if (freeEndGaps2) {
      for (let j = 1; j <= m; j++) {
        const idx = n * stride + j;
        const score = Math.max(M[idx], X[idx], Y[idx]);
        if (score > bestScore) {
          bestScore = score;
          currentI = n;
          currentJ = j;
          currentMatrix = M[idx] >= X[idx] && M[idx] >= Y[idx] ? 'M' : X[idx] >= Y[idx] ? 'X' : 'Y';
        }
      }
    }
  } else {
    const endIdx = n * stride + m;
    if (X[endIdx] >= M[endIdx] && X[endIdx] >= Y[endIdx]) currentMatrix = 'X';
    else if (Y[endIdx] >= M[endIdx]) currentMatrix = 'Y';
  }

  const out1 = [];
  const out2 = [];

  // Add trailing free end gaps if any
  for (let j = m; j > currentJ; j--) {
    out1.push('-');
    out2.push(s2[j - 1]);
  }
  for (let i = n; i > currentI; i--) {
    out1.push(s1[i - 1]);
    out2.push('-');
  }

  while (currentI > 0 || currentJ > 0) {
    if (currentI === 0) {
      out1.push('-');
      out2.push(s2[currentJ - 1]);
      currentJ--;
      continue;
    }
    if (currentJ === 0) {
      out1.push(s1[currentI - 1]);
      out2.push('-');
      currentI--;
      continue;
    }

    const idx = currentI * stride + currentJ;
    const rowOffset = currentI * stride;
    const prevRowOffset = (currentI - 1) * stride;
    const s1_char = s1[currentI - 1];
    const s2_char = s2[currentJ - 1];
    const matchScore = (s1_char === s2_char) ? match : mismatch;

    if (currentMatrix === 'M') {
      out1.push(s1_char);
      out2.push(s2_char);
      const mScore = M[prevRowOffset + (currentJ - 1)] + matchScore;
      const xScore = X[prevRowOffset + (currentJ - 1)] + matchScore;

      if (M[idx] === mScore) currentMatrix = 'M';
      else if (M[idx] === xScore) currentMatrix = 'X';
      else currentMatrix = 'Y';

      currentI--;
      currentJ--;
    } else if (currentMatrix === 'X') {
      out1.push('-');
      out2.push(s2_char);
      const xOpen = M[rowOffset + (currentJ - 1)] + gapOpen;
      const xExt = X[rowOffset + (currentJ - 1)] + gapExtend;

      if (X[idx] === xExt) currentMatrix = 'X';
      else if (X[idx] === xOpen) currentMatrix = 'M';
      else currentMatrix = 'Y';

      currentJ--;
    } else {
      // Y matrix
      out1.push(s1_char);
      out2.push('-');
      const yOpen = M[prevRowOffset + currentJ] + gapOpen;
      const yExt = Y[prevRowOffset + currentJ] + gapExtend;

      if (Y[idx] === yExt) currentMatrix = 'Y';
      else if (Y[idx] === yOpen) currentMatrix = 'M';
      else currentMatrix = 'X';

      currentI--;
    }
  }

  const aligned1 = out1.reverse().join('');
  const aligned2 = out2.reverse().join('');

  let matches = 0;
  let mismatches = 0;
  let gaps = 0;
  let insertions = 0;
  let deletions = 0;

  for (let i = 0; i < aligned1.length; i++) {
    const c1 = aligned1[i];
    const c2 = aligned2[i];
    if (c1 === '-' || c2 === '-') {
      gaps++;
      if (c1 === '-') insertions++;
      else deletions++;
    } else if (c1 === c2) {
      matches++;
    } else {
      mismatches++;
    }
  }

  const length = aligned1.length;
  const identity = length ? ((matches / length) * 100).toFixed(2) : '0.00';

  return { aligned1, aligned2, matches, mismatches, gaps, insertions, deletions, length, identity };
}

function findOptimalAlignment(s1, s2) {
  if (!s1 || !s2) return gotohAlign(s1, s2);

  const len1 = s1.length;
  const len2 = s2.length;
  const isFragment1 = len1 < len2 * 0.7;
  const isFragment2 = len2 < len1 * 0.7;

  let best = gotohAlign(s1, s2, { freeEndGaps1: isFragment1, freeEndGaps2: isFragment2 });
  let bestMetadata = { orientation: 'forward', rotationOffset: 0 };

  // Circular rotation check if one or both are plasmids
  if (len1 > 300 && len2 > 300 && Math.abs(len1 - len2) < Math.max(len1, len2) * 0.35 && Number(best.identity) < 95) {
    const kmerSize = 16;
    const seed = s1.slice(0, kmerSize);
    let matchPos = s2.indexOf(seed);
    let count = 0;
    while (matchPos !== -1 && count < 5) {
      if (matchPos > 0) {
        const rotatedS2 = s2.slice(matchPos) + s2.slice(0, matchPos);
        const candidate = gotohAlign(s1, rotatedS2);
        if (Number(candidate.identity) > Number(best.identity) + 5) {
          best = candidate;
          bestMetadata = { orientation: 'forward', rotationOffset: matchPos };
        }
      }
      matchPos = s2.indexOf(seed, matchPos + 1);
      count++;
    }
  }

  // Reverse complement detection
  const s1RC = revComp(s1);
  const candRC = gotohAlign(s1RC, s2, { freeEndGaps1: isFragment1, freeEndGaps2: isFragment2 });
  if (candRC && (Number(candRC.identity) > Number(best.identity) + 15 || (best.matches < 20 && candRC.matches > 30))) {
    best = candRC;
    bestMetadata = { orientation: 'reverse-complement', rotationOffset: 0 };
  }

  return { ...best, metadata: bestMetadata };
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
  const candidates = (features || []).filter(feature => feature.visible !== false).map((feature, index) => {
    const sourceStart = Math.max(0, Number(feature.start) || 0);
    const sourceEnd = Math.max(sourceStart + 1, Number(feature.end) || sourceStart + 1);
    const start = sourceToAlignment[Math.min(sourceStart, sourceToAlignment.length - 1)] ?? 0;
    const end = sourceToAlignment[Math.min(sourceEnd, sourceToAlignment.length - 1)] ?? alignedSequence.length;
    return { ...feature, key: feature.id || `${feature.label || feature.type || 'feat'}-${index}`, alignmentStart: start, alignmentEnd: Math.max(start + 1, end) };
  });
  return candidates
    .sort((a, b) => (priority[String(a.type).toLowerCase()] ?? 9) - (priority[String(b.type).toLowerCase()] ?? 9) || (b.alignmentEnd - b.alignmentStart) - (a.alignmentEnd - a.alignmentStart))
    .filter((feature, index, sorted) => !sorted.slice(0, index).some(kept => {
      const overlap = Math.max(0, Math.min(feature.alignmentEnd, kept.alignmentEnd) - Math.max(feature.alignmentStart, kept.alignmentStart));
      const shortest = Math.min(feature.alignmentEnd - feature.alignmentStart, kept.alignmentEnd - kept.alignmentStart);
      return overlap / Math.max(1, shortest) > 0.85;
    }))
    .sort((a, b) => a.alignmentStart - b.alignmentStart);
}

function FeatureTrack({ name, features, alignedSequence, length, hidden, onHideFeature, t }) {
  const mapped = useMemo(() => mappedFeatures(features, alignedSequence).filter(feature => !hidden.has(feature.key)), [features, alignedSequence, hidden]);
  const [hoveredKey, setHoveredKey] = useState(null);
  const hoverTimerRef = useRef(null);

  const handleMouseEnter = (key) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredKey(key);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredKey(null);
    }, 260);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  return (
    <div className="relative z-10 grid grid-cols-[130px_1fr] items-center gap-2.5 py-1">
      <div className="whitespace-normal text-right text-xs font-bold leading-tight text-slate-700" title={name}>{name}</div>
      <div className="relative h-10">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
        {mapped.map(feature => {
          const left = (feature.alignmentStart / length) * 100;
          const width = Math.max(0.8, ((feature.alignmentEnd - feature.alignmentStart) / length) * 100);
          const reverse = Number(feature.strand) === -1;
          const label = feature.label || feature.type || t.feature;
          const isHovered = hoveredKey === feature.key;
          return (
            <div
              key={feature.key}
              className={`absolute top-1/2 h-7 -translate-y-1/2 ${isHovered ? 'z-40' : 'z-10'}`}
              style={{ left: `${left}%`, width: `${width}%`, minWidth: 8 }}
              onMouseEnter={() => handleMouseEnter(feature.key)}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                className="h-full w-full focus:outline-none"
                aria-label={`${label}, ${Number(feature.start) + 1}–${feature.end}`}
              >
                <span
                  className="flex h-full w-full items-center justify-center overflow-hidden border-2 border-white px-2 text-[11px] font-bold text-white shadow-sm"
                  style={{
                    backgroundColor: feature.color || '#0f766e',
                    clipPath: reverse
                      ? 'polygon(10px 0, 100% 0, 100% 100%, 10px 100%, 0 50%)'
                      : 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'
                  }}
                >
                  {width > 6 && label.length <= Math.max(3, Math.floor(width / 1.8)) ? label : ''}
                </span>
              </button>
              {isHovered && (
                <div
                  role="tooltip"
                  onMouseEnter={() => handleMouseEnter(feature.key)}
                  onMouseLeave={handleMouseLeave}
                  className="absolute bottom-full left-1/2 z-[9999] mb-1.5 min-w-48 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-xl animate-in fade-in-50 duration-150 before:absolute before:top-full before:left-0 before:right-0 before:h-2.5 before:content-['']"
                >
                  <strong className="block truncate text-xs text-slate-800">{label}</strong>
                  <span className="mt-1 block text-[10px] font-medium text-slate-500">{t.type}: {feature.type || t.feature}</span>
                  <span className="block text-[10px] text-slate-400">{t.coordinates}: {Number(feature.start) + 1}–{feature.end} bp</span>
                  <span className="block text-[10px] text-slate-400">{t.length}: {Math.max(1, Number(feature.end) - Number(feature.start))} bp</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setHoveredKey(null);
                      onHideFeature(feature);
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
                  >
                    <EyeOff className="h-3 w-3" />
                    {t.hideFeature}
                  </button>
                </div>
              )}
            </div>
          );
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
    <section className="overflow-visible max-md:overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/70 shadow-sm" aria-label="Alignment overview">
      <div ref={overviewRef} className="min-w-[640px] px-3 py-2.5 sm:px-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5"><h4 className="text-sm font-bold text-slate-800">{t.overview}</h4><span className="group relative inline-flex" tabIndex={0}><Info className="h-3.5 w-3.5 cursor-help text-slate-400" aria-label={t.overviewHelp} /><span role="tooltip" className="pointer-events-none invisible absolute left-0 top-full z-[10000] mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-relaxed text-slate-600 opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100"><strong className="mb-1 block text-slate-800">{t.mismatch}</strong>{t.overviewHelp}</span></span></div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500"><details data-html2canvas-ignore="true" className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.removeAttribute('open'); }}><summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-md border border-slate-200 bg-white px-2 font-semibold shadow-sm hover:bg-slate-50"><Eye className="h-3 w-3" />{t.showFeatures}</summary><div className="absolute right-0 z-[9999] mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-2xl">{featureOptions.map(option => { const hidden = option.entries.every(entry => entry.track === 0 ? hidden1.has(entry.key) : hidden2.has(entry.key)); return <button key={option.label} type="button" onClick={() => option.entries.forEach(entry => entry.track === 0 ? (hidden ? onShow1(entry.key) : onHide1(entry.key)) : (hidden ? onShow2(entry.key) : onHide2(entry.key)))} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-slate-50">{hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}<span className="truncate">{option.label}</span></button>; })}</div></details><CopyImageButton targetRef={overviewRef} label={t.copyImage} copiedLabel={t.copied} capturingLabel={t.capturing} data-html2canvas-ignore="true" className="h-7 gap-1.5 px-2 text-[10px] shadow-sm" /></div>
      </div>
      <div className="relative space-y-0.5" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); const x = Math.max(0, event.clientX - rect.left - 142); if (x >= 0) onNavigate(Math.min(length - 1, Math.floor((x / Math.max(1, rect.width - 142)) * length))); }}>
        <div data-html2canvas-ignore="true" className="pointer-events-none absolute inset-y-0 z-20 rounded-sm bg-slate-400/30 transition-[left,width] duration-100" style={{ left: `calc(142px + (100% - 142px) * ${viewport.start / length})`, width: `max(6px, calc((100% - 142px) * ${(viewport.end - viewport.start) / length}))` }} />
        <FeatureTrack name={name1} features={features1} alignedSequence={result.aligned1} length={length} hidden={hidden1} onHideFeature={onHideFeature} t={t} />
        <FeatureTrack name={name2} features={features2} alignedSequence={result.aligned2} length={length} hidden={hidden2} onHideFeature={onHideFeature} t={t} />
        {differenceRuns.map(run => {
          const spanLen = run.end - run.start + 1;
          const isGap = spanLen >= 4;
          return (
            <span key={`${run.start}-${run.end}`} className="contents">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-[1] rounded-sm border-x border-red-400/50 bg-red-500/20"
                style={{
                  left: `calc(142px + (100% - 142px) * ${run.start / length})`,
                  width: `max(2px, calc((142px + (100% - 142px) * ${spanLen / length}) - (142px + (100% - 142px) * ${run.start / length})))`
                }}
              />
              {isGap ? (
                <button
                  type="button"
                  onClick={event => { event.stopPropagation(); onJump(run.differenceArrayIndex); }}
                  className="absolute -top-3.5 z-30 flex -translate-x-1/2 items-center justify-center rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow hover:bg-red-700 whitespace-nowrap"
                  style={{ left: `calc(142px + (100% - 142px) * ${((run.start + run.end) / 2 + 0.5) / length})` }}
                  title={`Gap (${spanLen} bp): bp ${run.start + 1}–${run.end + 1}`}
                >
                  Gap ({spanLen} bp)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={event => { event.stopPropagation(); onJump(run.differenceArrayIndex); }}
                  className="absolute bottom-0 top-0 z-30 w-5 -translate-x-1/2 bg-transparent"
                  style={{ left: `calc(142px + (100% - 142px) * ${((run.start + run.end) / 2 + 0.5) / length})` }}
                  title={`${t.mismatch} ${run.differenceArrayIndex + 1}: ${run.difference.base1} → ${run.difference.base2}`}
                >
                  <AlertTriangle className="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2 fill-red-500 text-white" />
                </button>
              )}
            </span>
          );
        })}
      </div>
      </div>
    </section>
  );
}

function BaseRow({ label, sequence, otherSequence, selectedIndex, onSelect, t }) {
  return (
    <div className="flex h-8 items-center">
      <div className="sticky left-0 z-20 flex h-full w-24 flex-none items-center border-r border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 shadow-[4px_0_8px_-7px_rgba(15,23,42,.5)]">
        <span className="truncate" title={label}>{label}</span>
      </div>
      {sequence.split('').map((base, index) => {
        const differs = base !== otherSequence[index];
        const selected = selectedIndex === index;
        return (
          <button
            type="button"
            key={index}
            onClick={() => onSelect(index)}
            className={`flex h-7 w-[28px] flex-none items-center justify-center border-y font-mono text-xs font-bold transition-colors ${
              differs
                ? 'border-red-300 bg-red-50 text-red-600'
                : selected
                ? 'border-slate-300 bg-slate-200 text-slate-800'
                : 'border-slate-100 text-slate-600 hover:bg-slate-100'
            } ${selected && differs ? 'bg-red-100 ring-2 ring-inset ring-slate-400' : ''} ${base === '-' ? 'text-slate-300' : ''}`}
            title={`${t.position} ${index + 1}: ${base}`}
          >
            {base}
          </button>
        );
      })}
    </div>
  );
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex h-8 items-center justify-between border-b border-slate-100 px-3 py-1">
        <h4 className="text-xs font-bold text-slate-800">{t.baseTitle}</h4>
        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">bp {viewport.start + 1}–{Math.max(viewport.start + 1, viewport.end)}</span>
      </div>
      <div ref={scrollRef} onScroll={updateViewport} className="overflow-x-auto scroll-smooth pb-1" tabIndex={0} aria-label="Scrollable aligned sequences">
        <div style={{ width: LABEL_WIDTH + result.length * BASE_WIDTH }}>
          <div className="flex h-6 items-end border-b border-slate-100 pb-0.5 text-[9px] text-slate-400">
            <span className="sticky left-0 z-20 w-24 flex-none bg-white" />
            {result.aligned1.split('').map((_, index) => {
              const mismatch = result.aligned1[index] !== result.aligned2[index];
              const selected = selectedIndex === index;
              return (
                <span key={index} className={`w-[28px] flex-none text-center leading-none ${mismatch ? 'font-extrabold text-red-500' : selected ? 'font-extrabold text-slate-900' : ''}`}>
                  {mismatch || selected || index % 10 === 0 ? index + 1 : ''}
                </span>
              );
            })}
          </div>
          <BaseRow label={name1} sequence={result.aligned1} otherSequence={result.aligned2} selectedIndex={selectedIndex} onSelect={setSelectedIndex} t={t} />
          <BaseRow label={name2} sequence={result.aligned2} otherSequence={result.aligned1} selectedIndex={selectedIndex} onSelect={setSelectedIndex} t={t} />
        </div>
      </div>
      <div className="flex h-8 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-1">
        <button type="button" onClick={() => scrollToDifference(activeDifference - 1)} disabled={!differences.length} className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-white hover:text-teal-700 disabled:opacity-30" aria-label={t.previousMismatch}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-28 text-center text-[11px] font-semibold text-slate-600">
          {differences.length ? `${activeDifference + 1} / ${differences.length} ${t.mismatches}` : `0 ${t.mismatches}`}
        </span>
        <button type="button" onClick={() => scrollToDifference(activeDifference + 1)} disabled={!differences.length} className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-white hover:text-teal-700 disabled:opacity-30" aria-label={t.nextMismatch}>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

function SavedAlignmentPanel({ items, activeId, onOpen, onDelete, onNew, collapsed, onToggle, panelWidth, onResizeStart, t, language }) {
  if (collapsed) {
    return (
      <aside className="relative flex min-h-full flex-col items-center border-l border-slate-200 bg-slate-50/70 py-3">
        <button type="button" onClick={onToggle} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-100 hover:text-slate-800" aria-label={t.expandPanel} title={t.expandPanel}><ChevronLeft className="h-4 w-4" /></button>
      </aside>
    );
  }
  return (
    <aside className="relative flex min-h-full flex-col overflow-hidden border-l border-slate-200 bg-slate-50/70" style={{ width: panelWidth }}>
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400 z-30 transition-colors"
        onMouseDown={onResizeStart}
        title="Drag to resize panel"
      />
      <div className="flex h-9 flex-shrink-0 items-center justify-between border-b border-slate-200 px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1">
          <button type="button" onClick={onToggle} className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700" aria-label={t.collapsePanel} title={t.collapsePanel}><ChevronRight className="h-3.5 w-3.5" /></button>
          <h4 className="truncate text-xs font-bold text-slate-700">{t.savedAlignments}</h4>
        </div>
        <button type="button" onClick={onNew} className="flex h-6 flex-none items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 shadow-sm hover:bg-slate-100"><Plus className="h-3 w-3" />{t.newAlignment}</button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-1.5">
        {items.length === 0 && <div className="px-3 py-8 text-center"><FolderOpen className="mx-auto mb-2 h-5 w-5 text-slate-300" /><p className="text-[11px] text-slate-400">{t.noSaved}</p></div>}
        {items.map(item => (
          <div key={item.id} className={`group mb-1 flex items-start gap-1 rounded-lg border px-2 py-1.5 transition-colors ${activeId === item.id ? 'border-slate-300 bg-white shadow-sm' : 'border-transparent hover:bg-white'}`}>
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
  const [savedPanelWidth, setSavedPanelWidth] = useState(220);
  const resizeRef = useRef(null);

  const handlePanelResizeStart = (e) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: savedPanelWidth };
    const onMouseMove = (moveEvent) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startX - moveEvent.clientX;
      const nextWidth = Math.max(160, Math.min(450, resizeRef.current.startWidth + delta));
      setSavedPanelWidth(nextWidth);
    };
    const onMouseUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

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
      const nextResult = findOptimalAlignment(first, second);
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
    const res = item.result || findOptimalAlignment(cleanSequence(item.seq1), cleanSequence(item.seq2));
    setFeatures1(item.features1 || []); setFeatures2(item.features2 || []); setResult(res);
    initializeFeatureVisibility(res, item.features1 || [], item.features2 || []);
    setInputCollapsed(true); setActiveDifference(0); setViewport({ start: 0, end: Math.min(res?.length || 60, 60) });
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
    <div
      className="grid h-full min-h-0 bg-white"
      style={{
        gridTemplateColumns: savedPanelCollapsed ? 'minmax(0, 1fr) 36px' : `minmax(0, 1fr) ${savedPanelWidth}px`,
      }}
    >
      <div className="min-w-0 space-y-2 p-2.5 sm:p-3">
      <div className="space-y-1 pr-0 md:pr-1">
        <h3 className="text-sm font-bold text-slate-800">{t.pairwise}</h3>
        <div className="flex min-w-0 flex-col gap-1.5 lg:flex-row lg:items-center">
          <input value={alignmentTitle} onChange={event => setAlignmentTitle(event.target.value)} placeholder={t.alignmentName} className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
          <div className="flex flex-none items-center gap-1.5">
            {result && <Button variant="outline" size="sm" onClick={() => setInputCollapsed(value => !value)} className="h-8 gap-1 whitespace-nowrap px-2.5 text-xs font-semibold">{inputCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}{inputCollapsed ? t.editSequences : t.collapseSequences}</Button>}
            <Button variant="outline" size="sm" onClick={saveAlignment} disabled={!result} className="h-8 gap-1 whitespace-nowrap px-2.5 text-xs font-semibold"><Save className="h-3.5 w-3.5" />{t.save}</Button>
            <Button onClick={runAlignment} disabled={running} size="sm" className="h-8 gap-1 whitespace-nowrap bg-teal-600 px-3 text-xs font-semibold hover:bg-teal-700">{running ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : result ? <RotateCcw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{running ? t.aligning : result ? t.runAgain : t.start}</Button>
          </div>
        </div>
      </div>
      <div className={`mr-0 grid overflow-hidden transition-[max-height,opacity] duration-300 md:mr-2 md:grid-cols-2 md:gap-2.5 ${inputCollapsed ? 'max-h-0 opacity-0' : 'max-h-[650px] opacity-100'}`} aria-hidden={inputCollapsed}>
        {[{ number: 1, role: t.sample, name: name1, setName: setName1, sequence: seq1, setSequence: setSeq1 }, { number: 2, role: t.reference, name: name2, setName: setName2, sequence: seq2, setSequence: setSeq2 }].map(field => <div key={field.number} className="pb-1"><label className="mb-1 block text-xs font-semibold text-slate-600">{field.role} <span className="text-slate-400 font-normal">({cleanSequence(field.sequence).length} bp)</span></label><div className="mb-1 flex gap-1"><input value={field.name} onChange={event => field.setName(event.target.value)} placeholder={t.name} className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs" />{library.length > 0 && <select className="w-28 truncate rounded-md border border-slate-200 bg-white px-1 py-1 text-xs text-slate-600" onChange={event => { selectLibraryEntry(library.find(item => item.id === event.target.value), field.number); event.target.value = ''; }} defaultValue=""><option value="" disabled>{t.fromLibrary}</option>{library.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div><Textarea value={field.sequence} onChange={event => { field.setSequence(event.target.value); setResult(null); }} placeholder={t.paste} className="h-[220px] min-h-[160px] resize-y border-slate-200 bg-white font-mono text-xs leading-relaxed" /></div>)}
      </div>
      {error && <p className="mr-0 text-xs text-red-500 md:mr-2">{error}</p>}
      {result && (
        <div className="mr-0 space-y-2 md:mr-1">
          <div className="grid grid-cols-[minmax(200px,2fr)_repeat(3,minmax(80px,1fr))] overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 text-slate-700">
            <div className="border-r border-slate-200 px-2.5 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t.identicalBases}</p>
              <div className="mt-0.5 flex items-baseline gap-2 whitespace-nowrap">
                <strong className="text-xs font-bold text-slate-800">{result.matches.toLocaleString()} / {result.length.toLocaleString()} bp</strong>
                <span className="text-[11px] font-semibold text-slate-500">{result.identity}% {t.identical}</span>
              </div>
            </div>
            {[[t.mismatch, result.mismatches], [t.insertions, result.insertions], [t.deletions, result.deletions]].map(([label, value]) => (
              <div key={label} className="border-r border-slate-200 px-2.5 py-1.5 last:border-r-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-0.5 text-xs font-bold text-slate-800">{value.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <AlignmentOverview result={result} name1={name1} name2={name2} features1={features1} features2={features2} differences={differences} viewport={viewport} onJump={jumpToDifference} onNavigate={setRequestedIndex} hidden1={hiddenFeatures1} hidden2={hiddenFeatures2} onHide1={key => setHiddenFeatures1(previous => new Set(previous).add(key))} onHide2={key => setHiddenFeatures2(previous => new Set(previous).add(key))} onShow1={key => setHiddenFeatures1(previous => { const next = new Set(previous); next.delete(key); return next; })} onShow2={key => setHiddenFeatures2(previous => { const next = new Set(previous); next.delete(key); return next; })} onHideFeature={hideFeatureByLabel} t={t} />
          <SequenceViewer result={result} name1={name1} name2={name2} differences={differences} activeDifference={activeDifference} onActiveDifference={setActiveDifference} requestedIndex={requestedIndex} viewport={viewport} onViewport={setViewport} t={t} />
        </div>
      )}
      {!result && !inputCollapsed && <div className="mr-0 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 md:mr-2"><Dna className="h-4 w-4" />{t.startHint}</div>}
      </div>
      <SavedAlignmentPanel items={savedAlignments} activeId={activeSavedId} onOpen={openSavedAlignment} onDelete={deleteSavedAlignment} onNew={startNewAlignment} collapsed={savedPanelCollapsed} onToggle={() => setSavedPanelCollapsed(value => !value)} panelWidth={savedPanelWidth} onResizeStart={handlePanelResizeStart} t={t} language={language} />
    </div>
  );
}
