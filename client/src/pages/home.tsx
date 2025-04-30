import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { OnboardingModal } from "@/components/OnboardingModal";

export default function Home() {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      
      <div className="flex flex-1 h-[calc(100vh-4rem)] overflow-hidden">
        <Sidebar />
        <ChatArea />
      </div>
      
      <OnboardingModal />
    </div>
  );
}
