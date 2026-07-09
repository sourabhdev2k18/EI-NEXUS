import { DashboardProvider } from '../context/DashboardContext.jsx';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import { Hero } from '../components/dashboard/Hero.jsx';
import { UseCaseBadges } from '../components/dashboard/UseCaseBadges.jsx';
import { FleetPanel } from '../components/dashboard/FleetPanel.jsx';
import { DigitalTwinPanel } from '../components/dashboard/DigitalTwinPanel.jsx';
import { AutonomousPanel } from '../components/dashboard/AutonomousPanel.jsx';
import { RoiPanel } from '../components/dashboard/RoiPanel.jsx';
import { MetricsPanel } from '../components/dashboard/MetricsPanel.jsx';
import { ToolsPanel } from '../components/dashboard/ToolsPanel.jsx';
import { RcaPanel } from '../components/dashboard/RcaPanel.jsx';
import { AriaChatWidget } from '../components/chat/AriaChatWidget.jsx';
import { Seo } from '../components/common/Seo.jsx';
import layout from '../layouts/DashboardLayout.module.css';

export default function DashboardPage() {
  return (
    <DashboardProvider>
      <Seo title="EI-Nexus - Root-Cause Intelligence Twin" description="Autonomous engineering intelligence twin for root-cause analysis and process optimization." />
      <DashboardLayout>
        <Hero />
        <UseCaseBadges />
        <div className={layout.grid}>
          <div>
            <FleetPanel />
            <DigitalTwinPanel />
            <AutonomousPanel />
            <RoiPanel />
            <MetricsPanel />
            <ToolsPanel />
          </div>
          <div>
            <RcaPanel />
          </div>
        </div>
        <footer>EI-Nexus RCA - offline-first - Gemini-optional - built for LTTS OpenHack 2026 - Big Bet 3 (Energy & Digital Manufacturing) x Big Bet 5/6 (AI Infra Self-Diagnosis / MCP Copilot)</footer>
        <AriaChatWidget />
      </DashboardLayout>
    </DashboardProvider>
  );
}
