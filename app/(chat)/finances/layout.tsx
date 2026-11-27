import type { ReactNode } from "react";

import { FinancesShell } from "@/components/finances/finances-shell";

export default function FinancesLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <FinancesShell>{children}</FinancesShell>;
}
