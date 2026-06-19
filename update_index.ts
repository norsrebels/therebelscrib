import fs from 'fs';

const file = 'src/routes/index.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add Lucide imports
content = content.replace('Pencil, Trash2, Pin, PinOff, Plus', 'Pencil, Trash2, Pin, PinOff, Plus, Bold, Italic, Underline, List, ListOrdered, Image as ImageIcon, Video, X, Upload, Link as LinkIcon');

// Add useRef
content = content.replace('import { useState } from "react";', 'import { useState, useRef, useEffect } from "react";');

// Create RichTextEditor component
const richTextEditor = `
function RichTextEditor({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [imageTab, setImageTab] = useState<'url' | 'upload'>('url');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Focus tracking to restore selection
  const [savedSelection, setSavedSelection] = useState<Range | null>(null);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      setSavedSelection(sel.getRangeAt(0));
    }
  };

  const restoreSelection = () => {
    if (savedSelection) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelection);
    }
  };

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    handleInput();
    editorRef.current?.focus();
  };

  const insertImage = (url: string) => {
    restoreSelection();
    document.execCommand('insertImage', false, url);
    handleInput();
    setImageModalOpen(false);
    setImageUrl('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const id = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const response = await fetch(\`/api/image/\${id}\`, {
        method: 'POST',
        body: file,
      });
      if (response.ok) {
        const data = await response.json();
        insertImage(data.url);
      } else {
        alert('Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Upload error');
    } finally {
      setIsUploading(false);
    }
  };

  const insertVideo = () => {
    if (!videoUrl) return;
    restoreSelection();
    
    // Parse youtube or vimeo URL
    let embedUrl = videoUrl;
    if (videoUrl.includes('youtube.com/watch?v=')) {
      const id = new URL(videoUrl).searchParams.get('v');
      embedUrl = \`https://www.youtube.com/embed/\${id}\`;
    } else if (videoUrl.includes('youtu.be/')) {
      const id = videoUrl.split('youtu.be/')[1].split('?')[0];
      embedUrl = \`https://www.youtube.com/embed/\${id}\`;
    } else if (videoUrl.includes('vimeo.com/')) {
      const id = videoUrl.split('vimeo.com/')[1];
      embedUrl = \`https://player.vimeo.com/video/\${id}\`;
    }

    const html = \`<div class="video-wrapper"><iframe src="\${embedUrl}" allowfullscreen></iframe></div><p><br></p>\`;
    document.execCommand('insertHTML', false, html);
    handleInput();
    setVideoModalOpen(false);
    setVideoUrl('');
  };

  const openImageModal = () => {
    saveSelection();
    setImageModalOpen(true);
  };

  const openVideoModal = () => {
    saveSelection();
    setVideoModalOpen(true);
  };

  return (
    <div className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl overflow-hidden focus-within:border-blue-500">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-[rgb(var(--border-soft))] bg-[rgb(var(--surface))]">
        <button type="button" onClick={() => execCommand('bold')} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><Bold size={16} /></button>
        <button type="button" onClick={() => execCommand('italic')} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><Italic size={16} /></button>
        <button type="button" onClick={() => execCommand('underline')} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><Underline size={16} /></button>
        <div className="w-px h-4 bg-[rgb(var(--border-strong))] mx-1" />
        <button type="button" onClick={() => execCommand('insertUnorderedList')} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><List size={16} /></button>
        <button type="button" onClick={() => execCommand('insertOrderedList')} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><ListOrdered size={16} /></button>
        <div className="w-px h-4 bg-[rgb(var(--border-strong))] mx-1" />
        <button type="button" onClick={openImageModal} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><ImageIcon size={16} /></button>
        <button type="button" onClick={openVideoModal} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><Video size={16} /></button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        className="announcement-body min-h-[150px] max-h-[400px] overflow-y-auto p-4 text-sm outline-none"
      />
      
      {imageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Insert Image</h3>
              <button onClick={() => setImageModalOpen(false)} className="text-[rgb(var(--muted-fg))] hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex gap-2 mb-4 border-b border-[rgb(var(--border-soft))]">
              <button 
                className={\`pb-2 px-2 text-sm font-medium border-b-2 \${imageTab === 'url' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[rgb(var(--muted-fg))]'}\`}
                onClick={() => setImageTab('url')}
              >
                <LinkIcon size={14} className="inline mr-1" /> URL
              </button>
              <button 
                className={\`pb-2 px-2 text-sm font-medium border-b-2 \${imageTab === 'upload' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[rgb(var(--muted-fg))]'}\`}
                onClick={() => setImageTab('upload')}
              >
                <Upload size={14} className="inline mr-1" /> Upload
              </button>
            </div>
            {imageTab === 'url' ? (
              <div className="space-y-3">
                <input 
                  type="text" 
                  value={imageUrl} 
                  onChange={(e) => setImageUrl(e.target.value)} 
                  placeholder="https://..." 
                  className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-lg px-3 py-2 text-sm outline-none"
                />
                <button onClick={() => insertImage(imageUrl)} className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold hover:bg-blue-700">Insert Image</button>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleImageUpload} 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isUploading}
                  className="w-full border border-[rgb(var(--border-strong))] text-[rgb(var(--fg))] rounded-lg py-4 text-sm font-bold hover:bg-[rgb(var(--surface-hover))] border-dashed"
                >
                  {isUploading ? 'Uploading...' : 'Select File'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Insert Video</h3>
              <button onClick={() => setVideoModalOpen(false)} className="text-[rgb(var(--muted-fg))] hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input 
                type="text" 
                value={videoUrl} 
                onChange={(e) => setVideoUrl(e.target.value)} 
                placeholder="YouTube or Vimeo URL" 
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-lg px-3 py-2 text-sm outline-none"
              />
              <button onClick={insertVideo} className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold hover:bg-blue-700">Insert Video</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;

content = content.replace('function HomePage() {', richTextEditor + '\n\nfunction HomePage() {');

// Replace textarea with RichTextEditor
const textareaRegex = /<textarea\s+placeholder="Body"\s+value=\{formBody\}\s+onChange=\{\(e\) => setFormBody\(e\.target\.value\)\}\s+rows=\{3\}\s+className="w-full bg-\[rgb\(var\(--bg\)\)\] border border-\[rgb\(var\(--border-soft\)\)\] rounded-xl px-4 py-2\.5 text-sm outline-none focus:border-blue-500 resize-none"\s+\/>/m;

content = content.replace(textareaRegex, '<RichTextEditor value={formBody} onChange={setFormBody} />');

// Replace body rendering to use dangerouslySetInnerHTML
const bodyRegex = /<p className="text-sm text-\[rgb\(var\(--muted-fg\)\)\]">\{a\.body\}<\/p>/g;
content = content.replace(bodyRegex, '<div className="text-sm text-[rgb(var(--muted-fg))] announcement-body" dangerouslySetInnerHTML={{ __html: a.body }} />');

fs.writeFileSync(file, content);
