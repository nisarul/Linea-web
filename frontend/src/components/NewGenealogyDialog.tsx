// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Input, Select } from "@/components";
import {
  createGenealogy,
  type Visibility,
} from "@/lib/genealogies";
import { ApiError } from "@/lib/api";

export interface NewGenealogyDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the freshly-created genealogy id on success. */
  onCreated?: (id: string) => void;
}

export function NewGenealogyDialog({
  open,
  onClose,
  onCreated,
}: NewGenealogyDialogProps) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("VISIBILITY_PRIVATE");
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: createGenealogy,
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["genealogies"] });
      onCreated?.(res.genealogy.id);
      reset();
      onClose();
    },
    onError: (e: unknown) => {
      setErr(e instanceof ApiError ? e.message : String(e));
    },
  });

  function reset() {
    setName("");
    setVisibility("VISIBILITY_PRIVATE");
    setErr(null);
  }

  function submit() {
    setErr(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("Name is required.");
      return;
    }
    if (trimmed.length > 120) {
      setErr("Name must be 120 characters or fewer.");
      return;
    }
    mut.mutate({ name: trimmed, visibility });
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (mut.isPending) return;
        reset();
        onClose();
      }}
      title="New genealogy"
      description="Create a new genealogy. You become its Owner. You can change visibility and add members anytime."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} isLoading={mut.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="block space-y-1">
          <span className="text-xs font-medium text-(--color-fg-secondary)">
            Name
          </span>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ottoman Imperial Line"
            maxLength={120}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-(--color-fg-secondary)">
            Visibility
          </span>
          <Select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
          >
            <option value="VISIBILITY_PRIVATE">Private — explicit members only</option>
            <option value="VISIBILITY_UNLISTED">Unlisted — anyone with the URL</option>
            <option value="VISIBILITY_PUBLIC">Public — discoverable</option>
          </Select>
          <span className="block text-xs text-(--color-fg-muted)">
            You can change this later. Defaults to Private.
          </span>
        </label>

        {err && (
          <div className="rounded-md border border-(--color-state-danger)/40 bg-(--color-state-danger-bg) px-3 py-2 text-sm text-(--color-state-danger)">
            {err}
          </div>
        )}
      </form>
    </Dialog>
  );
}
