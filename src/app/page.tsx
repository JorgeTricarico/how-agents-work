import Background from "@/components/Background";
import Hero from "@/components/Hero";
import AgentLoop from "@/components/AgentLoop";
import PromptInspector from "@/components/PromptInspector";
import ToolComparator from "@/components/ToolComparator";
import HookFlow from "@/components/HookFlow";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="relative w-full">
      <Background />
      <Hero />
      <AgentLoop />
      <PromptInspector />
      <ToolComparator />
      <HookFlow />
      <Footer />
    </main>
  );
}
