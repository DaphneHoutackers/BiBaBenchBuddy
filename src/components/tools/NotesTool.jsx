import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bold, CheckSquare, ChevronRight, Code2, Eraser, FilePlus, Folder, FolderOpen, FolderPlus, Heading1, Heading2, Heading3, Highlighter, Italic, Link, List, ListOrdered, MoreHorizontal, NotebookPen, PanelLeftClose, PanelLeftOpen, Palette, Quote, Search, Strikethrough, Trash2, Underline, X } from 'lucide-react';
import MacColorPicker from '@/components/shared/MacColorPicker';
import { PALETTE, ToolShell, fieldClass, primaryButton, secondaryButton, uid, useStoredState } from './toolUtils.jsx';

const COLORS=['#475569','#ef4444','#f59e0b','#eab308','#10b981','#14b8a6','#3b82f6','#6366f1','#8b5cf6','#ec4899'];
const exec=(cmd,value=null)=>document.execCommand(cmd,false,value);
const escapeHtml=text=>text.replace(/[&<>]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]));
function placeCaret(element){const range=document.createRange();range.selectNodeContents(element);range.collapse(false);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);element.focus();}

function exitChecklistItem(li){
  const list=li.closest('ul[data-checklist]');
  if(!list)return null;
  const items=[...list.children],index=items.indexOf(li),paragraph=document.createElement('p');
  paragraph.innerHTML='<br>';
  const before=items.slice(0,index),after=items.slice(index+1);
  const replacements=[];
  if(before.length){const beforeList=list.cloneNode(false);before.forEach(item=>beforeList.appendChild(item));replacements.push(beforeList)}
  replacements.push(paragraph);
  if(after.length){const afterList=list.cloneNode(false);after.forEach(item=>afterList.appendChild(item));replacements.push(afterList)}
  list.replaceWith(...replacements);
  return paragraph;
}

