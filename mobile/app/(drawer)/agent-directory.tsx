import { AgentDirectoryScreen } from "@/components/home/agent-directory-screen";
import { DrawerScene } from "@/components/navigation/drawer-scene";

export default function AgentDirectoryRoute() {
  return (
    <DrawerScene>
      <AgentDirectoryScreen />
    </DrawerScene>
  );
}
