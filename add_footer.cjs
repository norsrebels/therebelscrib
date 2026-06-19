const fs = require('fs');

let content = fs.readFileSync('src/components/TournamentApp.tsx', 'utf8');

const footer = `
      <footer className="mt-16 pb-8 border-t border-[rgb(var(--border-soft))] pt-8 text-center flex flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-4">
          {state.settings.facebookUrl && (
            <a href={state.settings.facebookUrl} target="_blank" rel="noreferrer" className="text-[rgb(var(--muted-fg))] hover:text-blue-500 transition-colors">
              <Facebook size={24} />
            </a>
          )}
          {state.settings.instagramUrl && (
            <a href={state.settings.instagramUrl} target="_blank" rel="noreferrer" className="text-[rgb(var(--muted-fg))] hover:text-pink-500 transition-colors">
              <Instagram size={24} />
            </a>
          )}
          {state.settings.contactUrl && (
            <a href={state.settings.contactUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-bold text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors px-4 py-2 border border-[rgb(var(--border-soft))] rounded-full hover:bg-[rgb(var(--bg))]">
              <Mail size={16} /> Contact Us
            </a>
          )}
        </div>
      </footer>
`;

content = content.replace(/<\/main>\n\s*<\/div>\n\s*\)\n}/, footer + '      </main>\n    </div>\n  )\n}');

fs.writeFileSync('src/components/TournamentApp.tsx', content);
