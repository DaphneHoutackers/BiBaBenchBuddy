import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('', { url: 'https://example.test' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { escapeHtml, sanitizeNoteHtml, sanitizeNoteSvg, notePreviewText } = await import('./notesHtml.js');
const parse = html => {
  const element = document.createElement('div');
  element.innerHTML = html;
  return element;
};

test('quoted filenames and link URLs remain one attribute with their original text', () => {
  const filename = `experiment" onerror="alert(1)'<&>.png`;
  const url = 'https://example.test/" onclick="alert(1)?a=1&b=2';
  const content = parse(sanitizeNoteHtml(`<img src="data:image/png;base64,AA==" alt="${escapeHtml(filename)}"><a href="${escapeHtml(url)}">${escapeHtml('<sample> & "control"')}</a>`));
  assert.equal(content.querySelector('img').getAttribute('alt'), filename);
  assert.equal(content.querySelector('a').getAttribute('href'), url);
  assert.equal(content.querySelector('a').textContent, '<sample> & "control"');
  assert.equal(content.querySelector('[onerror], [onclick]'), null);
});

test('rich paste and saved HTML remove active markup and encoded dangerous URLs', () => {
  for (const input of [
    '<img src=x onerror="alert(1)"><script>alert(1)</script><iframe srcdoc="bad"></iframe>',
    '<a href="jav&#x61;script:alert(1)">link</a><a href="data:text/html,bad">bad</a>',
    '<svg><g onload="alert(1)"></g></svg><math><mtext>bad</mtext></math>',
    '<style><style>bad</style><img src=x onerror=alert(1)>',
    '<!-- nested --!><img src=x onerror=alert(1)><meta http-equiv=refresh content="0;url=https://evil.test">',
  ]) {
    const clean = sanitizeNoteHtml(input);
    const content = parse(clean);
    assert.equal(content.querySelector('script, iframe, style, meta, svg, math, [onerror], [onload]'), null);
    for (const anchor of content.querySelectorAll('a')) assert.equal(anchor.hasAttribute('href'), false);
    assert.equal(sanitizeNoteHtml(clean), clean);
  }
});

test('HTML table cell paste is safe after extracting and reparsing cell content', () => {
  const table = parse(sanitizeNoteHtml('<table><tr><td><b>sample</b><img src=x onerror="alert(1)"></td><td><a href="javascript:alert(1)">control</a></td></tr></table>'));
  const cells = [...table.querySelectorAll('td')].map(cell => cell.innerHTML);
  const existingCell = parse('<table><tr><td></td></tr></table>').querySelector('td');
  existingCell.innerHTML = cells[0];
  assert.equal(existingCell.querySelector('[onerror]'), null);
  assert.equal(existingCell.querySelector('b').textContent, 'sample');
  const newTable = parse(`<table><tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr></table>`);
  assert.equal(newTable.querySelector('a').hasAttribute('href'), false);
});

test('formatting, tables, checklist state, code controls and images survive sanitization', () => {
  const html = '<h1 class="note-title">Title</h1><p style="color: rgb(255, 0, 0); text-align: center"><strong>Bold</strong><em>italic</em><u>underline</u></p><ul data-checklist="true"><li><label contenteditable="false"><input type="checkbox" checked data-checked="true"></label><span>task</span></li></ul><div class="note-table-wrapper" contenteditable="false"><table contenteditable="true"><tbody><tr><td colspan="2">cell</td></tr></tbody></table></div><div class="note-code" contenteditable="false"><button data-copy-code aria-label="Copy code">Copy</button><pre contenteditable="true"><code>&lt;tag&gt;</code></pre></div><div class="note-divider" contenteditable="false"><hr><button data-remove-divider>×</button></div><figure data-size="medium" class="note-image-wrapper"><img src="data:image/png;base64,AA==" alt="image"></figure><a href="https://example.test/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">link</a>';
  const content = parse(sanitizeNoteHtml(html));
  for (const selector of ['h1.note-title', 'strong', 'em', 'u', 'ul[data-checklist] input:checked', 'input[data-checked="true"]', 'table[contenteditable="true"] td[colspan="2"]', 'button[data-copy-code]', 'pre[contenteditable="true"] code', 'button[data-remove-divider]', 'figure[data-size="medium"] img[src^="data:image/png"]', 'a[target="_blank"][rel="noopener noreferrer"]']) assert.ok(content.querySelector(selector), selector);
  assert.equal(content.querySelector('p').style.textAlign, 'center');
});

test('custom SVG retains shapes while stripping executable and foreign content', () => {
  const content = parse(sanitizeNoteSvg('<svg viewBox="0 0 24 24" onload="alert(1)"><path d="M0 0L24 24" stroke="currentColor"/><script>alert(1)</script><foreignObject><img src=x onerror=alert(1)></foreignObject><a href="javascript:alert(1)"><circle r="4"/></a></svg>'));
  assert.ok(content.querySelector('svg[viewBox] path'));
  assert.ok(content.querySelector('circle'));
  assert.equal(content.querySelector('script, foreignObject, img, [onload], [onerror], [href]'), null);
});

test('previews decode entities once and preserve paragraph boundaries', () => {
  assert.equal(notePreviewText('<p>A &amp; B &lt;sample&gt;</p><p>C&nbsp;D</p>'), 'A & B <sample> C D');
  assert.equal(notePreviewText('<p>&amp;lt;img&amp;gt; &amp;amp;</p>'), '&lt;img&gt; &amp;');
  assert.equal(notePreviewText('<table><tr><td>A</td><td>B</td></tr></table><h5>C</h5><h6>D</h6>'), 'A B C D');
});
