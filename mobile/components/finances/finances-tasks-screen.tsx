import { FinancesSubnav } from "@/components/finances/finances-subnav";
import { TasksScreen } from "@/components/tasks/tasks-screen";
import { FINANCES_AREA_ROOT } from "@/src/finance-tasks";

/** Finances → Tasks: life-area subtree for Finances (Budget, Taxes, …). */
export function FinancesTasksScreen() {
  return (
    <TasksScreen
      leading="drawer"
      title="Finances"
      header={<FinancesSubnav />}
      areaRootName={FINANCES_AREA_ROOT}
      defaultAreaName={FINANCES_AREA_ROOT}
    />
  );
}
