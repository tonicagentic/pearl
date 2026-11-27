import { AnswersScreen } from "@/components/settings/answers-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Profile → Answers. Sources Pearl can use. */
export default function AnswersRoute() {
  return (
    <RequireSignedIn>
      <AnswersScreen />
    </RequireSignedIn>
  );
}
