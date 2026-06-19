import re

# 1. Fix src/server/assessment.functions.ts
with open("src/server/assessment.functions.ts", "r") as f:
    content = f.read()

content = content.replace(".validator((d:", ".inputValidator((d:")
content = content.replace(".validator(", ".inputValidator(")
# Also fix the weird implicit any by typing `d` properly in inputValidator and not relying on inference if it fails
content = re.sub(r'\.inputValidator\(\(d: \{ key: string \}\) => d\)\n\s*\.handler\(async \(\{ data: \{ key \} \}\) => \{', 
                 r'.inputValidator((d: { key: string }) => d)\n  .handler(async ({ data: { key } }) => {', content)

content = re.sub(r'handler\(async \(\{ data: playerId \}\)', r'handler(async ({ data: playerId }: { data: number })', content)
content = re.sub(r'handler\(\n\s*async \(\{ data: \{ playerId, assessment, overallScore, playerLevel \} \}\)', r'handler(\n    async ({ data: { playerId, assessment, overallScore, playerLevel } }: any)', content)

with open("src/server/assessment.functions.ts", "w") as f:
    f.write(content)


# 2. Fix configuration.tsx to not use react-query
with open("src/routes/configuration.tsx", "r") as f:
    content = f.read()

content = content.replace('import { useMutation, useQuery } from "@tanstack/react-query";', 'import { useRouter } from "@tanstack/react-router";')

loader_addition = """export const Route = createFileRoute("/configuration")({
  loader: async () => {
    const settingsData = await getSettings({ data: { key: "matrices" } });
    return { settingsData };
  },
  component: ConfigurationPage,
});"""

content = re.sub(r'export const Route = createFileRoute\("/configuration"\)\(\{\n  component: ConfigurationPage,\n\}\);', loader_addition, content)

query_removal = """  const { data: settingsData, isLoading: isSettingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings({ data: { key: "matrices" } }),
  });"""

content = content.replace(query_removal, "  const { settingsData } = Route.useLoaderData();\n  const router = useRouter();\n  const [isSaving, setIsSaving] = useState(false);")
content = content.replace("loading || isSettingsLoading", "loading")

mutation_removal = """  const saveMutation = useMutation({
    mutationFn: (newCategories: any) => saveSettings({ data: { key: "matrices", value: { categories: newCategories } } }),
    onSuccess: () => {
      alert("Settings saved successfully");
    }
  });"""

mutation_new = """  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings({ data: { key: "matrices", value: { categories } } });
      alert("Settings saved successfully");
      router.invalidate();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };"""

content = content.replace(mutation_removal, mutation_new)
content = content.replace("saveMutation.mutate(categories)", "handleSave")
content = content.replace("saveMutation.isPending", "isSaving")

with open("src/routes/configuration.tsx", "w") as f:
    f.write(content)

# 3. Fix assessment.tsx
with open("src/routes/assessment.tsx", "r") as f:
    content = f.read()

# Fix loader deps type
content = content.replace("loader: async ({ deps: { playerId } }) => {", "loader: async ({ deps: { playerId } }: { deps: { playerId?: number } }) => {")

# fix search navigate
content = re.sub(r'navigate\(\{\s*search: \{\s*playerId: (newPlayer\.id)\s*\}\s*\}\);', r'navigate({ search: { playerId: \1 } as any });', content)
content = re.sub(r'navigate\(\{\s*search: \{\s*playerId: parseInt\(e.target.value\) \|\| undefined,\s*\},\s*\}\)', r'navigate({ search: { playerId: parseInt(e.target.value) || undefined } as any })', content)

# fix dynamicCategories scope issue (it was inside AssessmentPage but used in rendering?)
# Wait, AssessmentPage contains the return, so it should be visible! Let me check why TS complained.
# Ah, I see: I replaced the rendering in assessment.tsx but maybe I missed a parenthesis or closed the function early?
# Let's write a targeted replace for AssessmentPage to ensure variables are in scope.
