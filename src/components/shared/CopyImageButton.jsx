import { useState, forwardRef } from 'react';
import { Button } from "@/components/ui/button";
import { Image, Check } from 'lucide-react';
import html2canvas from 'html2canvas';

const CopyImageButton = forwardRef(({ targetRef, label = "Copy Image", copiedLabel = 'Copied!', capturingLabel = 'Capturing...', ...props }, ref) => {
  const [copied, setCopied] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCopyImage = () => {
    if (!targetRef.current || isCapturing) return;
    if (!navigator.clipboard || !window.ClipboardItem) {
      alert("Clipboard API not supported on this device.");
      return;
    }
    
    setIsCapturing(true);
    const element = targetRef.current;
    
    // Add temporary identifier to locate in cloned DOM
    element.setAttribute('data-html2canvas-target', 'true');
    const scrollWidth = element.scrollWidth;
    const scrollHeight = element.scrollHeight;
    const originalStyle = {
      width: element.style.width,
      maxWidth: element.style.maxWidth,
      overflow: element.style.overflow,
    };
    element.style.width = `${scrollWidth}px`;
    element.style.maxWidth = 'none';
    element.style.overflow = 'visible';
    
    try {
      const promise = new Promise((resolve, reject) => {
        html2canvas(element, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
          width: scrollWidth + 10, // Add slight padding to prevent edge clipping
          height: scrollHeight,
          windowWidth: scrollWidth + 10,
          windowHeight: scrollHeight,
          onclone: (clonedDoc) => {
            const clonedTarget = clonedDoc.querySelector('[data-html2canvas-target="true"]');
            if (clonedTarget) {
              clonedTarget.style.width = `${scrollWidth}px`;
              clonedTarget.style.maxWidth = 'none';
              clonedTarget.style.overflow = 'visible';
              // Only expand true scroll containers. Expanding overflow-hidden children
              // breaks compact internal grids during image capture.
              const scrollables = [clonedTarget, ...clonedTarget.querySelectorAll('.overflow-x-auto, .overflow-auto')];
              scrollables.forEach(el => {
                el.style.overflow = 'visible';
                el.style.width = `${scrollWidth}px`;
                el.style.maxWidth = 'none';
              });

              // html2canvas renders native input text on a different baseline than
              // Chromium. Replace inputs in the cloned capture only with a visual
              // equivalent so exported values stay centered and never get clipped.
              clonedTarget.querySelectorAll('input').forEach(input => {
                const style = clonedDoc.defaultView.getComputedStyle(input);
                const replacement = clonedDoc.createElement('span');
                replacement.textContent = input.value || input.placeholder || '';
                replacement.style.display = 'flex';
                replacement.style.alignItems = 'center';
                replacement.style.justifyContent = style.textAlign === 'right' ? 'flex-end' : style.textAlign === 'center' ? 'center' : 'flex-start';
                replacement.style.boxSizing = 'border-box';
                replacement.style.width = `${input.getBoundingClientRect().width}px`;
                replacement.style.height = `${input.getBoundingClientRect().height}px`;
                replacement.style.padding = style.padding;
                replacement.style.border = style.border;
                replacement.style.borderRadius = style.borderRadius;
                replacement.style.background = style.backgroundColor;
                replacement.style.color = input.value ? style.color : '#94a3b8';
                replacement.style.font = style.font;
                replacement.style.lineHeight = '1';
                replacement.style.whiteSpace = 'nowrap';
                replacement.style.overflow = 'hidden';
                input.replaceWith(replacement);
              });
            }
          }
        }).then(canvas => {
          element.removeAttribute('data-html2canvas-target');
          element.style.width = originalStyle.width;
          element.style.maxWidth = originalStyle.maxWidth;
          element.style.overflow = originalStyle.overflow;
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas conversion failed'));
            }
          }, 'image/png');
        }).catch(err => {
          element.removeAttribute('data-html2canvas-target');
          element.style.width = originalStyle.width;
          element.style.maxWidth = originalStyle.maxWidth;
          element.style.overflow = originalStyle.overflow;
          console.error("html2canvas error:", err);
          reject(err);
        });
      });

      const item = new window.ClipboardItem({ 'image/png': promise });
      navigator.clipboard.write([item]).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(async (clipboardErr) => {
        console.warn("ClipboardItem with Promise failed, trying direct blob fallback:", clipboardErr);
        try {
          const blob = await promise;
          const directItem = new window.ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([directItem]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (fallbackErr) {
          console.error("Clipboard API error:", fallbackErr);
          alert("Could not copy image directly to clipboard.");
        }
      }).finally(() => {
        setIsCapturing(false);
      });
    } catch (err) {
      console.error("Error creating clipboard item:", err);
      element.removeAttribute('data-html2canvas-target');
      element.style.width = originalStyle.width;
      element.style.maxWidth = originalStyle.maxWidth;
      element.style.overflow = originalStyle.overflow;
      setIsCapturing(false);
    }
  };

  return (
    <Button
      ref={ref}
      variant="outline"
      size="sm"
      onClick={handleCopyImage}
      disabled={isCapturing}
      className="text-slate-600 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 gap-2"
      {...props}
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Image className="w-4 h-4" />}
      {copied ? copiedLabel : (isCapturing ? capturingLabel : label)}
    </Button>
  );
});

CopyImageButton.displayName = 'CopyImageButton';

export default CopyImageButton;