function Toolbar({editorRef,onContentChange}){
  const [highlights,setHighlights]=useState(false),[linkOpen,setLinkOpen]=useState(false),[linkName,setLinkName]=useState(''),[linkUrl,setLinkUrl]=useState('');
  const onBeforeCommand=()=>editorRef.current?.__recordHistory?.('command');
  const run=(cmd,value)=>{onBeforeCommand();editorRef.current?.focus();exec(cmd,value);onContentChange()};
  const insertChecklist=()=>{onBeforeCommand();const marker=`check-${Date.now()}`;editorRef.current?.focus();exec('insertHTML',`<ul data-checklist="true"><li><label contenteditable="false"><input type="checkbox" aria-label="Checklist item"></label><span data-caret="${marker}"><br></span></li></ul>`);const target=editorRef.current?.querySelector(`[data-caret="${marker}"]`);if(target){target.removeAttribute('data-caret');placeCaret(target)}onContentChange()};
  const insertCode=()=>{onBeforeCommand();const selection=window.getSelection()?.toString()||'Code';editorRef.current?.focus();exec('insertHTML',`<div class="note-code" contenteditable="false"><button data-copy-code aria-label="Copy code">Copy</button><pre contenteditable="true"><code>${escapeHtml(selection)}</code></pre></div><p><br></p>`);onContentChange()};
  const insertDivider=()=>{onBeforeCommand();editorRef.current?.focus();exec('insertHTML','<div class="note-divider" contenteditable="false"><hr><button data-remove-divider aria-label="Remove divider">×</button></div><p><br></p>');onContentChange()};
  const addLink=()=>{if(!linkName||!linkUrl)return;onBeforeCommand();editorRef.current?.focus();exec('insertHTML',`<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkName)}</a>`);setLinkOpen(false);setLinkName('');setLinkUrl('');onContentChange()};
  const controls=[[Eraser,'Remove formatting',()=>{run('removeFormat');run('formatBlock','p')}],[Heading1,'Heading 1',()=>run('formatBlock','h1')],[Heading2,'Heading 2',()=>run('formatBlock','h2')],[Heading3,'Heading 3',()=>run('formatBlock','h3')],[Bold,'Bold',()=>run('bold')],[Italic,'Italic',()=>run('italic')],[Underline,'Underline',()=>run('underline')],[Strikethrough,'Strikethrough',()=>run('strikeThrough')],[List,'Bullet list',()=>run('insertUnorderedList')],[ListOrdered,'Numbered list',()=>run('insertOrderedList')],[CheckSquare,'Checklist',insertChecklist],[Quote,'Quote',()=>run('formatBlock','blockquote')],[Code2,'Code box',insertCode]];
  return <div className="relative flex flex-wrap items-center gap-1 border-b p-2">{controls.map(([Icon,label,action])=><button key={label} type="button" title={label} onMouseDown={e=>e.preventDefault()} onClick={action} className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Icon className="h-4 w-4"/></button>)}<button type="button" title="Link" onMouseDown={e=>e.preventDefault()} onClick={()=>setLinkOpen(v=>!v)} className="rounded p-2 text-slate-500 hover:bg-slate-100"><Link className="h-4 w-4"/></button><button type="button" title="Highlight" onMouseDown={e=>e.preventDefault()} onClick={()=>setHighlights(v=>!v)} className="rounded p-2 text-slate-500 hover:bg-slate-100"><Highlighter className="h-4 w-4"/></button><button type="button" title="Divider" onMouseDown={e=>e.preventDefault()} onClick={insertDivider} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100">—</button>{highlights&&<div className="absolute left-64 top-11 z-30 flex gap-1 rounded-xl border bg-white p-2 shadow-xl">{PALETTE.slice(0,6).map(color=><button key={color} onMouseDown={e=>e.preventDefault()} onClick={()=>{run('hiliteColor',`${color}55`);setHighlights(false)}} className="h-6 w-7 rounded" style={{background:color}}/>)}</div>}{linkOpen&&<div className="absolute left-52 top-11 z-30 w-72 rounded-xl border bg-white p-3 shadow-xl"><label className="text-xs text-slate-500">Link name<input className={`${fieldClass} mt-1 w-full`} value={linkName} onChange={e=>setLinkName(e.target.value)}/></label><label className="mt-2 block text-xs text-slate-500">Link URL<input className={`${fieldClass} mt-1 w-full`} value={linkUrl} onChange={e=>setLinkUrl(e.target.value)}/></label><div className="mt-3 flex justify-end gap-2"><button className={secondaryButton} onClick={()=>setLinkOpen(false)}>Cancel</button><button className={primaryButton} onClick={addLink}>Insert link</button></div></div>}</div>;
}

