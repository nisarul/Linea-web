// SPDX-License-Identifier: AGPL-3.0-or-later
import { Badge, Button, Card, CardBody, CardHeader, Input } from "@/components";

/**
 * DesignSystemPage demonstrates the tokens + seed component
 * library. Useful as a living style reference during development.
 */
export function DesignSystemPage() {
  return (
    <div className="space-y-10">
        <section>
          <h1 className="font-serif text-3xl tracking-tight">Design system</h1>
          <p className="mt-2 max-w-prose text-(--color-fg-secondary)">
            Linea-web design tokens, theming primitives, and the seed component
            library. Switch the theme with the toggle in the header — light,
            dark, and system are all first-class.
          </p>
        </section>

        <Card>
          <CardHeader>
            <h2 className="font-serif text-lg tracking-tight">Buttons</h2>
          </CardHeader>
          <CardBody className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" isLoading>
              Submitting
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-serif text-lg tracking-tight">Inputs</h2>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Search persons" />
            <Input placeholder="Invalid input" invalid defaultValue="not a uuid" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-serif text-lg tracking-tight">Badges</h2>
          </CardHeader>
          <CardBody className="flex flex-wrap items-center gap-2">
            <Badge>Neutral</Badge>
            <Badge tone="accent">Owner</Badge>
            <Badge tone="info">Probable</Badge>
            <Badge tone="success">Accepted</Badge>
            <Badge tone="warn">Gapped</Badge>
            <Badge tone="danger">Rejected</Badge>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-serif text-lg tracking-tight">Multilingual names</h2>
          </CardHeader>
          <CardBody className="space-y-2 text-base">
            <p>
              Persons can carry multiple names in different scripts. Linea
              honours each name's writing direction:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <bdi>Suleiman the Magnificent</bdi>{" "}
                <span className="text-(--color-fg-muted)">·</span>{" "}
                <bdi lang="ar" dir="auto">سليمان القانوني</bdi>
              </li>
              <li>
                <bdi>Genghis Khan</bdi>{" "}
                <span className="text-(--color-fg-muted)">·</span>{" "}
                <bdi lang="mn" dir="auto">Чингис хаан</bdi>
              </li>
            </ul>
          </CardBody>
        </Card>
    </div>
  );
}
