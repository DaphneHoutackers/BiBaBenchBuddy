import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Atom,
  Bold,
  Bookmark,
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  Dna,
  Download,
  Eraser,
  FilePlus,
  FileText,
  Flame,
  FlaskConical,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Hash,
  Heading1,
  Heading2,
  Heading3,
  Heart,
  Highlighter,
  Italic,
  Layers,
  Lightbulb,
  Link,
  List,
  ListOrdered,
  Microscope,
  MoreHorizontal,
  NotebookPen,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  Quote,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Star,
  Strikethrough,
  Tag,
  Target,
  Trash,
  Trash2,
  Underline,
  X,
  Zap,
} from 'lucide-react';
import MacColorPicker from '@/components/shared/MacColorPicker';
import { PALETTE, ToolShell, fieldClass, primaryButton, secondaryButton, uid, useStoredState } from './toolUtils.jsx';

const COLORS = ['#475569', '#ef4444', '#f59e0b', '#eab308', '#10b981', '#14b8a6', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'];

const NOTE_ICON_MAP = {
  NotebookPen,
  FileText,
  CheckSquare,
  FlaskConical,
  Dna,
  Microscope,
  Atom,
  Bookmark,
  Sparkles,
  Star,
  Tag,
  Calendar,
  Clock,
  Target,
  Lightbulb,
  Layers,
  BookOpen,
  Heart,
  Shield,
  Pin,
  List,
  Hash,
  Flame,
  Zap,
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

  const normalizedTag = targetTag.toLowerCase().replace(/[<>]/g, '');
  const newBlock = document.createElement(normalizedTag);
  newBlock.innerHTML = innerHtml;
  newBlock.style.fontSize = '';
  newBlock.style.fontWeight = '';
  newBlock.style.marginLeft = '';
  newBlock.style.paddingLeft = '';
  newBlock.style.textIndent = '';
  newBlock.className = '';
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
  const normalizedTag = targetTag.toLowerCase().replace(/[<>]/g, '');

  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const node = container.nodeType === 3 ? container.parentElement : container;

    const li = node?.closest('li');
    if (li && editorRef.current?.contains(li)) {
      extractListItemAsBlock(li, normalizedTag);
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
        if (normalizedTag === 'p') {
          newElem.style.fontSize = '';
          newElem.style.fontWeight = '';
          newElem.style.marginLeft = '';
          newElem.style.paddingLeft = '';
          newElem.style.textIndent = '';
          newElem.className = '';
          newElem.querySelectorAll('b, strong').forEach(b => {
            b.replaceWith(...b.childNodes);
          });
        }
        block.replaceWith(newElem);
        placeCaret(newElem);
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
  editorRef.current?.focus();
  const selection = window.getSelection();
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

  const node = selection?.anchorNode?.nodeType === 3 ? selection.anchorNode.parentElement : selection?.anchorNode;
  const currentBlock = node?.closest?.('p, div, h1, h2, h3, h4, blockquote');
  const currentBlockText = currentBlock && currentBlock !== editorRef.current ? currentBlock.innerText.replace(/\u00a0/g, '').trim() : '';

  if (currentBlock && currentBlock !== editorRef.current && currentBlockText && !currentBlock.closest('ul[data-checklist]')) {
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

  const marker = `check-${Date.now()}`;
  exec('insertHTML', `<ul data-checklist="true"><li><label contenteditable="false"><input type="checkbox" aria-label="Checklist item"></label><span data-caret="${marker}"><br></span></li></ul>`);
  const target = editorRef.current?.querySelector(`[data-caret="${marker}"]`);
  if (target) {
    target.removeAttribute('data-caret');
    placeCaret(target);
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
  const [headingOpen, setHeadingOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [currentBlock, setCurrentBlock] = useState('p');
  const toolbarRef = useRef(null);

  const isNl = lang === 'nl';

  const run = (cmd, value = null) => {
    onBeforeCommand?.();
    editorRef.current?.focus();
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
    editorRef.current?.focus();
    exec('insertHTML', `<div class="note-code" contenteditable="false"><button data-copy-code aria-label="Copy code">Copy</button><pre contenteditable="true"><code>${escapeHtml(selection)}</code></pre></div><p><br></p>`);
    onContentChange?.();
    updatePosition();
  };

  const addLink = () => {
    if (!linkName.trim() || !linkUrl.trim()) return;
    onBeforeCommand?.();
    editorRef.current?.focus();
    const finalUrl = linkUrl.trim().startsWith('http://') || linkUrl.trim().startsWith('https://')
      ? linkUrl.trim()
      : `https://${linkUrl.trim()}`;
    exec('insertHTML', `<a href="${finalUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkName.trim())}</a>`);
    setLinkOpen(false);
    setLinkName('');
    setLinkUrl('');
    onContentChange?.();
    updatePosition();
  };

  const updatePosition = () => {
    if (!editorRef.current) {
      setPosition(null);
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setPosition(null);
      setHeadingOpen(false);
      setHighlightOpen(false);
      setLinkOpen(false);
      return;
    }

    if (!editorRef.current.contains(selection.anchorNode)) {
      setPosition(null);
      return;
    }

    const node = selection.anchorNode.nodeType === 3 ? selection.anchorNode.parentElement : selection.anchorNode;
    const block = node?.closest('h1, h2, h3, h4, p, blockquote');
    const tagName = block ? block.tagName.toLowerCase() : 'p';
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
    if (!headingOpen && !highlightOpen && !linkOpen) return;
    const handleOutsideClick = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setHeadingOpen(false);
        setHighlightOpen(false);
        setLinkOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [headingOpen, highlightOpen, linkOpen]);

  if (!position) return null;

  const headingLabelMap = isNl ? {
    h1: 'Titel',
    h2: 'Koptekst',
    h3: 'Subkop',
    h4: 'Kop 3',
    p: 'Hoofdtekst',
  } : {
    h1: 'Title',
    h2: 'Heading',
    h3: 'Subheading',
    h4: 'Heading 3',
    p: 'Normal',
  };

  const headingOptions = isNl ? [
    ['h1', 'Titel', '⇧⌘T'],
    ['h2', 'Koptekst', '⇧⌘H'],
    ['h3', 'Subkop', '⇧⌘J'],
    ['h4', 'Kop 3', '⇧⌘I'],
    ['p', 'Hoofdtekst', '⇧⌘B'],
  ] : [
    ['h1', 'Title', '⇧⌘T'],
    ['h2', 'Heading', '⇧⌘H'],
    ['h3', 'Subheading', '⇧⌘J'],
    ['h4', 'Heading 3', '⇧⌘I'],
    ['p', 'Normal', '⇧⌘B'],
  ];

  const openAbove = position.top > 220;

  return (
    <div
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

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setHeadingOpen((v) => !v);
            setHighlightOpen(false);
            setLinkOpen(false);
          }}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <span>{headingLabelMap[currentBlock] || (isNl ? 'Hoofdtekst' : 'Normal')}</span>
          <ChevronRight className={`h-3 w-3 transition-transform ${headingOpen ? 'rotate-90' : ''}`} />
        </button>

        {headingOpen && (
          <div
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
                  currentBlock === tag ? 'font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40' : ''
                }`}
              >
                <span>{label}</span>
                <span className="text-[10px] text-slate-400">{shortcut}</span>
              </button>
            ))}
          </div>
        )}
      </div>

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
            const selText = window.getSelection()?.toString() || '';
            setLinkName(selText);
            setLinkUrl('');
            setLinkOpen((v) => !v);
            setHeadingOpen(false);
            setHighlightOpen(false);
          }}
          className={`rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white ${linkOpen ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : ''}`}
        >
          <Link className="h-3.5 w-3.5" />
        </button>

        {linkOpen && (
          <div
            className={`absolute right-0 ${openAbove ? 'bottom-full mb-2' : 'top-full mt-2'} z-30 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900 text-left`}
            onMouseDown={(e) => e.stopPropagation()}
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
                onClick={() => setLinkOpen(false)}
              >
                {isNl ? 'Annuleren' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={!linkName.trim() || !linkUrl.trim()}
                className="rounded-lg bg-pink-600 px-2.5 py-1 text-xs font-medium text-white shadow-xs hover:bg-pink-700 disabled:opacity-50"
                onClick={addLink}
              >
                {isNl ? 'Link invoegen' : 'Insert link'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      <div className="relative">
        <button
          type="button"
          title={isNl ? 'Markeren' : 'Highlight'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setHighlightOpen((v) => !v);
            setHeadingOpen(false);
            setLinkOpen(false);
          }}
          className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <Highlighter className="h-3.5 w-3.5" />
        </button>

        {highlightOpen && (
          <div
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
          </div>
        )}
      </div>
    </div>
  );
}

function Toolbar({ editorRef, onContentChange, lang = 'en' }) {
  const [highlights, setHighlights] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const highlightsRef = useRef(null);
  const linkRef = useRef(null);
  const isNl = lang === 'nl';

  useEffect(() => {
    if (!highlights && !linkOpen) return;
    const handleOutsideClick = (e) => {
      if (highlights && highlightsRef.current && !highlightsRef.current.contains(e.target)) {
        setHighlights(false);
      }
      if (linkOpen && linkRef.current && !linkRef.current.contains(e.target)) {
        setLinkOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [highlights, linkOpen]);

  const onBeforeCommand = () => editorRef.current?.__recordHistory?.('command');
  const run = (cmd, value) => {
    onBeforeCommand();
    editorRef.current?.focus();
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
  const controls = [
    [Eraser, isNl ? 'Opmaak & markering wissen' : 'Remove formatting & highlight', () => clearFormattingAndHighlight(editorRef, onContentChange, onBeforeCommand)],
    [Heading1, isNl ? 'Titel / Kop 1 (⇧⌘T / ⇧⌘H)' : 'Title / Heading 1 (⇧⌘T / ⇧⌘H)', () => setBlockFormat(editorRef, 'h1', onContentChange, onBeforeCommand)],
    [Heading2, isNl ? 'Subkop (⇧⌘J)' : 'Subheading (⇧⌘J)', () => setBlockFormat(editorRef, 'h2', onContentChange, onBeforeCommand)],
    [Heading3, isNl ? 'Kop 3 (⇧⌘I)' : 'Heading 3 (⇧⌘I)', () => setBlockFormat(editorRef, 'h3', onContentChange, onBeforeCommand)],
    [Bold, 'Bold (⌘B)', () => run('bold')],
    [Italic, 'Italic (⌘I)', () => run('italic')],
    [Underline, 'Underline (⌘U)', () => run('underline')],
    [Strikethrough, 'Strikethrough', () => run('strikeThrough')],
    [List, isNl ? 'Opsommingstekenslijst (⇧⌘7)' : 'Bullet list (⇧⌘7)', () => run('insertUnorderedList')],
    [ListOrdered, isNl ? 'Genummerde lijst (⇧⌘9)' : 'Numbered list (⇧⌘9)', () => run('insertOrderedList')],
    [CheckSquare, isNl ? 'Checklist (⇧⌘L)' : 'Checklist (⇧⌘L)', insertChecklist],
    [Quote, isNl ? 'Blokcitaat (⌥⌘\')' : 'Quote (⌥⌘\')', () => toggleQuote(editorRef, onContentChange, onBeforeCommand)],
    [Code2, isNl ? 'Codeblok (⇧⌘M)' : 'Code box (⇧⌘M)', insertCode],
  ];
  return (
    <div className="relative flex flex-wrap items-center gap-1 border-b p-2 dark:border-slate-800">
      {controls.map(([Icon, label, action]) => (
        <button key={label} type="button" title={label} onMouseDown={e => e.preventDefault()} onClick={action} className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200">
          <Icon className="h-4 w-4" />
        </button>
      ))}
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
          <div className="absolute left-0 top-full mt-1.5 z-40 w-72 rounded-xl border bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
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
          </div>
        )}
      </div>

      <div className="relative" ref={highlightsRef}>
        <button
          type="button"
          title={isNl ? 'Markeren' : 'Highlight'}
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            setHighlights(v => !v);
            setLinkOpen(false);
          }}
          className={`rounded p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 ${highlights ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''}`}
        >
          <Highlighter className="h-4 w-4" />
        </button>

        {highlights && (
          <div className="absolute left-0 top-full mt-1.5 z-40 flex items-center gap-1 rounded-xl border bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
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
          </div>
        )}
      </div>

      <button type="button" title={isNl ? 'Scheidingslijn' : 'Divider'} onMouseDown={e => e.preventDefault()} onClick={insertDivider} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
        —
      </button>
    </div>
  );
}

function IconColorPopover({ popover, isNl, onClose, onSave }) {
  const popoverRef = useRef(null);
  const { item, anchorRect } = popover;
  const [selectedIcon, setSelectedIcon] = useState(item.icon || 'NotebookPen');
  const [selectedColor, setSelectedColor] = useState(item.color || COLORS[0]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [onClose]);

  if (!anchorRect) return null;

  let top = anchorRect.bottom + 6;
  let left = anchorRect.left;

  if (top + 320 > window.innerHeight) {
    top = Math.max(10, anchorRect.top - 320);
  }
  if (left + 260 > window.innerWidth) {
    left = Math.max(10, window.innerWidth - 270);
  }

  const CurrentIconComponent = NOTE_ICON_MAP[selectedIcon] || NotebookPen;

  return (
    <div
      ref={popoverRef}
      className="fixed z-[130] w-64 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100"
      style={{ top, left }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 shadow-inner shrink-0">
            <CurrentIconComponent className="h-4 w-4 transition-colors" style={{ color: selectedColor }} />
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
            {isNl ? 'Icoon & kleur' : 'Icon & color'}
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

      {/* 1. Icon Grid */}
      <div className="mt-2.5">
        <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto p-1 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
          {NOTE_ICON_NAMES.map((name) => {
            const IconComp = NOTE_ICON_MAP[name];
            const isSelected = selectedIcon === name;
            return (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => setSelectedIcon(name)}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                  isSelected
                    ? 'bg-white shadow-xs ring-2 ring-pink-500 text-slate-900 dark:bg-slate-700 dark:text-white'
                    : 'text-slate-700 hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/60 dark:hover:text-white'
                }`}
              >
                <IconComp className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Color Swatches */}
      <div className="mt-2.5">
        <div className="grid grid-cols-5 gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedColor(c)}
              className={`h-5 w-full rounded-md transition-transform hover:scale-105 shadow-xs border ${
                selectedColor === c ? 'ring-2 ring-offset-1 ring-slate-800 dark:ring-white scale-105' : 'border-black/10'
              }`}
              style={{ background: c }}
            />
          ))}
        </div>

        <MacColorPicker
          value={selectedColor}
          onChange={(c) => setSelectedColor(c)}
          buttonClassName="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <Palette className="h-3 w-3" />
          {isNl ? 'Aangepaste kleur…' : 'Custom color…'}
        </MacColorPicker>
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
          className="rounded-lg bg-pink-600 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-pink-700"
          onClick={() => {
            onSave(selectedIcon, selectedColor);
            onClose();
          }}
        >
          {isNl ? 'Toepassen' : 'Apply'}
        </button>
      </div>
    </div>
  );
}

