import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Bookmark, Check } from 'lucide-react';

export default function SaveHistoryButton({ onSave, label = "Save to History", className = "", ...props }) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (onSave) {
      onSave();
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={handleSave}
      className={`h-8 text-xs font-medium text-slate-600 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all flex items-center gap-1.5 shadow-sm shrink-0 ${className}`}
      title="Save this session to history"
      {...props}
    >
      {saved ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in-50 duration-200" />
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Saved!</span>
        </>
      ) : (
        <>
          <Bookmark className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
          <span>{label}</span>
        </>
      )}
    </Button>
  );
}
