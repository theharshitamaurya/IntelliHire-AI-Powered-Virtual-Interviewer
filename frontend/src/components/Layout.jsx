import React from "react";
import {
  Home,
  Brain,
  LayoutDashboard,
  Target,
  MessageSquare,
} from "lucide-react";

const AppTab = {
  Home: "home",
  Practice: "practice",
  JDMode: "jdmode",
  Interview: "interview",
  Analytics: "analytics",
};

export const Layout = ({ activeTab, setActiveTab, children }) => {
  const tabs = [
    { id: AppTab.Home, label: "Home", icon: Home },
    { id: AppTab.Practice, label: "Practice", icon: Target },
    { id: AppTab.JDMode, label: "JD Mode", icon: MessageSquare },
    { id: AppTab.Interview, label: "Live Interview", icon: Brain },
    { id: AppTab.Analytics, label: "Analytics", icon: LayoutDashboard },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Logo Section */}
          <div
            className="flex items-center space-x-2 cursor-pointer group"
            onClick={() => setActiveTab(AppTab.Home)}
          >
            <div className="bg-indigo-600 p-1.5 rounded-lg group-hover:scale-110 transition-transform">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              IntelliHire <span className="text-indigo-400">AI</span>
            </span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap justify-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl mx-auto w-full p-4 md:p-8">
        {children}
      </main>

      {/* Footer - Updated for Groq */}
      <footer className="py-8 text-center text-slate-500 text-sm border-t border-slate-800 mt-auto">
        <div className="flex flex-col items-center gap-2">
          <p>
            &copy; {new Date().getFullYear()} IntelliHire AI. All rights
            reserved.
          </p>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
            <span>Powered by</span>
            <span className="text-indigo-500">Groq Llama-3</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
