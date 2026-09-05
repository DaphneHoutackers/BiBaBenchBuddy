import ViewportPanel from '@/components/shared/ViewportPanel';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from '@/context/HistoryContext';
import {
  Activity,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlertCircle,
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Atom,
  Award,
  Binary,
  Bold,
  Bookmark,
  BookMarked,
  BookOpen,
  Boxes,
  Bug,
  Calendar,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Code2,
  Columns3,
  Copy,
  Cpu,
  Dna,
  Download,
  Droplet,
  Droplets,
  Eraser,
  ExternalLink,
  Feather,
  FilePlus,
  FileSpreadsheet,
  FileText,
  Files,
  Fish,
  FishSymbol,
  Flame,
  FlaskConical,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Globe,
  Hash,
  Heart,
  HelpCircle,
  Highlighter,
  Image as ImageIcon,
  Inbox,
  Info,
  Italic,
  Layers,
  LayoutGrid,
  Lightbulb,
  Link,
  List,
  ListChecks,
  ListOrdered,
  ListTodo,
  Microscope,
  MoreHorizontal,
  Notebook,
  NotebookPen,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  PenLine,
  PenTool,
  Pin,
  Pipette,
  Plus,
  Quote,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Star,
  Strikethrough,
  Syringe,
  Table,
  Tag,
  Tags,
  Target,
  TestTube,
  Thermometer,
  Trash,
  Trash2,
  Underline,
  Unlink,
  Upload,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import MacColorPicker from '@/components/shared/MacColorPicker';
import { PALETTE, ToolShell, fieldClass, primaryButton, secondaryButton, uid, useStoredState } from './toolUtils.jsx';

const COLORS = ['#475569', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#0284c7', '#2563eb', '#7c3aed', '#db2777'];

const NOTE_ICON_MAP = {
  // Writing & Notes
  NotebookPen,
  Notebook,
  FileText,
  Files,
  FileSpreadsheet,
  BookOpen,
  BookMarked,
  Bookmark,
  Pencil,
  PenLine,
  Highlighter,
  Feather,
  PenTool,
  Eraser,
  // Tasks & Lists
  CheckSquare,
  ListChecks,
  ListTodo,
  List,
  ClipboardList,
  Table,
  // Lab & Biology
  FlaskConical,
  TestTube,
  Microscope,
  Dna,
  Atom,
  Syringe,
  Droplet,
  Droplets,
  Thermometer,
  Fish,
  FishSymbol,
  Bug,
  Flame,
  Activity,
  // Tech & Science
  Binary,
  Cpu,
  Boxes,
  Layers,
  Wrench,
  // Symbols & Organization
  Star,
  Heart,
  Tag,
  Tags,
  Pin,
  Shield,
  Target,
  Lightbulb,
  Zap,
  Sparkles,
  Award,
  Calendar,
  CalendarDays,
  Clock,
  Hash,
  Globe,
  Archive,
  Inbox,
  AlertCircle,
  Info,
  HelpCircle,
};

const NOTE_ICON_NAMES = Object.keys(NOTE_ICON_MAP);

const exec = (cmd, value = null) => document.execCommand(cmd, false, value);
const escapeHtml = text => (text || '').replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));

function placeCaret(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  element.focus();
}

function placeCaretAtStart(element) {
  const range = document.createRange();
  if (element.firstChild) {
    range.setStart(element.firstChild, 0);
  } else {
    range.setStart(element, 0);
  }
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  element.focus();
}

function exitChecklistItem(li) {
  const list = li.closest('ul[data-checklist]');
  if (!list) return null;
  const items = [...list.children], index = items.indexOf(li), paragraph = document.createElement('p');
  paragraph.innerHTML = '<br>';
  const before = items.slice(0, index), after = items.slice(index + 1);
  const replacements = [];
  if (before.length) {
    const beforeList = list.cloneNode(false);
    before.forEach(item => beforeList.appendChild(item));
    replacements.push(beforeList);
  }
  replacements.push(paragraph);
  if (after.length) {
    const afterList = list.cloneNode(false);
    after.forEach(item => afterList.appendChild(item));
    replacements.push(afterList);
  }
  list.replaceWith(...replacements);
  return paragraph;
}

function isListItemEmpty(item) {
  if (!item) return true;
  const clone = item.cloneNode(true);
  clone.querySelector('label')?.remove();
  clone.querySelector('input')?.remove();
  return !clone.innerText.replace(/\u00a0/g, '').trim();
}

function extractListItemAsBlock(li, targetTag) {
  const list = li.closest('ul, ol');
  if (!list) return null;

  const clone = li.cloneNode(true);
  clone.querySelector('label')?.remove();
  clone.querySelector('input')?.remove();
  const innerHtml = clone.innerHTML;

  const isTitle = targetTag === 'title';
  const normalizedTag = isTitle ? 'h1' : targetTag.toLowerCase().replace(/[<>]/g, '');
  const newBlock = document.createElement(normalizedTag);
  newBlock.innerHTML = innerHtml;
  newBlock.style.fontSize = '';
  newBlock.style.fontWeight = '';
  newBlock.style.marginLeft = '';
  newBlock.style.paddingLeft = '';
  newBlock.style.textIndent = '';
  newBlock.className = isTitle ? 'note-title' : '';
  if (normalizedTag === 'p') {
    newBlock.querySelectorAll('h1, h2, h3, h4, b, strong').forEach(b => {
      b.replaceWith(...b.childNodes);
    });
  }

  const items = [...list.children];
  const index = items.indexOf(li);
  const before = items.slice(0, index).filter(item => !isListItemEmpty(item));
  const after = items.slice(index + 1).filter(item => !isListItemEmpty(item));
  const replacements = [];

  if (before.length) {
    const beforeList = list.cloneNode(false);
    before.forEach(item => beforeList.appendChild(item));
    replacements.push(beforeList);
  }

  replacements.push(newBlock);

  if (after.length) {
    const afterList = list.cloneNode(false);
    after.forEach(item => afterList.appendChild(item));
    replacements.push(afterList);
  }

  list.replaceWith(...replacements);
  placeCaret(newBlock);
  return newBlock;
}

function setBlockFormat(editorRef, targetTag, onContentChange, onBeforeCommand) {
  onBeforeCommand?.();
  editorRef.current?.focus();
  const isTitle = targetTag === 'title';
  const normalizedTag = isTitle ? 'h1' : targetTag.toLowerCase().replace(/[<>]/g, '');

  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const node = container.nodeType === 3 ? container.parentElement : container;

    const li = node?.closest('li');
    if (li && editorRef.current?.contains(li)) {
      extractListItemAsBlock(li, targetTag);
      onContentChange?.();
      return;
    }

    exec('formatBlock', `<${normalizedTag}>`);

    const block = node?.closest('h1, h2, h3, h4, blockquote, p, div');
    if (block && block !== editorRef.current) {
      if (block.tagName.toLowerCase() !== normalizedTag) {
        const newElem = document.createElement(normalizedTag);
        newElem.innerHTML = block.innerHTML;
        newElem.querySelectorAll('h1, h2, h3, h4').forEach(h => {
          h.replaceWith(...h.childNodes);
        });
        if (isTitle) {
          newElem.className = 'note-title';
        } else if (normalizedTag === 'p') {
          newElem.style.fontSize = '';
          newElem.style.fontWeight = '';
          newElem.style.marginLeft = '';
          newElem.style.paddingLeft = '';
          newElem.style.textIndent = '';
          newElem.className = '';
          newElem.querySelectorAll('b, strong').forEach(b => {
            b.replaceWith(...b.childNodes);
          });
        } else {
          newElem.className = '';
        }
        block.replaceWith(newElem);
        placeCaret(newElem);
      } else {
        if (isTitle) {
          block.className = 'note-title';
        } else if (normalizedTag === 'h1') {
          block.classList.remove('note-title');
        } else if (normalizedTag === 'p') {
          block.style.fontSize = '';
          block.style.fontWeight = '';
          block.style.marginLeft = '';
          block.style.paddingLeft = '';
          block.style.textIndent = '';
          block.className = '';
          block.querySelectorAll('h1, h2, h3, h4, b, strong').forEach(b => {
            b.replaceWith(...b.childNodes);
          });
        }
      }
    }
  }

  onContentChange?.();
}

function toggleQuote(editorRef, onContentChange, onBeforeCommand) {
  onBeforeCommand?.();
  editorRef.current?.focus();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const node = container.nodeType === 3 ? container.parentElement : container;

  const existingQuote = node?.closest('blockquote');
  if (existingQuote && editorRef.current?.contains(existingQuote)) {
    const textLines = existingQuote.innerText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const fragment = document.createDocumentFragment();
    if (textLines.length > 0) {
      textLines.forEach(line => {
        const p = document.createElement('p');
        p.innerHTML = escapeHtml(line);
        p.style.marginLeft = '';
        p.style.paddingLeft = '';
        p.style.textIndent = '';
        fragment.appendChild(p);
      });
    } else {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      p.style.marginLeft = '';
      p.style.paddingLeft = '';
      p.style.textIndent = '';
      fragment.appendChild(p);
    }
    const firstP = fragment.firstChild;
    existingQuote.replaceWith(fragment);
    if (firstP) placeCaret(firstP);
    onContentChange?.();
    return;
  }

  if (editorRef.current) {
    const allLis = [...editorRef.current.querySelectorAll('li')].filter(li => selection.containsNode(li, true));
    if (allLis.length > 0) {
      const selectedTexts = [];
      allLis.forEach(li => {
        const clone = li.cloneNode(true);
        clone.querySelector('label')?.remove();
        clone.querySelector('input')?.remove();
        const text = clone.innerText.replace(/\u00a0/g, '').trim();
        if (text) selectedTexts.push(text);
      });

      if (selectedTexts.length > 0) {
        const parentList = allLis[0].closest('ul, ol');
        if (parentList) {
          const allItems = [...parentList.children];
          const firstIndex = allItems.indexOf(allLis[0]);
          const lastIndex = allItems.indexOf(allLis[allLis.length - 1]);

          const before = allItems.slice(0, firstIndex).filter(item => !isListItemEmpty(item));
          const after = allItems.slice(lastIndex + 1).filter(item => !isListItemEmpty(item));

          const bq = document.createElement('blockquote');
          bq.innerHTML = selectedTexts.map(t => `<p>${escapeHtml(t)}</p>`).join('');

          const replacements = [];
          if (before.length) {
            const beforeList = parentList.cloneNode(false);
            before.forEach(item => beforeList.appendChild(item));
            replacements.push(beforeList);
          }

          replacements.push(bq);

          if (after.length) {
            const afterList = parentList.cloneNode(false);
            after.forEach(item => afterList.appendChild(item));
            replacements.push(afterList);
          }

          parentList.replaceWith(...replacements);
          placeCaret(bq);
          onContentChange?.();
          return;
        }
      }
    }
  }

  const selectedText = selection.toString();
  if (selectedText.trim()) {
    const lines = selectedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const quoteHtml = `<blockquote>${lines.map(l => `<p>${escapeHtml(l)}</p>`).join('')}</blockquote>`;
    exec('insertHTML', quoteHtml);
    onContentChange?.();
    return;
  }

  const singleBlock = node?.closest('h1, h2, h3, h4, p, div');
  if (singleBlock && singleBlock !== editorRef.current) {
    const bq = document.createElement('blockquote');
    bq.innerHTML = `<p>${singleBlock.innerHTML}</p>`;
    singleBlock.replaceWith(bq);
    placeCaret(bq);
  } else {
    exec('formatBlock', '<blockquote>');
  }
  onContentChange?.();
}

function clearFormattingAndHighlight(editorRef, onContentChange, onBeforeCommand) {
  onBeforeCommand?.();
  editorRef.current?.focus();
  exec('removeFormat');
  exec('hiliteColor', 'transparent');

  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const parent = container.nodeType === 3 ? container.parentElement : container;

    const li = parent?.closest('li');
    if (li && editorRef.current?.contains(li)) {
      extractListItemAsBlock(li, 'p');
      onContentChange?.();
      return;
    }

    setBlockFormat(editorRef, 'p', onContentChange, onBeforeCommand);

    if (parent && parent.style) {
      parent.style.backgroundColor = '';
      parent.style.fontSize = '';
      parent.style.fontWeight = '';
    }
    const block = parent?.closest('p, div, h1, h2, h3, h4');
    if (block) {
      block.style.fontWeight = '';
      block.style.fontSize = '';
      block.querySelectorAll('b, strong').forEach(b => {
        b.replaceWith(...b.childNodes);
      });
    }
  } else {
    setBlockFormat(editorRef, 'p', onContentChange, onBeforeCommand);
  }

  onContentChange?.();
}

function insertOrFormatChecklist({ editorRef, onContentChange, onBeforeCommand }) {
  onBeforeCommand?.();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const node = container.nodeType === 3 ? container.parentElement : container;

  // 1. If selection/cursor is inside a table cell (td or th)
  const tableCell = node?.closest('td, th');
  if (tableCell) {
    const currentList = node?.closest('ul, ol');
    if (currentList && tableCell.contains(currentList)) {
      currentList.setAttribute('data-checklist', 'true');
      currentList.removeAttribute('data-dash-list');
      if (currentList.tagName.toLowerCase() !== 'ul') {
        const ul = document.createElement('ul');
        ul.setAttribute('data-checklist', 'true');
        ul.innerHTML = currentList.innerHTML;
        currentList.replaceWith(ul);
      }
      currentList.querySelectorAll('li').forEach(li => {
        if (!li.querySelector('input[type="checkbox"]')) {
          const text = li.innerHTML;
          li.innerHTML = `<label contenteditable="false"><input type="checkbox" aria-label="Checklist item"></label><span>${text}</span>`;
        }
      });
      const firstSpan = currentList.querySelector('li span') || currentList.querySelector('li');
      if (firstSpan) placeCaretAtStart(firstSpan);
    } else {
      const cellText = tableCell.innerText.replace(/\u00a0/g, ' ').trim();
      const lines = cellText ? cellText.split(/\r?\n/).map(l => l.trim()).filter(Boolean) : [];
      const itemsHtml = (lines.length > 0 ? lines : ['']).map(line =>
        `<li><label contenteditable="false"><input type="checkbox" aria-label="Checklist item"></label><span>${escapeHtml(line) || '<br>'}</span></li>`
      ).join('');
      tableCell.innerHTML = `<ul data-checklist="true">${itemsHtml}</ul>`;
      const firstSpan = tableCell.querySelector('ul[data-checklist] li span');
      if (firstSpan) placeCaretAtStart(firstSpan);
    }
    onContentChange?.();
    return;
  }

  // 2. If multiple lines selected in regular text
  const selectedText = selection?.toString() || '';
  if (selectedText.trim()) {
    const lines = selectedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const itemsHtml = lines.map(line =>
        `<li><label contenteditable="false"><input type="checkbox" aria-label="Checklist item"></label><span>${escapeHtml(line)}</span></li>`
      ).join('');
      const checklistHtml = `<ul data-checklist="true">${itemsHtml}</ul>`;
      exec('insertHTML', checklistHtml);
      onContentChange?.();
      return;
    }
  }

  // 3. If cursor is on an existing block in regular text
  const currentBlock = node?.closest?.('p, h1, h2, h3, h4, blockquote');
  const currentBlockText = currentBlock && currentBlock !== editorRef.current ? currentBlock.innerText.replace(/\u00a0/g, '').trim() : '';

  if (currentBlock && currentBlock !== editorRef.current && currentBlockText && !currentBlock.closest('ul[data-checklist]') && !currentBlock.closest('.note-table-wrapper')) {
    const lines = currentBlock.innerText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const itemsHtml = (lines.length > 0 ? lines : [currentBlockText]).map(line =>
      `<li><label contenteditable="false"><input type="checkbox" aria-label="Checklist item"></label><span>${escapeHtml(line)}</span></li>`
    ).join('');
    const ul = document.createElement('ul');
    ul.setAttribute('data-checklist', 'true');
    ul.innerHTML = itemsHtml;
    currentBlock.replaceWith(ul);
    placeCaret(ul.querySelector('li:last-child span') || ul);
    onContentChange?.();
    return;
  }

  // 4. Default insert empty checklist item
  const marker = `check-${Date.now()}`;
  exec('insertHTML', `<ul data-checklist="true"><li><label contenteditable="false"><input type="checkbox" aria-label="Checklist item"></label><span data-caret="${marker}"><br></span></li></ul>`);
  const target = editorRef.current?.querySelector(`[data-caret="${marker}"]`);
  if (target) {
    target.removeAttribute('data-caret');
    placeCaret(target);
  }
  onContentChange?.();
}

function formatList(editorRef, type, onContentChange, onBeforeCommand) {
  onBeforeCommand?.();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const node = container.nodeType === 3 ? container.parentElement : container;
  const tableCell = node?.closest('td, th');
  const currentList = node?.closest('ul, ol');
  const currentLi = node?.closest('li');

  if (type === 'none') {
    if (currentLi) {
      extractListItemAsBlock(currentLi, 'p');
    } else if (tableCell) {
      const list = tableCell.querySelector('ul, ol');
      if (list) {
        const text = Array.from(list.querySelectorAll('li')).map(li => {
          const clone = li.cloneNode(true);
          clone.querySelector('label')?.remove();
          return clone.innerText.trim();
        }).filter(Boolean).join('<br>');
        tableCell.innerHTML = text || '<br>';
        placeCaretAtStart(tableCell);
      }
    } else {
      setBlockFormat(editorRef, 'p', onContentChange, onBeforeCommand);
    }
    onContentChange?.();
    return;
  }

  if (type === 'bullet') {
    if (currentList && (tableCell ? tableCell.contains(currentList) : true)) {
      currentList.removeAttribute('data-checklist');
      currentList.removeAttribute('data-dash-list');
      if (currentList.tagName.toLowerCase() !== 'ul') {
        const ul = document.createElement('ul');
        ul.innerHTML = currentList.innerHTML;
        currentList.replaceWith(ul);
      }
      currentList.querySelectorAll('label, input[type="checkbox"]').forEach(el => el.remove());
    } else if (tableCell) {
      const lines = tableCell.innerText.replace(/\u00a0/g, ' ').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const itemsHtml = (lines.length > 0 ? lines : ['']).map(line => `<li>${escapeHtml(line) || '<br>'}</li>`).join('');
      tableCell.innerHTML = `<ul>${itemsHtml}</ul>`;
      const firstLi = tableCell.querySelector('li');
      if (firstLi) placeCaretAtStart(firstLi);
    } else {
      exec('insertUnorderedList');
    }
    onContentChange?.();
    return;
  }

  if (type === 'dash') {
    if (currentList && (tableCell ? tableCell.contains(currentList) : true)) {
      currentList.removeAttribute('data-checklist');
      currentList.setAttribute('data-dash-list', 'true');
      if (currentList.tagName.toLowerCase() !== 'ul') {
        const ul = document.createElement('ul');
        ul.setAttribute('data-dash-list', 'true');
        ul.innerHTML = currentList.innerHTML;
        currentList.replaceWith(ul);
      }
      currentList.querySelectorAll('label, input[type="checkbox"]').forEach(el => el.remove());
    } else if (tableCell) {
      const lines = tableCell.innerText.replace(/\u00a0/g, ' ').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const itemsHtml = (lines.length > 0 ? lines : ['']).map(line => `<li>${escapeHtml(line) || '<br>'}</li>`).join('');
      tableCell.innerHTML = `<ul data-dash-list="true">${itemsHtml}</ul>`;
      const firstLi = tableCell.querySelector('li');
      if (firstLi) placeCaretAtStart(firstLi);
    } else {
      const block = node?.closest('p, h1, h2, h3, h4');
      const text = block ? block.innerHTML : (range.toString() || '<br>');
      const ul = document.createElement('ul');
      ul.setAttribute('data-dash-list', 'true');
      const li = document.createElement('li');
      li.innerHTML = text || '<br>';
      ul.appendChild(li);
      if (block && editorRef.current?.contains(block)) {
        block.replaceWith(ul);
      } else {
        exec('insertHTML', ul.outerHTML);
      }
      placeCaretAtStart(li);
    }
    onContentChange?.();
    return;
  }

  if (type === 'number') {
    if (currentList && (tableCell ? tableCell.contains(currentList) : true)) {
      currentList.removeAttribute('data-checklist');
      currentList.removeAttribute('data-dash-list');
      if (currentList.tagName.toLowerCase() !== 'ol') {
        const ol = document.createElement('ol');
        ol.innerHTML = currentList.innerHTML;
        currentList.replaceWith(ol);
      }
      currentList.querySelectorAll('label, input[type="checkbox"]').forEach(el => el.remove());
    } else if (tableCell) {
      const lines = tableCell.innerText.replace(/\u00a0/g, ' ').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const itemsHtml = (lines.length > 0 ? lines : ['']).map(line => `<li>${escapeHtml(line) || '<br>'}</li>`).join('');
      tableCell.innerHTML = `<ol>${itemsHtml}</ol>`;
      const firstLi = tableCell.querySelector('li');
      if (firstLi) placeCaretAtStart(firstLi);
    } else {
      exec('insertOrderedList');
    }
    onContentChange?.();
    return;
  }
}

function indentListItem(li) {
  if (!li) return;
  const prevLi = li.previousElementSibling;
  if (!prevLi) return;
  const isChecklist = li.closest('ul[data-checklist]');
  const isDash = li.closest('ul[data-dash-list]');
  const isOrdered = li.closest('ol');
  const tag = isOrdered ? 'ol' : 'ul';
  let nestedList = prevLi.querySelector(`:scope > ${tag}`);
  if (!nestedList) {
    nestedList = document.createElement(tag);
    if (isChecklist) nestedList.setAttribute('data-checklist', 'true');
    if (isDash) nestedList.setAttribute('data-dash-list', 'true');
    prevLi.appendChild(nestedList);
  }
  nestedList.appendChild(li);
  const target = li.querySelector('span') || li;
  placeCaretAtStart(target);
}

function outdentListItem(li) {
  if (!li) return;
  const parentList = li.parentElement;
  const parentLi = parentList?.closest('li');
  if (parentLi) {
    parentLi.after(li);
    if (parentList.children.length === 0) parentList.remove();
    const target = li.querySelector('span') || li;
    placeCaretAtStart(target);
  } else {
    extractListItemAsBlock(li, 'p');
  }
}

function applyAlignment({ align, editorRef, onContentChange, onBeforeCommand, tableOverlay }) {
  onBeforeCommand?.();
  const selection = window.getSelection();
  const anchor = selection?.anchorNode?.nodeType === 3 ? selection.anchorNode.parentElement : selection?.anchorNode;
  const cell = anchor?.closest?.('td, th');

  // If inside a table cell or if table overlay has selected cells / rows / cols / range
  if (cell) {
    cell.style.textAlign = align;
  }
  if (tableOverlay?.table) {
    if (tableOverlay.selectedType === 'row' && tableOverlay.row) {
      Array.from(tableOverlay.row.children).forEach(c => { c.style.textAlign = align; });
    } else if (tableOverlay.selectedType === 'col' && tableOverlay.colIndex !== undefined) {
      Array.from(tableOverlay.table.querySelectorAll('tr')).forEach(tr => {
        const colCell = tr.children[tableOverlay.colIndex];
        if (colCell) colCell.style.textAlign = align;
      });
    } else if (tableOverlay.selectedType === 'range' && tableOverlay.range) {
      const { minRow, maxRow, minCol, maxCol } = tableOverlay.range;
      const rows = Array.from(tableOverlay.table.querySelectorAll('tr'));
      for (let r = minRow; r <= maxRow; r++) {
        const tr = rows[r];
        if (tr) {
          for (let c = minCol; c <= maxCol; c++) {
            const rangeCell = tr.children[c];
            if (rangeCell) rangeCell.style.textAlign = align;
          }
        }
      }
    }
  }

  // Also set textAlign on the surrounding block element
  const block = anchor?.closest?.('p, h1, h2, h3, h4, li, blockquote, div');
  if (block && block !== editorRef.current) {
    block.style.textAlign = align;
    if (align === 'justify') {
      block.style.textJustify = 'inter-word';
    } else {
      block.style.textJustify = '';
    }
  }

  // Also execute standard browser exec command for regular text
  const cmdMap = {
    left: 'justifyLeft',
    center: 'justifyCenter',
    right: 'justifyRight',
    justify: 'justifyFull',
  };
  if (cmdMap[align]) {
    exec(cmdMap[align]);
  }

  onContentChange?.();
}

