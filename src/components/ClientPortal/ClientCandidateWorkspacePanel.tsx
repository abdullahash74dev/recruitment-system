import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { FolderPlus, Loader2, NotebookPen, Plus } from "lucide-react";
import {
  useClientCandidateFoldersQuery,
  useAllFolderMembershipQuery,
  useToggleFolderItemMutation,
  useCreateFolderMutation,
  useCandidateNoteQuery,
  useSaveCandidateNoteMutation,
  useCandidateStatusQuery,
  useSetCandidateStatusMutation,
  CLIENT_CANDIDATE_STATUS_LABELS,
  type ClientCandidateStatus,
} from "@/hooks/queries/useClientCandidateWorkspace";

interface ClientCandidateWorkspacePanelProps {
  lang: "ar" | "en";
  applicantId: string;
}

const NO_STATUS = "__none__";

/**
 * The client org's own private organizational tools for a revealed
 * candidate -- internal follow-up status, a private note, and folder
 * membership. None of this is applicant PII; it's the client's own
 * workspace metadata, shared across their team via RLS (see the
 * client_candidate_workspace migration), never visible to other client orgs
 * or surfaced anywhere in the admin dashboard.
 */
export default function ClientCandidateWorkspacePanel({ lang, applicantId }: ClientCandidateWorkspacePanelProps) {
  const ar = lang === "ar";

  const { data: status } = useCandidateStatusQuery(applicantId);
  const setStatusMutation = useSetCandidateStatusMutation(lang);

  const { data: savedNote } = useCandidateNoteQuery(applicantId);
  const saveNoteMutation = useSaveCandidateNoteMutation(lang);
  const [noteDraft, setNoteDraft] = useState("");
  useEffect(() => setNoteDraft(savedNote ?? ""), [savedNote]);
  const noteDirty = noteDraft !== (savedNote ?? "");

  const { data: folders = [] } = useClientCandidateFoldersQuery();
  const { data: membership = {} } = useAllFolderMembershipQuery();
  const toggleFolderItem = useToggleFolderItemMutation(lang);
  const createFolder = useCreateFolderMutation(lang);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderPopoverOpen, setFolderPopoverOpen] = useState(false);

  const memberFolderCount = folders.filter((f) => membership[f.id]?.includes(applicantId)).length;

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status ?? NO_STATUS}
          onValueChange={(v) => {
            if (v !== NO_STATUS) setStatusMutation.mutate({ applicantId, status: v as ClientCandidateStatus });
          }}
        >
          <SelectTrigger className="h-8 w-auto text-xs gap-1.5">
            <SelectValue placeholder={ar ? "حالة المتابعة" : "Follow-up status"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_STATUS} disabled>{ar ? "بدون حالة" : "No status"}</SelectItem>
            {(Object.keys(CLIENT_CANDIDATE_STATUS_LABELS) as ClientCandidateStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{ar ? CLIENT_CANDIDATE_STATUS_LABELS[s].ar : CLIENT_CANDIDATE_STATUS_LABELS[s].en}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={folderPopoverOpen} onOpenChange={setFolderPopoverOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
              <FolderPlus className="h-3.5 w-3.5" />
              {ar ? `المجلدات (${memberFolderCount})` : `Folders (${memberFolderCount})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {folders.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">{ar ? "لا توجد مجلدات بعد" : "No folders yet"}</p>
              )}
              {folders.map((f) => {
                const checked = membership[f.id]?.includes(applicantId) ?? false;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFolderItem.mutate({ folderId: f.id, applicantId, add: !checked })}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-start text-xs"
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span className="flex-1 truncate">{f.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t mt-2">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={ar ? "اسم مجلد جديد" : "New folder name"}
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFolderName.trim()) {
                    createFolder.mutate(newFolderName.trim());
                    setNewFolderName("");
                  }
                }}
              />
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 shrink-0"
                disabled={!newFolderName.trim() || createFolder.isPending}
                onClick={() => {
                  createFolder.mutate(newFolderName.trim());
                  setNewFolderName("");
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <NotebookPen className="h-3.5 w-3.5" />
          {ar ? "ملاحظة خاصة بشركتك" : "Your organization's private note"}
        </label>
        <Textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder={ar ? "اكتب ملاحظة... (مرئية لفريقك بس)" : "Write a note... (visible to your team only)"}
          className="text-sm min-h-[60px]"
        />
        {noteDirty && (
          <Button
            size="sm"
            className="gap-1.5"
            disabled={saveNoteMutation.isPending}
            onClick={() => saveNoteMutation.mutate({ applicantId, note: noteDraft })}
          >
            {saveNoteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {ar ? "حفظ الملاحظة" : "Save note"}
          </Button>
        )}
      </div>
    </div>
  );
}
