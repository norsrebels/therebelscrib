
import type { Toast } from "@/lib/use-toast";

export function ToastBar({ toast }: { toast: Toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-5 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all animate-in ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {toast.msg}
    </div>
  );
}

function WolfSilhouette({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 80"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M15 65 Q10 60 8 50 Q6 40 10 35 Q12 32 14 28 L16 22 Q18 18 20 20 L22 25 Q24 30 28 28 Q32 26 34 22 L36 16 Q38 12 40 14 L42 20 Q44 26 48 30 Q52 34 58 34 Q64 34 70 32 Q76 30 82 30 Q88 30 94 34 Q100 38 104 42 Q108 46 110 52 Q112 58 110 62 Q108 66 104 68 Q100 70 94 68 Q88 66 84 64 L78 62 Q72 60 66 62 Q60 64 54 64 Q48 64 42 66 Q36 68 30 68 Q24 68 20 66 Z" />
      <circle cx="30" cy="35" r="2" fill="rgb(var(--bg))" />
    </svg>
  );
}



export function ConfirmationModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  variant = "danger",
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "default";
}) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold tracking-tight mb-2">{title}</h3>
        <p className="text-[rgb(var(--muted-fg))] text-sm mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[rgb(var(--surface-hover))] border border-[rgb(var(--border-soft))] hover:bg-[rgb(var(--border-soft))] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-amber-500/30 rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center animate-in">
        <div className="mb-4">
          <WolfSilhouette className="w-24 h-16 text-amber-400 mx-auto" />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-white mb-2">
          Welcome Rebels
        </h2>
        <p className="text-amber-400 text-sm font-bold tracking-widest uppercase mb-6">
          On the court, rebel your way
        </p>
        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
          You&apos;re viewing a live tournament. Scores update in real-time — sit back and enjoy the action.
        </p>
        <button
          onClick={onClose}
          className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full text-sm transition-colors"
        >
          Let&apos;s Go
        </button>
      </div>
    </div>
  );
}
