// SPDX-License-Identifier: AGPL-3.0-or-later
import { Card, CardBody } from "@/components";

export function GenealogiesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl tracking-tight">Genealogies</h1>
        <p className="mt-1 text-(--color-fg-secondary)">
          Browse and manage genealogies. Per-genealogy detail views land
          in phase 3.
        </p>
      </header>
      <Card>
        <CardBody className="text-(--color-fg-muted)">
          The full list, search, and filters arrive in the next phase.
          For now, see the Dashboard for a categorised view of the genealogies
          you can access.
        </CardBody>
      </Card>
    </div>
  );
}
