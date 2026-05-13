// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from "@tanstack/react-router";
import { Button, Card, CardBody } from "@/components";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="font-serif text-5xl tracking-tight">404</h1>
      <p className="mt-2 text-(--color-fg-secondary)">
        That page is not in the graph.
      </p>
      <Card className="mt-8 text-left">
        <CardBody className="space-y-2 text-sm text-(--color-fg-secondary)">
          <p>The URL you followed does not match any route in Linea-web.</p>
          <p>
            Try the <Link to="/" className="underline">dashboard</Link>, browse{" "}
            <Link to="/genealogies" className="underline">genealogies</Link>,
            or check the URL.
          </p>
        </CardBody>
      </Card>
      <div className="mt-6">
        <Link to="/">
          <Button variant="primary">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
