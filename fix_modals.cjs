const fs = require('fs');
let m = fs.readFileSync('src/components/Modals.tsx', 'utf8');

const brokenPart = `          />
        </div>
      </div>
      <p className="text-white/90 text-lg font-bold tracking-tight">
        {message}
        {dots}
      </p>
    </div>
  );
}`;

m = m.replace(brokenPart, '');
fs.writeFileSync('src/components/Modals.tsx', m);
