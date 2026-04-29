import { useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Composer from "@/components/Composer";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { roleHas } from "@/lib/permissionsConfig";
import { useToast } from "@/components/Toast";
import { createTaskFromComposerInput } from "@/lib/createTaskFromComposerInput";
import type { TaskType } from "@/types";
import { taskDetail } from "@/lib/routes";

/**
 * /novy — dedicated create-task page.
 * Contains only the Composer. After save, auto-redirect to /t/:id so the
 * author can fill in priority / deadline / assignee / category / location.
 */
export default function NewTask() {
  const t = useT();
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  // V18-S38 — role driven přes permissionsConfig.
  const role =
    roleState.status === "ready" ? roleState.profile.role : null;
  const canCreateNapad = roleHas("task.create.napad", role);
  const canCreateDokumentace = roleHas("task.create.dokumentace", role);
  // V24 — allowedTypes plně permission-driven, jeden řádek per typ. Místo
  // dvou-cesty `if canNapad ? full : [...]` (V14/V19) vyhodnotíme každou
  // create akci přes roleHas. Mirror pro UX gating; server rules zůstávají
  // authoritative (composer + tasks/create v firestore.rules).
  //   - OWNER: ["napad","otazka","ukol","dokumentace"]
  //   - PM:    ["otazka","ukol","dokumentace"]
  //   - CM:    ["otazka","ukol"]
  const allowedTypes: TaskType[] = [
    ...(canCreateNapad ? (["napad"] as TaskType[]) : []),
    "otazka",
    "ukol",
    ...(canCreateDokumentace ? (["dokumentace"] as TaskType[]) : []),
  ];
  const { show: showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // V20 — ?type=dokumentace pre-selects the type in the composer.
  const qType = searchParams.get("type") as TaskType | null;
  const initialType: TaskType | undefined =
    qType && allowedTypes.includes(qType) ? qType : undefined;

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
          // V18-S38 — authorRole snapshot odpovídá aktuální roli signed-in usera;
          // fallback OWNER pro safety pokud roleState ještě neloadnul.
          authorRole: role ?? "OWNER",
          onImageUploadError: () => showToast(t("composer.uploadFailed"), "error"),
        });
        // Hop to detail so author can fill metadata.
        navigate(taskDetail(taskId), { replace: true });
      } catch (e) {
        console.error(e);
        showToast(t("composer.saveFailed"), "error");
        throw e;
      }
    },
    [user, role, t, showToast, navigate]
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
          {t(canCreateNapad ? "novy.pageTitle" : "novy.pageTitlePm")}
        </h2>
      </header>
      <p className="mb-4 text-sm text-ink-muted">
        {t(canCreateNapad ? "novy.pageHint" : "novy.pageHintPm")}
      </p>
      <Composer onSave={onSave} allowedTypes={allowedTypes} initialType={initialType} />
    </section>
  );
}
