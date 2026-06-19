const fs = require('fs');

// 1. Modals.tsx: Remove RunningWolfLoader
let modals = fs.readFileSync('src/components/Modals.tsx', 'utf8');
modals = modals.replace(/export function RunningWolfLoader[\s\S]*?\}\n/, '');
fs.writeFileSync('src/components/Modals.tsx', modals);

// 2. tournaments.tsx: Update to useLoading
let t = fs.readFileSync('src/routes/tournaments.tsx', 'utf8');
t = t.replace(/import { ConfirmationModal, RunningWolfLoader } from "@\/components\/Modals";/, 'import { ConfirmationModal } from "@/components/Modals";\nimport { useLoading } from "@/lib/loading-context";');
t = t.replace(/const \[isCreating, setIsCreating\] = useState\(false\);/, 'const { setLoading } = useLoading();');
t = t.replace(/setIsCreating\(true\);/g, 'setLoading(true);');
t = t.replace(/setIsCreating\(false\);/g, 'setLoading(false);');
t = t.replace(/\{isCreating && <RunningWolfLoader message="Creating schedule" \/>\}/, '');
fs.writeFileSync('src/routes/tournaments.tsx', t);