function ContextMenu({menu,folders,onClose,onAction}){if(!menu)return null;const item=menu.item;return <div className="fixed z-[120] w-56 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-2xl" style={{left:menu.x,top:menu.y}} onClick={e=>e.stopPropagation()}><p className="truncate px-2 py-1 text-[10px] font-bold uppercase text-slate-400">{item.name||item.title}</p>{[['rename','Rename'],['add-folder','Add folder'],['add-note','Add note'],['duplicate','Duplicate']].map(([id,label])=><button key={id} onClick={()=>onAction(id,item)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50">{label}</button>)}<button onClick={()=>onAction('move-panel',item)} className="flex w-full justify-between rounded-lg px-2 py-2 hover:bg-slate-50">Move <ChevronRight className="h-3 w-3"/></button><button onClick={()=>onAction('color-panel',item)} className="flex w-full justify-between rounded-lg px-2 py-2 hover:bg-slate-50">Change color <ChevronRight className="h-3 w-3"/></button>{item.type==='folder'&&<><button onClick={()=>onAction('remove-color',item)} className="w-full rounded-lg px-2 py-2 text-left hover:bg-slate-50">Remove color</button><button onClick={()=>onAction('apply-color',item)} className="w-full rounded-lg px-2 py-2 text-left hover:bg-slate-50">Apply color to notes</button></>}<button onClick={()=>onAction('delete',item)} className="w-full rounded-lg px-2 py-2 text-left text-red-600 hover:bg-red-50">Delete {item.type}</button>{menu.panel==='move'&&<div className="absolute left-full top-24 ml-2 w-56 rounded-xl border bg-white p-1.5 shadow-xl"><p className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">Move to</p><button onClick={()=>onAction('move',item,null)} className="w-full rounded-lg px-2 py-2 text-left hover:bg-slate-50">/ Root directory</button>{folders.filter(f=>f.id!==item.id).map(f=><button key={f.id} onClick={()=>onAction('move',item,f.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"><Folder className="h-4 w-4" fill={f.color} style={{color:f.color}}/>{f.name}</button>)}</div>}{menu.panel==='color'&&<div className="absolute left-full top-32 ml-2 w-40 rounded-xl border bg-white p-2 shadow-xl"><div className="grid grid-cols-5 gap-1">{COLORS.map(color=><button key={color} onClick={()=>onAction('color',item,color)} className="h-5 w-5 rounded" style={{background:color}}/>)}</div><MacColorPicker value={item.color||COLORS[0]} onChange={color=>onAction('color',item,color)} buttonClassName="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border py-1.5 text-[10px]"><Palette className="h-3 w-3"/>Custom</MacColorPicker></div>}<button onClick={onClose} className="absolute -right-2 -top-2 hidden"><X/></button></div>}

export default function NotesTool(){
  const [notes,setNotes]=useStoredState('biba_notes_v1',[]),[folders,setFolders]=useStoredState('biba_note_folders_v2',[]);
  const [selected,setSelected]=useState(null),[query,setQuery]=useState(''),[collapsed,setCollapsed]=useState(false),[expanded,setExpanded]=useState(new Set()),[menu,setMenu]=useState(null);
  const editorRef=useRef(null),autosaveRef=useRef(null),historyTimerRef=useRef(null),historyRef=useRef({entries:[],index:-1,lastType:null,time:0});const note=notes.find(n=>n.id===selected);
  const commitHistory=(type='command')=>{if(!editorRef.current)return;const snapshot=editorRef.current.innerHTML,history=historyRef.current,now=Date.now();if(history.entries[history.index]===snapshot)return;history.entries=history.entries.slice(0,history.index+1);if(type==='insertText'&&history.lastType==='insertText'&&now-history.time<700){history.entries[history.index]=snapshot}else{history.entries.push(snapshot);history.index+=1;if(history.entries.length>100){history.entries.shift();history.index-=1}}history.lastType=type;history.time=now};
  const checkpointHistory=()=>{clearTimeout(historyTimerRef.current);commitHistory('checkpoint')};
  const saveContent=eventOrType=>{if(!selected||!editorRef.current)return;const type=typeof eventOrType==='string'?eventOrType:eventOrType?.nativeEvent?.inputType||'command';clearTimeout(historyTimerRef.current);historyTimerRef.current=setTimeout(()=>commitHistory(type),0);const content=editorRef.current.innerHTML;clearTimeout(autosaveRef.current);autosaveRef.current=setTimeout(()=>setNotes(items=>items.map(n=>n.id===selected?{...n,content,updated:Date.now()}:n)),120)};
  const restoreHistory=redo=>{if(!editorRef.current)return;const history=historyRef.current,nextIndex=history.index+(redo?1:-1);if(nextIndex<0||nextIndex>=history.entries.length)return;history.index=nextIndex;editorRef.current.innerHTML=history.entries[nextIndex];history.lastType='history';history.time=Date.now();placeCaret(editorRef.current);const content=editorRef.current.innerHTML;clearTimeout(autosaveRef.current);autosaveRef.current=setTimeout(()=>setNotes(items=>items.map(n=>n.id===selected?{...n,content,updated:Date.now()}:n)),120)};
  const [renameDialog, setRenameDialog] = useState(null);
  const saveContentRef = useRef(saveContent);
  saveContentRef.current = saveContent;

  useLayoutEffect(()=>{if(editorRef.current&&note){const content=note.content||'<p><br></p>';editorRef.current.innerHTML=content;historyRef.current={entries:[content],index:0,lastType:null,time:0}}},[note?.id]);
  useEffect(()=>()=>{clearTimeout(autosaveRef.current);clearTimeout(historyTimerRef.current)},[]);
  useEffect(()=>{
    const click=e=>{
      const copy=e.target.closest('[data-copy-code]');
      if(copy){navigator.clipboard?.writeText(copy.parentElement.querySelector('code')?.innerText||'');copy.textContent='Copied'}
      const remove=e.target.closest('[data-remove-divider]');
      if(remove){remove.parentElement.remove();saveContentRef.current?.()}
      const box=e.target.closest('input[type="checkbox"]');
      if(box&&editorRef.current?.contains(box))saveContentRef.current?.();
    };
    document.addEventListener('click',click);
    return()=>document.removeEventListener('click',click);
  },[]);
  const createNote=(folder=null)=>{const item={id:uid(),title:'Untitled note',content:'<p><br></p>',folder,color:folders.find(f=>f.id===folder)?.color||null,updated:Date.now()};setNotes(v=>[item,...v]);setSelected(item.id);if(folder)setExpanded(v=>new Set([...v,folder]))};
  const createFolder=(parent=null)=>{const item={id:uid(),type:'folder',name:'New folder',parent,color:COLORS[0]};setFolders(v=>[...v,item]);if(parent)setExpanded(v=>new Set([...v,parent]))};
  const handleEditorKeyDown=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();restoreHistory(e.shiftKey);return}const selection=window.getSelection();const node=selection?.anchorNode?.nodeType===3?selection.anchorNode.parentElement:selection?.anchorNode;const markerBlock=node?.closest?.('p,div');const marker=markerBlock?.textContent.replace(/\u00a0/g,'').trim();if(e.key===' '&&(marker==='*'||marker==='1.')){e.preventDefault();checkpointHistory();const range=document.createRange();range.selectNodeContents(markerBlock);selection.removeAllRanges();selection.addRange(range);exec('delete');exec(marker==='*'?'insertUnorderedList':'insertOrderedList');saveContent('list-shortcut');return}const li=node?.closest?.('ul[data-checklist] li');if(e.key==='Enter'&&li){e.preventDefault();checkpointHistory();const text=li.querySelector('span')?.innerText.replace(/\u00a0/g,'').trim();if(!text){const paragraph=exitChecklistItem(li);if(paragraph)placeCaret(paragraph)}else{const next=document.createElement('li');next.innerHTML='<label contenteditable="false"><input type="checkbox" aria-label="Checklist item"></label><span><br></span>';li.after(next);placeCaret(next.querySelector('span'))}saveContent('checklist-enter');return}const quote=node?.closest?.('blockquote');if(e.key==='Enter'&&quote&&!quote.innerText.trim()){e.preventDefault();checkpointHistory();const p=document.createElement('p');p.innerHTML='<br>';quote.replaceWith(p);placeCaret(p);saveContent('quote-exit')}};
  const handleBeforeInput=e=>{const inputType=e.nativeEvent?.inputType||e.inputType||'insertText',selection=window.getSelection(),anchor=selection?.anchorNode?.nodeType===3?selection.anchorNode.parentElement:selection?.anchorNode;if(inputType==='insertParagraph'&&anchor?.closest?.('ul[data-checklist],blockquote')){e.preventDefault();return}if(inputType!=='insertText'||e.data!==' ')return;const block=anchor?.closest?.('p,div');if(!block)return;const text=block.textContent.replace(/\u00a0/g,'').trim();if(text==='*'||text==='1.'){e.preventDefault();const range=document.createRange();range.selectNodeContents(block);selection.removeAllRanges();selection.addRange(range);exec('delete');exec(text==='*'?'insertUnorderedList':'insertOrderedList');saveContent('list-shortcut')}};
  const openMenu=(event,item)=>{event.preventDefault();event.stopPropagation();setMenu({x:Math.min(event.clientX,window.innerWidth-470),y:Math.min(event.clientY,window.innerHeight-350),item,panel:null})};
  const action=(id,item,value)=>{const isFolder=item.type==='folder';if(id==='move-panel'||id==='color-panel'){setMenu(m=>({...m,panel:id==='move-panel'?'move':'color'}));return}if(id==='rename'){setRenameDialog({item,name:isFolder?item.name:item.title});}else if(id==='add-folder')createFolder(isFolder?item.id:item.folder);else if(id==='add-note')createNote(isFolder?item.id:item.folder);else if(id==='duplicate'){if(isFolder){const newId=uid();setFolders(v=>[...v,{...item,id:newId,name:`${item.name} copy`}]);setNotes(v=>[...v,...v.filter(n=>n.folder===item.id).map(n=>({...n,id:uid(),folder:newId}))])}else setNotes(v=>[{...item,id:uid(),title:`${item.title} copy`},...v])}else if(id==='move'){isFolder?setFolders(v=>v.map(x=>x.id===item.id?{...x,parent:value}:x)):setNotes(v=>v.map(x=>x.id===item.id?{...x,folder:value}:x))}else if(id==='color'){isFolder?setFolders(v=>v.map(x=>x.id===item.id?{...x,color:value}:x)):setNotes(v=>v.map(x=>x.id===item.id?{...x,color:value}:x))}else if(id==='remove-color')setFolders(v=>v.map(x=>x.id===item.id?{...x,color:null}:x));else if(id==='apply-color')setNotes(v=>v.map(n=>n.folder===item.id?{...n,color:item.color}:n));else if(id==='delete'){if(isFolder){const ids=new Set([item.id]);let changed=true;while(changed){changed=false;folders.forEach(f=>{if(ids.has(f.parent)&&!ids.has(f.id)){ids.add(f.id);changed=true}})}setFolders(v=>v.filter(f=>!ids.has(f.id)));setNotes(v=>v.filter(n=>!ids.has(n.folder)))}else setNotes(v=>v.filter(n=>n.id!==item.id))}setMenu(null)};
  const sorted=[...notes].filter(n=>n.title.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(b.updated||0)-(a.updated||0));
  const renderFolder=(folder,depth=0)=>{const children=folders.filter(f=>f.parent===folder.id),folderNotes=sorted.filter(n=>n.folder===folder.id),isOpen=expanded.has(folder.id);return <div key={folder.id}><div onContextMenu={e=>openMenu(e,folder)} className="group flex h-8 items-center gap-1 rounded-lg px-1.5 text-sm hover:bg-slate-50" style={{paddingLeft:6+depth*12}}><button onClick={()=>setExpanded(v=>{const next=new Set(v);next.has(folder.id)?next.delete(folder.id):next.add(folder.id);return next})}><ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition ${isOpen?'rotate-90':''}`}/></button>{isOpen?<FolderOpen className="h-4 w-4" fill={folder.color||'#94a3b8'} style={{color:folder.color||'#94a3b8'}}/>:<Folder className="h-4 w-4" fill={folder.color||'#94a3b8'} style={{color:folder.color||'#94a3b8'}}/>}<span className="min-w-0 flex-1 truncate">{folder.name}</span><button onClick={e=>openMenu(e,folder)} className="opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4"/></button></div>{isOpen&&<div>{children.map(f=>renderFolder(f,depth+1))}{folderNotes.map(n=>renderNote(n,depth+1))}</div>}</div>};
  const renderNote=(n,depth=0)=><div key={n.id} role="button" tabIndex={0} onClick={()=>setSelected(n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(n.id)}}} onContextMenu={e=>openMenu(e,{...n,type:'note'})} className={`group flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-sm ${selected===n.id?'bg-pink-50 text-pink-700':'text-slate-600 hover:bg-slate-50'}`} style={{paddingLeft:12+depth*12}}><NotebookPen className="h-3.5 w-3.5" style={{color:n.color||'#94a3b8'}}/><span className="min-w-0 flex-1 truncate">{n.title}</span><button onClick={e=>openMenu(e,{...n,type:'note'})} className="opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4"/></button></div>;
  return <ToolShell icon={NotebookPen} title="Notes" description="Write, format and organize reusable lab notes."><div className={`grid min-h-[650px] overflow-hidden rounded-xl border border-slate-200 bg-white transition-all ${collapsed?'grid-cols-[52px_1fr]':'grid-cols-[280px_1fr]'}`}><aside className="overflow-hidden border-r"><div className="flex h-12 items-center justify-between border-b px-3"><b className={`text-sm text-slate-700 ${collapsed?'hidden':''}`}>Library</b><button onClick={()=>setCollapsed(v=>!v)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">{collapsed?<PanelLeftOpen className="h-4 w-4"/>:<PanelLeftClose className="h-4 w-4"/>}</button></div>{!collapsed&&<div className="p-2"><div className="grid grid-cols-[1fr_34px_34px] gap-1"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400"/><input className={`${fieldClass} w-full pl-8`} placeholder="Search notes…" value={query} onChange={e=>setQuery(e.target.value)}/></div><button title="New folder" onClick={()=>createFolder()} className="rounded-lg border text-slate-500 hover:bg-slate-50"><FolderPlus className="mx-auto h-4 w-4"/></button><button title="New note" onClick={()=>createNote()} className="rounded-lg bg-pink-600 text-white"><FilePlus className="mx-auto h-4 w-4"/></button></div><div className="mt-3 max-h-[570px] overflow-y-auto">{folders.filter(f=>!f.parent).map(f=>renderFolder(f))}{sorted.filter(n=>!n.folder).map(n=>renderNote(n))}</div></div>}</aside><main className="min-w-0">{note?<><div className="flex items-center gap-2 border-b p-3"><input className={`${fieldClass} min-w-0 flex-1 border-0 text-lg font-bold shadow-none`} value={note.title} onChange={e=>setNotes(v=>v.map(n=>n.id===note.id?{...n,title:e.target.value,updated:Date.now()}:n))}/><button className={`${secondaryButton} text-red-600`} onClick={()=>{setNotes(v=>v.filter(n=>n.id!==note.id));setSelected(null)}}><Trash2 className="h-4 w-4"/>Delete</button></div><Toolbar editorRef={editorRef} onContentChange={saveContent}/><div ref={editorRef} contentEditable dir="ltr" suppressContentEditableWarning onInput={saveContent} onKeyDown={handleEditorKeyDown} onBeforeInput={handleBeforeInput} className="note-editor min-h-[540px] max-w-none p-6 text-left text-sm leading-6 text-slate-700 outline-none"/></>:<div className="flex h-full items-center justify-center text-sm text-slate-400">Select a note or create a new one.</div>}</main></div><ContextMenu menu={menu} folders={folders} onClose={()=>setMenu(null)} onAction={action}/>
  {renameDialog && (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Rename {renameDialog.item.type === 'folder' ? 'folder' : 'note'}</h3>
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
                setNotes(v => v.map(x => x.id === renameDialog.item.id ? { ...x, title: name } : x));
              }
              setRenameDialog(null);
            } else if (e.key === 'Escape') {
              setRenameDialog(null);
            }
          }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button className={secondaryButton} onClick={() => setRenameDialog(null)}>Cancel</button>
          <button
            className={primaryButton}
            disabled={!renameDialog.name.trim()}
            onClick={() => {
              const name = renameDialog.name.trim();
              if (!name) return;
              if (renameDialog.item.type === 'folder') {
                setFolders(v => v.map(x => x.id === renameDialog.item.id ? { ...x, name } : x));
              } else {
                setNotes(v => v.map(x => x.id === renameDialog.item.id ? { ...x, title: name } : x));
              }
              setRenameDialog(null);
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )}</ToolShell>}
