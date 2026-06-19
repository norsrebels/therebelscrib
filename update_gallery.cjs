const fs = require('fs');
let content = fs.readFileSync('src/routes/gallery.tsx', 'utf8');

const emptyStateCode = `{GALLERY_DATA.length === 0 ? (
              albumId ? (
                <div className="text-center py-24 border border-dashed border-[rgb(var(--border-soft))] rounded-2xl flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-[rgb(var(--surface-hover))] rounded-full flex items-center justify-center">
                    <Folder size={28} className="text-[rgb(var(--muted-fg))]" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">No photos yet</p>
                    <p className="text-[rgb(var(--muted-fg))] text-sm">
                      {isAdmin ? "Upload the first photo to this album." : "This album is empty."}
                    </p>
                  </div>
                  {isAdmin && (
                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-blue-700 transition-colors">
                      <Upload size={14} /> Upload Photo
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                    </label>
                  )}
                </div>
              ) : (
                <div className="text-center py-24 border border-dashed border-[rgb(var(--border-soft))] rounded-2xl">
                  <p className="text-[rgb(var(--muted-fg))] text-sm">
                    {isAdmin ? "No photos uploaded yet. Click Upload to add the first one." : "No photos have been uploaded yet."}
                  </p>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">`;

content = content.replace(
  '<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">',
  emptyStateCode
);

content = content.replace(
  '              {GALLERY_DATA.map((image, index) => {',
  '                {GALLERY_DATA.map((image, index) => {'
);
content = content.replace(
  '            </div>\n          </>\n        )}',
  '            </div>\n            )}\n          </>\n        )}'
);

fs.writeFileSync('src/routes/gallery.tsx', content);
