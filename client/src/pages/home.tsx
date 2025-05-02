import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { OnboardingModal } from "@/components/OnboardingModal";
import { useApiContext } from "@/context/ApiContext";

export default function Home() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isConnected } = useApiContext();

  useEffect(() => {
    if (isConnected) {
      setIsCollapsed(true);
    }
  }, [isConnected]);

  return (
    <div className="h-screen flex flex-col">
      <Header isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      
      <div className="flex flex-1 h-[calc(100vh-4rem)] overflow-hidden">
        <Sidebar isCollapsed={isCollapsed} />
        <ChatArea />
      </div>
      
      <OnboardingModal />
    </div>
  );
}
