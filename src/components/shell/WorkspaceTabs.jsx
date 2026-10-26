import { Plus, X } from 'lucide-react';

export default function WorkspaceTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
  isDark,
  labels,
}) {
  const toolTabs = tabs.filter(tab => tab.toolId);

  return (
    <nav
      aria-label={labels.workspaces}
      className={`flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b px-2 scrollbar-none ${
        isDark ? 'border-white/10 bg-slate-950/35' : 'border-[#e5e5e5] bg-white'
      }`}
    >
      {toolTabs.map(tab => {
        const isActive = tab.id === activeId;
        const Icon = tab.icon;
        return (
          <div
            key={tab.id}
            className={`group relative flex h-full min-w-[104px] max-w-[190px] shrink-0 items-center text-xs font-medium transition-colors ${
              isActive
                ? isDark
                  ? 'text-white'
                  : 'text-[#0d0d0d]'
                : isDark
                  ? 'text-white/45 hover:text-white/80'
                  : 'text-[#6f6f6f] hover:bg-[#f7f7f8] hover:text-[#0d0d0d]'
            }`}
            title={tab.title}
          >
            <button
              type="button"
              onClick={() => onSelect(tab.id)}
              className="flex h-full min-w-0 flex-1 items-center gap-2 px-2.5"
              aria-current={isActive ? 'page' : undefined}
            >
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              <span className="min-w-0 flex-1 truncate text-left">{tab.title}</span>
            </button>
            <button
              type="button"
              aria-label={`${labels.close} ${tab.title}`}
              onClick={event => {
                event.stopPropagation();
                onClose(tab.id);
              }}
              className={`mr-1.5 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-[#ececec]'
              }`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
            {isActive && <span className={`absolute inset-x-1 bottom-0 h-0.5 ${isDark ? 'bg-white/80' : 'bg-[#0d0d0d]'}`} />}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onNew}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
          isDark ? 'text-white/45 hover:bg-white/10 hover:text-white' : 'text-[#6f6f6f] hover:bg-[#f2f2f2] hover:text-[#0d0d0d]'
        }`}
        aria-label={labels.newWorkspace}
        title={labels.newWorkspace}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
