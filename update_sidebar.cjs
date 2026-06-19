const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// Fix A
content = content.replace(
  "const [theme, setTheme] = useState<'light' | 'dark'>('dark')",
  "const [theme, setTheme] = useState<'light' | 'dark'>('light')"
);

// Fix D
content = content.replace(
  "const allItems = [",
  "const moreIsActive = !BOTTOM_NAV_ITEMS.some(item => isActive(item.path))\n\n  const allItems = ["
);

// Fix B & D (Mobile Bottom Nav - More button)
content = content.replace(
  /<button\n\s*onClick=\{\(\) => setMobileOpen\(true\)\}\n\s*className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-\[56px\] text-\[rgb\(var\(--muted-fg\)\)\] transition-colors"\n\s*>\n\s*<Menu size=\{20\} \/>\n\s*<span className="text-\[10px\] font-semibold leading-tight">More<\/span>\n\s*<\/button>/,
  `<button
          onClick={() => setMobileOpen(true)}
          className={\`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[56px] transition-colors relative \${
            moreIsActive ? 'text-blue-500' : 'text-[rgb(var(--muted-fg))]'
          }\`}
        >
          <Menu size={20} />
          {isAdmin && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-[rgb(var(--surface))]" />
          )}
          <span className="text-[10px] font-semibold leading-tight">More</span>
        </button>`
);

// Fix C
content = content.replace(
  /\{user \? \(\n\s*<button\n\s*onClick=\{handleSignOut\}\n\s*className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-\[rgb\(var\(--muted-fg\)\)\] hover:text-\[rgb\(var\(--fg\)\)\] hover:bg-\[rgb\(var\(--surface-hover\)\)\] transition-colors"\n\s*>\n\s*<LogOut size=\{18\} \/> Sign Out\n\s*<\/button>\n\s*\) : \(/,
  `{user ? (
                <>
                  <div className="px-3 py-2 text-xs text-[rgb(var(--muted-fg))] truncate">{user.email}</div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors"
                  >
                    <LogOut size={18} /> Sign Out
                  </button>
                </>
              ) : (`
);

fs.writeFileSync('src/components/Sidebar.tsx', content);
