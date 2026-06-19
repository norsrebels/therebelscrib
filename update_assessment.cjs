const fs = require('fs');
let content = fs.readFileSync('src/routes/assessment.tsx', 'utf8');

content = content.replace(
  '<div className="overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">',
  '<div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">'
);
content = content.replace(
  '<div className="flex gap-1.5 sm:gap-2 min-w-max">',
  '<div className="grid grid-cols-5 sm:flex gap-1.5 sm:gap-2 sm:min-w-max w-full sm:w-auto">'
);

fs.writeFileSync('src/routes/assessment.tsx', content);
