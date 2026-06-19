import { createFileRoute, Link } from "@tanstack/react-router";
import { Facebook, Instagram, Mail, Globe, ExternalLink, ArrowLeft } from "lucide-react";
import { getAllSiteSettings } from "../server/site-settings.functions";

export const Route = createFileRoute("/social")({
  loader: async () => {
    const settings = await getAllSiteSettings().catch(
      () => ({} as Record<string, string>),
    );
    return { settings };
  },
  component: SocialPage,
});

function SocialPage() {
  const { settings } = Route.useLoaderData();

  const socialLinks = {
    facebookUrl: settings.facebookUrl || "",
    instagramUrl: settings.instagramUrl || "",
    contactUrl: settings.contactUrl || "",
  };

  const links = [
    {
      url: socialLinks.facebookUrl,
      label: "Facebook",
      icon: Facebook,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      hoverBorder: "hover:border-blue-500/30",
    },
    {
      url: socialLinks.instagramUrl,
      label: "Instagram",
      icon: Instagram,
      color: "text-pink-500",
      bg: "bg-pink-500/10",
      hoverBorder: "hover:border-pink-500/30",
    },
    {
      url: socialLinks.contactUrl,
      label: "Contact Us",
      icon: Mail,
      color: "text-[rgb(var(--fg))]",
      bg: "bg-[rgb(var(--surface-hover))]",
      hoverBorder: "hover:border-[rgb(var(--border-strong))]",
    },
  ];

  const hasAnyLinks = links.some((l) => l.url);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        Back to home
      </Link>
      
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">Connect with the Rebels</h1>
        <p className="text-lg text-[rgb(var(--muted-fg))] max-w-2xl mx-auto">
          Join our community across different platforms to stay updated with the latest news, games, and events.
        </p>
      </div>

      {hasAnyLinks ? (
        <div className="grid gap-6 md:grid-cols-3">
          {links
            .filter((l) => l.url)
            .map((link) => {
              const Icon = link.icon;
              return (
                <div
                  key={link.label}
                  className={`glass border border-[rgb(var(--border-soft))] ${link.hoverBorder} rounded-2xl p-6 flex flex-col items-center text-center gap-4 hover:-translate-y-1 transition-all shadow-sm hover:shadow-md group`}
                >
                  <div
                    className={`w-16 h-16 rounded-2xl ${link.bg} ${link.color} flex items-center justify-center flex-shrink-0 mb-2`}
                  >
                    <Icon size={32} />
                  </div>
                  <div className="flex-1 min-w-0 w-full mb-4">
                    <h3 className="text-xl font-bold mb-2">{link.label}</h3>
                    <p className="text-sm text-[rgb(var(--muted-fg))] truncate w-full px-2">
                      {link.url}
                    </p>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[rgb(var(--surface-hover))] hover:bg-[rgb(var(--border-soft))] text-[rgb(var(--fg))] font-semibold rounded-xl transition-colors"
                  >
                    Open
                    <ExternalLink size={16} className="text-[rgb(var(--muted-fg))] group-hover:text-[rgb(var(--fg))] transition-colors" />
                  </a>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed border-[rgb(var(--border-soft))] rounded-2xl max-w-2xl mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 bg-[rgb(var(--surface-hover))] rounded-full flex items-center justify-center text-[rgb(var(--muted-fg))]">
            <Globe size={28} />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Social Links Yet</h3>
          <p className="text-sm text-[rgb(var(--muted-fg))] max-w-sm mx-auto">
            Social media links will appear here once they&apos;re configured in
            the admin settings.
          </p>
        </div>
      )}
    </main>
  );
}