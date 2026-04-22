import { useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Composer from "@/components/Composer";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/components/Toast";
import { createTaskFromComposerInput } from "@/lib/createTaskFromComposerInput";
import type { TaskType } from "@/types";

/**
 * /novy — dedicated create-task page.
 * Contains only the Composer. After save, auto-redirect to /t/:id so the
 * author can fill in priority / deadline / assignee / category / location.
 */
export default function NewTask() {
  const t = useT();
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const isPm =
    roleState.status === "ready" &&
    roleState.profile.role === "PROJECT_MANAGER";
  // V10 — PM may only create úkoly. Lock the composer type so the toggle
  // disappears entirely for PM.
  const lockedType: TaskType | undefined = isPm ? "otazka" : undefined;
  const { show: showToast } = useToast();
  const navigate = useNavigate();

  const onSave = useCallback(
    async (text: string, type: TaskType, imageFiles: File[], linkUrls: string[]) => {
      if (!user) return;
      try {
        const taskId = await createTaskFromComposerInput({
          text,
          type,
          imageFiles,
          linkUrls,
          uid: user.uid,
          onImageUploadError: () => showToast(t("composer.uploadFailed"), "error"),
        });
        // Hop to detail so author can fill metadata.
        navigate(`/t/${taskId}`, { replace: true });
      } catch (e) {
        console.error(e);
        showToast(t("composer.saveFailed"), "error");
        throw e;
      }
    },
    [user, t, showToast, navigate]
  );

  return (
    <section aria-labelledby="novy-heading" className="mx-auto max-w-xl px-4 pt-4 pb-4">
      <header className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t("detail.back")}
          className="-ml-2 grid min-h-tap min-w-tap place-items-center rounded-md text-ink hover:bg-bg-subtle"
        >
          <ArrowLeft aria-hidden size={20} />
        </button>
        <h2 id="novy-heading" className="text-xl font-semibold tracking-tight text-ink">
          {t(isPm ? "novy.pageTitlePm" : "novy.pageTitle")}
        </h2>
      </header>
      <p className="mb-4 text-sm text-ink-muted">
        {t(isPm ? "novy.pageHintPm" : "novy.pageHint")}
      </p>
      <Composer onSave={onSave} lockedType={lockedType} />
    </section>
  );
}
