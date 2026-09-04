import { MachineProvider } from "@/components/MachineProvider";
import { PlaygroundDrawer } from "@/components/PlaygroundDrawer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MachineProvider>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      <PlaygroundDrawer />
    </MachineProvider>
  );
}
