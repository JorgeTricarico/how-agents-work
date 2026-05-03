import Background from "@/components/Background";
import CinematicScene from "@/components/CinematicScene";
import AgentLoop from "@/components/AgentLoop";
import ToolComparator from "@/components/ToolComparator";
import HookFlow from "@/components/HookFlow";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="relative w-full">
      <Background />
      <CinematicScene />
      <AgentLoop />
      <ToolComparator />
      <HookFlow />
      <Footer />
    </main>
  );
}
