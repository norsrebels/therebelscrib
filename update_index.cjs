const fs = require('fs');
let content = fs.readFileSync('src/routes/index.tsx', 'utf8');

const oldCards = `{announcements.length > 0 ? (
            announcements.map((a: any) => (
              <div
                key={a.id}
                className="glass border border-[rgb(var(--border-soft))] p-6 rounded-xl shadow-sm relative group"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={\`text-xs font-bold px-2 py-1 rounded-full \${TAG_COLORS[a.tagColor] || TAG_COLORS.blue}\`}
                  >
                    {a.tag}
                    {a.pinned && " · Pinned"}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleTogglePin(a.id, a.pinned)}
                        className="p-1 rounded text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
                        title={a.pinned ? "Unpin" : "Pin"}
                      >
                        {a.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <button
                        onClick={() => startEdit(a)}
                        className="p-1 rounded text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(a.id)}
                        className="p-1 rounded text-[rgb(var(--muted-fg))] hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <h4 className="text-lg font-semibold mt-3 mb-2">{a.title}</h4>
                <p className="text-sm text-[rgb(var(--muted-fg))]">{a.body}</p>
              </div>
            ))
          ) : (`;

const newCards = `{announcements.length > 0 ? (
            announcements.map((a: any, index: number) => (
              <div
                key={a.id}
                className="glass border border-[rgb(var(--border-soft))] p-6 rounded-xl shadow-sm relative group animate-in fade-in"
                style={{ animationDelay: \`\${index * 80}ms\`, animationFillMode: 'both' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={\`text-xs font-bold px-2.5 py-1 rounded-full \${TAG_COLORS[a.tagColor] || TAG_COLORS.blue}\`}
                  >
                    {a.tag}
                  </span>
                  <div className="flex items-center gap-1">
                    {isAdmin && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-1">
                        <button
                          onClick={() => handleTogglePin(a.id, a.pinned)}
                          className="p-1.5 rounded-lg bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
                          title={a.pinned ? "Unpin" : "Pin"}
                        >
                          {a.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>
                        <button
                          onClick={() => startEdit(a)}
                          className="p-1.5 rounded-lg bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(a.id)}
                          className="p-1.5 rounded-lg bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))] hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                    {a.pinned && (
                      <Pin size={16} className="text-amber-500" />
                    )}
                  </div>
                </div>
                <h4 className="text-lg font-semibold mt-3 mb-2">{a.title}</h4>
                <p className="text-sm text-[rgb(var(--muted-fg))]">{a.body}</p>
              </div>
            ))
          ) : (`;

content = content.replace(oldCards, newCards);
fs.writeFileSync('src/routes/index.tsx', content);
