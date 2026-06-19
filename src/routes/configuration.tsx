import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-client";
import { useState, useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { getSettings, saveSettings } from "@/server/assessment.functions";
import {
  getAllSiteSettings,
  saveBulkSiteSettings,
} from "@/server/site-settings.functions";
import {
  getChatbotConfig,
  saveChatbotConfig,
} from "@/server/chatbot.functions";
import { Facebook, Instagram, Mail, MessageCircle, Plus, Trash2, RotateCcw } from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { ToastBar } from "@/components/Modals";

export const Route = createFileRoute("/configuration")({
  loader: async () => {
    const [settingsData, siteSettingsMap, chatbotConfig] = await Promise.all([
      getSettings({ data: { key: "matrices" } }),
      getAllSiteSettings().catch(() => ({} as Record<string, string>)),
      getChatbotConfig().catch(() => ({
        systemPrompt: "",
        faqs: [] as { question: string; answer: string }[],
        defaultSystemPrompt: "",
      })),
    ]);
    return { settingsData, siteSettingsMap, chatbotConfig };
  },
  component: ConfigurationPage,
});

function ConfigurationPage() {
  const { isAdmin, loading } = useAuth();
  const [categories, setCategories] = useState<
    {
      id: string;
      title: string;
      criteria: { id: string; label: string; maxScore: number }[];
    }[]
  >([]);
  const { settingsData, siteSettingsMap, chatbotConfig } = Route.useLoaderData();
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [contactUrl, setContactUrl] = useState("");
  const [isSavingSocial, setIsSavingSocial] = useState(false);

  const [chatbotPrompt, setChatbotPrompt] = useState("");
  const [chatbotFaqs, setChatbotFaqs] = useState<
    { question: string; answer: string }[]
  >([]);
  const [isSavingChatbot, setIsSavingChatbot] = useState(false);

  useEffect(() => {
    if (settingsData && settingsData.value) {
      setCategories(settingsData.value.categories || []);
    } else if (settingsData !== undefined) {
      setCategories([
        {
          id: "technical",
          title: "Technical Skills",
          criteria: [
            { id: "serving", label: "Serving", maxScore: 5 },
            { id: "passing", label: "Passing", maxScore: 5 },
          ],
        },
      ]);
    }
  }, [settingsData]);

  useEffect(() => {
    setFacebookUrl(siteSettingsMap.facebookUrl || "");
    setInstagramUrl(siteSettingsMap.instagramUrl || "");
    setContactUrl(siteSettingsMap.contactUrl || "");
  }, [siteSettingsMap]);

  useEffect(() => {
    if (chatbotConfig) {
      setChatbotPrompt(chatbotConfig.systemPrompt || "");
      setChatbotFaqs(chatbotConfig.faqs || []);
    }
  }, [chatbotConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings({
        data: { key: "matrices", value: { categories } },
      });
      showToast("Settings saved successfully", "success");
      router.invalidate();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSocial = async () => {
    setIsSavingSocial(true);
    try {
      await saveBulkSiteSettings({
        data: {
          settings: [
            { key: "facebookUrl", value: facebookUrl },
            { key: "instagramUrl", value: instagramUrl },
            { key: "contactUrl", value: contactUrl },
          ],
        },
      });
      showToast("Social links saved successfully", "success");
      router.invalidate();
    } catch (e) {
      console.error(e);
      showToast("Failed to save social links", "error");
    } finally {
      setIsSavingSocial(false);
    }
  };

  const handleSaveChatbot = async () => {
    setIsSavingChatbot(true);
    try {
      await saveChatbotConfig({
        data: {
          systemPrompt: chatbotPrompt,
          faqs: chatbotFaqs.filter((f) => f.question.trim() && f.answer.trim()),
        },
      });
      showToast("Chatbot settings saved successfully", "success");
      router.invalidate();
    } catch (e) {
      console.error(e);
      showToast("Failed to save chatbot settings", "error");
    } finally {
      setIsSavingChatbot(false);
    }
  };

  const handleAddFaq = () => {
    setChatbotFaqs([...chatbotFaqs, { question: "", answer: "" }]);
  };

  const handleUpdateFaq = (
    index: number,
    field: "question" | "answer",
    value: string,
  ) => {
    const updated = [...chatbotFaqs];
    updated[index] = { ...updated[index], [field]: value };
    setChatbotFaqs(updated);
  };

  const handleRemoveFaq = (index: number) => {
    setChatbotFaqs(chatbotFaqs.filter((_, i) => i !== index));
  };

  const handleResetPrompt = () => {
    if (chatbotConfig?.defaultSystemPrompt) {
      setChatbotPrompt(chatbotConfig.defaultSystemPrompt);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center text-[rgb(var(--muted-fg))]">
        Loading...
      </div>
    );

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
          <p className="text-[rgb(var(--muted-fg))]">
            Sign in as an admin to access configuration.
          </p>
        </div>
      </div>
    );
  }

  const handleAddCategory = () => {
    setCategories([
      ...categories,
      {
        id: `cat_${Date.now()}`,
        title: "New Category",
        criteria: [],
      },
    ]);
  };

  const handleAddCriteria = (catIndex: number) => {
    const newCats = [...categories];
    newCats[catIndex].criteria.push({
      id: `crit_${Date.now()}`,
      label: "New Criteria",
      maxScore: 10,
    });
    setCategories(newCats);
  };

  const handleUpdateCategory = (index: number, title: string) => {
    const newCats = [...categories];
    newCats[index].title = title;
    setCategories(newCats);
  };

  const handleUpdateCriteria = (
    catIndex: number,
    critIndex: number,
    field: string,
    value: any,
  ) => {
    const newCats = [...categories];
    newCats[catIndex].criteria[critIndex] = {
      ...newCats[catIndex].criteria[critIndex],
      [field]: value,
    };
    setCategories(newCats);
  };

  const handleRemoveCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const handleRemoveCriteria = (catIndex: number, critIndex: number) => {
    const newCats = [...categories];
    newCats[catIndex].criteria = newCats[catIndex].criteria.filter(
      (_, i) => i !== critIndex,
    );
    setCategories(newCats);
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-3xl font-bold mb-8 tracking-tight">Configuration</h1>

      {/* Social Media Settings */}
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 shadow-sm mb-8">
        <h2 className="text-xl font-semibold mb-4">Social & Contact Links</h2>
        <p className="text-sm text-[rgb(var(--muted-fg))] mb-6">
          Configure the social media and contact URLs displayed across the site.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[rgb(var(--muted-fg))] flex items-center gap-2 mb-1">
              <Facebook size={14} /> Facebook URL
            </label>
            <input
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="https://facebook.com/..."
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[rgb(var(--muted-fg))] flex items-center gap-2 mb-1">
              <Instagram size={14} /> Instagram URL
            </label>
            <input
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="https://instagram.com/..."
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[rgb(var(--muted-fg))] flex items-center gap-2 mb-1">
              <Mail size={14} /> Contact URL
            </label>
            <input
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="mailto:hello@example.com or https://..."
              value={contactUrl}
              onChange={(e) => setContactUrl(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveSocial}
              disabled={isSavingSocial}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {isSavingSocial ? "Saving..." : "Save Social Links"}
            </button>
          </div>
        </div>
      </div>

      {/* Chatbot Knowledge Base */}
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 shadow-sm mb-8">
        <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <MessageCircle size={20} /> Chatbot Knowledge Base
        </h2>
        <p className="text-sm text-[rgb(var(--muted-fg))] mb-6">
          Configure the AI assistant that visitors can chat with. Customize its personality and add FAQs it should always answer correctly.
        </p>

        <div className="space-y-6">
          {/* System Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-[rgb(var(--muted-fg))]">
                System Prompt
              </label>
              <button
                onClick={handleResetPrompt}
                className="flex items-center gap-1 text-xs text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
                title="Reset to default"
              >
                <RotateCcw size={12} /> Reset to default
              </button>
            </div>
            <textarea
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 min-h-[120px] resize-y text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted-fg))]"
              placeholder="You are a helpful assistant for..."
              value={chatbotPrompt}
              onChange={(e) => setChatbotPrompt(e.target.value)}
            />
          </div>

          {/* FAQs */}
          <div>
            <label className="text-sm font-medium text-[rgb(var(--muted-fg))] block mb-3">
              Frequently Asked Questions
            </label>
            <div className="space-y-4">
              {chatbotFaqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="border border-[rgb(var(--border))] rounded-xl p-4 bg-[rgb(var(--bg))]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      <input
                        className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted-fg))]"
                        placeholder="Question (e.g., What are your practice hours?)"
                        value={faq.question}
                        onChange={(e) =>
                          handleUpdateFaq(idx, "question", e.target.value)
                        }
                      />
                      <textarea
                        className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 min-h-[60px] resize-y text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted-fg))]"
                        placeholder="Answer"
                        value={faq.answer}
                        onChange={(e) =>
                          handleUpdateFaq(idx, "answer", e.target.value)
                        }
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveFaq(idx)}
                      className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors mt-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={handleAddFaq}
                className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 font-medium py-2"
              >
                <Plus size={16} /> Add FAQ
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveChatbot}
              disabled={isSavingChatbot}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {isSavingChatbot ? "Saving..." : "Save Chatbot Settings"}
            </button>
          </div>
        </div>
      </div>

      {/* Assessment Matrices */}
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Assessment Matrices</h2>
        <p className="text-sm text-[rgb(var(--muted-fg))] mb-6">
          Define the categories and criteria used for scoring players in the
          Player Dex.
        </p>

        <div className="space-y-8">
          {categories.map((cat, cIdx) => (
            <div
              key={cat.id}
              className="border border-[rgb(var(--border))] rounded-xl p-4 bg-[rgb(var(--bg))]"
            >
              <div className="flex gap-4 items-center mb-4">
                <input
                  className="flex-1 bg-transparent border-b border-[rgb(var(--border))] text-lg font-semibold px-2 py-1 outline-none focus:border-blue-500"
                  value={cat.title}
                  onChange={(e) => handleUpdateCategory(cIdx, e.target.value)}
                />
                <button
                  onClick={() => handleRemoveCategory(cIdx)}
                  className="text-red-500 hover:text-red-600 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
              <div className="space-y-3 pl-4 border-l-2 border-[rgb(var(--border))]">
                {cat.criteria.map((crit, crIdx) => (
                  <div key={crit.id} className="flex gap-3 items-center">
                    <input
                      className="flex-1 bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                      value={crit.label}
                      onChange={(e) =>
                        handleUpdateCriteria(
                          cIdx,
                          crIdx,
                          "label",
                          e.target.value,
                        )
                      }
                      placeholder="Criteria Name"
                    />
                    <input
                      type="number"
                      className="w-24 bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                      value={crit.maxScore}
                      onChange={(e) =>
                        handleUpdateCriteria(
                          cIdx,
                          crIdx,
                          "maxScore",
                          parseInt(e.target.value) || 5,
                        )
                      }
                      placeholder="Max Score"
                    />
                    <button
                      onClick={() => handleRemoveCriteria(cIdx, crIdx)}
                      className="text-red-500 hover:text-red-600 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => handleAddCriteria(cIdx)}
                  className="text-sm text-blue-500 hover:text-blue-600 font-medium py-2"
                >
                  + Add Criteria
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={handleAddCategory}
            className="px-4 py-2 bg-[rgb(var(--surface-hover))] border border-[rgb(var(--border))] rounded-xl text-sm font-semibold"
          >
            Add Category
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 ml-auto"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
      <ToastBar toast={toast} />
    </main>
  );
}
