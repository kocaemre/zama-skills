// Temporary placeholder page — Plan 03 replaces this with the Magic UI hero,
// balance card, mint, and transfer screens. For now it just confirms the
// dark-mode shell renders and the Connect button mounts.

import { Connect } from "@/components/Connect";

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container flex min-h-screen flex-col items-center justify-center gap-6 py-12 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Confidential Demo Token
        </h1>
        <p className="max-w-prose text-muted-foreground">
          Shell ready. Plan 03 will mount the balance card, mint, and transfer
          flows here.
        </p>
        <Connect />
      </div>
    </main>
  );
}