function htmlToMarkdown(html, title) {
  const container = document.createElement('div');
  container.innerHTML = html || '';

  // Transform checklist items
  container.querySelectorAll('ul[data-checklist] li').forEach(li => {
    const isChecked = li.querySelector('input[type="checkbox"]')?.checked;
    const clone = li.cloneNode(true);
    clone.querySelector('label')?.remove();
    clone.querySelector('input')?.remove();
    const text = clone.innerText.replace(/\u00a0/g, '').trim();
    li.textContent = `[${isChecked ? 'x' : ' '}] ${text}`;
  });

  function nodeToMd(node) {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType !== 1) return '';

    const tag = node.tagName.toLowerCase();
    const inner = Array.from(node.childNodes).map(nodeToMd).join('');

    switch (tag) {
      case 'h1':
        return `\n# ${inner.trim()}\n\n`;
      case 'h2':
        return `\n## ${inner.trim()}\n\n`;
      case 'h3':
        return `\n### ${inner.trim()}\n\n`;
      case 'h4':
        return `\n#### ${inner.trim()}\n\n`;
      case 'p':
        return `${inner}\n\n`;
      case 'b':
      case 'strong':
        return `**${inner}**`;
      case 'i':
      case 'em':
        return `*${inner}*`;
      case 'u':
        return `<u>${inner}</u>`;
      case 's':
      case 'strike':
        return `~~${inner}~~`;
      case 'blockquote':
        return `\n> ${inner.trim().replace(/\n/g, '\n> ')}\n\n`;
      case 'code':
        return `\`${inner}\``;
      case 'pre':
        return `\n\`\`\`\n${inner.trim()}\n\`\`\`\n\n`;
      case 'ul':
        return `\n${Array.from(node.children).map(li => `- ${nodeToMd(li).trim()}`).join('\n')}\n\n`;
      case 'ol':
        return `\n${Array.from(node.children).map((li, i) => `${i + 1}. ${nodeToMd(li).trim()}`).join('\n')}\n\n`;
      case 'li':
        return inner;
      case 'a':
        return `[${inner}](${node.getAttribute('href') || ''})`;
      case 'hr':
        return `\n---\n\n`;
      case 'br':
        return `\n`;
      default:
        return inner;
    }
  }

  const bodyMd = Array.from(container.childNodes).map(nodeToMd).join('').trim();
  return `# ${title || 'Untitled note'}\n\n${bodyMd}`;
}

function FloatingToolbar({ editorRef, onContentChange, onBeforeCommand, lang = 'en' }) {
  const [position, setPosition] = useState(null);
  const [isInsideTable, setIsInsideTable] = useState(false);
  const [headingOpen, setHeadingOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [currentBlock, setCurrentBlock] = useState('p');
  const toolbarRef = useRef(null);
  const savedRangeRef = useRef(null);
  const linkOpenRef = useRef(linkOpen);
  linkOpenRef.current = linkOpen;

  const isNl = lang === 'nl';

  const run = (cmd, value = null) => {
    onBeforeCommand?.();
    exec(cmd, value);
    onContentChange?.();
    updatePosition();
  };

  const handleHeading = (tag) => {
    setBlockFormat(editorRef, tag, onContentChange, onBeforeCommand);
    setCurrentBlock(tag);
    setHeadingOpen(false);
    updatePosition();
  };

  const handleChecklist = () => {
    insertOrFormatChecklist({ editorRef, onContentChange, onBeforeCommand });
    updatePosition();
  };

  const handleCode = () => {
    onBeforeCommand?.();
    const selection = window.getSelection()?.toString() || 'Code';
    exec('insertHTML', `<div class="note-code" contenteditable="false"><button data-copy-code aria-label="Copy code">Copy</button><pre contenteditable="true"><code>${escapeHtml(selection)}</code></pre></div><p><br></p>`);
    onContentChange?.();
    updatePosition();
  };

  const handleAlignment = (align) => {
    onBeforeCommand?.();
    const sel = window.getSelection();
    const anchor = sel?.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel?.anchorNode;
    const cell = anchor?.closest?.('td, th');
    if (cell) {
      cell.style.textAlign = align;
    }
    const cmdMap = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull' };
    if (cmdMap[align]) exec(cmdMap[align]);
    setAlignOpen(false);
    onContentChange?.();
    updatePosition();
  };

  const addLink = () => {
    if (!linkName.trim() || !linkUrl.trim()) return;
    onBeforeCommand?.();
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    const finalUrl = linkUrl.trim().startsWith('http://') || linkUrl.trim().startsWith('https://')
      ? linkUrl.trim()
      : `https://${linkUrl.trim()}`;
    exec('insertHTML', `<a href="${finalUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkName.trim())}</a>`);
    setLinkOpen(false);
    setLinkName('');
    setLinkUrl('');
    savedRangeRef.current = null;
    onContentChange?.();
    setTimeout(updatePosition, 50);
  };

  const updatePosition = () => {
    if (linkOpenRef.current) {
      return;
    }
    if (!editorRef.current) {
      setPosition(null);
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setPosition(null);
      setHeadingOpen(false);
      setAlignOpen(false);
      setHighlightOpen(false);
      setLinkOpen(false);
      return;
    }

    if (!editorRef.current.contains(selection.anchorNode)) {
      setPosition(null);
      return;
    }

    const node = selection.anchorNode.nodeType === 3 ? selection.anchorNode.parentElement : selection.anchorNode;
    const inTable = Boolean(node?.closest?.('td, th, table, .note-table'));
    setIsInsideTable(inTable);

    const block = node?.closest('h1, h2, h3, h4, p, blockquote');
    let tagName = 'p';
    if (block) {
      const tag = block.tagName.toLowerCase();
      if (tag === 'h1') {
        tagName = block.classList.contains('note-title') ? 'title' : 'h1';
      } else {
        tagName = tag;
      }
    }
    setCurrentBlock(tagName);

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      setPosition(null);
      return;
    }

    const editorRect = editorRef.current.getBoundingClientRect();
    let top = rect.top - 46;
    if (top < editorRect.top - 20) {
      top = rect.bottom + 8;
    }
    const left = Math.max(200, Math.min(window.innerWidth - 220, rect.left + rect.width / 2));

    setPosition({ top, left });
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      setTimeout(updatePosition, 10);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  useEffect(() => {
    if (!headingOpen && !alignOpen && !highlightOpen && !linkOpen) return;
    const handleOutsideClick = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setHeadingOpen(false);
        setAlignOpen(false);
        setHighlightOpen(false);
        setLinkOpen(false);
        savedRangeRef.current = null;
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [headingOpen, alignOpen, highlightOpen, linkOpen]);

  if (!position) return null;

  const headingLabelMap = isNl ? {
    title: 'Titel',
    h1: 'Koptekst',
    h2: 'Subkop',
    h3: 'Kop 3',
    p: 'Hoofdtekst',
  } : {
    title: 'Title',
    h1: 'Heading',
    h2: 'Subheading',
    h3: 'Heading 3',
    p: 'Normal',
  };

  const headingOptions = isNl ? [
    ['title', 'Titel', '⇧⌘T'],
    ['h1', 'Koptekst', '⇧⌘H'],
    ['h2', 'Subkop', '⇧⌘J'],
    ['h3', 'Kop 3', '⇧⌘I'],
    ['p', 'Hoofdtekst', '⇧⌘B'],
  ] : [
    ['title', 'Title', '⇧⌘T'],
    ['h1', 'Heading', '⇧⌘H'],
    ['h2', 'Subheading', '⇧⌘J'],
    ['h3', 'Heading 3', '⇧⌘I'],
    ['p', 'Normal', '⇧⌘B'],
  ];

  const alignmentOptions = isNl ? [
    { id: 'left', label: 'Lijn links uit', shortcut: '⌘{', icon: AlignLeft },
    { id: 'center', label: 'Centreer', shortcut: '⌘|', icon: AlignCenter },
    { id: 'justify', label: 'Vul uit', shortcut: '', icon: AlignJustify },
    { id: 'right', label: 'Lijn rechts uit', shortcut: '⌘}', icon: AlignRight },
  ] : [
    { id: 'left', label: 'Align left', shortcut: '⌘{', icon: AlignLeft },
    { id: 'center', label: 'Center', shortcut: '⌘|', icon: AlignCenter },
    { id: 'justify', label: 'Justify', shortcut: '', icon: AlignJustify },
    { id: 'right', label: 'Align right', shortcut: '⌘}', icon: AlignRight },
  ];

  const openAbove = position.top > 220;

  return (
    <ViewportPanel
      ref={toolbarRef}
      className="fixed z-[110] flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 transition-all text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translate(-50%, 0)',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        title={isNl ? 'Opmaak & markering wissen' : 'Clear formatting & highlights'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          clearFormattingAndHighlight(editorRef, onContentChange, onBeforeCommand);
          setCurrentBlock('p');
          updatePosition();
        }}
        className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <Eraser className="h-3.5 w-3.5" />
      </button>

      {/* Show heading dropdown ONLY when NOT inside a table cell */}
      {!isInsideTable && (
        <>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setHeadingOpen((v) => !v);
                setAlignOpen(false);
                setHighlightOpen(false);
                setLinkOpen(false);
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span>{headingLabelMap[currentBlock] || (isNl ? 'Hoofdtekst' : 'Normal')}</span>
              <ChevronRight className={`h-3 w-3 transition-transform ${headingOpen ? 'rotate-90' : ''}`} />
            </button>

            {headingOpen && (
              <ViewportPanel
                className={`absolute left-0 ${openAbove ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} z-20 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900`}
                onMouseDown={(e) => e.preventDefault()}
              >
                {headingOptions.map(([tag, label, shortcut]) => (
                  <button
                    key={tag}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleHeading(tag)}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      currentBlock === tag ? 'font-bold bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : ''
                    }`}
                  >
                    <span>{label}</span>
                    <span className="text-[10px] text-slate-400">{shortcut}</span>
                  </button>
                ))}
              </ViewportPanel>
            )}
          </div>
        </>
      )}

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      <button
        type="button"
        title="Bold (⌘B)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run('bold')}
        className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Italic (⌘I)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run('italic')}
        className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Underline (⌘U)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run('underline')}
        className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <Underline className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Strikethrough"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run('strikeThrough')}
        className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </button>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      <button
        type="button"
        title={isNl ? 'Opsommingstekenslijst (⇧⌘7)' : 'Bullet list (⇧⌘7)'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run('insertUnorderedList')}
        className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title={isNl ? 'Genummerde lijst (⇧⌘9)' : 'Numbered list (⇧⌘9)'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run('insertOrderedList')}
        className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title={isNl ? 'Checklist (⇧⌘L)' : 'Checklist (⇧⌘L)'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleChecklist}
        className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <CheckSquare className="h-3.5 w-3.5" />
      </button>

      {/* Hide Quote, Code, Link if inside a table cell */}
      {!isInsideTable && (
        <>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          <button
            type="button"
            title={isNl ? 'Blokcitaat (⌥⌘\')' : 'Quote (⌥⌘\')'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              toggleQuote(editorRef, onContentChange, onBeforeCommand);
              updatePosition();
            }}
            className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Quote className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title={isNl ? 'Codeblok (⇧⌘M)' : 'Code block (⇧⌘M)'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCode}
            className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>

          <div className="relative">
            <button
              type="button"
              title={isNl ? 'Link toevoegen' : 'Insert link'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                  savedRangeRef.current = sel.getRangeAt(0).cloneRange();
                }
                const selText = sel?.toString() || '';
                setLinkName(selText);
                setLinkUrl('');
                setLinkOpen((v) => !v);
                setHeadingOpen(false);
                setAlignOpen(false);
                setHighlightOpen(false);
              }}
              className={`rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white ${linkOpen ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : ''}`}
            >
              <Link className="h-3.5 w-3.5" />
            </button>

            {linkOpen && (
              <ViewportPanel
                className={`absolute right-0 ${openAbove ? 'bottom-full mb-2' : 'top-full mt-2'} z-30 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900 text-left`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {isNl ? 'Link tekst' : 'Link text'}
                  <input
                    className={`${fieldClass} mt-1 w-full text-xs`}
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder={isNl ? 'Tekst…' : 'Text…'}
                  />
                </label>
                <label className="mt-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {isNl ? 'Link URL' : 'Link URL'}
                  <input
                    className={`${fieldClass} mt-1 w-full text-xs`}
                    value={linkUrl}
                    autoFocus
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLink();
                      }
                    }}
                  />
                </label>
                <div className="mt-3 flex justify-end gap-1.5">
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    onClick={() => {
                      setLinkOpen(false);
                      savedRangeRef.current = null;
                      setTimeout(updatePosition, 50);
                    }}
                  >
                    {isNl ? 'Annuleren' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={!linkName.trim() || !linkUrl.trim()}
                    className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white disabled:opacity-50"
                    onClick={addLink}
                  >
                    {isNl ? 'Link invoegen' : 'Insert link'}
                  </button>
                </div>
              </ViewportPanel>
            )}
          </div>
        </>
      )}

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* Text Alignment Dropdown (Tekst) */}
      <div className="relative">
        <button
          type="button"
          title={isNl ? 'Tekstuitlijning' : 'Text alignment'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setAlignOpen((v) => !v);
            setHeadingOpen(false);
            setHighlightOpen(false);
            setLinkOpen(false);
          }}
          className={`rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white ${alignOpen ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : ''}`}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>

        {alignOpen && (
          <ViewportPanel
            className={`absolute right-0 ${openAbove ? 'bottom-full mb-2' : 'top-full mt-2'} z-20 w-48 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900 text-left`}
            onMouseDown={(e) => e.preventDefault()}
          >
            {alignmentOptions.map(({ id, label, shortcut, icon: AlignIcon }) => (
              <button
                key={id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleAlignment(id)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlignIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span>{label}</span>
                </div>
                {shortcut && <span className="text-[10px] text-slate-400 font-mono">{shortcut}</span>}
              </button>
            ))}
          </ViewportPanel>
        )}
      </div>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* Highlighter */}
      <div className="relative">
        <button
          type="button"
          title={isNl ? 'Markeren' : 'Highlight'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setHighlightOpen((v) => !v);
            setAlignOpen(false);
            setHeadingOpen(false);
            setLinkOpen(false);
          }}
          className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <Highlighter className="h-3.5 w-3.5" />
        </button>

        {highlightOpen && (
          <ViewportPanel
            className={`absolute right-0 ${openAbove ? 'bottom-full mb-2' : 'top-full mt-2'} z-20 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900`}
            onMouseDown={(e) => e.preventDefault()}
          >
            <button
              type="button"
              title={isNl ? 'Markering verwijderen' : 'Remove highlight'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                run('hiliteColor', 'transparent');
                setHighlightOpen(false);
              }}
              className="h-5 w-5 rounded-md transition-transform hover:scale-110 shadow-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center relative overflow-hidden shrink-0"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-0.5 bg-red-500 rotate-45" />
              </div>
            </button>

            {PALETTE.slice(0, 6).map((color) => (
              <button
                key={color}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  run('hiliteColor', `${color}55`);
                  setHighlightOpen(false);
                }}
                className="h-5 w-5 rounded-md transition-transform hover:scale-110 shadow-xs border border-black/10 shrink-0"
                style={{ background: color }}
              />
            ))}
          </ViewportPanel>
        )}
      </div>
    </ViewportPanel>
  );
}

function Toolbar({ editorRef, onContentChange, lang = 'en', note }) {
  const [highlights, setHighlights] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [headingOpen, setHeadingOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const highlightsRef = useRef(null);
  const linkRef = useRef(null);
  const alignRef = useRef(null);
  const headingRef = useRef(null);
  const listRef = useRef(null);
  const isNl = lang === 'nl';

  useEffect(() => {
    if (!highlights && !linkOpen && !alignOpen && !headingOpen && !listOpen) return;
    const handleOutsideClick = (e) => {
      if (highlights && highlightsRef.current && !highlightsRef.current.contains(e.target)) {
        setHighlights(false);
      }
      if (linkOpen && linkRef.current && !linkRef.current.contains(e.target)) {
        setLinkOpen(false);
      }
      if (alignOpen && alignRef.current && !alignRef.current.contains(e.target)) {
        setAlignOpen(false);
      }
      if (headingOpen && headingRef.current && !headingRef.current.contains(e.target)) {
        setHeadingOpen(false);
      }
      if (listOpen && listRef.current && !listRef.current.contains(e.target)) {
        setListOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [highlights, linkOpen, alignOpen, headingOpen, listOpen]);

  const alignmentOptions = isNl ? [
    { id: 'left', label: 'Lijn links uit', shortcut: '⌘{', icon: AlignLeft },
    { id: 'center', label: 'Centreer', shortcut: '⌘|', icon: AlignCenter },
    { id: 'justify', label: 'Vul uit', shortcut: '', icon: AlignJustify },
    { id: 'right', label: 'Lijn rechts uit', shortcut: '⌘}', icon: AlignRight },
  ] : [
    { id: 'left', label: 'Align left', shortcut: '⌘{', icon: AlignLeft },
    { id: 'center', label: 'Center', shortcut: '⌘|', icon: AlignCenter },
    { id: 'justify', label: 'Justify', shortcut: '', icon: AlignJustify },
    { id: 'right', label: 'Align right', shortcut: '⌘}', icon: AlignRight },
  ];

  const onBeforeCommand = () => editorRef.current?.__recordHistory?.('command');
  const run = (cmd, value) => {
    onBeforeCommand();
    exec(cmd, value);
    onContentChange();
  };
  const insertChecklist = () => {
    insertOrFormatChecklist({ editorRef, onContentChange, onBeforeCommand });
  };
  const insertCode = () => {
    onBeforeCommand();
    const selection = window.getSelection()?.toString() || 'Code';
    editorRef.current?.focus();
    exec('insertHTML', `<div class="note-code" contenteditable="false"><button data-copy-code aria-label="Copy code">Copy</button><pre contenteditable="true"><code>${escapeHtml(selection)}</code></pre></div><p><br></p>`);
    onContentChange();
  };
  const insertDivider = () => {
    onBeforeCommand();
    editorRef.current?.focus();
    exec('insertHTML', '<div class="note-divider" contenteditable="false"><hr><button data-remove-divider aria-label="Remove divider">×</button></div><p><br></p>');
    onContentChange();
  };
  const addLink = () => {
    if (!linkName.trim() || !linkUrl.trim()) return;
    onBeforeCommand();
    editorRef.current?.focus();
    const finalUrl = linkUrl.trim().startsWith('http://') || linkUrl.trim().startsWith('https://')
      ? linkUrl.trim()
      : `https://${linkUrl.trim()}`;
    exec('insertHTML', `<a href="${finalUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkName.trim())}</a>`);
    setLinkOpen(false);
    setLinkName('');
    setLinkUrl('');
    onContentChange();
  };
  const imageInputRef = useRef(null);
  const insertTable = () => {
    onBeforeCommand();
    editorRef.current?.focus();
    const tableHtml = `
      <div class="note-table-wrapper" contenteditable="false">
        <table class="note-table" contenteditable="true">
          <thead>
            <tr>
              <th>Header 1</th>
              <th>Header 2</th>
              <th>Header 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><br></td>
              <td><br></td>
              <td><br></td>
            </tr>
            <tr>
              <td><br></td>
              <td><br></td>
              <td><br></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p><br></p>
    `;
    exec('insertHTML', tableHtml);
    onContentChange();
  };

  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (dataUrl) {
        onBeforeCommand();
        editorRef.current?.focus();
        const imgHtml = `<figure data-size="medium" class="note-image-wrapper"><img src="${dataUrl}" alt="${escapeHtml(file.name)}" /></figure><p><br></p>`;
        exec('insertHTML', imgHtml);
        onContentChange();
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative flex items-center gap-1 border-b p-2 overflow-x-auto overflow-y-hidden flex-nowrap scrollbar-none max-w-full dark:border-slate-800 shrink-0">
      {/* Heading options dropdown */}
      <div className="relative shrink-0" ref={headingRef}>
        <button
          type="button"
          title={isNl ? 'Kopteksten / Titel' : 'Headings / Title'}
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            setHeadingOpen(v => !v);
            setListOpen(false);
            setLinkOpen(false);
            setHighlights(false);
            setAlignOpen(false);
          }}
          className={`flex items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors shrink-0 ${headingOpen ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''}`}
        >
          <span>Aa</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>

        {headingOpen && (
          <ViewportPanel className="absolute left-0 top-full mt-1.5 z-40 w-44 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => { setBlockFormat(editorRef, 'title', onContentChange, onBeforeCommand); setHeadingOpen(false); }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm font-extrabold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white"
            >
              <span>{isNl ? 'Titel' : 'Title'}</span>
              <span className="text-[10px] text-slate-400 font-normal">⇧⌘T</span>
            </button>
            <button
              type="button"
              onClick={() => { setBlockFormat(editorRef, 'h1', onContentChange, onBeforeCommand); setHeadingOpen(false); }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white"
            >
              <span>Heading 1</span>
              <span className="text-[10px] text-slate-400 font-normal">⇧⌘H</span>
            </button>
            <button
              type="button"
              onClick={() => { setBlockFormat(editorRef, 'h2', onContentChange, onBeforeCommand); setHeadingOpen(false); }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white"
            >
              <span>Heading 2</span>
              <span className="text-[10px] text-slate-400 font-normal">⇧⌘J</span>
            </button>
            <button
              type="button"
              onClick={() => { setBlockFormat(editorRef, 'h3', onContentChange, onBeforeCommand); setHeadingOpen(false); }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <span>Heading 3</span>
              <span className="text-[10px] text-slate-400 font-normal">⇧⌘I</span>
            </button>
            <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
            <button
              type="button"
              onClick={() => { setBlockFormat(editorRef, 'p', onContentChange, onBeforeCommand); setHeadingOpen(false); }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-normal hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <span>{isNl ? 'Body' : 'Body'}</span>
              <span className="text-[10px] text-slate-400 font-normal">⇧⌘B</span>
            </button>
          </ViewportPanel>
        )}
      </div>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" />

      {/* Formatting controls */}
      <button type="button" title="Bold (⌘B)" onMouseDown={e => e.preventDefault()} onClick={() => run('bold')} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0">
        <Bold className="h-4 w-4" />
      </button>
      <button type="button" title="Italic (⌘I)" onMouseDown={e => e.preventDefault()} onClick={() => run('italic')} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0">
        <Italic className="h-4 w-4" />
      </button>
      <button type="button" title="Underline (⌘U)" onMouseDown={e => e.preventDefault()} onClick={() => run('underline')} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0">
        <Underline className="h-4 w-4" />
      </button>
      <button type="button" title="Strikethrough" onMouseDown={e => e.preventDefault()} onClick={() => run('strikeThrough')} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0">
        <Strikethrough className="h-4 w-4" />
      </button>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" />

      {/* List dropdown: Geen, Bullet, Gestreept, Genummerd */}
      <div className="relative shrink-0" ref={listRef}>
        <button
          type="button"
          title={isNl ? 'Lijstopties' : 'List options'}
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            setListOpen(v => !v);
            setHeadingOpen(false);
            setLinkOpen(false);
            setHighlights(false);
            setAlignOpen(false);
          }}
          className={`flex items-center gap-1 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0 ${listOpen ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''}`}
        >
          <List className="h-4 w-4" />
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>

        {listOpen && (
          <ViewportPanel className="absolute left-0 top-full mt-1.5 z-40 w-44 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => { formatList(editorRef, 'none', onContentChange, onBeforeCommand); setListOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <span className="w-4 text-center font-bold text-slate-400">—</span>
              <span>{isNl ? 'Geen' : 'None'}</span>
            </button>
            <button
              type="button"
              onClick={() => { formatList(editorRef, 'bullet', onContentChange, onBeforeCommand); setListOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <span className="w-4 text-center text-sm font-bold leading-none">•</span>
              <span>{isNl ? 'Bullet' : 'Bullet'}</span>
              <span className="ml-auto text-[10px] text-slate-400 font-normal">⇧⌘7</span>
            </button>
            <button
              type="button"
              onClick={() => { formatList(editorRef, 'dash', onContentChange, onBeforeCommand); setListOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <span className="w-4 text-center font-bold text-slate-700 dark:text-slate-200">–</span>
              <span>{isNl ? 'Gestreept' : 'Dashed'}</span>
              <span className="ml-auto text-[10px] text-slate-400 font-normal">- space</span>
            </button>
            <button
              type="button"
              onClick={() => { formatList(editorRef, 'number', onContentChange, onBeforeCommand); setListOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <span className="w-4 text-center font-bold text-xs">1.</span>
              <span>{isNl ? 'Genummerd' : 'Numbered'}</span>
              <span className="ml-auto text-[10px] text-slate-400 font-normal">⇧⌘9</span>
            </button>
          </ViewportPanel>
        )}
      </div>

      {/* Checklist standalone button */}
      <button
        type="button"
        title={isNl ? 'Checklist (⇧⌘L)' : 'Checklist (⇧⌘L)'}
        onMouseDown={e => e.preventDefault()}
        onClick={insertChecklist}
        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0"
      >
        <CheckSquare className="h-4 w-4" />
      </button>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" />

      {/* Quote */}
      <button type="button" title={isNl ? 'Blokcitaat (⌥⌘\')' : 'Quote (⌥⌘\')'} onMouseDown={e => e.preventDefault()} onClick={() => toggleQuote(editorRef, onContentChange, onBeforeCommand)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0">
        <Quote className="h-4 w-4" />
      </button>

      {/* Code */}
      <button type="button" title={isNl ? 'Codeblok (⇧⌘M)' : 'Code box (⇧⌘M)'} onMouseDown={e => e.preventDefault()} onClick={insertCode} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0">
        <Code2 className="h-4 w-4" />
      </button>

      {/* Table */}
      <button type="button" title={isNl ? 'Tabel invoegen' : 'Insert table'} onMouseDown={e => e.preventDefault()} onClick={insertTable} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0">
        <Table className="h-4 w-4" />
      </button>

      {/* Eraser / Clear format */}
      <button type="button" title={isNl ? 'Opmaak & markering wissen' : 'Remove formatting & highlight'} onMouseDown={e => e.preventDefault()} onClick={() => clearFormattingAndHighlight(editorRef, onContentChange, onBeforeCommand)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0">
        <Eraser className="h-4 w-4" />
      </button>

      {/* Image Upload Button */}
      <button
        type="button"
        title={isNl ? 'Afbeelding toevoegen' : 'Insert image'}
        onMouseDown={e => e.preventDefault()}
        onClick={() => imageInputRef.current?.click()}
        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0"
      >
        <ImageIcon className="h-4 w-4" />
      </button>
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFile(file);
          e.target.value = '';
        }}
        className="hidden"
      />

      <div className="relative" ref={linkRef}>
        <button
          type="button"
          title={isNl ? 'Link invoegen' : 'Insert link'}
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            const selText = window.getSelection()?.toString() || '';
            if (selText) setLinkName(selText);
            setLinkOpen(v => !v);
            setHighlights(false);
          }}
          className={`rounded p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 ${linkOpen ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''}`}
        >
          <Link className="h-4 w-4" />
        </button>

        {linkOpen && (
          <ViewportPanel className="absolute left-0 top-full mt-1.5 z-40 w-72 rounded-xl border bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <label className="text-xs text-slate-500">{isNl ? 'Link tekst' : 'Link text'}
              <input className={`${fieldClass} mt-1 w-full`} value={linkName} onChange={e => setLinkName(e.target.value)} />
            </label>
            <label className="mt-2 block text-xs text-slate-500">{isNl ? 'Link URL' : 'Link URL'}
              <input
                className={`${fieldClass} mt-1 w-full`}
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLink();
                  }
                }}
              />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button className={secondaryButton} onClick={() => setLinkOpen(false)}>{isNl ? 'Annuleren' : 'Cancel'}</button>
              <button className={primaryButton} disabled={!linkName.trim() || !linkUrl.trim()} onClick={addLink}>{isNl ? 'Invoegen' : 'Insert link'}</button>
            </div>
          </ViewportPanel>
        )}
      </div>

      {/* Text Alignment Dropdown (Tekst) */}
      <div className="relative" ref={alignRef}>
        <button
          type="button"
          title={isNl ? 'Tekstuitlijning' : 'Text alignment'}
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            setAlignOpen(v => !v);
            setHighlights(false);
            setLinkOpen(false);
          }}
          className={`rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${alignOpen ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''}`}
        >
          <AlignLeft className="h-4 w-4" />
        </button>

        {alignOpen && (
          <ViewportPanel
            className="absolute left-0 top-full mt-1.5 z-40 w-48 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onMouseDown={e => e.preventDefault()}
          >
            {alignmentOptions.map(({ id, label, shortcut, icon: AlignIcon }) => (
              <button
                key={id}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  onBeforeCommand?.();
                  const sel = window.getSelection();
                  const anchor = sel?.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel?.anchorNode;
                  const cell = anchor?.closest?.('td, th');
                  if (cell) {
                    cell.style.textAlign = id;
                  }
                  const cmdMap = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull' };
                  if (cmdMap[id]) exec(cmdMap[id]);
                  setAlignOpen(false);
                  onContentChange();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlignIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span>{label}</span>
                </div>
                {shortcut && <span className="text-[10px] text-slate-400 font-mono">{shortcut}</span>}
              </button>
            ))}
          </ViewportPanel>
        )}
      </div>

      <div className="relative" ref={highlightsRef}>
        <button
          type="button"
          title={isNl ? 'Markeren' : 'Highlight'}
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            setHighlights(v => !v);
            setAlignOpen(false);
            setLinkOpen(false);
          }}
          className={`rounded p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 ${highlights ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''}`}
        >
          <Highlighter className="h-4 w-4" />
        </button>

        {highlights && (
          <ViewportPanel className="absolute left-0 top-full mt-1.5 z-40 flex items-center gap-1 rounded-xl border bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              title={isNl ? 'Markering verwijderen' : 'Remove highlight'}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { run('hiliteColor', 'transparent'); setHighlights(false); }}
              className="h-6 w-6 rounded-md transition-transform hover:scale-110 shadow-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center relative overflow-hidden shrink-0"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-0.5 bg-red-500 rotate-45" />
              </div>
            </button>

            {PALETTE.slice(0, 6).map(color => (
              <button key={color} onMouseDown={e => e.preventDefault()} onClick={() => { run('hiliteColor', `${color}55`); setHighlights(false); }} className="h-6 w-7 rounded shrink-0 shadow-xs border border-black/10" style={{ background: color }} />
            ))}
          </ViewportPanel>
        )}
      </div>

      <button type="button" title={isNl ? 'Scheidingslijn' : 'Divider'} onMouseDown={e => e.preventDefault()} onClick={insertDivider} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
        —
      </button>

      {note && (
        <div className="ml-auto flex items-center text-xs text-slate-400 dark:text-slate-500 pr-1 select-none font-medium">
          <span>{countWords(note.content)} {isNl ? 'woorden' : 'words'}</span>
        </div>
      )}
    </div>
  );
}

const renderFolderIcon = (folder, isOpen = false, className = "h-5 w-5") => {
  const color = folder?.color || COLORS[0];
  const iconName = folder?.icon;
  const FolderIconComp = isOpen ? FolderOpen : Folder;

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {/* Folder base colored with folder.color */}
      <FolderIconComp
        className="w-full h-full drop-shadow-xs"
        fill={color}
        style={{ color: color }}
      />
      {/* Centered white icon on folder body */}
      {iconName && iconName !== 'Folder' && iconName !== 'FolderOpen' ? (
        <div className="absolute inset-0 flex items-center justify-center pt-0.5 pointer-events-none">
          {typeof iconName === 'string' && (iconName.startsWith('custom:') || iconName.startsWith('<svg') || iconName.startsWith('data:image/svg+xml')) ? (
            <span
              className="h-2 w-2 inline-flex items-center justify-center shrink-0 text-white [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
              dangerouslySetInnerHTML={{
                __html: (iconName.startsWith('custom:') ? iconName.slice(7) : iconName)
                  .replace(/width="[^"]*"/i, '')
                  .replace(/height="[^"]*"/i, '')
                  .replace(/stroke="[^"]*"/gi, 'stroke="currentColor"')
                  .replace(/fill="[^"]*"/gi, 'fill="none"')
              }}
            />
          ) : (
            (() => {
              const IconComp = NOTE_ICON_MAP[iconName] || NotebookPen;
              return <IconComp className="h-2 w-2 text-white stroke-[2.2]" />;
            })()
          )}
        </div>
      ) : null}
    </div>
  );
};

const renderNoteIcon = (iconName, color, className = "h-[19px] w-[19px]") => {
  const bg = color || COLORS[0];
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-[5px] shrink-0 shadow-2xs ${className}`}
      style={{ backgroundColor: bg }}
    >
      {typeof iconName === 'string' && (iconName.startsWith('custom:') || iconName.startsWith('<svg') || iconName.startsWith('data:image/svg+xml')) ? (
        (() => {
          const rawSvg = iconName.startsWith('custom:') ? iconName.slice(7) : iconName;
          if (rawSvg.startsWith('<svg')) {
            const cleanedSvg = rawSvg
              .replace(/width="[^"]*"/i, '')
              .replace(/height="[^"]*"/i, '')
              .replace(/stroke="[^"]*"/gi, 'stroke="currentColor"')
              .replace(/fill="[^"]*"/gi, 'fill="none"')
              .replace(/color="[^"]*"/gi, '');
            return (
              <span
                className="w-3/5 h-3/5 inline-flex items-center justify-center shrink-0 text-white [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
                dangerouslySetInnerHTML={{ __html: cleanedSvg }}
              />
            );
          }
          return (
            <img
              src={rawSvg}
              alt="icon"
              className="w-3/5 h-3/5 object-contain shrink-0 filter invert"
            />
          );
        })()
      ) : (
        (() => {
          const IconComp = NOTE_ICON_MAP[iconName] || NotebookPen;
          return <IconComp className="w-3/5 h-3/5 text-white stroke-[2.4]" />;
        })()
      )}
    </div>
  );
};

function countWords(htmlContent) {
  if (!htmlContent) return 0;
  const text = htmlContent
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function getReadingTime(wordCount, isNl) {
  const minutes = Math.ceil(wordCount / 200);
  if (minutes <= 1) return isNl ? '< 1 min' : '< 1 min';
  return `${minutes} min`;
}

const NOTE_TABLE_COLUMNS = [
  { id: 'name', labelNl: 'Notitie / Map', labelEn: 'Note / Folder', defaultVisible: true, minWidth: 160, defaultWidth: 300, nonHideable: true },
  { id: 'tags', labelNl: 'Labels', labelEn: 'Labels', defaultVisible: true, minWidth: 100, defaultWidth: 160 },
  { id: 'words', labelNl: 'Woorden', labelEn: 'Words', defaultVisible: true, minWidth: 70, defaultWidth: 90, align: 'center' },
  { id: 'readTime', labelNl: 'Leestijd', labelEn: 'Read time', defaultVisible: false, minWidth: 80, defaultWidth: 100, align: 'center' },
  { id: 'modified', labelNl: 'Laatst bewerkt', labelEn: 'Last edited', defaultVisible: true, minWidth: 130, defaultWidth: 150, align: 'center' },
  { id: 'created', labelNl: 'Aangemaakt', labelEn: 'Added', defaultVisible: true, minWidth: 130, defaultWidth: 150, align: 'center' },
  { id: 'actions', labelNl: '', labelEn: '', defaultVisible: true, width: 44, fixed: true, nonHideable: true },
];

function formatDate(timestamp, isNl) {
  if (!timestamp) return '—';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '—';
    const dateStr = d.toLocaleDateString(isNl ? 'nl-NL' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${dateStr}, ${hours}:${minutes}`;
  } catch {
    return '—';
  }
}

