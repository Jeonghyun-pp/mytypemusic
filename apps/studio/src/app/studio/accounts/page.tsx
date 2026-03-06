import { Suspense } from "react";
import AccountsView from "./_components/AccountsView";

export default function AccountsPage() {
  return (
    <Suspense>
      <AccountsView />
    </Suspense>
  );
}