function ContextMenu({ menu, folders, onClose, onAction, isNl }) {
  if (!menu) return null;
  const item = menu.item;
  const isFolder = item.type === 'folder';

  const menuItems = [
    { id: 'rename', label: isNl ? 'Naam wijzigen' : 'Rename', icon: Pencil },
    { id: 'icon-color', label: isNl ? 'Icoon & kleur wijzigen' : 'Change icon & color', icon: Palette },
    ...(isFolder ? [
      { id: 'add-folder', label: isNl ? 'Map toevoegen' : 'Add folder', icon: FolderPlus },
      { id: 'add-note', label: isNl ? 'Notitie toevoegen' : 'Add note', icon: FilePlus },
    ] : []),
    { id: 'duplicate', label: isNl ? 'Dupliceren' : 'Duplicate', icon: Copy },
  ];

  return (
    <div className="fixed z-[120] w-56 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-2xl dark:border-slate-700 dark:bg-slate-900" style={{ left: menu.x, top: menu.y }} onClick={e => e.stopPropagation()}>
      <p className="truncate px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.name || item.title}</p>
      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
      {menuItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onAction(id, item)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
        >
          <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>{label}</span>
        </button>
      ))}
      <button
        onClick={() => onAction('move-panel', item)}
        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <FolderInput className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>{isNl ? 'Verplaatsen' : 'Move'}</span>
        </div>
        <ChevronRight className="h-3 w-3 text-slate-400" />
      </button>
      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
      <button
        onClick={() => onAction('delete', item)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
        <span>{isNl ? 'Verwijderen' : 'Delete'}</span>
      </button>
      {menu.panel === 'move' && (
        <div className="absolute left-full top-24 ml-2 w-56 rounded-xl border bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{isNl ? 'Verplaats naar' : 'Move to'}</p>
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          <button onClick={() => onAction('move', item, null)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            <Folder className="h-3.5 w-3.5 text-slate-400" />
            <span>/ {isNl ? 'Hoofdmap' : 'Root directory'}</span>
          </button>
          {folders.filter(f => f.id !== item.id).map(f => (
            <button key={f.id} onClick={() => onAction('move', item, f.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
              <Folder className="h-3.5 w-3.5" fill={f.color || '#94a3b8'} style={{ color: f.color || '#94a3b8' }} />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotesTool({ settings }) {
  const [notes, setNotes] = useStoredState('biba_notes_v1', []);
  const [folders, setFolders] = useStoredState('biba_note_folders_v2', []);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [menu, setMenu] = useState(null);
  const [viewMode, setViewMode] = useState('library'); // 'library' | 'trash'
  const [iconPopover, setIconPopover] = useState(null); // { item, anchorRect }
  const [renameDialog, setRenameDialog] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  const editorRef = useRef(null);
  const exportRef = useRef(null);
  const historyTimerRef = useRef(null);
  const historyRef = useRef({ entries: [], index: -1, lastType: null, time: 0 });
  const note = notes.find(n => n.id === selected);

  const lang = settings?.language || (() => {
    try {
      const s = JSON.parse(localStorage.getItem('biba_bench_buddy_settings') || '{}');
      return s.language || 'en';
    } catch {
      return 'en';
    }
  })();
  const isNl = lang === 'nl';

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

  // Immediate autosave function on every single modification
  const saveContent = (eventOrType) => {
    if (!selected || !editorRef.current) return;
    const type = typeof eventOrType === 'string' ? eventOrType : eventOrType?.nativeEvent?.inputType || 'command';
    clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => commitHistory(type), 0);
    const content = editorRef.current.innerHTML;
    setNotes(items => items.map(n => n.id === selected ? { ...n, content, updated: Date.now() } : n));
  };

  const restoreHistory = (redo) => {
    if (!editorRef.current) return;
    const history = historyRef.current;
    const nextIndex = history.index + (redo ? 1 : -1);
    if (nextIndex < 0 || nextIndex >= history.entries.length) return;
    history.index = nextIndex;
    editorRef.current.innerHTML = history.entries[nextIndex];
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
      historyRef.current = { entries: [content], index: 0, lastType: null, time: 0 };
    }
  }, [note?.id]);

  useEffect(() => () => {
    clearTimeout(historyTimerRef.current);
  }, []);

  useEffect(() => {
    const click = (e) => {
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
        saveContentRef.current?.();
      }
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, []);

  const toggleChecklistItem = () => {
    const selection = window.getSelection();
    const node = selection?.anchorNode?.nodeType === 3 ? selection.anchorNode.parentElement : selection?.anchorNode;
    const li = node?.closest('ul[data-checklist] li');
    if (li) {
      const input = li.querySelector('input[type="checkbox"]');
      if (input) {
        input.checked = !input.checked;
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
        exec('insertUnorderedList');
        saveContent(format);
        break;
      case 'number':
        exec('insertOrderedList');
        saveContent(format);
        break;
      case 'checklist':
        insertOrFormatChecklist({ editorRef, onContentChange: saveContent, onBeforeCommand: () => commitHistory('command') });
        break;
      case 'toggle-check':
        toggleChecklistItem();
        break;
      case 'indent':
        exec('indent');
        saveContent('indent');
        break;
      case 'outdent':
        exec('outdent');
        saveContent('outdent');
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

  const createNote = (folder = null) => {
    const item = {
      id: uid(),
      title: 'Untitled note',
      content: '<p><br></p>',
      folder,
      icon: 'NotebookPen',
      color: folders.find(f => f.id === folder)?.color || null,
      updated: Date.now(),
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

  const exportMarkdown = () => {
    if (!note) return;
    const md = htmlToMarkdown(note.content, note.title);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(note.title || 'note').replace(/[/\\?%*:|"<>]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const exportPdf = async () => {
    if (!note) return;
    setExportOpen(false);

    // 1. Try Electron native PDF export
    if (window.electronAPI?.exportNotePdf) {
      try {
        const res = await window.electronAPI.exportNotePdf({
          title: note.title || 'Untitled note',
          html: note.content || '<p></p>',
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

    const contentHtml = note.content || '<p></p>';

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${escapeHtml(note.title || 'Note')}</title>
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
            ul, ol { margin: 6px 0; padding-left: 20px; font-size: 13px; }
            ul[data-checklist] { list-style: none; padding-left: 0; }
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
          <h1 class="note-title">${escapeHtml(note.title || 'Untitled note')}</h1>
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

    // Tab and Shift+Tab indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      checkpointHistory();
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

    const selection = window.getSelection();
    const node = selection?.anchorNode?.nodeType === 3 ? selection.anchorNode.parentElement : selection?.anchorNode;
    const markerBlock = node?.closest?.('p,div');
    const marker = markerBlock?.textContent.replace(/\u00a0/g, '').trim();
    if (e.key === ' ' && (marker === '*' || marker === '1.')) {
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
        const paragraph = exitChecklistItem(checklistLi);
        if (paragraph) placeCaret(paragraph);
      } else {
        const next = document.createElement('li');
        next.innerHTML = '<label contenteditable="false"><input type="checkbox" aria-label="Checklist item"></label><span><br></span>';
        checklistLi.after(next);
        placeCaret(next.querySelector('span') || next);
      }
      saveContent('checklist-enter');
      return;
    }

    // Standard list Enter handler on empty item
    const standardLi = node?.closest?.('ul:not([data-checklist]) li, ol li');
    if (e.key === 'Enter' && standardLi) {
      const text = standardLi.innerText.replace(/\u00a0/g, '').trim();
      if (!text) {
        e.preventDefault();
        checkpointHistory();
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
    e.preventDefault();
    const html = e.clipboardData?.getData('text/html');
    const text = e.clipboardData?.getData('text/plain') || '';

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
      // Find element rect if available or use menu coordinates
      const rect = { left: Math.min(window.innerWidth - 280, (menu?.x || 200) + 10), top: menu?.y || 200, bottom: (menu?.y || 200) + 20 };
      setIconPopover({ item, anchorRect: rect });
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

  const renderNoteIcon = (iconName, color, className = "h-3.5 w-3.5") => {
    const IconComp = NOTE_ICON_MAP[iconName] || NotebookPen;
    return <IconComp className={className} style={{ color: color || '#94a3b8' }} />;
  };

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
            className="rounded p-0.5 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-transform hover:scale-110"
            title={isNl ? 'Icoon & kleur wijzigen' : 'Change icon & color'}
          >
            {isOpen ? (
              <FolderOpen className="h-4 w-4" fill={folder.color || '#94a3b8'} style={{ color: folder.color || '#94a3b8' }} />
            ) : (
              <Folder className="h-4 w-4" fill={folder.color || '#94a3b8'} style={{ color: folder.color || '#94a3b8' }} />
            )}
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

  const renderNote = (n, depth = 0) => (
    <div
      key={n.id}
      role="button"
      tabIndex={0}
      onClick={() => setSelected(n.id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSelected(n.id);
        }
      }}
      onContextMenu={e => openMenu(e, { ...n, type: 'note' })}
      className={`group flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 text-left text-sm ${
        selected === n.id ? 'bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300 font-medium' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
      }`}
      style={{ paddingLeft: 10 + depth * 12 }}
    >
      <button
        type="button"
        title={isNl ? 'Icoon & kleur aanpassen' : 'Customize icon & color'}
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setIconPopover({ item: n, anchorRect: rect });
        }}
        className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10 transition-transform hover:scale-110 shrink-0"
      >
        {renderNoteIcon(n.icon, n.color, "h-3.5 w-3.5")}
      </button>

      <span className="min-w-0 flex-1 truncate">{n.title}</span>

      <button onClick={e => openMenu(e, { ...n, type: 'note' })} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0">
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <ToolShell icon={NotebookPen} title="Notes" description="Write, format and organize reusable lab notes.">
      <div className={`grid h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] overflow-hidden rounded-xl border border-slate-200 bg-white transition-all dark:border-slate-800 dark:bg-slate-900 ${collapsed ? 'grid-cols-[52px_1fr]' : 'grid-cols-[280px_1fr]'}`}>
        <aside className="flex flex-col justify-between h-full overflow-hidden border-r dark:border-slate-800">
          <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="flex h-12 items-center justify-between border-b px-3 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-1.5">
                <b className={`text-sm text-slate-700 dark:text-slate-200 ${collapsed ? 'hidden' : ''}`}>
                  {viewMode === 'trash' ? (isNl ? 'Prullenbak' : 'Trash') : (isNl ? 'Bibliotheek' : 'Library')}
                </b>
              </div>
              <button onClick={() => setCollapsed(v => !v)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>

            {!collapsed && (
              <div className="flex flex-col min-h-0 flex-1 p-2">
                <div className="grid grid-cols-[1fr_34px_34px] gap-1 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input className={`${fieldClass} w-full pl-8`} placeholder={isNl ? 'Zoek notities…' : 'Search notes…'} value={query} onChange={e => setQuery(e.target.value)} />
                  </div>
                  <button title={isNl ? 'Nieuwe map' : 'New folder'} onClick={() => createFolder()} className="rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                    <FolderPlus className="mx-auto h-4 w-4" />
                  </button>
                  <button title={isNl ? 'Nieuwe notitie' : 'New note'} onClick={() => createNote()} className="rounded-lg bg-pink-600 text-white shadow-xs hover:bg-pink-700">
                    <FilePlus className="mx-auto h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex-1 overflow-y-auto min-h-0">
                  {viewMode === 'library' ? (
                    <>
                      {folders.filter(f => !f.parent).map(f => renderFolder(f))}
                      {sortedActive.filter(n => !n.folder).map(n => renderNote(n))}
                      {sortedActive.length === 0 && folders.length === 0 && (
                        <div className="py-8 text-center text-xs text-slate-400">
                          {isNl ? 'Geen notities. Maak een nieuwe notitie aan.' : 'No notes. Create a new note.'}
                        </div>
                      )}
                    </>
                  ) : (
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
                          onClick={() => setSelected(n.id)}
                          className={`group flex h-8 w-full cursor-pointer items-center justify-between rounded-lg px-2 text-left text-sm ${
                            selected === n.id ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-medium' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {renderNoteIcon(n.icon, n.color, "h-3.5 w-3.5 shrink-0 opacity-70")}
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

        <main className="flex flex-col h-full min-w-0 overflow-hidden relative">
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
              <div className="flex items-center gap-2.5 border-b p-3 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  title={isNl ? 'Icoon & kleur aanpassen' : 'Customize icon & color'}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setIconPopover({ item: note, anchorRect: rect });
                  }}
                  className="rounded-xl p-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 transition-transform hover:scale-105"
                >
                  {renderNoteIcon(note.icon, note.color, "h-5 w-5")}
                </button>

                <input
                  className={`${fieldClass} min-w-0 flex-1 border-0 text-lg font-bold shadow-none focus:ring-0`}
                  value={note.title}
                  disabled={Boolean(note.deleted)}
                  onChange={e => setNotes(v => v.map(n => n.id === note.id ? { ...n, title: e.target.value, updated: Date.now() } : n))}
                />

                {!note.deleted && (
                  <div className="flex items-center gap-1.5">
                    {/* Export Dropdown */}
                    <div className="relative" ref={exportRef}>
                      <button
                        type="button"
                        onClick={() => setExportOpen(v => !v)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>{isNl ? 'Exporteer' : 'Export'}</span>
                      </button>

                      {exportOpen && (
                        <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                          <button
                            type="button"
                            onClick={exportMarkdown}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <FileText className="h-3.5 w-3.5 text-slate-400" />
                            <span>Markdown (.md)</span>
                          </button>
                          <button
                            type="button"
                            onClick={exportPdf}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Download className="h-3.5 w-3.5 text-slate-400" />
                            <span>PDF (.pdf)</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      className={`${secondaryButton} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40`}
                      onClick={() => {
                        setNotes(v => v.map(n => n.id === note.id ? { ...n, deleted: Date.now() } : n));
                        setSelected(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />{isNl ? 'Verwijderen' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>

              {!note.deleted && (
                <div className="shrink-0">
                  <Toolbar editorRef={editorRef} onContentChange={saveContent} lang={lang} />
                  <FloatingToolbar
                    editorRef={editorRef}
                    onContentChange={saveContent}
                    onBeforeCommand={() => commitHistory('command')}
                    lang={lang}
                  />
                </div>
              )}

              {/* Note Body: Scrolls independently */}
              <div
                ref={editorRef}
                contentEditable={!note.deleted}
                dir="ltr"
                suppressContentEditableWarning
                onInput={saveContent}
                onKeyUp={saveContent}
                onBlur={saveContent}
                onKeyDown={handleEditorKeyDown}
                onPaste={handlePaste}
                onBeforeInput={handleBeforeInput}
                className="note-editor flex-1 overflow-y-auto p-6 text-left text-sm leading-6 text-slate-700 outline-none dark:text-slate-200"
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              {viewMode === 'trash'
                ? (isNl ? 'Selecteer een verwijderde notitie.' : 'Select a deleted note.')
                : (isNl ? 'Selecteer een notitie of maak een nieuwe aan.' : 'Select a note or create a new one.')}
            </div>
          )}
        </main>
      </div>

      <ContextMenu menu={menu} folders={folders} onClose={() => setMenu(null)} onAction={action} isNl={isNl} />

      {iconPopover && (
        <IconColorPopover
          popover={iconPopover}
          isNl={isNl}
          onClose={() => setIconPopover(null)}
          onSave={(icon, color) => {
            if (iconPopover.item.type === 'folder') {
              setFolders(v => v.map(f => f.id === iconPopover.item.id ? { ...f, color } : f));
            } else {
              setNotes(v => v.map(n => n.id === iconPopover.item.id ? { ...n, icon, color, updated: Date.now() } : n));
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
    </ToolShell>
  );
}
