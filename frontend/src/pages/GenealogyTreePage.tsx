// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { Card, CardBody, Select, TreeCanvas } from "@/components";
import { listPersons, preferredName } from "@/lib/persons";
import { listRelationships } from "@/lib/relationships";

export function GenealogyTreePage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const search = useSearch({ strict: false }) as { focus?: string; dir?: string };
  const nav = useNavigate();

  const persons = useQuery({
    queryKey: ["persons", id],
    queryFn: () => listPersons(id),
  });
  const rels = useQuery({
    queryKey: ["relationships", id],
    queryFn: () => listRelationships(id),
  });

  const personList = useMemo(
    () => persons.data?.persons ?? [],
    [persons.data],
  );
  const focus = (search.focus as string | undefined) ?? personList[0]?.id.value ?? "";
  const direction = (search.dir === "descendants" ? "descendants" : "ancestors") as
    | "ancestors"
    | "descendants";

  const sorted = useMemo(
    () => [...personList].sort((a, b) => preferredName(a).localeCompare(preferredName(b))),
    [personList],
  );

  const [_localFocus, _setLocalFocus] = useState<string>("");
  void _localFocus;
  void _setLocalFocus;

  if (persons.isLoading || rels.isLoading) {
    return <div className="h-96 animate-pulse rounded-lg bg-(--color-bg-sunken)" />;
  }
  if (persons.isError || rels.isError) {
    return (
      <Card>
        <CardBody className="text-(--color-fg-danger)">
          Failed to load tree data.
        </CardBody>
      </Card>
    );
  }
  if (personList.length === 0) {
    return (
      <Card>
        <CardBody className="text-sm text-(--color-fg-muted)">
          No persons in this genealogy yet. Add some via the CLI or the
          proposal flow (phase 5).
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-(--color-fg-secondary)">
            Focus person
          </span>
          <Select
            value={focus}
            onChange={(e) => void nav({ to: ".", search: { focus: e.target.value, dir: direction } as never })}
            className="w-72"
          >
            {sorted.map((p) => (
              <option key={p.id.value} value={p.id.value}>
                {preferredName(p)}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-(--color-fg-secondary)">
            Direction
          </span>
          <Select
            value={direction}
            onChange={(e) => void nav({ to: ".", search: { focus, dir: e.target.value } as never })}
            className="w-44"
          >
            <option value="ancestors">Ancestors</option>
            <option value="descendants">Descendants</option>
          </Select>
        </label>
        <span className="ml-auto text-xs text-(--color-fg-muted)">
          Drag to pan · scroll to zoom · click a person to focus
        </span>
      </div>

      <TreeCanvas
        persons={personList}
        relationships={rels.data?.relationships ?? []}
        focusId={focus}
        direction={direction}
        height={560}
        onSelect={(pid) =>
          void nav({ to: ".", search: { focus: pid, dir: direction } as never })
        }
      />
    </div>
  );
}