function formatHeaderDate(timestamp) {
  if (!timestamp) return '—';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return '—';
  }
}

function getPreviewText(htmlContent) {
  if (!htmlContent) return '';
  return htmlContent
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function IconColorPopover({ popover, isNl, onClose, onSave }) {
  const popoverRef = useRef(null);
  const fileInputRef = useRef(null);
  const svgMenuRef = useRef(null);
  const colorMenuRef = useRef(null);
  const { item, anchorRect } = popover;
  const isFolder = item.type === 'folder';
  const [selectedIcon, setSelectedIcon] = useState(item.icon || (isFolder ? null : 'NotebookPen'));
  const [selectedColor, setSelectedColor] = useState(item.color || COLORS[0]);
  const [customSvgList, setCustomSvgList] = useStoredState('biba_custom_svg_icons', []);
  const [savedColors, setSavedColors] = useStoredState('biba_saved_note_colors', []);
  const [svgContextMenu, setSvgContextMenu] = useState(null);
  const [colorContextMenu, setColorContextMenu] = useState(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (svgMenuRef.current && svgMenuRef.current.contains(e.target)) {
        return;
      }
      if (colorMenuRef.current && colorMenuRef.current.contains(e.target)) {
        return;
      }
      if (svgContextMenu) {
        setSvgContextMenu(null);
        return;
      }
      if (colorContextMenu) {
        setColorContextMenu(null);
        return;
      }
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [onClose, svgContextMenu, colorContextMenu]);

  if (!anchorRect) return null;

  const POPOVER_HEIGHT = 440;
  const POPOVER_WIDTH = 300;
  let top = anchorRect.bottom + 6;
  let left = Math.min(anchorRect.left, window.innerWidth - POPOVER_WIDTH - 12);
  left = Math.max(10, left);

  // If opening below would overflow the window bottom, open upwards
  if (top + POPOVER_HEIGHT > window.innerHeight) {
    top = anchorRect.top - POPOVER_HEIGHT - 6;
  }
  // Clamp inside screen bounds so it never cuts off
  if (top < 10) {
    top = Math.max(10, window.innerHeight - POPOVER_HEIGHT - 12);
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      let content = event.target?.result;
      if (typeof content === 'string') {
        if (content.includes('<svg')) {
          const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/i);
          if (svgMatch) {
            content = svgMatch[0];
          }
          const customKey = `custom:${content}`;
          setCustomSvgList(prev => {
            const next = [customKey, ...prev.filter(x => x !== customKey).slice(0, 23)];
            try {
              localStorage.setItem('biba_custom_svg_icons', JSON.stringify(next));
            } catch {}
            return next;
          });
          setSelectedIcon(customKey);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const deleteCustomSvg = (svgStr) => {
    setCustomSvgList(prev => {
      const next = prev.filter(x => x !== svgStr);
      try {
        localStorage.setItem('biba_custom_svg_icons', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (selectedIcon === svgStr) {
      setSelectedIcon(isFolder ? null : 'NotebookPen');
    }
    setSvgContextMenu(null);
  };

  const handleSaveColor = () => {
    if (!selectedColor) return;
    if (!savedColors.includes(selectedColor)) {
      setSavedColors(prev => {
        const next = [selectedColor, ...prev].slice(0, 14);
        try {
          localStorage.setItem('biba_saved_note_colors', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  };

  const deleteSavedColor = (color) => {
    setSavedColors(prev => {
      const next = prev.filter(c => c !== color);
      try {
        localStorage.setItem('biba_saved_note_colors', JSON.stringify(next));
      } catch {}
      return next;
    });
    setColorContextMenu(null);
  };

  const renderIconItem = (nameOrSvg, isSelected, onSelect) => {
    const isCustom = typeof nameOrSvg === 'string' && (nameOrSvg.startsWith('custom:') || nameOrSvg.startsWith('<svg'));
    return (
      <button
        key={nameOrSvg}
        type="button"
        title={isCustom ? (isNl ? 'Eigen SVG (Rechtermuisklik om te verwijderen)' : 'Custom SVG (Right-click to delete)') : nameOrSvg}
        onClick={() => onSelect(nameOrSvg)}
        onContextMenu={(e) => {
          if (isCustom) {
            e.preventDefault();
            e.stopPropagation();
            setSvgContextMenu({
              x: e.clientX,
              y: e.clientY,
              svgStr: nameOrSvg,
            });
          }
        }}
        className={`relative flex h-7 w-7 items-center justify-center rounded-md transition-all ${
          isSelected
            ? 'bg-white shadow-xs ring-2 ring-slate-800 text-slate-900 dark:bg-slate-700 dark:ring-white dark:text-white'
            : 'text-slate-800 hover:bg-white/80 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700/60 dark:hover:text-white'
        }`}
      >
        {isCustom ? (
          <span
            className="h-3.5 w-3.5 inline-flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full text-slate-800 dark:text-slate-200"
            dangerouslySetInnerHTML={{
              __html: (nameOrSvg.startsWith('custom:') ? nameOrSvg.slice(7) : nameOrSvg)
                .replace(/width="[^"]*"/i, '')
                .replace(/height="[^"]*"/i, '')
                .replace(/stroke="[^"]*"/gi, 'stroke="currentColor"')
                .replace(/fill="[^"]*"/gi, 'fill="none"')
            }}
          />
        ) : (
          (() => {
            const IconComp = NOTE_ICON_MAP[nameOrSvg] || NotebookPen;
            return <IconComp className="h-3.5 w-3.5 text-slate-800 dark:text-slate-200" />;
          })()
        )}
      </button>
    );
  };

  return (
    <ViewportPanel
      ref={popoverRef}
      className="fixed z-[140] w-72 max-h-[calc(100vh-20px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100"
      style={{ top, left }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 shadow-inner shrink-0">
            {isFolder ? (
              renderFolderIcon({ color: selectedColor, icon: selectedIcon }, false, "h-5 w-5")
            ) : (
              renderNoteIcon(selectedIcon, selectedColor, "h-5 w-5")
            )}
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
            {isNl ? (isFolder ? 'Mapicoon & kleur' : 'Icoon & kleur') : (isFolder ? 'Folder icon & color' : 'Icon & color')}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 1. Icon Grid with Custom SVG upload */}
      <div className="mt-2.5">
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {isNl ? 'Kies icoon' : 'Select icon'}
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            title={isNl ? 'Eigen SVG uploaden' : 'Upload custom SVG'}
          >
            <Upload className="h-3 w-3" />
            <span>{isNl ? 'Upload SVG' : 'Upload SVG'}</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".svg,image/svg+xml"
            className="hidden"
          />
        </div>

        <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
          {/* Custom uploaded SVGs */}
          {customSvgList.map((svgStr) => renderIconItem(svgStr, selectedIcon === svgStr, setSelectedIcon))}

          {/* Built-in Lucide icons */}
          {NOTE_ICON_NAMES.map((name) => renderIconItem(name, selectedIcon === name, setSelectedIcon))}
        </div>
      </div>

      {/* 2. Color Selection: Presets (1 compact row with square custom picker FIRST) & Saved Colors (1 row) */}
      <div className="mt-3 space-y-2 border-t pt-2.5 dark:border-slate-800">
        {/* Preset Row: Custom color picker first + 10 presets */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            {isNl ? 'Standaard kleuren' : 'Presets'}
          </span>
          <div className="grid grid-cols-11 gap-1.5 items-center">
            {/* Square Custom Color Picker Tile First */}
            <MacColorPicker
              value={selectedColor}
              onChange={(c) => setSelectedColor(c)}
              buttonClassName="aspect-square w-full rounded-[4px] border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900 hover:border-slate-500 dark:hover:border-slate-400 flex items-center justify-center p-0 shadow-xs transition-transform hover:scale-110 shrink-0 cursor-pointer"
              title={isNl ? 'Aangepaste kleur kiezen' : 'Custom color picker'}
            >
              <Pipette className="h-2.5 w-2.5 text-slate-800 dark:text-slate-100 stroke-[2.4]" />
            </MacColorPicker>

            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => setSelectedColor(c)}
                className={`aspect-square w-full rounded-[4px] transition-transform hover:scale-110 shadow-xs border shrink-0 ${
                  selectedColor === c
                    ? 'ring-2 ring-slate-800 scale-110 border-white dark:ring-white dark:border-slate-900'
                    : 'border-black/15 hover:border-black/35 dark:border-white/20'
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        {/* Saved Colors Row */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isNl ? 'Opgeslagen kleuren' : 'Saved colors'}
            </span>
            <button
              type="button"
              onClick={handleSaveColor}
              disabled={savedColors.includes(selectedColor)}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white disabled:opacity-40"
              title={isNl ? 'Huidige kleur opslaan' : 'Save current color'}
            >
              <Plus className="h-3 w-3" />
              <span>{isNl ? 'Opslaan' : 'Save'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 min-h-[24px] overflow-x-auto py-0.5">
            {savedColors.map((c) => (
              <button
                key={c}
                type="button"
                title={isNl ? `${c} (Rechtermuisknop om te verwijderen)` : `${c} (Right-click to delete)`}
                onClick={() => setSelectedColor(c)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setColorContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    color: c,
                  });
                }}
                className={`h-5 w-5 rounded-[4px] transition-transform hover:scale-110 shadow-xs border shrink-0 ${
                  selectedColor === c
                    ? 'ring-2 ring-slate-800 scale-110 border-white dark:ring-white dark:border-slate-900'
                    : 'border-black/15 hover:border-black/35 dark:border-white/20'
                }`}
                style={{ background: c }}
              />
            ))}
            {savedColors.length === 0 && (
              <span className="text-[11px] text-slate-400 italic">
                {isNl ? 'Geen opgeslagen kleuren' : 'No saved colors'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-1.5 border-t pt-2 dark:border-slate-800">
        <button
          type="button"
          className="rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={onClose}
        >
          {isNl ? 'Annuleren' : 'Cancel'}
        </button>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          onClick={() => {
            onSave(selectedIcon, selectedColor);
            onClose();
          }}
        >
          {isNl ? 'Toepassen' : 'Apply'}
        </button>
      </div>

      {/* Context Menu for SVG deletion */}
      {svgContextMenu && (
        <ViewportPanel
          ref={svgMenuRef}
          className="fixed z-[160] rounded-xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900 text-xs"
          style={{ left: svgContextMenu.x, top: svgContextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              deleteCustomSvg(svgContextMenu.svgStr);
            }}
            onClick={() => deleteCustomSvg(svgContextMenu.svgStr)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 w-full text-left font-medium cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            <span>{isNl ? 'Verwijder SVG' : 'Delete SVG'}</span>
          </button>
        </ViewportPanel>
      )}

      {/* Context Menu for Saved Color deletion */}
      {colorContextMenu && (
        <ViewportPanel
          ref={colorMenuRef}
          className="fixed z-[160] rounded-xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900 text-xs"
          style={{ left: colorContextMenu.x, top: colorContextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              deleteSavedColor(colorContextMenu.color);
            }}
            onClick={() => deleteSavedColor(colorContextMenu.color)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 w-full text-left font-medium cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            <span>{isNl ? 'Verwijder kleur' : 'Delete color'}</span>
          </button>
        </ViewportPanel>
      )}
    </ViewportPanel>
  );
}

function ContextMenu({ menu, folders, onClose, onAction, isNl }) {
  const menuRef = useRef(null);
  const [contextSubmenu, setContextSubmenu] = useState(null); // 'export' | 'move' | null

  useEffect(() => {
    if (!menu) return;
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [menu, onClose]);

  if (!menu) return null;
  const item = menu.item;
  const isFolder = item.type === 'folder';

  const menuItems = [
    { id: 'rename', label: isNl ? 'Naam wijzigen' : 'Rename', icon: Pencil },
    { id: 'icon-color', label: isNl ? 'Icoon & kleur wijzigen' : 'Change icon & color', icon: Palette },
    ...(!isFolder ? [
      { id: 'tags', label: isNl ? 'Labels beheren' : 'Manage labels', icon: Tag },
    ] : []),
    ...(isFolder ? [
      { id: 'add-folder', label: isNl ? 'Map toevoegen' : 'Add folder', icon: FolderPlus },
      { id: 'add-note', label: isNl ? 'Notitie toevoegen' : 'Add note', icon: FilePlus },
      { id: 'apply-color-all', label: isNl ? 'Kleur toepassen op alle notities' : 'Apply color to all notes', icon: Palette },
      { id: 'apply-icon-all', label: isNl ? 'Icoon toepassen op alle notities' : 'Apply icon to all notes', icon: Sparkles },
    ] : []),
    { id: 'duplicate', label: isNl ? 'Dupliceren' : 'Duplicate', icon: Copy },
  ];

  return (
    <ViewportPanel
      ref={menuRef}
      className="fixed z-[140] w-64 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      style={{ left: menu.x, top: menu.y }}
      onClick={e => e.stopPropagation()}
      onMouseLeave={() => setContextSubmenu(null)}
    >
      <p className="truncate px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.name || item.title}</p>
      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
      {menuItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onMouseEnter={() => setContextSubmenu(null)}
          onClick={() => {
            setContextSubmenu(null);
            onAction(id, item);
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
        >
          <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>{label}</span>
        </button>
      ))}

      {/* Export option for notes */}
      {!isFolder && (
        <div
          className="relative"
          onMouseEnter={() => setContextSubmenu('export')}
        >
          <button
            type="button"
            onClick={() => setContextSubmenu(s => s === 'export' ? null : 'export')}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors ${
              contextSubmenu === 'export' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{isNl ? 'Exporteer' : 'Export'}</span>
            </div>
            <ChevronRight className="h-3 w-3 text-slate-400" />
          </button>

          {contextSubmenu === 'export' && (
            <ViewportPanel className="absolute left-full top-0 ml-1.5 w-44 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-2xl dark:border-slate-700 dark:bg-slate-900 z-50">
              <button
                type="button"
                onClick={() => {
                  setContextSubmenu(null);
                  onAction('export-md', item);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                <span>Markdown (.md)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setContextSubmenu(null);
                  onAction('export-pdf', item);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5 text-slate-400" />
                <span>PDF (.pdf)</span>
              </button>
            </ViewportPanel>
          )}
        </div>
      )}

      {/* Move option */}
      <div
        className="relative"
        onMouseEnter={() => setContextSubmenu('move')}
      >
        <button
          type="button"
          onClick={() => setContextSubmenu(s => s === 'move' ? null : 'move')}
          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors ${
            contextSubmenu === 'move' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''
          }`}
        >
          <div className="flex items-center gap-2.5">
            <FolderInput className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>{isNl ? 'Verplaatsen' : 'Move'}</span>
          </div>
          <ChevronRight className="h-3 w-3 text-slate-400" />
        </button>

        {contextSubmenu === 'move' && (
          <ViewportPanel className="absolute left-full top-0 ml-1.5 w-56 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-2xl dark:border-slate-700 dark:bg-slate-900 z-50">
            <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{isNl ? 'Verplaats naar' : 'Move to'}</p>
            <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
            <button
              type="button"
              onClick={() => {
                setContextSubmenu(null);
                onAction('move', item, null);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Folder className="h-3.5 w-3.5 text-slate-400" />
              <span>/ {isNl ? 'Hoofdmap' : 'Root directory'}</span>
            </button>
            {folders.filter(f => f.id !== item.id).map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setContextSubmenu(null);
                  onAction('move', item, f.id);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Folder className="h-3.5 w-3.5" fill={f.color || '#94a3b8'} style={{ color: f.color || '#94a3b8' }} />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
          </ViewportPanel>
        )}
      </div>

      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
      <button
        onMouseEnter={() => setContextSubmenu(null)}
        onClick={() => {
          setContextSubmenu(null);
          onAction('delete', item);
        }}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
        <span>{isNl ? 'Verwijderen' : 'Delete'}</span>
      </button>
    </ViewportPanel>
  );
}

export default function NotesTool({ settings, historyData }) {
  const { addHistoryItem } = useHistory();
  const [notes, setNotes] = useStoredState('biba_notes_v1', []);
  const [folders, setFolders] = useStoredState('biba_note_folders_v2', []);
  const [selected, setSelected] = useStoredState('biba_notes_selected_id', null);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useStoredState('biba_notes_sidebar_collapsed_v1', false);
  const [expandedIds, setExpandedIds] = useStoredState('biba_notes_expanded_folders_v1', []);
  const expanded = useMemo(() => new Set(expandedIds || []), [expandedIds]);
  const setExpanded = useCallback((updater) => {
    setExpandedIds(prev => {
      const currentSet = new Set(prev || []);
      const nextSet = typeof updater === 'function' ? updater(currentSet) : updater;
      return Array.from(nextSet || []);
    });
  }, [setExpandedIds]);
  const [menu, setMenu] = useState(null);
  const [viewMode, setViewMode] = useState('library'); // 'library' | 'library-overview' | 'trash'
  const [overviewLayout, setOverviewLayout] = useStoredState('biba_notes_overview_layout', 'table'); // 'table' | 'grid'
  const [gridFolderId, setGridFolderId] = useState(null); // folder drilled into in grid view
  const [tagModal, setTagModal] = useState(null); // { note, tags }
  const [iconPopover, setIconPopover] = useState(null); // { item, anchorRect }
  const [renameDialog, setRenameDialog] = useState(null);
  const [noteTableColumns, setNoteTableColumns] = useStoredState('biba_note_table_columns_v1', {
    name: true,
    tags: true,
    words: true,
    readTime: false,
    modified: true,
    created: true,
    actions: true,
  });
  const [noteTableWidths, setNoteTableWidths] = useStoredState('biba_note_table_widths_v1', {
    name: 300,
    tags: 160,
    words: 90,
    readTime: 100,
    modified: 150,
    created: 150,
    actions: 44,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [tableSortKey, setTableSortKey] = useState('name');
  const [tableSortDirection, setTableSortDirection] = useState('asc');
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [headerSubmenu, setHeaderSubmenu] = useState(null); // 'export' | 'move' | null
  const [linkMenu, setLinkMenu] = useState(null); // { x, y, href, linkEl }
  const [imageMenu, setImageMenu] = useState(null); // { x, y, imgEl, wrapperEl, currentSize }
  const [tableOverlay, setTableOverlay] = useState(null); // { table, row, cell, rowIndex, colIndex, rowMenuOpen, colMenuOpen, rowTop, rowLeft, colTop, colLeft }
  const [copiedTableData, setCopiedTableData] = useState(null); // { type: 'row' | 'col', data: [] }
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const columnResizeRef = useRef(null);
  const columnMenuRef = useRef(null);
  const headerMenuRef = useRef(null);
  const touchStartRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const editorRef = useRef(null);
  const tableDragRef = useRef(null);
  const historyTimerRef = useRef(null);
  const historyRef = useRef({ entries: [], index: -1, lastType: null, time: 0 });
  const note = notes.find(n => n.id === selected);

  // Restore note if opened via history
  useEffect(() => {
    if (historyData?.data?.noteId) {
      setSelected(historyData.data.noteId);
    }
  }, [historyData, setSelected]);

  // Record active note session to history
  useEffect(() => {
    if (!selected) return;
    const currentNote = notes.find(n => n.id === selected);
    if (!currentNote || currentNote.deleted) return;
    const isNl = settings?.language === 'nl';
    const timer = setTimeout(() => {
      addHistoryItem({
        toolId: 'notes',
        toolName: isNl ? 'Notities' : 'Notes',
        data: {
          noteId: currentNote.id,
          preview: currentNote.title || (isNl ? 'Naamloze notitie' : 'Untitled note'),
          folderId: currentNote.folderId,
        }
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [selected, note?.title, addHistoryItem, settings?.language]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (linkMenu && !e.target.closest('#note-link-menu')) {
        setLinkMenu(null);
      }
      if (imageMenu && !e.target.closest('#note-image-menu')) {
        setImageMenu(null);
      }
      if (tableOverlay && (tableOverlay.rowMenuOpen || tableOverlay.colMenuOpen) && !e.target.closest('#note-table-controls')) {
        setTableOverlay(prev => prev ? { ...prev, rowMenuOpen: false, colMenuOpen: false } : null);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [linkMenu, imageMenu, tableOverlay]);

  useEffect(() => {
    if (!tableOverlay?.selectedType) return;
    const handleGlobalTableKey = (e) => {
      // Don't intercept if user is typing in an active input or modal dialog
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName) || e.target?.closest?.('.modal, [role="dialog"]')) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const handled = handleTableSelectionDelete();
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        if (tableOverlay.selectedType === 'row') handleCopyRow();
        else if (tableOverlay.selectedType === 'col') handleCopyCol();
        else if (tableOverlay.selectedType === 'range') handleCopyRange();
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleGlobalTableKey, true);
    return () => window.removeEventListener('keydown', handleGlobalTableKey, true);
  }, [tableOverlay, copiedTableData]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const updateFromCell = (cell, keepSelection = true) => {
      if (!cell || !editor.contains(cell)) return;
      const row = cell.closest('tr');
      const table = row?.closest('table');
      if (!row || !table) return;

      const tableRect = table.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();

      const allRows = Array.from(table.querySelectorAll('tr'));
      const rowIndex = allRows.indexOf(row);
      const colIndex = Array.from(row.children).indexOf(cell);

      setTableOverlay(prev => ({
        table,
        row,
        cell,
        rowIndex,
        colIndex,
        selectedType: (keepSelection && prev?.table === table) ? prev.selectedType : null,
        range: (keepSelection && prev?.table === table) ? prev.range : null,
        selectionRect: (keepSelection && prev?.table === table) ? prev.selectionRect : null,
        rowMenuOpen: (prev?.table === table && prev?.rowIndex === rowIndex) ? prev.rowMenuOpen : false,
        colMenuOpen: (prev?.table === table && prev?.colIndex === colIndex) ? prev.colMenuOpen : false,
        rowTop: rowRect.top + (rowRect.height / 2) - 10,
        rowLeft: Math.max(8, tableRect.left - 24),
        colTop: Math.max(8, tableRect.top - 24),
        colLeft: cellRect.left + (cellRect.width / 2) - 10,
        tableRect,
        rowRect,
        colRect: cellRect,
      }));
    };

    const handlePointerDown = (e) => {
      if (e.target.closest('#note-table-controls')) return;
      const cell = e.target.closest('td, th');
      if (cell && editor.contains(cell)) {
        const row = cell.closest('tr');
        const table = row?.closest('table');
        if (table && row) {
          const allRows = Array.from(table.querySelectorAll('tr'));
          const startRow = allRows.indexOf(row);
          const startCol = Array.from(row.children).indexOf(cell);
          tableDragRef.current = { table, startRow, startCol, isDragging: false };
        }
        updateFromCell(cell, false);
      } else if (!e.target.closest('.note-table-wrapper') && !e.target.closest('.note-table')) {
        setTableOverlay(null);
        tableDragRef.current = null;
      }
    };

    const handlePointerMove = (e) => {
      if (e.target.closest('#note-table-controls')) return;
      const cell = e.target.closest('td, th');

      // Dragging across table cells for multi-cell/row/col selection
      if (tableDragRef.current && (e.buttons === 1 || e.which === 1)) {
        const { table, startRow, startCol } = tableDragRef.current;
        if (cell && table.contains(cell)) {
          const row = cell.closest('tr');
          const allRows = Array.from(table.querySelectorAll('tr'));
          const currentRow = allRows.indexOf(row);
          const currentCol = Array.from(row.children).indexOf(cell);

          if (currentRow !== -1 && currentCol !== -1 && (currentRow !== startRow || currentCol !== startCol || tableDragRef.current.isDragging)) {
            tableDragRef.current.isDragging = true;
            // Clear native text selection across cells
            try { window.getSelection()?.removeAllRanges(); } catch {}

            const minRow = Math.min(startRow, currentRow);
            const maxRow = Math.max(startRow, currentRow);
            const minCol = Math.min(startCol, currentCol);
            const maxCol = Math.max(startCol, currentCol);

            const startCellEl = allRows[minRow]?.children[minCol];
            const endCellEl = allRows[maxRow]?.children[maxCol];
            if (startCellEl && endCellEl) {
              const startRect = startCellEl.getBoundingClientRect();
              const endRect = endCellEl.getBoundingClientRect();
              const selectionRect = {
                top: startRect.top,
                left: startRect.left,
                width: endRect.right - startRect.left,
                height: endRect.bottom - startRect.top,
              };
              const tableRect = table.getBoundingClientRect();
              const rowRect = row.getBoundingClientRect();
              const cellRect = cell.getBoundingClientRect();

              setTableOverlay({
                table,
                row,
                cell,
                rowIndex: currentRow,
                colIndex: currentCol,
                selectedType: 'range',
                range: { minRow, maxRow, minCol, maxCol },
                selectionRect,
                rowTop: rowRect.top + (rowRect.height / 2) - 10,
                rowLeft: Math.max(8, tableRect.left - 24),
                colTop: Math.max(8, tableRect.top - 24),
                colLeft: cellRect.left + (cellRect.width / 2) - 10,
                tableRect,
                rowRect,
                colRect: cellRect,
              });
              return;
            }
          }
        }
      }

      if (cell && editor.contains(cell)) {
        if (!tableDragRef.current?.isDragging) {
          updateFromCell(cell, true);
        }
      }
    };

    const handlePointerUp = () => {
      if (tableDragRef.current?.isDragging) {
        try { window.getSelection()?.removeAllRanges(); } catch {}
      }
      tableDragRef.current = null;
    };

    const handleScrollOrResize = () => {
      setTableOverlay(prev => {
        if (!prev?.cell || !prev?.table || !document.body.contains(prev.cell)) return null;
        const tableRect = prev.table.getBoundingClientRect();
        const rowRect = prev.row.getBoundingClientRect();
        const cellRect = prev.cell.getBoundingClientRect();

        let nextSelectionRect = prev.selectionRect;
        if (prev.selectedType === 'range' && prev.range) {
          const allRows = Array.from(prev.table.querySelectorAll('tr'));
          const startCellEl = allRows[prev.range.minRow]?.children[prev.range.minCol];
          const endCellEl = allRows[prev.range.maxRow]?.children[prev.range.maxCol];
          if (startCellEl && endCellEl) {
            const startRect = startCellEl.getBoundingClientRect();
            const endRect = endCellEl.getBoundingClientRect();
            nextSelectionRect = {
              top: startRect.top,
              left: startRect.left,
              width: endRect.right - startRect.left,
              height: endRect.bottom - startRect.top,
            };
          }
        }

        return {
          ...prev,
          rowTop: rowRect.top + (rowRect.height / 2) - 10,
          rowLeft: Math.max(8, tableRect.left - 24),
          colTop: Math.max(8, tableRect.top - 24),
          colLeft: cellRect.left + (cellRect.width / 2) - 10,
          tableRect,
          rowRect,
          colRect: cellRect,
          selectionRect: nextSelectionRect,
        };
      });
    };

    editor.addEventListener('pointerdown', handlePointerDown);
    editor.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    editor.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      editor.removeEventListener('pointerdown', handlePointerDown);
      editor.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      editor.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [selected, viewMode]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Clear previous selections
    editor.querySelectorAll('.note-table tr[data-selected="true"]').forEach(el => el.removeAttribute('data-selected'));
    editor.querySelectorAll('.note-table [data-col-selected="true"]').forEach(el => el.removeAttribute('data-col-selected'));
    editor.querySelectorAll('.note-table [data-cell-selected="true"]').forEach(el => el.removeAttribute('data-cell-selected'));

    if (!tableOverlay || !tableOverlay.selectedType || !tableOverlay.table) return;

    if (tableOverlay.selectedType === 'row' && tableOverlay.row) {
      tableOverlay.row.setAttribute('data-selected', 'true');
    } else if (tableOverlay.selectedType === 'col' && tableOverlay.colIndex !== undefined) {
      const rows = Array.from(tableOverlay.table.querySelectorAll('tr'));
      rows.forEach(tr => {
        const cell = tr.children[tableOverlay.colIndex];
        if (cell) cell.setAttribute('data-col-selected', 'true');
      });
    } else if (tableOverlay.selectedType === 'range' && tableOverlay.range) {
      const { minRow, maxRow, minCol, maxCol } = tableOverlay.range;
      const rows = Array.from(tableOverlay.table.querySelectorAll('tr'));
      for (let r = minRow; r <= maxRow; r++) {
        const tr = rows[r];
        if (tr) {
          for (let c = minCol; c <= maxCol; c++) {
            const cell = tr.children[c];
            if (cell) cell.setAttribute('data-cell-selected', 'true');
          }
        }
      }
    }
  }, [tableOverlay?.selectedType, tableOverlay?.row, tableOverlay?.colIndex, tableOverlay?.range, tableOverlay?.table]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!columnResizeRef.current) return;
      const { columnId, startX, startWidth } = columnResizeRef.current;
      const colDef = NOTE_TABLE_COLUMNS.find(c => c.id === columnId);
      const minW = colDef?.minWidth || 60;
      const nextWidth = Math.max(minW, startWidth + e.clientX - startX);
      setNoteTableWidths(prev => ({ ...prev, [columnId]: nextWidth }));
    };

    const handleMouseUp = () => {
      columnResizeRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setNoteTableWidths]);

  useEffect(() => {
    if (!showColumnMenu) return;
    const handleOutside = (e) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [showColumnMenu]);

  useEffect(() => {
    if (!headerMenuOpen) return;
    const handleOutside = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setHeaderMenuOpen(false);
        setHeaderSubmenu(null);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [headerMenuOpen]);

  const lang = settings?.language || (() => {
    try {
      const s = JSON.parse(localStorage.getItem('biba_bench_buddy_settings') || '{}');
      return s.language || 'en';
    } catch {
      return 'en';
    }
  })();
  const isNl = lang === 'nl';

  // Ensure active note is selected if in library editor mode and none currently selected
  useEffect(() => {
    if (viewMode === 'library') {
      const active = notes.filter(n => !n.deleted);
      if (active.length > 0) {
        if (!selected || !active.some(n => n.id === selected)) {
          setSelected(active[0].id);
        }
      }
    }
  }, [viewMode, notes, selected, setSelected]);

  const commitHistory = (type = 'command') => {
    if (!editorRef.current) return;
    const snapshot = editorRef.current.innerHTML;
    const history = historyRef.current;
    const now = Date.now();
    if (history.entries[history.index] === snapshot) return;
    history.entries = history.entries.slice(0, history.index + 1);
    if (type === 'insertText' && history.lastType === 'insertText' && now - history.time < 700) {
      history.entries[history.index] = snapshot;
    } else {
      history.entries.push(snapshot);
      history.index += 1;
      if (history.entries.length > 100) {
        history.entries.shift();
        history.index -= 1;
      }
    }
    history.lastType = type;
    history.time = now;
  };

  const checkpointHistory = () => {
    clearTimeout(historyTimerRef.current);
    commitHistory('checkpoint');
  };

  const syncCheckboxes = (el) => {
    if (!el) return;
    el.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (cb.checked) {
        cb.setAttribute('checked', 'checked');
        cb.setAttribute('data-checked', 'true');
      } else {
        cb.removeAttribute('checked');
        cb.removeAttribute('data-checked');
      }
    });
  };

  // Immediate autosave function on every single modification
  const saveContent = (eventOrType) => {
    if (!selected || !editorRef.current) return;
    syncCheckboxes(editorRef.current);
    const type = typeof eventOrType === 'string' ? eventOrType : eventOrType?.nativeEvent?.inputType || 'command';
    clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => commitHistory(type), 0);
    const content = editorRef.current.innerHTML;
    setNotes(items => {
      const next = items.map(n => n.id === selected ? { ...n, content, updated: Date.now() } : n);
      try {
        localStorage.setItem('biba_notes_v1', JSON.stringify(next));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      return next;
    });
  };

  // Window flush on blur/reload/close to guarantee zero data loss
  useEffect(() => {
    const flushSave = () => {
      if (selected && editorRef.current) {
        syncCheckboxes(editorRef.current);
        const content = editorRef.current.innerHTML;
        try {
          const raw = localStorage.getItem('biba_notes_v1');
          if (raw) {
            const list = JSON.parse(raw);
            const next = list.map(n => n.id === selected ? { ...n, content, updated: Date.now() } : n);
            localStorage.setItem('biba_notes_v1', JSON.stringify(next));
          }
        } catch {}
      }
    };
    window.addEventListener('beforeunload', flushSave);
    window.addEventListener('blur', flushSave);
    document.addEventListener('visibilitychange', flushSave);
    return () => {
      window.removeEventListener('beforeunload', flushSave);
      window.removeEventListener('blur', flushSave);
      document.removeEventListener('visibilitychange', flushSave);
      flushSave();
    };
  }, [selected]);

  const restoreHistory = (redo) => {
    if (!editorRef.current) return;
    const history = historyRef.current;
    const nextIndex = history.index + (redo ? 1 : -1);
    if (nextIndex < 0 || nextIndex >= history.entries.length) return;
    history.index = nextIndex;
    editorRef.current.innerHTML = history.entries[nextIndex];
    syncCheckboxes(editorRef.current);
    editorRef.current.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = cb.hasAttribute('checked') || cb.getAttribute('data-checked') === 'true';
    });
    history.lastType = 'history';
    history.time = Date.now();
    placeCaret(editorRef.current);
    const content = editorRef.current.innerHTML;
    setNotes(items => items.map(n => n.id === selected ? { ...n, content, updated: Date.now() } : n));
  };

  const saveContentRef = useRef(saveContent);
  saveContentRef.current = saveContent;

  useLayoutEffect(() => {
    if (editorRef.current && note) {
      const content = note.content || '<p><br></p>';
      editorRef.current.innerHTML = content;
      editorRef.current.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = cb.hasAttribute('checked') || cb.getAttribute('data-checked') === 'true';
      });
      historyRef.current = { entries: [content], index: 0, lastType: null, time: 0 };
    }
  }, [note?.id]);

  useEffect(() => () => {
    clearTimeout(historyTimerRef.current);
  }, []);

  useEffect(() => {
    const click = (e) => {
      const link = e.target.closest('a');
      if (link && editorRef.current?.contains(link)) {
        const href = link.getAttribute('href');
        if (href) {
          e.preventDefault();
          e.stopPropagation();
          if (window.electronAPI?.openExternal) {
            window.electronAPI.openExternal(href);
          } else {
            window.open(href, '_blank', 'noopener,noreferrer');
          }
          return;
        }
      }
      const copy = e.target.closest('[data-copy-code]');
      if (copy) {
        navigator.clipboard?.writeText(copy.parentElement.querySelector('code')?.innerText || '');
        copy.textContent = 'Copied';
      }
      const remove = e.target.closest('[data-remove-divider]');
      if (remove) {
        remove.parentElement.remove();
        saveContentRef.current?.();
      }
      const box = e.target.closest('input[type="checkbox"]');
      if (box && editorRef.current?.contains(box)) {
        if (box.checked) {
          box.setAttribute('checked', 'checked');
          box.setAttribute('data-checked', 'true');
        } else {
          box.removeAttribute('checked');
          box.removeAttribute('data-checked');
        }
        saveContentRef.current?.('checkbox-toggle');
      }
    };

    const change = (e) => {
      const box = e.target.closest('input[type="checkbox"]');
      if (box && editorRef.current?.contains(box)) {
        if (box.checked) {
          box.setAttribute('checked', 'checked');
          box.setAttribute('data-checked', 'true');
        } else {
          box.removeAttribute('checked');
          box.removeAttribute('data-checked');
        }
        saveContentRef.current?.('checkbox-toggle');
      }
    };

    document.addEventListener('click', click);
    document.addEventListener('change', change);
    return () => {
      document.removeEventListener('click', click);
      document.removeEventListener('change', change);
    };
  }, []);

  const toggleChecklistItem = () => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;

    // Check if selection covers multiple checklist items
    const allChecklistLis = Array.from(editorRef.current.querySelectorAll('ul[data-checklist] li'));
    const selectedLis = allChecklistLis.filter(li => selection.containsNode(li, true));

    if (selectedLis.length > 0) {
      // If any of the selected checklist items is unchecked, check all of them; otherwise uncheck all
      const anyUnchecked = selectedLis.some(li => {
        const input = li.querySelector('input[type="checkbox"]');
        return input && !input.checked;
      });
      const newCheckedState = anyUnchecked;

      selectedLis.forEach(li => {
        const input = li.querySelector('input[type="checkbox"]');
        if (input) {
          input.checked = newCheckedState;
          if (newCheckedState) {
            input.setAttribute('checked', 'checked');
            input.setAttribute('data-checked', 'true');
          } else {
            input.removeAttribute('checked');
            input.removeAttribute('data-checked');
          }
        }
      });
      saveContent('toggle-check');
      return;
    }

    // Single item fallback
    const node = selection?.anchorNode?.nodeType === 3 ? selection.anchorNode.parentElement : selection?.anchorNode;
    const li = node?.closest('ul[data-checklist] li');
    if (li) {
      const input = li.querySelector('input[type="checkbox"]');
      if (input) {
        input.checked = !input.checked;
        if (input.checked) {
          input.setAttribute('checked', 'checked');
          input.setAttribute('data-checked', 'true');
        } else {
          input.removeAttribute('checked');
          input.removeAttribute('data-checked');
        }
        saveContent('toggle-check');
      }
    }
  };

  // Format shortcuts dispatcher
  const applyFormat = (format) => {
    if (!editorRef.current) return;
    commitHistory('command');
    editorRef.current.focus();
    switch (format) {
      case 'title':
        setBlockFormat(editorRef, 'title', saveContent, () => commitHistory('command'));
        break;
      case 'h1':
        setBlockFormat(editorRef, 'h1', saveContent, () => commitHistory('command'));
        break;
      case 'h2':
        setBlockFormat(editorRef, 'h2', saveContent, () => commitHistory('command'));
        break;
      case 'h3':
        setBlockFormat(editorRef, 'h3', saveContent, () => commitHistory('command'));
        break;
      case 'h4':
        setBlockFormat(editorRef, 'h4', saveContent, () => commitHistory('command'));
        break;
      case 'p':
        setBlockFormat(editorRef, 'p', saveContent, () => commitHistory('command'));
        break;
      case 'bullet':
        formatList(editorRef, 'bullet', saveContent, () => commitHistory('command'));
        break;
      case 'dash':
        formatList(editorRef, 'dash', saveContent, () => commitHistory('command'));
        break;
      case 'number':
        formatList(editorRef, 'number', saveContent, () => commitHistory('command'));
        break;
      case 'none':
        formatList(editorRef, 'none', saveContent, () => commitHistory('command'));
        break;
      case 'checklist':
        insertOrFormatChecklist({ editorRef, onContentChange: saveContent, onBeforeCommand: () => commitHistory('command') });
        break;
      case 'toggle-check':
        toggleChecklistItem();
        break;
      case 'indent': {
        const selection = window.getSelection();
        const node = selection?.anchorNode?.nodeType === 3 ? selection.anchorNode.parentElement : selection?.anchorNode;
        const checklistLi = node?.closest?.('ul[data-checklist] li');
        if (checklistLi) {
          const prevLi = checklistLi.previousElementSibling;
          if (prevLi) {
            let nestedUl = prevLi.querySelector(':scope > ul[data-checklist]');
            if (!nestedUl) {
              nestedUl = document.createElement('ul');
              nestedUl.setAttribute('data-checklist', 'true');
              prevLi.appendChild(nestedUl);
            }
            nestedUl.appendChild(checklistLi);
            placeCaret(checklistLi.querySelector('span') || checklistLi);
            saveContent('checklist-indent');
            break;
          }
        }
        const standardLi = node?.closest?.('ul:not([data-checklist]) li, ol li');
        if (standardLi) {
          const prevLi = standardLi.previousElementSibling;
          if (prevLi) {
            const listType = standardLi.closest('ol') ? 'ol' : 'ul';
            let nestedList = prevLi.querySelector(`:scope > ${listType}`);
            if (!nestedList) {
              nestedList = document.createElement(listType);
              prevLi.appendChild(nestedList);
            }
            nestedList.appendChild(standardLi);
            placeCaretAtStart(standardLi);
            saveContent('list-indent');
            break;
          }
        }
        exec('indent');
        saveContent('indent');
        break;
      }
      case 'outdent': {
        const selection = window.getSelection();
        const node = selection?.anchorNode?.nodeType === 3 ? selection.anchorNode.parentElement : selection?.anchorNode;
        const checklistLi = node?.closest?.('ul[data-checklist] li');
        if (checklistLi) {
          const parentUl = checklistLi.parentElement;
          const parentLi = parentUl?.closest('li');
          if (parentLi) {
            parentLi.after(checklistLi);
            if (parentUl.children.length === 0) parentUl.remove();
            placeCaret(checklistLi.querySelector('span') || checklistLi);
            saveContent('checklist-outdent');
            break;
          }
        }
        const standardLi = node?.closest?.('ul:not([data-checklist]) li, ol li');
        if (standardLi) {
          const parentList = standardLi.parentElement;
          const parentLi = parentList?.closest('li');
          if (parentLi) {
            parentLi.after(standardLi);
            if (parentList.children.length === 0) parentList.remove();
            placeCaretAtStart(standardLi);
            saveContent('list-outdent');
            break;
          }
        }
        exec('outdent');
        saveContent('outdent');
        break;
      }
      case 'align-left':
        applyAlignment({ align: 'left', editorRef, onContentChange: () => saveContent('align-left'), onBeforeCommand: () => commitHistory('command'), tableOverlay });
        break;
      case 'align-center':
        applyAlignment({ align: 'center', editorRef, onContentChange: () => saveContent('align-center'), onBeforeCommand: () => commitHistory('command'), tableOverlay });
        break;
      case 'align-right':
        applyAlignment({ align: 'right', editorRef, onContentChange: () => saveContent('align-right'), onBeforeCommand: () => commitHistory('command'), tableOverlay });
        break;
      case 'align-justify':
        applyAlignment({ align: 'justify', editorRef, onContentChange: () => saveContent('align-justify'), onBeforeCommand: () => commitHistory('command'), tableOverlay });
        break;
      case 'quote':
        toggleQuote(editorRef, saveContent, () => commitHistory('command'));
        break;
      case 'code': {
        const selection = window.getSelection()?.toString() || 'Code';
        exec('insertHTML', `<div class="note-code" contenteditable="false"><button data-copy-code aria-label="Copy code">Copy</button><pre contenteditable="true"><code>${escapeHtml(selection)}</code></pre></div><p><br></p>`);
        saveContent(format);
        break;
      }
      default:
        break;
    }
  };



  // Listen to menu bar IPC if in Electron
  useEffect(() => {
    if (window.electronAPI?.onNoteFormat) {
      const unsubscribe = window.electronAPI.onNoteFormat((format) => {
        applyFormat(format);
      });
      return unsubscribe;
    }
  }, []);

  // Listen to File actions from Electron menu
  useEffect(() => {
    if (!window.electronAPI?.onFileAction) return;
    const unsub = window.electronAPI.onFileAction((action) => {
      if (!note || note.deleted) return;
      if (action === 'save-as') {
        const newTitle = window.prompt(isNl ? 'Opslaan als:' : 'Save note as:', `${note.title || 'Note'} (Copy)`);
        if (newTitle !== null) {
          const now = Date.now();
          const copy = {
            ...note,
            id: uid(),
            title: newTitle.trim() || note.title,
            created: now,
            updated: now,
          };
          setNotes(prev => [copy, ...prev]);
          setSelected(copy.id);
        }
      } else if (action === 'duplicate') {
        const now = Date.now();
        const copy = {
          ...note,
          id: uid(),
          title: `${note.title || 'Note'} (Copy)`,
          created: now,
          updated: now,
        };
        setNotes(prev => [copy, ...prev]);
        setSelected(copy.id);
      } else if (action === 'export-md') {
        exportMarkdown(note);
      } else if (action === 'export-pdf') {
        exportPdf(note);
      } else if (action === 'delete') {
        setNotes(v => v.map(n => n.id === note.id ? { ...n, deleted: Date.now() } : n));
        setSelected(null);
      }
    });
    return unsub;
  }, [note, isNl]);

  const createNote = (folder = null) => {
    const now = Date.now();
    const item = {
      id: uid(),
      title: isNl ? 'Naamloze notitie' : 'Untitled note',
      content: '<p><br></p>',
      folder,
      icon: 'NotebookPen',
      color: folders.find(f => f.id === folder)?.color || COLORS[0],
      tags: [],
      created: now,
      updated: now,
      deleted: null
    };
    setNotes(v => [item, ...v]);
    setSelected(item.id);
    setViewMode('library');
    if (folder) setExpanded(v => new Set([...v, folder]));
  };

  const createFolder = (parent = null) => {
    const item = { id: uid(), type: 'folder', name: 'New folder', parent, color: COLORS[0] };
    setFolders(v => [...v, item]);
    if (parent) setExpanded(v => new Set([...v, parent]));
  };

  const exportMarkdown = (targetNote = note) => {
    if (!targetNote) return;
    const md = htmlToMarkdown(targetNote.content, targetNote.title);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(targetNote.title || 'note').replace(/[/\\?%*:|"<>]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async (targetNote = note) => {
    if (!targetNote) return;

    // 1. Try Electron native PDF export
    if (window.electronAPI?.exportNotePdf) {
      try {
        const res = await window.electronAPI.exportNotePdf({
          title: targetNote.title || 'Untitled note',
          html: targetNote.content || '<p></p>',
        });
        if (res?.success || res?.canceled) return;
      } catch (err) {
        console.error('Electron PDF export error:', err);
      }
    }

    // 2. Browser fallback via hidden iframe print
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    const contentHtml = targetNote.content || '<p></p>';

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${escapeHtml(targetNote.title || 'Note')}</title>
          <style>
            @page {
              margin: 20mm;
              size: auto;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #1e293b;
              margin: 0;
              padding: 0;
            }
            h1.note-title {
              font-size: 24px;
              font-weight: 800;
              margin: 0 0 16px 0;
              padding-bottom: 10px;
              border-bottom: 2px solid #e2e8f0;
            }
            h1 { font-size: 20px; font-weight: 700; margin: 16px 0 8px 0; }
            h2 { font-size: 17px; font-weight: 700; margin: 14px 0 6px 0; }
            h3 { font-size: 15px; font-weight: 600; margin: 12px 0 4px 0; }
            h4 { font-size: 13px; font-weight: 600; margin: 10px 0 4px 0; }
            p { margin: 6px 0; font-size: 13px; }
            blockquote {
              margin: 10px 0;
              border-left: 3px solid #94a3b8;
              padding-left: 12px;
              color: #475569;
              font-style: italic;
            }
            ul { margin: 6px 0; padding-left: 20px; font-size: 13px; }
            ol {
              counter-reset: item;
              list-style: none;
              padding-left: 20px;
              margin: 6px 0;
              font-size: 13px;
            }
            ol > li {
              display: block;
              counter-increment: item;
              position: relative;
              margin: 4px 0;
            }
            ol > li::before {
              content: counters(item, ".") ". ";
              font-weight: 600;
              margin-right: 6px;
            }
            ul[data-checklist] { list-style: none; padding-left: 0; }
            ul[data-checklist] ul[data-checklist] { padding-left: 20px; margin: 4px 0; }
            ul[data-checklist] li {
              position: relative;
              padding-left: 24px;
              margin: 4px 0;
            }
            ul[data-checklist] li input[type="checkbox"] {
              position: absolute;
              left: 0;
              top: 3px;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 12px 0;
            }
            th, td {
              border: 1px solid #cbd5e1 !important;
              padding: 6px 10px;
              font-size: 12px;
              text-align: left;
              vertical-align: top;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            th {
              background-color: #f8fafc !important;
              font-weight: 700;
              color: #0f172a;
            }
            td {
              background-color: #ffffff;
            }
            .note-code pre {
              background: #f1f5f9;
              padding: 10px 14px;
              border-radius: 6px;
              font-family: monospace;
              font-size: 12px;
              border: 1px solid #e2e8f0;
            }
            a { color: #db2777; text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1 class="note-title">${escapeHtml(targetNote.title || 'Untitled note')}</h1>
          <div>${contentHtml}</div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print error:', err);
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 2000);
      }
    }, 300);
  };

  const handleEditorKeyDown = (e) => {
    const isMod = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    const selection = window.getSelection();
    const node = selection?.anchorNode?.nodeType === 3 ? selection.anchorNode.parentElement : selection?.anchorNode;

    // Selected row/column/range keyboard actions (Copy & Delete)
    if (tableOverlay?.selectedType) {
      if (isMod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (tableOverlay.selectedType === 'row') handleCopyRow();
        else if (tableOverlay.selectedType === 'col') handleCopyCol();
        else if (tableOverlay.selectedType === 'range') handleCopyRange();
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const handled = handleTableSelectionDelete();
        if (handled) {
          e.preventDefault();
          return;
        }
      }
    }

    // Table cell Tab and Enter navigation (when not inside a list item)
    const inList = Boolean(node?.closest?.('li'));
    const tableCell = !inList ? node?.closest?.('td, th') : null;
    if (tableCell) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.altKey || isShift) {
          // Option+Enter or Shift+Enter: Insert a line break inside this cell!
          e.stopPropagation();
          checkpointHistory();
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const br = document.createElement('br');
            range.insertNode(br);
            range.setStartAfter(br);
            range.setEndAfter(br);
            if (!br.nextSibling) {
              const trailingBr = document.createElement('br');
              tableCell.appendChild(trailingBr);
            }
            sel.removeAllRanges();
            sel.addRange(range);
          } else {
            exec('insertHTML', '<br>');
          }
          saveContent('table-cell-newline');
          return;
        }

        // Plain Enter in Table:
        const table = tableCell.closest('table');
        const currentTr = tableCell.closest('tr');
        if (table && currentTr) {
          const allRows = Array.from(table.querySelectorAll('tr'));
          const rowIndex = allRows.indexOf(currentTr);
          const colIndex = Array.from(currentTr.children).indexOf(tableCell);

          if (rowIndex === allRows.length - 1) {
            // In the last row: automatically add a new row at the bottom!
            commitHistory('table-enter-add-row');
            const tbody = table.querySelector('tbody') || table;
            const colCount = currentTr.children.length;
            const newTr = document.createElement('tr');
            for (let i = 0; i < colCount; i++) {
              const td = document.createElement('td');
              td.innerHTML = '<br>';
              newTr.appendChild(td);
            }
            tbody.appendChild(newTr);
            saveContent('table-enter-add-row');
            setTimeout(() => {
              const targetTd = newTr.children[colIndex] || newTr.querySelector('td');
              if (targetTd) placeCaretAtStart(targetTd);
            }, 10);
          } else {
            // Not in the last row: move to the same column in the row below!
            const nextTr = allRows[rowIndex + 1];
            const nextCell = nextTr?.children[colIndex] || nextTr?.children[0];
            if (nextCell) {
              placeCaretAtStart(nextCell);
            }
          }
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        const table = tableCell.closest('table');
        if (table) {
          const cells = Array.from(table.querySelectorAll('th, td'));
          const curIndex = cells.indexOf(tableCell);
          if (isShift) {
            if (curIndex > 0) {
              placeCaretAtStart(cells[curIndex - 1]);
            }
          } else {
            if (curIndex === cells.length - 1) {
              // Last cell: Insert new row at the bottom!
              commitHistory('table-tab-add-row');
              const tbody = table.querySelector('tbody') || table;
              const lastRow = table.querySelector('tbody tr:last-child') || table.querySelector('tr:last-child');
              const colCount = lastRow?.children?.length || table.querySelector('tr')?.children?.length || 3;
              const newTr = document.createElement('tr');
              for (let i = 0; i < colCount; i++) {
                const td = document.createElement('td');
                td.innerHTML = '<br>';
                newTr.appendChild(td);
              }
              tbody.appendChild(newTr);
              saveContent('table-tab-add-row');
              setTimeout(() => {
                const firstTd = newTr.querySelector('td');
                if (firstTd) placeCaretAtStart(firstTd);
              }, 10);
            } else if (curIndex < cells.length - 1) {
              placeCaretAtStart(cells[curIndex + 1]);
            }
          }
        }
        return;
      }
    }

    // Tab and Shift+Tab indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      checkpointHistory();

      const checklistLi = node?.closest?.('ul[data-checklist] li');
      if (checklistLi) {
        if (isShift) {
          const parentUl = checklistLi.parentElement;
          const parentLi = parentUl?.closest('li');
          if (parentLi) {
            parentLi.after(checklistLi);
            if (parentUl.children.length === 0) parentUl.remove();
            placeCaret(checklistLi.querySelector('span') || checklistLi);
            saveContent('checklist-outdent');
            return;
          }
        } else {
          const prevLi = checklistLi.previousElementSibling;
          if (prevLi) {
            let nestedUl = prevLi.querySelector(':scope > ul[data-checklist]');
            if (!nestedUl) {
              nestedUl = document.createElement('ul');
              nestedUl.setAttribute('data-checklist', 'true');
              prevLi.appendChild(nestedUl);
            }
            nestedUl.appendChild(checklistLi);
            placeCaret(checklistLi.querySelector('span') || checklistLi);
            saveContent('checklist-indent');
            return;
          }
        }
        return;
      }

      const standardLi = node?.closest?.('ul:not([data-checklist]) li, ol li');
      if (standardLi) {
        if (isShift) {
          const parentList = standardLi.parentElement;
          const parentLi = parentList?.closest('li');
          if (parentLi) {
            parentLi.after(standardLi);
            if (parentList.children.length === 0) parentList.remove();
            placeCaretAtStart(standardLi);
            saveContent('list-outdent');
            return;
          } else {
            exec('outdent');
            saveContent('outdent');
            return;
          }
        } else {
          const prevLi = standardLi.previousElementSibling;
          if (prevLi) {
            const listType = standardLi.closest('ol') ? 'ol' : 'ul';
            let nestedList = prevLi.querySelector(`:scope > ${listType}`);
            if (!nestedList) {
              nestedList = document.createElement(listType);
              prevLi.appendChild(nestedList);
            }
            nestedList.appendChild(standardLi);
            placeCaretAtStart(standardLi);
            saveContent('list-indent');
            return;
          } else {
            exec('indent');
            saveContent('indent');
            return;
          }
        }
      }

      if (isShift) {
        exec('outdent');
        saveContent('outdent');
      } else {
        exec('indent');
        saveContent('indent');
      }
      return;
    }

    if (isMod && isShift) {
      const key = e.key.toLowerCase();
      if (e.key === '{' || e.key === '[') {
        e.preventDefault();
        applyAlignment({ align: 'left', editorRef, onContentChange: () => saveContent('align-left'), onBeforeCommand: checkpointHistory, tableOverlay });
        return;
      }
      if (e.key === '|' || e.key === '\\') {
        e.preventDefault();
        applyAlignment({ align: 'center', editorRef, onContentChange: () => saveContent('align-center'), onBeforeCommand: checkpointHistory, tableOverlay });
        return;
      }
      if (e.key === '}' || e.key === ']') {
        e.preventDefault();
        applyAlignment({ align: 'right', editorRef, onContentChange: () => saveContent('align-right'), onBeforeCommand: checkpointHistory, tableOverlay });
        return;
      }
      if (key === 't') {
        e.preventDefault();
        applyFormat('title');
        return;
      }
      if (key === 'h') {
        e.preventDefault();
        applyFormat('h1');
        return;
      }
      if (key === 'j') {
        e.preventDefault();
        applyFormat('h2');
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        applyFormat('h3');
        return;
      }
      if (key === 'b') {
        e.preventDefault();
        applyFormat('p');
        return;
      }
      if (key === 'm') {
        e.preventDefault();
        applyFormat('code');
        return;
      }
      if (key === '7' || key === '8') {
        e.preventDefault();
        applyFormat('bullet');
        return;
      }
      if (key === '9') {
        e.preventDefault();
        applyFormat('number');
        return;
      }
      if (key === 'l') {
        e.preventDefault();
        applyFormat('checklist');
        return;
      }
      if (key === 'u') {
        e.preventDefault();
        applyFormat('toggle-check');
        return;
      }
      if (key === 'q') {
        e.preventDefault();
        applyFormat('quote');
        return;
      }
    } else if (isMod && e.altKey) {
      if (e.key === "'" || e.key === '’') {
        e.preventDefault();
        applyFormat('quote');
        return;
      }
    } else if (isMod && !e.altKey && !isShift) {
      const key = e.key.toLowerCase();
      if (e.key === ']' || e.key === '}') {
        e.preventDefault();
        applyFormat('indent');
        return;
      }
      if (e.key === '[' || e.key === '{') {
        e.preventDefault();
        applyFormat('outdent');
        return;
      }
      if (key === 'z') {
        e.preventDefault();
        restoreHistory(false);
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        restoreHistory(true);
        return;
      }
      if (key === 'b') {
        e.preventDefault();
        commitHistory('command');
        exec('bold');
        saveContent('bold');
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        commitHistory('command');
        exec('italic');
        saveContent('italic');
        return;
      }
      if (key === 'u') {
        e.preventDefault();
        commitHistory('command');
        exec('underline');
        saveContent('underline');
        return;
      }
    }

    const markerBlock = node?.closest?.('p,div');
    const marker = markerBlock?.textContent.replace(/\u00a0/g, '').trim();
    if (e.key === ' ') {
      if (marker === '*' || marker === '1.') {
        e.preventDefault();
        checkpointHistory();
        const range = document.createRange();
        range.selectNodeContents(markerBlock);
        selection.removeAllRanges();
        selection.addRange(range);
        exec('delete');
        exec(marker === '*' ? 'insertUnorderedList' : 'insertOrderedList');
        saveContent('list-shortcut');
        return;
      }
      if (marker === '-' || marker === '–') {
        e.preventDefault();
        checkpointHistory();
        const ul = document.createElement('ul');
        ul.setAttribute('data-dash-list', 'true');
        const li = document.createElement('li');
        li.innerHTML = '<br>';
        ul.appendChild(li);
        if (markerBlock && editorRef.current?.contains(markerBlock)) {
          markerBlock.replaceWith(ul);
        } else {
          exec('insertHTML', ul.outerHTML);
        }
        placeCaretAtStart(li);
        saveContent('list-shortcut-dash');
        return;
      }
    }

    // Checklist Enter handler
    const checklistLi = node?.closest?.('ul[data-checklist] li');
    if (e.key === 'Enter' && checklistLi) {
      e.preventDefault();
      checkpointHistory();
      const clone = checklistLi.cloneNode(true);
      clone.querySelector('label')?.remove();
      clone.querySelector('input')?.remove();
      const text = clone.innerText.replace(/\u00a0/g, '').trim();

      if (!text) {
        // If nested, outdent to parent checklist level
        const parentUl = checklistLi.parentElement;
        const parentLi = parentUl?.closest('li');
        if (parentLi) {
          parentLi.after(checklistLi);
          if (parentUl.children.length === 0) parentUl.remove();
          placeCaret(checklistLi.querySelector('span') || checklistLi);
          saveContent('checklist-outdent');
          return;
        }

        const paragraph = exitChecklistItem(checklistLi);
        if (paragraph) placeCaret(paragraph);
      } else {
        const textContainer = checklistLi.querySelector('span') || checklistLi;
        let trailingFragment = null;

        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          try {
            const splitRange = document.createRange();
            splitRange.setStart(range.endContainer, range.endOffset);
            splitRange.setEndAfter(textContainer.lastChild || textContainer);
            trailingFragment = splitRange.extractContents();
          } catch {
            trailingFragment = null;
          }
        }

        const nextLi = document.createElement('li');
        nextLi.innerHTML = '<label contenteditable="false"><input type="checkbox" aria-label="Checklist item"></label>';
        const nextSpan = document.createElement('span');

        if (trailingFragment && (trailingFragment.textContent.trim() || trailingFragment.querySelector('*'))) {
          nextSpan.appendChild(trailingFragment);
        } else {
          nextSpan.innerHTML = '<br>';
        }

        if (!textContainer.innerHTML.trim() || textContainer.innerHTML === '<br>') {
          textContainer.innerHTML = '<br>';
        }

        nextLi.appendChild(nextSpan);
        checklistLi.after(nextLi);
        placeCaretAtStart(nextSpan);
      }
      saveContent('checklist-enter');
      return;
    }

    // Standard list Enter handler
    const standardLi = node?.closest?.('ul:not([data-checklist]) li, ol li');
    if (e.key === 'Enter' && standardLi) {
      e.preventDefault();
      checkpointHistory();
      const text = standardLi.innerText.replace(/\u00a0/g, '').trim();
      if (!text) {
        // If nested, outdent to parent list level
        const parentList = standardLi.parentElement;
        const parentLi = parentList?.closest('li');
        if (parentLi) {
          parentLi.after(standardLi);
          if (parentList.children.length === 0) parentList.remove();
          placeCaretAtStart(standardLi);
          saveContent('list-outdent');
          return;
        }

        const list = standardLi.closest('ul, ol');
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        if (list && list.children.length === 1) {
          list.replaceWith(p);
        } else {
          standardLi.remove();
          list?.after(p);
        }
        placeCaret(p);
        saveContent('list-exit');
        return;
      }

      let trailingFragment = null;
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        try {
          const splitRange = document.createRange();
          splitRange.setStart(range.endContainer, range.endOffset);
          splitRange.setEndAfter(standardLi.lastChild || standardLi);
          trailingFragment = splitRange.extractContents();
        } catch {
          trailingFragment = null;
        }
      }

      const nextLi = document.createElement('li');
      if (trailingFragment && (trailingFragment.textContent.trim() || trailingFragment.querySelector('*'))) {
        nextLi.appendChild(trailingFragment);
      } else {
        nextLi.innerHTML = '<br>';
      }

      if (!standardLi.innerHTML.trim()) {
        standardLi.innerHTML = '<br>';
      }

      standardLi.after(nextLi);
      placeCaretAtStart(nextLi);
      saveContent('list-enter');
      return;
    }

    const quote = node?.closest?.('blockquote');
    if (e.key === 'Enter' && quote && !quote.innerText.trim()) {
      e.preventDefault();
      checkpointHistory();
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      quote.replaceWith(p);
      placeCaret(p);
      saveContent('quote-exit');
    }
  };

  const handlePaste = (e) => {
    // 1. Check if clipboard contains an image file
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result;
              if (dataUrl) {
                commitHistory('paste-image');
                exec('insertHTML', `<figure data-size="medium" class="note-image-wrapper"><img src="${dataUrl}" alt="Pasted image" /></figure><p><br></p>`);
                saveContent('paste-image');
              }
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }
    }

    const html = e.clipboardData?.getData('text/html') || '';
    const text = e.clipboardData?.getData('text/plain') || '';

    // Check if cursor is currently inside an existing table cell
    const selection = window.getSelection();
    const anchor = selection?.anchorNode?.nodeType === 3 ? selection.anchorNode.parentElement : selection?.anchorNode;
    const currentCell = anchor?.closest?.('td, th');

    // Parse HTML or TSV into a 2D matrix of values
    const parsePastedTableData = () => {
      if (html && (html.includes('<table') || html.includes('<tr'))) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const rows = Array.from(doc.querySelectorAll('tr'));
        if (rows.length > 0) {
          return rows.map(tr => {
            const cells = Array.from(tr.querySelectorAll('th, td'));
            return cells.map(c => c.innerHTML.trim());
          });
        }
      }
      if (text && (text.includes('\t') || text.includes('\n'))) {
        const lines = text.split(/\r?\n/).filter(l => l.length > 0);
        if (lines.length > 1 || (lines.length === 1 && lines[0].includes('\t'))) {
          return lines.map(line => line.split('\t').map(c => escapeHtml(c.trim()) || '<br>'));
        }
      }
      return null;
    };

    const tableData = parsePastedTableData();

    if (currentCell && tableData && tableData.length > 0) {
      // CASE A: User is inside an existing table cell!
      // Paste table values directly into the table cells starting from this cell!
      e.preventDefault();
      commitHistory('paste-table-cells');

      const currentTr = currentCell.closest('tr');
      const table = currentTr?.closest('table');
      if (table && currentTr) {
        const allRows = Array.from(table.querySelectorAll('tr'));
        const startRowIndex = allRows.indexOf(currentTr);
        const startColIndex = Array.from(currentTr.children).indexOf(currentCell);

        const neededRows = startRowIndex + tableData.length;
        const maxColsInPasted = Math.max(...tableData.map(r => r.length));
        const neededCols = startColIndex + maxColsInPasted;

        // Ensure enough columns in all existing rows
        allRows.forEach(tr => {
          while (tr.children.length < neededCols) {
            const isHeader = tr.parentElement?.tagName === 'THEAD' || tr.querySelector('th');
            const newCell = document.createElement(isHeader ? 'th' : 'td');
            newCell.innerHTML = '<br>';
            tr.appendChild(newCell);
          }
        });

        // Ensure enough rows
        const tbody = table.querySelector('tbody') || table;
        const totalCols = table.querySelector('tr')?.children?.length || neededCols;
        while (allRows.length < neededRows) {
          const newTr = document.createElement('tr');
          for (let c = 0; c < totalCols; c++) {
            const td = document.createElement('td');
            td.innerHTML = '<br>';
            newTr.appendChild(td);
          }
          tbody.appendChild(newTr);
          allRows.push(newTr);
        }

        // Fill cells with pasted data
        tableData.forEach((rowValues, rOffset) => {
          const targetTr = allRows[startRowIndex + rOffset];
          if (targetTr) {
            rowValues.forEach((val, cOffset) => {
              const targetCell = targetTr.children[startColIndex + cOffset];
              if (targetCell) {
                targetCell.innerHTML = val || '<br>';
              }
            });
          }
        });

        saveContent('paste-table-cells');
        return;
      }
    }

    if (!currentCell && tableData && tableData.length > 0 && (html.includes('<table') || text.includes('\t'))) {
      // CASE B: User is in normal note body and pastes a table or TSV
      e.preventDefault();
      commitHistory('paste-table');

      let tableHtml = '<div class="note-table-wrapper" contenteditable="false"><table class="note-table" contenteditable="true"><tbody>';
      tableData.forEach((rowValues, rIdx) => {
        tableHtml += '<tr>';
        rowValues.forEach((val) => {
          const tag = rIdx === 0 && html.includes('<th') ? 'th' : 'td';
          tableHtml += `<${tag}>${val || '<br>'}</${tag}>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table></div><p><br></p>';

      exec('insertHTML', tableHtml);
      saveContent('paste-table');
      return;
    }

    e.preventDefault();
    if (html) {
      const cleanHtml = html
        .replace(/<meta[^>]*>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/gi, '');
      commitHistory('paste');
      exec('insertHTML', cleanHtml);
      saveContent('paste');
    } else if (text) {
      commitHistory('paste');
      const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      exec('insertText', cleanText);
      saveContent('paste');
    }
  };

  const handleDrop = (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result;
            if (dataUrl) {
              commitHistory('drop-image');
              exec('insertHTML', `<figure data-size="medium" class="note-image-wrapper"><img src="${dataUrl}" alt="${escapeHtml(file.name)}" /></figure><p><br></p>`);
              saveContent('drop-image');
            }
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }
  };

  const handleBeforeInput = (e) => {
    const inputType = e.nativeEvent?.inputType || e.inputType || 'insertText';
    const selection = window.getSelection();
    const anchor = selection?.anchorNode?.nodeType === 3 ? selection.anchorNode.parentElement : selection?.anchorNode;
    if (inputType === 'insertParagraph' && anchor?.closest?.('ul[data-checklist],blockquote')) {
      e.preventDefault();
      return;
    }
    if (inputType !== 'insertText' || e.data !== ' ') return;
    const block = anchor?.closest?.('p,div');
    if (!block) return;
    const text = block.textContent.replace(/\u00a0/g, '').trim();
    if (text === '*' || text === '1.') {
      e.preventDefault();
      const range = document.createRange();
      range.selectNodeContents(block);
      selection.removeAllRanges();
      selection.addRange(range);
      exec('delete');
      exec(text === '*' ? 'insertUnorderedList' : 'insertOrderedList');
      saveContent('list-shortcut');
    }
  };

  const handleEditorContextMenu = (e) => {
    // 1. Check if right-clicking an image
    const img = e.target.closest('img');
    if (img && editorRef.current?.contains(img)) {
      e.preventDefault();
      e.stopPropagation();
      const wrapper = img.closest('.note-image-wrapper') || img;
      const currentSize = wrapper.getAttribute?.('data-size') || 'medium';
      setImageMenu({
        x: Math.min(e.clientX, window.innerWidth - 220),
        y: Math.min(e.clientY, window.innerHeight - 200),
        imgEl: img,
        wrapperEl: wrapper,
        currentSize,
      });
      return;
    }

    // 2. Check if right-clicking a link
    const link = e.target.closest('a');
    if (link && editorRef.current?.contains(link)) {
      e.preventDefault();
      e.stopPropagation();
      setLinkMenu({
        x: Math.min(e.clientX, window.innerWidth - 220),
        y: Math.min(e.clientY, window.innerHeight - 160),
        href: link.getAttribute('href') || link.href || '',
        linkEl: link,
      });
      return;
    }
  };

  // Table Helpers
  const handleInsertRowAbove = () => {
    if (!tableOverlay?.row || !tableOverlay?.table) return;
    const { row } = tableOverlay;
    commitHistory('table-row-add');
    const colCount = row.children.length;
    const newTr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.innerHTML = '<br>';
      newTr.appendChild(td);
    }
    row.before(newTr);
    saveContent('table-row-add');
    setTableOverlay(null);
  };

  const handleInsertRowBelow = () => {
    if (!tableOverlay?.row || !tableOverlay?.table) return;
    const { row } = tableOverlay;
    commitHistory('table-row-add');
    const colCount = row.children.length;
    const newTr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.innerHTML = '<br>';
      newTr.appendChild(td);
    }
    row.after(newTr);
    saveContent('table-row-add');
    setTableOverlay(null);
  };

  const handleCopyRow = () => {
    if (!tableOverlay?.row) return;
    const data = Array.from(tableOverlay.row.children).map(c => c.innerHTML);
    setCopiedTableData({ type: 'row', data });
    setTableOverlay(prev => ({ ...prev, rowMenuOpen: false }));
  };

  const handlePasteRow = () => {
    if (!tableOverlay?.row || !copiedTableData || copiedTableData.type !== 'row') return;
    commitHistory('table-row-paste');
    const cells = Array.from(tableOverlay.row.children);
    copiedTableData.data.forEach((val, idx) => {
      if (cells[idx]) {
        cells[idx].innerHTML = val;
      }
    });
    saveContent('table-row-paste');
    setTableOverlay(null);
  };

  const handleTableSelectionDelete = () => {
    if (!tableOverlay?.selectedType || !tableOverlay?.table) return false;
    const { selectedType, table, row, rowIndex, colIndex, range } = tableOverlay;
    const allRows = Array.from(table.querySelectorAll('tr'));
    if (allRows.length === 0) return false;
    const totalCols = allRows[0]?.children?.length || 0;

    // 1. Single Row selection
    if (selectedType === 'row' && (row || rowIndex !== undefined)) {
      const targetRow = row || allRows[rowIndex];
      if (!targetRow) return false;
      const cells = Array.from(targetRow.children);
      const hasContent = cells.some(c => c.innerText.replace(/\u00a0/g, '').trim() !== '');
      if (hasContent) {
        commitHistory('table-row-clear');
        cells.forEach(c => { c.innerHTML = '<br>'; });
        saveContent('table-row-clear');
      } else {
        commitHistory('table-row-delete');
        if (allRows.length <= 1) {
          table.closest('.note-table-wrapper')?.remove() || table.remove();
        } else {
          targetRow.remove();
        }
        saveContent('table-row-delete');
        setTableOverlay(null);
      }
      return true;
    }

    // 2. Single Column selection
    if (selectedType === 'col' && colIndex !== undefined) {
      const colCells = allRows.map(r => r.children[colIndex]).filter(Boolean);
      const hasContent = colCells.some(c => c.innerText.replace(/\u00a0/g, '').trim() !== '');
      if (hasContent) {
        commitHistory('table-col-clear');
        colCells.forEach(c => { c.innerHTML = '<br>'; });
        saveContent('table-col-clear');
      } else {
        commitHistory('table-col-delete');
        if (totalCols <= 1) {
          table.closest('.note-table-wrapper')?.remove() || table.remove();
        } else {
          allRows.forEach(tr => {
            tr.children[colIndex]?.remove();
          });
        }
        saveContent('table-col-delete');
        setTableOverlay(null);
      }
      return true;
    }

    // 3. Range selection (entire table, whole rows, whole columns, or block of cells)
    if (selectedType === 'range' && range) {
      const { minRow, maxRow, minCol, maxCol } = range;
      const isEntireTable = minRow === 0 && maxRow === allRows.length - 1 && minCol === 0 && maxCol === totalCols - 1;
      const isWholeRows = minCol === 0 && maxCol === totalCols - 1;
      const isWholeCols = minRow === 0 && maxRow === allRows.length - 1;

      // Collect all cells in range
      const rangeCells = [];
      for (let r = minRow; r <= maxRow; r++) {
        const tr = allRows[r];
        if (tr) {
          for (let c = minCol; c <= maxCol; c++) {
            const cell = tr.children[c];
            if (cell) rangeCells.push(cell);
          }
        }
      }

      const hasContent = rangeCells.some(c => c.innerText.replace(/\u00a0/g, '').trim() !== '');

      if (hasContent) {
        // First delete: clear content of all selected cells
        commitHistory('table-range-clear');
        rangeCells.forEach(c => { c.innerHTML = '<br>'; });
        saveContent('table-range-clear');
        return true;
      }

      // Second delete: cells in range are empty!
      if (isEntireTable) {
        commitHistory('table-delete');
        table.closest('.note-table-wrapper')?.remove() || table.remove();
        saveContent('table-delete');
        setTableOverlay(null);
        return true;
      }

      if (isWholeRows) {
        commitHistory('table-rows-delete');
        const rowsToDelete = [];
        for (let r = minRow; r <= maxRow; r++) {
          if (allRows[r]) rowsToDelete.push(allRows[r]);
        }
        if (rowsToDelete.length >= allRows.length) {
          table.closest('.note-table-wrapper')?.remove() || table.remove();
        } else {
          rowsToDelete.forEach(tr => tr.remove());
        }
        saveContent('table-rows-delete');
        setTableOverlay(null);
        return true;
      }

      if (isWholeCols) {
        commitHistory('table-cols-delete');
        const colsCountToDelete = maxCol - minCol + 1;
        if (colsCountToDelete >= totalCols) {
          table.closest('.note-table-wrapper')?.remove() || table.remove();
        } else {
          allRows.forEach(tr => {
            for (let c = maxCol; c >= minCol; c--) {
              tr.children[c]?.remove();
            }
          });
        }
        saveContent('table-cols-delete');
        setTableOverlay(null);
        return true;
      }

      return true;
    }

    return false;
  };

  const handleDeleteRow = () => {
    if (!tableOverlay?.row || !tableOverlay?.table) return;
    const { row, table } = tableOverlay;
    commitHistory('table-row-delete');
    const allRows = Array.from(table.querySelectorAll('tr'));
    if (allRows.length <= 1) {
      table.closest('.note-table-wrapper')?.remove() || table.remove();
    } else {
      row.remove();
    }
    saveContent('table-row-delete');
    setTableOverlay(null);
  };

  const handleInsertColLeft = () => {
    if (!tableOverlay?.table || tableOverlay?.colIndex === undefined) return;
    const { table, colIndex } = tableOverlay;
    commitHistory('table-col-add');
    const rows = Array.from(table.querySelectorAll('tr'));
    rows.forEach(tr => {
      const isHeader = tr.parentElement?.tagName === 'THEAD' || tr.querySelector('th');
      const cell = document.createElement(isHeader ? 'th' : 'td');
      cell.innerHTML = isHeader ? 'Header' : '<br>';
      const targetCell = tr.children[colIndex];
      if (targetCell) {
        tr.insertBefore(cell, targetCell);
      } else {
        tr.appendChild(cell);
      }
    });
    saveContent('table-col-add');
    setTableOverlay(null);
  };

  const handleInsertColRight = () => {
    if (!tableOverlay?.table || tableOverlay?.colIndex === undefined) return;
    const { table, colIndex } = tableOverlay;
    commitHistory('table-col-add');
    const rows = Array.from(table.querySelectorAll('tr'));
    rows.forEach(tr => {
      const isHeader = tr.parentElement?.tagName === 'THEAD' || tr.querySelector('th');
      const cell = document.createElement(isHeader ? 'th' : 'td');
      cell.innerHTML = isHeader ? 'Header' : '<br>';
      const targetCell = tr.children[colIndex];
      if (targetCell && targetCell.nextSibling) {
        tr.insertBefore(cell, targetCell.nextSibling);
      } else {
        tr.appendChild(cell);
      }
    });
    saveContent('table-col-add');
    setTableOverlay(null);
  };

  const handleCopyCol = () => {
    if (!tableOverlay?.table || tableOverlay?.colIndex === undefined) return;
    const { table, colIndex } = tableOverlay;
    const rows = Array.from(table.querySelectorAll('tr'));
    const data = rows.map(tr => tr.children[colIndex]?.innerHTML || '');
    setCopiedTableData({ type: 'col', data });
    setTableOverlay(prev => ({ ...prev, colMenuOpen: false }));
  };

  const handlePasteCol = () => {
    if (!tableOverlay?.table || tableOverlay?.colIndex === undefined || !copiedTableData || copiedTableData.type !== 'col') return;
    commitHistory('table-col-paste');
    const rows = Array.from(tableOverlay.table.querySelectorAll('tr'));
    rows.forEach((tr, idx) => {
      const cell = tr.children[tableOverlay.colIndex];
      if (cell && copiedTableData.data[idx] !== undefined) {
        cell.innerHTML = copiedTableData.data[idx];
      }
    });
    saveContent('table-col-paste');
    setTableOverlay(null);
  };

  const handleDeleteCol = () => {
    if (!tableOverlay?.table || tableOverlay?.colIndex === undefined) return;
    const { table, colIndex } = tableOverlay;
    commitHistory('table-col-delete');
    const rows = Array.from(table.querySelectorAll('tr'));
    const firstRowCells = rows[0]?.children?.length || 0;
    if (firstRowCells <= 1) {
      table.closest('.note-table-wrapper')?.remove() || table.remove();
    } else {
      rows.forEach(tr => {
        tr.children[colIndex]?.remove();
      });
    }
    saveContent('table-col-delete');
    setTableOverlay(null);
  };

  const handleCopyRange = () => {
    if (!tableOverlay?.table || !tableOverlay?.range) return;
    const { minRow, maxRow, minCol, maxCol } = tableOverlay.range;
    const rows = Array.from(tableOverlay.table.querySelectorAll('tr'));
    const gridData = [];
    const textRows = [];

    for (let r = minRow; r <= maxRow; r++) {
      const tr = rows[r];
      if (tr) {
        const rowVals = [];
        const textCols = [];
        for (let c = minCol; c <= maxCol; c++) {
          const cell = tr.children[c];
          rowVals.push(cell?.innerHTML || '');
          textCols.push(cell?.innerText.trim() || '');
        }
        gridData.push(rowVals);
        textRows.push(textCols.join('\t'));
      }
    }

    const plainText = textRows.join('\n');
    try { navigator.clipboard?.writeText(plainText); } catch {}
    setCopiedTableData({ type: 'grid', data: gridData });
  };

  const handleDeleteTable = () => {
    if (!tableOverlay?.table) return;
    commitHistory('table-delete');
    tableOverlay.table.closest('.note-table-wrapper')?.remove() || tableOverlay.table.remove();
    saveContent('table-delete');
    setTableOverlay(null);
  };

  const openMenu = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({
      x: Math.min(event.clientX, window.innerWidth - 470),
      y: Math.min(event.clientY, window.innerHeight - 350),
      item,
      panel: null
    });
  };

  const action = (id, item, value) => {
    const isFolder = item.type === 'folder';
    if (id === 'move-panel') {
      setMenu(m => ({ ...m, panel: 'move' }));
      return;
    }
    if (id === 'icon-color') {
      const rect = { left: Math.min(window.innerWidth - 300, (menu?.x || 200) + 10), top: menu?.y || 200, bottom: (menu?.y || 200) + 20 };
      setIconPopover({ item, anchorRect: rect });
    } else if (id === 'tags') {
      setTagModal({ note: item, tags: item.tags || [] });
    } else if (id === 'rename') {
      setRenameDialog({ item, name: isFolder ? item.name : item.title });
    } else if (id === 'add-folder') {
      createFolder(isFolder ? item.id : item.folder);
    } else if (id === 'add-note') {
      createNote(isFolder ? item.id : item.folder);
    } else if (id === 'duplicate') {
      if (isFolder) {
        const newId = uid();
        setFolders(v => [...v, { ...item, id: newId, name: `${item.name} copy` }]);
        setNotes(v => [...v, ...v.filter(n => n.folder === item.id).map(n => ({ ...n, id: uid(), folder: newId }))]);
      } else {
        setNotes(v => [{ ...item, id: uid(), title: `${item.title} copy`, updated: Date.now() }, ...v]);
      }
    } else if (id === 'apply-color-all') {
      const getFolderIds = (folderId) => {
        const ids = [folderId];
        const findChildren = (pid) => {
          folders.filter(f => f.parent === pid).forEach(child => {
            ids.push(child.id);
            findChildren(child.id);
          });
        };
        findChildren(folderId);
        return new Set(ids);
      };
      const allFolderIds = getFolderIds(item.id);
      const folderColor = item.color || COLORS[0];
      setNotes(v => {
        const next = v.map(n => allFolderIds.has(n.folder) ? { ...n, color: folderColor, updated: Date.now() } : n);
        try {
          localStorage.setItem('biba_notes_v1', JSON.stringify(next));
        } catch {}
        return next;
      });
    } else if (id === 'apply-icon-all') {
      const getFolderIds = (folderId) => {
        const ids = [folderId];
        const findChildren = (pid) => {
          folders.filter(f => f.parent === pid).forEach(child => {
            ids.push(child.id);
            findChildren(child.id);
          });
        };
        findChildren(folderId);
        return new Set(ids);
      };
      const allFolderIds = getFolderIds(item.id);
      const folderIcon = item.icon || 'NotebookPen';
      setNotes(v => {
        const next = v.map(n => allFolderIds.has(n.folder) ? { ...n, icon: folderIcon, updated: Date.now() } : n);
        try {
          localStorage.setItem('biba_notes_v1', JSON.stringify(next));
        } catch {}
        return next;
      });
    } else if (id === 'move') {
      if (isFolder) {
        setFolders(v => v.map(x => x.id === item.id ? { ...x, parent: value } : x));
      } else {
        setNotes(v => v.map(x => x.id === item.id ? { ...x, folder: value } : x));
      }
    } else if (id === 'delete') {
      if (isFolder) {
        const ids = new Set([item.id]);
        let changed = true;
        while (changed) {
          changed = false;
          folders.forEach(f => {
            if (ids.has(f.parent) && !ids.has(f.id)) {
              ids.add(f.id);
              changed = true;
            }
          });
        }
        setFolders(v => v.filter(f => !ids.has(f.id)));
        setNotes(v => v.filter(n => !ids.has(n.folder)));
      } else {
        setNotes(v => v.map(n => n.id === item.id ? { ...n, deleted: Date.now() } : n));
        if (selected === item.id) {
          setSelected(null);
        }
      }
    } else if (id === 'export-md') {
      exportMarkdown(item);
    } else if (id === 'export-pdf') {
      exportPdf(item);
    }
    setMenu(null);
  };

  const activeNotes = notes.filter(n => !n.deleted);
  const deletedNotes = notes.filter(n => n.deleted);

  const sortedActive = [...activeNotes]
    .filter(n => n.title.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (b.updated || 0) - (a.updated || 0));

  const sortedDeleted = [...deletedNotes]
    .filter(n => n.title.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (b.deleted || 0) - (a.deleted || 0));

  const renderFolder = (folder, depth = 0) => {
    const children = folders.filter(f => f.parent === folder.id);
    const folderNotes = sortedActive.filter(n => n.folder === folder.id);
    const isOpen = expanded.has(folder.id);
    return (
      <div key={folder.id}>
        <div onContextMenu={e => openMenu(e, folder)} className="group flex h-8 items-center gap-1 rounded-lg px-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60" style={{ paddingLeft: 6 + depth * 12 }}>
          <button onClick={() => setExpanded(v => {
            const next = new Set(v);
            if (next.has(folder.id)) next.delete(folder.id);
            else next.add(folder.id);
            return next;
          })}>
            <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition ${isOpen ? 'rotate-90' : ''}`} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setIconPopover({ item: folder, anchorRect: rect });
            }}
            className="rounded p-0.5 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-transform hover:scale-110 shrink-0"
            title={isNl ? 'Icoon & kleur wijzigen' : 'Change icon & color'}
          >
            {renderFolderIcon(folder, isOpen, "h-5 w-5")}
          </button>
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          <button onClick={e => openMenu(e, folder)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
        {isOpen && (
          <div>
            {children.map(f => renderFolder(f, depth + 1))}
            {folderNotes.map(n => renderNote(n, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderNote = (n, depth = 0) => {
    const isSelected = selected === n.id;
    return (
      <div
        key={n.id}
        role="button"
        tabIndex={0}
        onClick={() => {
          setSelected(n.id);
          setViewMode('library');
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelected(n.id);
            setViewMode('library');
          }
        }}
        onContextMenu={e => openMenu(e, { ...n, type: 'note' })}
        className={`group flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 text-left text-sm transition-colors ${
          isSelected && viewMode === 'library'
            ? 'bg-slate-100 dark:bg-slate-800 font-medium'
            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60'
        }`}
        style={{ paddingLeft: depth === 0 ? 10 : 38 + (depth - 1) * 16 }}
      >
        <button
          type="button"
          title={isNl ? 'Icoon & kleur aanpassen' : 'Customize icon & color'}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setIconPopover({ item: n, anchorRect: rect });
          }}
          className="rounded p-0.5 hover:opacity-90 transition-transform hover:scale-105 shrink-0"
        >
          {renderNoteIcon(n.icon, n.color, "h-[19px] w-[19px]")}
        </button>

        <span
          className="min-w-0 flex-1 truncate"
          style={isSelected && viewMode === 'library' && n.color ? { color: n.color } : undefined}
        >
          {n.title}
        </span>

        <button onClick={e => openMenu(e, { ...n, type: 'note' })} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const renderLibraryOverview = () => {
    const currentFolder = gridFolderId ? folders.find(f => f.id === gridFolderId) : null;
    const allActive = notes.filter(n => !n.deleted);
    const filtered = allActive.filter(n => {
      const q = query.toLowerCase();
      const matchTitle = (n.title || '').toLowerCase().includes(q);
      const matchTag = n.tags && n.tags.some(t => t.toLowerCase().includes(q));
      return matchTitle || matchTag;
    });

    const sortItems = (items) => {
      return [...items].sort((a, b) => {
        let result = 0;
        if (tableSortKey === 'name') {
          const nameA = (a.title || a.name || '').toLowerCase();
          const nameB = (b.title || b.name || '').toLowerCase();
          result = nameA.localeCompare(nameB);
        } else if (tableSortKey === 'tags') {
          const tagsA = (a.tags || []).join(', ').toLowerCase();
          const tagsB = (b.tags || []).join(', ').toLowerCase();
          result = tagsA.localeCompare(tagsB);
        } else if (tableSortKey === 'words') {
          const wordsA = countWords(a.content || '');
          const wordsB = countWords(b.content || '');
          result = wordsA - wordsB;
        } else if (tableSortKey === 'readTime') {
          const wordsA = countWords(a.content || '');
          const wordsB = countWords(b.content || '');
          result = wordsA - wordsB;
        } else if (tableSortKey === 'modified') {
          const timeA = a.updated || a.created || 0;
          const timeB = b.updated || b.created || 0;
          result = timeA - timeB;
        } else if (tableSortKey === 'created') {
          const timeA = a.created || a.updated || 0;
          const timeB = b.created || b.updated || 0;
          result = timeA - timeB;
        }
        return tableSortDirection === 'asc' ? result : -result;
      });
    };

    const rootFolders = sortItems(folders.filter(f => !f.parent));
    const rootNotes = sortItems(filtered.filter(n => !n.folder));

    const currentGridFolders = gridFolderId ? sortItems(folders.filter(f => f.parent === gridFolderId)) : rootFolders;
    const currentGridNotes = gridFolderId ? sortItems(filtered.filter(n => n.folder === gridFolderId)) : rootNotes;

    const visibleCols = NOTE_TABLE_COLUMNS.filter(col => noteTableColumns[col.id]);
    const totalTableWidth = visibleCols.reduce((sum, col) => sum + (noteTableWidths[col.id] || col.defaultWidth || col.width || 100), 0);

    const handleHeaderClick = (colId) => {
      if (colId === 'actions') return;
      if (tableSortKey === colId) {
        setTableSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
        setTableSortKey(colId);
        setTableSortDirection(['words', 'readTime', 'modified', 'created'].includes(colId) ? 'desc' : 'asc');
      }
    };

    const renderTableRow = (item, type = 'note', depth = 0) => {
      const isF = type === 'folder';
      const isOpen = expanded.has(item.id);
      const childFolders = sortItems(folders.filter(f => f.parent === item.id));
      const childNotes = sortItems(filtered.filter(n => n.folder === item.id));
      const itemCount = childFolders.length + childNotes.length;

      if (isF) {
        return (
          <Fragment key={`folder-${item.id}`}>
            <tr
              onContextMenu={e => openMenu(e, item)}
              className="group border-b border-slate-100 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
            >
              {visibleCols.map(col => {
                if (col.id === 'name') {
                  return (
                    <td key={col.id} className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-1.5 min-w-0" style={{ paddingLeft: depth * 18 }}>
                        <button
                          type="button"
                          onClick={() => setExpanded(v => {
                            const next = new Set(v);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })}
                          className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded shrink-0"
                        >
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setIconPopover({ item, anchorRect: rect });
                          }}
                          className="rounded p-0.5 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-transform hover:scale-110 shrink-0"
                          title={isNl ? 'Icoon & kleur wijzigen' : 'Change icon & color'}
                        >
                          {renderFolderIcon(item, isOpen, "h-5 w-5")}
                        </button>
                        <span className="font-semibold truncate">{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal shrink-0">({itemCount})</span>
                      </div>
                    </td>
                  );
                }
                if (col.id === 'actions') {
                  return (
                    <td key={col.id} className="px-2 py-2 text-right align-middle">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          openMenu(e, item);
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                        title={isNl ? 'Map opties' : 'Folder options'}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  );
                }
                return (
                  <td key={col.id} className="px-3 py-2 align-middle" />
                );
              })}
            </tr>

            {isOpen && (
              <>
                {childFolders.map(f => renderTableRow(f, 'folder', depth + 1))}
                {childNotes.map(n => renderTableRow(n, 'note', depth + 1))}
              </>
            )}
          </Fragment>
        );
      }

      // Note row
      const wordCount = countWords(item.content);
      const readingTime = getReadingTime(wordCount, isNl);
      const editedDate = formatDate(item.updated, isNl);
      const addedDate = formatDate(item.created || item.updated, isNl);

      return (
        <tr
          key={`note-${item.id}`}
          onClick={() => {
            setSelected(item.id);
            setViewMode('library');
          }}
          onContextMenu={e => openMenu(e, { ...item, type: 'note' })}
          className="group border-b border-slate-100 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          {visibleCols.map(col => {
            if (col.id === 'name') {
              return (
                <td key={col.id} className="px-3 py-2 align-middle">
                  <div className="flex items-center gap-2 min-w-0" style={{ paddingLeft: depth * 18 + 20}}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setIconPopover({ item, anchorRect: rect });
                      }}
                      className="rounded p-0.5 hover:opacity-90 transition-transform hover:scale-105 shrink-0"
                      title={isNl ? 'Icoon & kleur aanpassen' : 'Customize icon & color'}
                    >
                      {renderNoteIcon(item.icon, item.color, "h-[19px] w-[19px]")}
                    </button>
                    <span className="font-medium text-slate-800 dark:text-slate-100 truncate group-hover:text-slate-900 dark:group-hover:text-white">
                      {item.title}
                    </span>
                  </div>
                </td>
              );
            }
            if (col.id === 'tags') {
              return (
                <td key={col.id} className="px-3 py-2 align-middle">
                  <div className="flex items-center gap-1 overflow-hidden">
                    {(item.tags && item.tags.length > 0) ? (
                      item.tags.slice(0, 2).map((t, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 truncate max-w-[80px]"
                        >
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 text-[11px]">—</span>
                    )}
                    {item.tags && item.tags.length > 2 && (
                      <span className="text-[10px] text-slate-400 font-semibold shrink-0">+{item.tags.length - 2}</span>
                    )}
                  </div>
                </td>
              );
            }
            if (col.id === 'words') {
              return (
                <td key={col.id} className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-mono text-[11px] align-middle">
                  {wordCount}
                </td>
              );
            }
            if (col.id === 'readTime') {
              return (
                <td key={col.id} className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-[11px] align-middle">
                  {readingTime}
                </td>
              );
            }
            if (col.id === 'modified') {
              return (
                <td key={col.id} className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-[11px] align-middle">
                  {editedDate}
                </td>
              );
            }
            if (col.id === 'created') {
              return (
                <td key={col.id} className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-[11px] align-middle">
                  {addedDate}
                </td>
              );
            }
            if (col.id === 'actions') {
              return (
                <td key={col.id} className="px-2 py-2 text-right align-middle">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      openMenu(e, { ...item, type: 'note' });
                    }}
                    className="inline-flex h-6 w-6 items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                    title={isNl ? 'Notitie opties' : 'Note options'}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </td>
              );
            }
            return null;
          })}
        </tr>
      );
    };

    return (
      <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
        {/* Library Header Bar */}
        <div className="flex items-center justify-between border-b px-4 py-3 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {(gridFolderId || isMobile) && (
              <button
                type="button"
                onClick={() => {
                  if (gridFolderId) setGridFolderId(null);
                  else setViewMode('library');
                }}
                className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-700 transition-colors"
                title={isNl ? 'Terug naar Bibliotheek' : 'Back to Library'}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{isNl ? 'Terug' : 'Back'}</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              {currentFolder ? (
                <>
                  {renderFolderIcon(currentFolder, false, "h-6 w-6")}
                  <h2 className="text-base font-bold text-slate-800 dark:text-white truncate">
                    {currentFolder.name}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {currentGridNotes.length} {isNl ? 'notities' : 'notes'}
                  </span>
                </>
              ) : (
                <>
                  <h2 className="text-base font-bold text-slate-800 dark:text-white">
                    {isNl ? 'Bibliotheek Overzicht' : 'Library Overview'}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {allActive.length} {isNl ? 'notities' : 'notes'} • {folders.length} {isNl ? 'mappen' : 'folders'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sub-toolbar: View Switcher (Table vs Grid) on left + Columns Selector */}
        <div className="flex items-center justify-between border-b px-4 py-2 bg-slate-50/50 dark:bg-slate-900/30 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            {/* View Switcher: Table vs Grid */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 dark:border-slate-700 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => setOverviewLayout('table')}
                title={isNl ? 'Lijst / Tabelweergave' : 'List / Table View'}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  overviewLayout === 'table'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Table className="h-3.5 w-3.5" />
                <span>{isNl ? 'Tabel' : 'Table'}</span>
              </button>
              <button
                type="button"
                onClick={() => setOverviewLayout('grid')}
                title={isNl ? 'Rasterweergave (met previews)' : 'Grid View (with previews)'}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  overviewLayout === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>{isNl ? 'Raster' : 'Grid'}</span>
              </button>
            </div>

            {/* Columns Selector Button with Expand/Collapse Chevron */}
            {overviewLayout === 'table' && (
              <div className="relative" ref={columnMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowColumnMenu(v => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title={isNl ? 'Kolommen aanpassen' : 'Customize columns'}
                >
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${showColumnMenu ? 'rotate-180' : ''}`} />
                  <Columns3 className="h-3.5 w-3.5 text-slate-500" />
                  <span>{isNl ? 'Kolommen' : 'Columns'}</span>
                </button>

                {showColumnMenu && (
                  <ViewportPanel
                    className="absolute left-0 top-full mt-1.5 z-40 w-56 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {isNl ? 'Zichtbare kolommen' : 'Visible columns'}
                    </div>
                    <div className="space-y-0.5 mt-1">
                      {NOTE_TABLE_COLUMNS.filter(col => col.id !== 'actions').map(col => (
                        <label
                          key={col.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 select-none ${
                            col.nonHideable || col.fixed ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(noteTableColumns[col.id])}
                            disabled={Boolean(col.nonHideable || col.fixed)}
                            onChange={e => setNoteTableColumns(prev => ({ ...prev, [col.id]: e.target.checked }))}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span>{isNl ? col.labelNl : col.labelEn}</span>
                        </label>
                      ))}
                    </div>
                  </ViewportPanel>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Overview Body */}
        <div className="flex-1 overflow-auto min-h-0">
          {overviewLayout === 'table' ? (
            /* =================== TABLE VIEW =================== */
            <div className="w-full min-h-full">
              <table className="w-full text-xs table-fixed border-collapse" style={{ minWidth: Math.max(650, totalTableWidth) }}>
                <colgroup>
                  {visibleCols.map(col => (
                    <col
                      key={col.id}
                      style={{ width: noteTableWidths[col.id] || col.defaultWidth || col.width || 100 }}
                    />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs">
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    {visibleCols.map(col => {
                      if (col.id === 'actions') {
                        return <th key="actions" className="w-[44px] p-2 text-center" />;
                      }
                      const label = isNl ? col.labelNl : col.labelEn;
                      const isSorted = tableSortKey === col.id;
                      return (
                        <th
                          key={col.id}
                          onClick={() => handleHeaderClick(col.id)}
                          className={`group relative select-none px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-r border-slate-200/90 dark:border-slate-800/90 last:border-r-0 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors ${
                            col.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                        >
                          <div className={`flex items-center gap-1.5 min-w-0 ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                            <span className="truncate">{label}</span>
                            {isSorted ? (
                              tableSortDirection === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            )}
                          </div>
                          {!col.fixed && (
                            <span
                              className="group/resizer absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize flex items-center justify-center z-20"
                              title={isNl ? 'Sleep om kolombreedte aan te passen' : 'Drag to resize column'}
                              onClick={e => e.stopPropagation()}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                columnResizeRef.current = {
                                  columnId: col.id,
                                  startX: e.clientX,
                                  startWidth: noteTableWidths[col.id] || col.defaultWidth || 100,
                                };
                              }}
                            >
                              <span className="w-0.5 h-4/5 rounded-full bg-transparent group-hover/resizer:bg-teal-500 active:bg-teal-600 transition-colors" />
                            </span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rootFolders.map(f => renderTableRow(f, 'folder', 0))}
                  {rootNotes.map(n => renderTableRow(n, 'note', 0))}
                </tbody>
              </table>

              {allActive.length === 0 && folders.length === 0 && (
                <div className="py-16 text-center text-xs text-slate-400">
                  {isNl ? 'Geen notities in de bibliotheek. Maak een nieuwe notitie aan!' : 'No notes in library. Create a new note!'}
                </div>
              )}
            </div>
          ) : (
            /* =================== GRID VIEW =================== */
            <div className="p-4 space-y-6">
              {/* Folders in current level */}
              {currentGridFolders.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
                    {isNl ? 'Mappen' : 'Folders'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {currentGridFolders.map(f => {
                      const childF = folders.filter(cf => cf.parent === f.id);
                      const childN = allActive.filter(cn => cn.folder === f.id);
                      const total = childF.length + childN.length;
                      return (
                        <div
                          key={f.id}
                          onClick={() => setGridFolderId(f.id)}
                          onContextMenu={e => openMenu(e, f)}
                          className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-slate-700 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {renderFolderIcon(f, false, "h-6 w-6")}
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                {f.name}
                              </h4>
                              <p className="text-[10px] text-slate-400">
                                {total} {total === 1 ? (isNl ? 'item' : 'item') : (isNl ? 'items' : 'items')}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              openMenu(e, f);
                            }}
                            className="p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes in current level */}
              <div>
                {currentGridFolders.length > 0 && currentGridNotes.length > 0 && (
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
                    {isNl ? 'Notities' : 'Notes'}
                  </h3>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {currentGridNotes.map(n => {
                    const wordCount = countWords(n.content);
                    const previewText = getPreviewText(n.content);
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          setSelected(n.id);
                          setViewMode('library');
                        }}
                        onContextMenu={e => openMenu(e, { ...n, type: 'note' })}
                        className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700 transition-all cursor-pointer h-48"
                      >
                        {/* Note Card Header */}
                        <div>
                          <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setIconPopover({ item: n, anchorRect: rect });
                                }}
                                className="rounded p-0.5 hover:opacity-90 transition-transform hover:scale-105 shrink-0"
                              >
                                {renderNoteIcon(n.icon, n.color, "h-5 w-5")}
                              </button>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                {n.title}
                              </h4>
                            </div>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                openMenu(e, { ...n, type: 'note' });
                              }}
                              className="p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-700 dark:hover:text-slate-200"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Preview snippet */}
                          <p className="line-clamp-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                            {previewText || <span className="italic text-slate-400">{isNl ? 'Lege notitie…' : 'Empty note…'}</span>}
                          </p>
                        </div>

                        {/* Note Card Footer */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-1 text-[10px] text-slate-400">
                          <div className="flex items-center gap-1 overflow-hidden min-w-0">
                            {(n.tags && n.tags.length > 0) ? (
                              n.tags.slice(0, 2).map((t, idx) => (
                                <span
                                  key={idx}
                                  className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-medium text-slate-600 dark:text-slate-300 truncate"
                                >
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span>{wordCount} {isNl ? 'woorden' : 'words'}</span>
                            )}
                          </div>
                          <span className="shrink-0 font-medium">{formatDate(n.updated || n.created, isNl)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {currentGridFolders.length === 0 && currentGridNotes.length === 0 && (
                  <div className="py-16 text-center text-xs text-slate-400">
                    {isNl ? 'Geen items in deze map.' : 'No items in this folder.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        target: e.target,
        time: Date.now(),
      };
    }
  };

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    const target = touchStartRef.current.target;
    touchStartRef.current = null;

    // Must be predominantly horizontal and quick swipe
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 600) {
      const li = target?.closest('li');
      if (li && editorRef.current?.contains(li)) {
        e.preventDefault();
        checkpointHistory();
        if (dx > 0) {
          indentListItem(li);
          saveContent('swipe-indent');
        } else {
          outdentListItem(li);
          saveContent('swipe-outdent');
        }
      }
    }
  };

  return (
    <ToolShell icon={NotebookPen} title="Notes" description="Write, format and organize reusable lab notes.">
      <div className={`grid h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] overflow-hidden rounded-xl border border-slate-200 bg-white transition-all dark:border-slate-800 dark:bg-slate-900 ${
        isMobile ? 'grid-cols-1' : collapsed ? 'grid-cols-[52px_1fr]' : 'grid-cols-[280px_1fr]'
      }`}>
        <aside className={`flex flex-col justify-between h-full overflow-hidden border-r dark:border-slate-800 ${
          isMobile && (selected || viewMode === 'library-overview') ? 'hidden' : 'flex'
        }`}>
          <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
            {/* Sidebar Header: Entire header bar is clickable to open Library Overview */}
            <div
              onClick={() => {
                if (collapsed) {
                  setCollapsed(false);
                } else {
                  setSelected(null);
                  setViewMode('library-overview');
                  setGridFolderId(null);
                }
              }}
              className={`flex h-12 items-center justify-between border-b px-3 dark:border-slate-800 shrink-0 cursor-pointer select-none transition-colors ${
                viewMode === 'library-overview' && !selected && !collapsed
                  ? 'bg-slate-100/70 dark:bg-slate-800/60'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
              title={isNl ? 'Volledige bibliotheek overzicht bekijken' : 'View full library overview'}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`text-sm font-bold truncate ${
                    viewMode === 'library-overview' && !selected
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-700 dark:text-slate-300'
                  } ${collapsed ? 'hidden' : ''}`}
                >
                  {viewMode === 'trash' ? (isNl ? 'Prullenbak' : 'Trash') : (isNl ? 'Bibliotheek' : 'Library')}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed(v => !v);
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700"
                title={collapsed ? (isNl ? 'Zijbalk uitklappen' : 'Expand sidebar') : (isNl ? 'Zijbalk inklappen' : 'Collapse sidebar')}
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>

            {!collapsed && (
              <div className="flex flex-col min-h-0 flex-1 p-2">
                {/* Search bar & Sleek Gray Add Folder & Add Note Buttons */}
                <div className="grid grid-cols-[1fr_34px_34px] gap-1 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input className={`${fieldClass} w-full pl-8`} placeholder={isNl ? 'Zoek notities…' : 'Search notes…'} value={query} onChange={e => setQuery(e.target.value)} />
                  </div>
                  <button
                    type="button"
                    title={isNl ? 'Nieuwe map' : 'New folder'}
                    onClick={() => createFolder()}
                    className="flex items-center justify-center rounded-lg bg-slate-100 border border-slate-200/60 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition-colors"
                  >
                    <FolderPlus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={isNl ? 'Nieuwe notitie' : 'New note'}
                    onClick={() => createNote()}
                    className="flex items-center justify-center rounded-lg bg-slate-100 border border-slate-200/60 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition-colors"
                  >
                    <FilePlus className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex-1 overflow-y-auto min-h-0">
                  {viewMode === 'trash' ? (
                    <>
                      <div className="flex items-center justify-between px-2 py-1 mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          {deletedNotes.length} {isNl ? 'verwijderd' : 'deleted'}
                        </span>
                        {deletedNotes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(isNl ? 'Weet je zeker dat je alle notities in de prullenbak permanent wilt verwijderen?' : 'Are you sure you want to permanently delete all notes in trash?')) {
                                setNotes(v => v.filter(n => !n.deleted));
                                setSelected(null);
                              }
                            }}
                            className="text-[11px] font-semibold text-red-600 hover:underline dark:text-red-400"
                          >
                            {isNl ? 'Prullenbak legen' : 'Empty trash'}
                          </button>
                        )}
                      </div>
                      {sortedDeleted.map(n => (
                        <div
                          key={n.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelected(n.id);
                            setViewMode('trash');
                          }}
                          className={`group flex h-8 w-full cursor-pointer items-center justify-between rounded-lg px-2 text-left text-sm ${
                            selected === n.id ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-medium' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {renderNoteIcon(n.icon, n.color, "h-[19px] w-[19px] shrink-0 opacity-70")}
                            <span className="min-w-0 truncate">{n.title}</span>
                          </div>
                        </div>
                      ))}
                      {deletedNotes.length === 0 && (
                        <div className="py-8 text-center text-xs text-slate-400">
                          {isNl ? 'De prullenbak is leeg.' : 'Trash is empty.'}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {folders.filter(f => !f.parent).map(f => renderFolder(f))}
                      {sortedActive.filter(n => !n.folder).map(n => renderNote(n))}
                      {sortedActive.length === 0 && folders.length === 0 && (
                        <div className="py-8 text-center text-xs text-slate-400">
                          {isNl ? 'Geen notities. Maak een nieuwe notitie aan.' : 'No notes. Create a new note.'}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom section: Library / Trash toggle */}
          {!collapsed && (
            <div className="border-t p-2 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setViewMode(v => v === 'trash' ? 'library' : 'trash');
                  setSelected(null);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                  viewMode === 'trash'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Trash className="h-3.5 w-3.5" />
                  <span>{isNl ? 'Prullenbak' : 'Trash'}</span>
                </div>
                {deletedNotes.length > 0 && (
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {deletedNotes.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </aside>

        <main className={`flex flex-col h-full min-w-0 overflow-hidden relative ${
          isMobile && !selected && viewMode !== 'library-overview' ? 'hidden' : 'flex'
        }`}>
          {note ? (
            <>
              {/* Trash Notice Banner */}
              {note.deleted && (
                <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300 shrink-0">
                  <div className="flex items-center gap-2 font-medium">
                    <Trash2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{isNl ? 'Deze notitie bevindt zich in de prullenbak.' : 'This note is in the trash.'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNotes(v => v.map(item => item.id === note.id ? { ...item, deleted: null, updated: Date.now() } : item));
                        setViewMode('library');
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                      {isNl ? 'Herstellen' : 'Restore'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNotes(v => v.filter(item => item.id !== note.id));
                        setSelected(null);
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {isNl ? 'Definitief verwijderen' : 'Delete permanently'}
                    </button>
                  </div>
                </div>
              )}

              {/* Note Header */}
              <div className="flex items-center gap-2 sm:gap-3 border-b px-3 sm:px-4 py-3 dark:border-slate-800 shrink-0">
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0 mr-0.5"
                    title={isNl ? 'Terug naar notities' : 'Back to notes'}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}

                <button
                  type="button"
                  title={isNl ? 'Icoon & kleur aanpassen' : 'Customize icon & color'}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setIconPopover({ item: note, anchorRect: rect });
                  }}
                  className="rounded p-0.5 hover:opacity-85 transition-transform hover:scale-105 shrink-0 flex items-center justify-center"
                >
                  {renderNoteIcon(note.icon, note.color, "h-7 w-7 sm:h-8 sm:w-8")}
                </button>

                {/* Title */}
                <div className="flex items-center min-w-0 flex-1">
                  <input
                    className="w-full bg-transparent border-0 text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white p-0 m-0 shadow-none outline-none focus:ring-0 focus:outline-none leading-none tracking-tight"
                    value={note.title}
                    disabled={Boolean(note.deleted)}
                    placeholder={isNl ? 'Naamloze notitie' : 'Untitled note'}
                    onChange={e => {
                      const newTitle = e.target.value;
                      setNotes(v => {
                        const next = v.map(n => n.id === note.id ? { ...n, title: newTitle, updated: Date.now() } : n);
                        try {
                          localStorage.setItem('biba_notes_v1', JSON.stringify(next));
                        } catch {}
                        return next;
                      });
                    }}
                  />
                </div>

                {!note.deleted && (
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Last modified date: Hidden on mobile, shown in Note body on mobile */}
                    <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500 shrink-0 select-none mr-1 font-medium">
                      {isNl ? 'Laatst bewerkt:' : 'Last modified:'} {formatHeaderDate(note.updated || note.created)}
                    </span>

                    {/* ... Actions Menu Dropdown */}
                    <div className="relative" ref={headerMenuRef}>
                      <button
                        type="button"
                        title={isNl ? 'Opties' : 'Options'}
                        onClick={() => {
                          setHeaderMenuOpen(v => !v);
                          setHeaderSubmenu(null);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {headerMenuOpen && (
                        <ViewportPanel
                          className="absolute right-0 top-full mt-1.5 z-40 w-56 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                          onClick={e => e.stopPropagation()}
                          onMouseLeave={() => setHeaderSubmenu(null)}
                        >
                          {/* Add / Manage tags */}
                          <button
                            type="button"
                            onMouseEnter={() => setHeaderSubmenu(null)}
                            onClick={() => {
                              setHeaderMenuOpen(false);
                              setHeaderSubmenu(null);
                              setTagModal({ note, tags: note.tags || [] });
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{isNl ? 'Labels beheren / toevoegen' : 'Add / manage tags'}</span>
                          </button>

                          {/* Export Submenu */}
                          <div
                            className="relative"
                            onMouseEnter={() => setHeaderSubmenu('export')}
                          >
                            <button
                              type="button"
                              onClick={() => setHeaderSubmenu(s => s === 'export' ? null : 'export')}
                              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors ${
                                headerSubmenu === 'export' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>{isNl ? 'Exporteer' : 'Export'}</span>
                              </div>
                              <ChevronRight className="h-3 w-3 text-slate-400" />
                            </button>

                            {headerSubmenu === 'export' && (
                              <ViewportPanel
                                className="absolute right-full top-0 mr-1.5 w-44 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-2xl dark:border-slate-700 dark:bg-slate-900 z-50"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHeaderMenuOpen(false);
                                    setHeaderSubmenu(null);
                                    exportMarkdown();
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                                  <span>Markdown (.md)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHeaderMenuOpen(false);
                                    setHeaderSubmenu(null);
                                    exportPdf();
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  <Download className="h-3.5 w-3.5 text-slate-400" />
                                  <span>PDF (.pdf)</span>
                                </button>
                              </ViewportPanel>
                            )}
                          </div>

                          {/* Move Submenu */}
                          <div
                            className="relative"
                            onMouseEnter={() => setHeaderSubmenu('move')}
                          >
                            <button
                              type="button"
                              onClick={() => setHeaderSubmenu(s => s === 'move' ? null : 'move')}
                              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors ${
                                headerSubmenu === 'move' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <FolderInput className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>{isNl ? 'Verplaatsen' : 'Move'}</span>
                              </div>
                              <ChevronRight className="h-3 w-3 text-slate-400" />
                            </button>

                            {headerSubmenu === 'move' && (
                              <ViewportPanel
                                className="absolute right-full top-0 mr-1.5 w-48 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-2xl dark:border-slate-700 dark:bg-slate-900 z-50"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNotes(v => v.map(n => n.id === note.id ? { ...n, folder: null, updated: Date.now() } : n));
                                    setHeaderMenuOpen(false);
                                    setHeaderSubmenu(null);
                                  }}
                                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                    !note.folder ? 'font-semibold text-teal-600 dark:text-teal-400' : 'text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  <Folder className="h-3.5 w-3.5 text-slate-400" />
                                  <span>{isNl ? 'Hoofdmap' : 'Root'}</span>
                                </button>
                                {folders.map(f => (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => {
                                      setNotes(v => v.map(n => n.id === note.id ? { ...n, folder: f.id, updated: Date.now() } : n));
                                      setHeaderMenuOpen(false);
                                      setHeaderSubmenu(null);
                                    }}
                                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 truncate ${
                                      note.folder === f.id ? 'font-semibold text-teal-600 dark:text-teal-400' : 'text-slate-700 dark:text-slate-200'
                                    }`}
                                  >
                                    <Folder className="h-3.5 w-3.5 shrink-0" fill={f.color || '#94a3b8'} style={{ color: f.color || '#94a3b8' }} />
                                    <span className="truncate">{f.name}</span>
                                  </button>
                                ))}
                              </ViewportPanel>
                            )}
                          </div>

                          {/* Change Color & Icon */}
                          <button
                            type="button"
                            onMouseEnter={() => setHeaderSubmenu(null)}
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setIconPopover({ item: note, anchorRect: rect });
                              setHeaderMenuOpen(false);
                              setHeaderSubmenu(null);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Palette className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{isNl ? 'Icoon & kleur wijzigen' : 'Change icon & color'}</span>
                          </button>

                          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

                          {/* Delete */}
                          <button
                            type="button"
                            onMouseEnter={() => setHeaderSubmenu(null)}
                            onClick={() => {
                              setNotes(v => v.map(n => n.id === note.id ? { ...n, deleted: Date.now() } : n));
                              setSelected(null);
                              setHeaderMenuOpen(false);
                              setHeaderSubmenu(null);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors font-medium"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                            <span>{isNl ? 'Verwijderen' : 'Delete'}</span>
                          </button>
                        </ViewportPanel>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {!note.deleted && (
                <div className="shrink-0">
                  <Toolbar editorRef={editorRef} onContentChange={saveContent} lang={lang} note={note} />
                  <FloatingToolbar
                    editorRef={editorRef}
                    onContentChange={saveContent}
                    onBeforeCommand={() => commitHistory('command')}
                    lang={lang}
                  />
                </div>
              )}

              {/* Note Body: Scrolls independently */}
              <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex justify-end px-6 pt-2 pb-0 sm:hidden shrink-0">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium select-none">
                    {formatHeaderDate(note.updated || note.created)}
                  </span>
                </div>
                <div
                  ref={editorRef}
                  contentEditable={!note.deleted}
                  dir="ltr"
                  suppressContentEditableWarning
                  onInput={saveContent}
                  onKeyUp={saveContent}
                  onBlur={saveContent}
                  onKeyDown={handleEditorKeyDown}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onPaste={handlePaste}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onBeforeInput={handleBeforeInput}
                  onContextMenu={handleEditorContextMenu}
                  className="note-editor flex-1 overflow-y-auto p-4 sm:p-6 text-left text-sm leading-6 text-slate-700 outline-none dark:text-slate-200"
                />
              </div>
            </>
          ) : viewMode === 'trash' ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              {isNl ? 'Selecteer een verwijderde notitie.' : 'Select a deleted note.'}
            </div>
          ) : (
            renderLibraryOverview()
          )}
        </main>
      </div>

      <ContextMenu menu={menu} folders={folders} onClose={() => setMenu(null)} onAction={action} isNl={isNl} />

      {/* Link Context Menu */}
      {linkMenu && (
        <ViewportPanel
          id="note-link-menu"
          className="fixed z-[160] w-52 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          style={{ left: linkMenu.x, top: linkMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 truncate max-w-full">
            {linkMenu.href || (isNl ? 'Link' : 'Link')}
          </div>
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

          {/* Open link */}
          <button
            type="button"
            onClick={() => {
              const href = linkMenu.href;
              setLinkMenu(null);
              if (href) {
                if (window.electronAPI?.openExternal) {
                  window.electronAPI.openExternal(href);
                } else {
                  window.open(href, '_blank', 'noopener,noreferrer');
                }
              }
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>{isNl ? 'Link openen' : 'Open link'}</span>
          </button>

          {/* Copy link */}
          <button
            type="button"
            onClick={() => {
              const href = linkMenu.href;
              setLinkMenu(null);
              if (href) {
                navigator.clipboard?.writeText(href);
              }
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>{isNl ? 'Link kopiëren' : 'Copy link'}</span>
          </button>

          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

          {/* Remove link */}
          <button
            type="button"
            onClick={() => {
              const el = linkMenu.linkEl;
              setLinkMenu(null);
              if (el && editorRef.current?.contains(el)) {
                commitHistory('unlink');
                const parent = el.parentNode;
                if (parent) {
                  while (el.firstChild) {
                    parent.insertBefore(el.firstChild, el);
                  }
                  el.remove();
                }
                saveContent('unlink');
              }
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors font-medium"
          >
            <Unlink className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <span>{isNl ? 'Link verwijderen' : 'Remove link'}</span>
          </button>
        </ViewportPanel>
      )}

      {/* Image Context Menu (Apple Notes style 3 sizes: Klein, Middel, Groot) */}
      {imageMenu && (
        <ViewportPanel
          id="note-image-menu"
          className="fixed z-[160] w-52 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          style={{ left: imageMenu.x, top: imageMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {isNl ? 'Formaat afbeelding' : 'Image size'}
          </div>

          {/* Small Preset */}
          <button
            type="button"
            onClick={() => {
              commitHistory('image-resize');
              imageMenu.wrapperEl?.setAttribute('data-size', 'small');
              setImageMenu(null);
              saveContent('image-resize');
            }}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
              imageMenu.currentSize === 'small'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <span>{isNl ? 'Klein' : 'Small'}</span>
            {imageMenu.currentSize === 'small' && <span className="text-teal-600 dark:text-teal-400 font-bold">✓</span>}
          </button>

          {/* Medium Preset */}
          <button
            type="button"
            onClick={() => {
              commitHistory('image-resize');
              imageMenu.wrapperEl?.setAttribute('data-size', 'medium');
              setImageMenu(null);
              saveContent('image-resize');
            }}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
              imageMenu.currentSize === 'medium' || !imageMenu.currentSize
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <span>{isNl ? 'Middel' : 'Medium'}</span>
            {(imageMenu.currentSize === 'medium' || !imageMenu.currentSize) && <span className="text-teal-600 dark:text-teal-400 font-bold">✓</span>}
          </button>

          {/* Large Preset */}
          <button
            type="button"
            onClick={() => {
              commitHistory('image-resize');
              imageMenu.wrapperEl?.setAttribute('data-size', 'large');
              setImageMenu(null);
              saveContent('image-resize');
            }}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
              imageMenu.currentSize === 'large'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <span>{isNl ? 'Groot' : 'Large'}</span>
            {imageMenu.currentSize === 'large' && <span className="text-teal-600 dark:text-teal-400 font-bold">✓</span>}
          </button>

          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

          {/* Copy Image Source / URL */}
          <button
            type="button"
            onClick={() => {
              const src = imageMenu.imgEl?.src || '';
              setImageMenu(null);
              if (src) {
                navigator.clipboard?.writeText(src);
              }
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>{isNl ? 'Afbeelding kopiëren' : 'Copy image'}</span>
          </button>

          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

          {/* Delete Image */}
          <button
            type="button"
            onClick={() => {
              commitHistory('image-delete');
              imageMenu.wrapperEl?.remove();
              setImageMenu(null);
              saveContent('image-delete');
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors font-medium"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <span>{isNl ? 'Afbeelding verwijderen' : 'Delete image'}</span>
          </button>
        </ViewportPanel>
      )}

      {/* Table Overlay Handles, Selection Frame, and Context Menus */}
      {tableOverlay && (
        <div id="note-table-controls">
          {/* Apple Notes Selection Frame (Amber border with yellow corner handles) */}
          {tableOverlay.selectedType === 'row' && tableOverlay.rowRect && (
            <ViewportPanel
              className="pointer-events-none fixed z-30 rounded-[2px] border-2 border-amber-500 bg-amber-500/10 shadow-xs"
              style={{
                top: tableOverlay.rowRect.top,
                left: tableOverlay.rowRect.left,
                width: tableOverlay.rowRect.width,
                height: tableOverlay.rowRect.height,
              }}
            >
              <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full border border-white bg-amber-500 shadow-xs" />
              <div className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-white bg-amber-500 shadow-xs" />
              <div className="absolute -left-1 -bottom-1 h-2 w-2 rounded-full border border-white bg-amber-500 shadow-xs" />
              <div className="absolute -right-1 -bottom-1 h-2 w-2 rounded-full border border-white bg-amber-500 shadow-xs" />
            </ViewportPanel>
          )}

          {tableOverlay.selectedType === 'col' && tableOverlay.tableRect && tableOverlay.colRect && (
            <ViewportPanel
              className="pointer-events-none fixed z-30 rounded-[2px] border-2 border-amber-500 bg-amber-500/10 shadow-xs"
              style={{
                top: tableOverlay.tableRect.top,
                left: tableOverlay.colRect.left,
                width: tableOverlay.colRect.width,
                height: tableOverlay.tableRect.height,
              }}
            >
              <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full border border-white bg-amber-500 shadow-xs" />
              <div className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-white bg-amber-500 shadow-xs" />
              <div className="absolute -left-1 -bottom-1 h-2 w-2 rounded-full border border-white bg-amber-500 shadow-xs" />
              <div className="absolute -right-1 -bottom-1 h-2 w-2 rounded-full border border-white bg-amber-500 shadow-xs" />
            </ViewportPanel>
          )}

          {tableOverlay.selectedType === 'range' && tableOverlay.selectionRect && (
            <ViewportPanel
              className="pointer-events-none fixed z-30 rounded-[2px] border-2 border-amber-500 bg-amber-500/10 shadow-xs"
              style={{
                top: tableOverlay.selectionRect.top,
                left: tableOverlay.selectionRect.left,
                width: tableOverlay.selectionRect.width,
                height: tableOverlay.selectionRect.height,
              }}
            >
              <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full border border-white bg-amber-500 shadow-xs" />
              <div className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-white bg-amber-500 shadow-xs" />
              <div className="absolute -left-1 -bottom-1 h-2 w-2 rounded-full border border-white bg-amber-500 shadow-xs" />
              <div className="absolute -right-1 -bottom-1 h-2 w-2 rounded-full border border-white bg-amber-500 shadow-xs" />
            </ViewportPanel>
          )}

          {/* Row handle (...) */}
          <button
            type="button"
            title={isNl ? 'Rijopties' : 'Row options'}
            onClick={(e) => {
              e.stopPropagation();
              setTableOverlay(prev => ({
                ...prev,
                selectedType: prev?.selectedType === 'row' ? null : 'row',
                rowMenuOpen: !prev?.rowMenuOpen,
                colMenuOpen: false,
              }));
            }}
            className={`fixed z-40 flex h-5 w-4.5 items-center justify-center rounded shadow-xs transition-colors cursor-pointer ${
              tableOverlay.selectedType === 'row'
                ? 'bg-amber-500 text-white font-bold'
                : 'bg-slate-200/95 text-slate-600 hover:bg-amber-500 hover:text-white dark:bg-slate-700/95 dark:text-slate-300 dark:hover:bg-amber-500 dark:hover:text-white'
            }`}
            style={{ left: tableOverlay.rowLeft, top: tableOverlay.rowTop }}
          >
            <MoreHorizontal className="h-3 w-3 rotate-90" />
          </button>

          {/* Column handle (...) */}
          <button
            type="button"
            title={isNl ? 'Kolomopties' : 'Column options'}
            onClick={(e) => {
              e.stopPropagation();
              setTableOverlay(prev => ({
                ...prev,
                selectedType: prev?.selectedType === 'col' ? null : 'col',
                colMenuOpen: !prev?.colMenuOpen,
                rowMenuOpen: false,
              }));
            }}
            className={`fixed z-40 flex h-4.5 w-5 items-center justify-center rounded shadow-xs transition-colors cursor-pointer ${
              tableOverlay.selectedType === 'col'
                ? 'bg-amber-500 text-white font-bold'
                : 'bg-slate-200/95 text-slate-600 hover:bg-amber-500 hover:text-white dark:bg-slate-700/95 dark:text-slate-300 dark:hover:bg-amber-500 dark:hover:text-white'
            }`}
            style={{ left: tableOverlay.colLeft, top: tableOverlay.colTop }}
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>

          {/* Row Menu Popup */}
          {tableOverlay.rowMenuOpen && (() => {
            const rowMenuWidth = 210;
            const rowMenuHeight = 310;
            let rowMenuLeft = tableOverlay.rowLeft + 24;
            if (rowMenuLeft + rowMenuWidth > window.innerWidth - 12) {
              rowMenuLeft = Math.max(10, tableOverlay.rowLeft - rowMenuWidth - 8);
            }
            let rowMenuTop = tableOverlay.rowTop;
            if (rowMenuTop + rowMenuHeight > window.innerHeight - 16) {
              rowMenuTop = Math.max(10, tableOverlay.rowTop - rowMenuHeight + 24);
            }

            return (
              <ViewportPanel
                className="fixed z-[250] w-52 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                style={{ left: rowMenuLeft, top: rowMenuTop }}
                onClick={e => e.stopPropagation()}
              >
                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {isNl ? 'Rijopties' : 'Row options'}
                </div>

                {/* Add row above */}
                <button
                  type="button"
                  onClick={handleInsertRowAbove}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <ArrowUp className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{isNl ? 'Rij hierboven invoegen' : 'Add row above'}</span>
                </button>

                {/* Add row below */}
                <button
                  type="button"
                  onClick={handleInsertRowBelow}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <ArrowDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{isNl ? 'Rij hieronder invoegen' : 'Add row below'}</span>
                </button>

                <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

                {/* Copy row */}
                <button
                  type="button"
                  onClick={handleCopyRow}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{isNl ? 'Rij kopiëren' : 'Copy row'}</span>
                </button>

                {/* Paste row */}
                <button
                  type="button"
                  disabled={!copiedTableData || copiedTableData.type !== 'row'}
                  onClick={handlePasteRow}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{isNl ? 'Rij plakken' : 'Paste row'}</span>
                </button>

                <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

                {/* Text alignment in row */}
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[11px] text-slate-500">{isNl ? 'Uitlijning' : 'Alignment'}</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      title={isNl ? 'Links' : 'Left'}
                      onClick={() => {
                        if (tableOverlay.row) {
                          Array.from(tableOverlay.row.children).forEach(c => { c.style.textAlign = 'left'; });
                          saveContent('align-row');
                        }
                      }}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <AlignLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title={isNl ? 'Centreer' : 'Center'}
                      onClick={() => {
                        if (tableOverlay.row) {
                          Array.from(tableOverlay.row.children).forEach(c => { c.style.textAlign = 'center'; });
                          saveContent('align-row');
                        }
                      }}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <AlignCenter className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title={isNl ? 'Rechts' : 'Right'}
                      onClick={() => {
                        if (tableOverlay.row) {
                          Array.from(tableOverlay.row.children).forEach(c => { c.style.textAlign = 'right'; });
                          saveContent('align-row');
                        }
                      }}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <AlignRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

                {/* Delete row */}
                <button
                  type="button"
                  onClick={handleDeleteRow}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <span>{isNl ? 'Rij verwijderen' : 'Delete row'}</span>
                </button>

                {/* Delete table */}
                <button
                  type="button"
                  onClick={handleDeleteTable}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors font-medium"
                >
                  <Trash className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <span>{isNl ? 'Tabel verwijderen' : 'Delete table'}</span>
                </button>
              </ViewportPanel>
            );
          })()}

          {/* Column Menu Popup */}
          {tableOverlay.colMenuOpen && (() => {
            const colMenuWidth = 210;
            const colMenuHeight = 310;
            let colMenuLeft = tableOverlay.colLeft;
            if (colMenuLeft + colMenuWidth > window.innerWidth - 12) {
              colMenuLeft = Math.max(10, window.innerWidth - colMenuWidth - 12);
            }
            let colMenuTop = tableOverlay.colTop + 24;
            if (colMenuTop + colMenuHeight > window.innerHeight - 16) {
              colMenuTop = Math.max(10, tableOverlay.colTop - colMenuHeight - 8);
            }

            return (
              <ViewportPanel
                className="fixed z-[250] w-52 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                style={{ left: colMenuLeft, top: colMenuTop }}
                onClick={e => e.stopPropagation()}
              >
                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {isNl ? 'Kolomopties' : 'Column options'}
                </div>

                {/* Add column left */}
                <button
                  type="button"
                  onClick={handleInsertColLeft}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{isNl ? 'Kolom links invoegen' : 'Add column left'}</span>
                </button>

                {/* Add column right */}
                <button
                  type="button"
                  onClick={handleInsertColRight}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{isNl ? 'Kolom rechts invoegen' : 'Add column right'}</span>
                </button>

                <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

                {/* Copy column */}
                <button
                  type="button"
                  onClick={handleCopyCol}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{isNl ? 'Kolom kopiëren' : 'Copy column'}</span>
                </button>

                {/* Paste column */}
                <button
                  type="button"
                  disabled={!copiedTableData || copiedTableData.type !== 'col'}
                  onClick={handlePasteCol}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{isNl ? 'Kolom plakken' : 'Paste column'}</span>
                </button>

                <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

                {/* Text alignment in column */}
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[11px] text-slate-500">{isNl ? 'Uitlijning' : 'Alignment'}</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      title={isNl ? 'Links' : 'Left'}
                      onClick={() => {
                        if (tableOverlay.table && tableOverlay.colIndex !== undefined) {
                          Array.from(tableOverlay.table.querySelectorAll('tr')).forEach(tr => {
                            const colCell = tr.children[tableOverlay.colIndex];
                            if (colCell) colCell.style.textAlign = 'left';
                          });
                          saveContent('align-col');
                        }
                      }}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <AlignLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title={isNl ? 'Centreer' : 'Center'}
                      onClick={() => {
                        if (tableOverlay.table && tableOverlay.colIndex !== undefined) {
                          Array.from(tableOverlay.table.querySelectorAll('tr')).forEach(tr => {
                            const colCell = tr.children[tableOverlay.colIndex];
                            if (colCell) colCell.style.textAlign = 'center';
                          });
                          saveContent('align-col');
                        }
                      }}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <AlignCenter className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title={isNl ? 'Rechts' : 'Right'}
                      onClick={() => {
                        if (tableOverlay.table && tableOverlay.colIndex !== undefined) {
                          Array.from(tableOverlay.table.querySelectorAll('tr')).forEach(tr => {
                            const colCell = tr.children[tableOverlay.colIndex];
                            if (colCell) colCell.style.textAlign = 'right';
                          });
                          saveContent('align-col');
                        }
                      }}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <AlignRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

                {/* Delete column */}
                <button
                  type="button"
                  onClick={handleDeleteCol}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <span>{isNl ? 'Kolom verwijderen' : 'Delete column'}</span>
                </button>

                {/* Delete table */}
                <button
                  type="button"
                  onClick={handleDeleteTable}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors font-medium"
                >
                  <Trash className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <span>{isNl ? 'Tabel verwijderen' : 'Delete table'}</span>
                </button>
              </ViewportPanel>
            );
          })()}
        </div>
      )}

      {iconPopover && (
        <IconColorPopover
          popover={iconPopover}
          isNl={isNl}
          onClose={() => setIconPopover(null)}
          onSave={(icon, color) => {
            if (iconPopover.item.type === 'folder') {
              setFolders(v => {
                const next = v.map(f => f.id === iconPopover.item.id ? { ...f, icon, color } : f);
                try {
                  localStorage.setItem('biba_note_folders_v2', JSON.stringify(next));
                } catch {}
                return next;
              });
            } else {
              setNotes(v => {
                const next = v.map(n => n.id === iconPopover.item.id ? { ...n, icon, color, updated: Date.now() } : n);
                try {
                  localStorage.setItem('biba_notes_v1', JSON.stringify(next));
                } catch {}
                return next;
              });
            }
          }}
        />
      )}

      {renameDialog && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{isNl ? 'Naam wijzigen' : 'Rename'} {renameDialog.item.type === 'folder' ? (isNl ? 'map' : 'folder') : (isNl ? 'notitie' : 'note')}</h3>
            <input
              autoFocus
              className={`${fieldClass} mt-3 w-full`}
              value={renameDialog.name}
              onChange={e => setRenameDialog({ ...renameDialog, name: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter' && renameDialog.name.trim()) {
                  const name = renameDialog.name.trim();
                  if (renameDialog.item.type === 'folder') {
                    setFolders(v => v.map(x => x.id === renameDialog.item.id ? { ...x, name } : x));
                  } else {
                    setNotes(v => v.map(x => x.id === renameDialog.item.id ? { ...x, title: name, updated: Date.now() } : x));
                  }
                  setRenameDialog(null);
                } else if (e.key === 'Escape') {
                  setRenameDialog(null);
                }
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className={secondaryButton} onClick={() => setRenameDialog(null)}>{isNl ? 'Annuleren' : 'Cancel'}</button>
              <button
                className={primaryButton}
                disabled={!renameDialog.name.trim()}
                onClick={() => {
                  const name = renameDialog.name.trim();
                  if (!name) return;
                  if (renameDialog.item.type === 'folder') {
                    setFolders(v => v.map(x => x.id === renameDialog.item.id ? { ...x, name } : x));
                  } else {
                    setNotes(v => v.map(x => x.id === renameDialog.item.id ? { ...x, title: name, updated: Date.now() } : x));
                  }
                  setRenameDialog(null);
                }}
              >
                {isNl ? 'Opslaan' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {tagModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <Tag className="h-4 w-4 text-slate-600 dark:text-slate-300 shrink-0" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                  {isNl ? 'Labels beheren' : 'Manage labels'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTagModal(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {/* Current tags */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  {isNl ? 'Huidige labels' : 'Current labels'}
                </label>
                <div className="flex flex-wrap items-center gap-1.5 min-h-[32px] p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                  {(tagModal.tags || []).map((t, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 shadow-2xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                    >
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextTags = tagModal.tags.filter((_, i) => i !== idx);
                          setTagModal({ ...tagModal, tags: nextTags });
                          setNotes(v => v.map(n => n.id === tagModal.note.id ? { ...n, tags: nextTags, updated: Date.now() } : n));
                        }}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  {(!tagModal.tags || tagModal.tags.length === 0) && (
                    <span className="text-xs text-slate-400 italic px-1">
                      {isNl ? 'Nog geen labels toegevoegd' : 'No labels added yet'}
                    </span>
                  )}
                </div>
              </div>

              {/* Add new tag */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  {isNl ? 'Nieuw label toevoegen' : 'Add new label'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={isNl ? 'Typ een label…' : 'Type a tag…'}
                    id="tag-modal-input"
                    className={`${fieldClass} flex-1 text-xs`}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        e.preventDefault();
                        const val = e.target.value.trim().toLowerCase();
                        if (!tagModal.tags.includes(val)) {
                          const nextTags = [...tagModal.tags, val];
                          setTagModal({ ...tagModal, tags: nextTags });
                          setNotes(v => v.map(n => n.id === tagModal.note.id ? { ...n, tags: nextTags, updated: Date.now() } : n));
                        }
                        e.target.value = '';
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('tag-modal-input');
                      if (input && input.value.trim()) {
                        const val = input.value.trim().toLowerCase();
                        if (!tagModal.tags.includes(val)) {
                          const nextTags = [...tagModal.tags, val];
                          setTagModal({ ...tagModal, tags: nextTags });
                          setNotes(v => v.map(n => n.id === tagModal.note.id ? { ...n, tags: nextTags, updated: Date.now() } : n));
                        }
                        input.value = '';
                      }
                    }}
                    className="flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white shrink-0"
                  >
                    <Plus className="h-3 w-3" />
                    <span>{isNl ? 'Toevoegen' : 'Add'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => setTagModal(null)}
              >
                {isNl ? 'Klaar' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
