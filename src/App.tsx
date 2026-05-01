import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { Header } from './components/Header';
import { Nav } from './components/Nav';
import { SettingsDrawer } from './components/SettingsDrawer';
import { SyncIndicator } from './components/SyncIndicator';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { useStore } from './store';
import type { TabId } from './types';

import { Overview } from './tabs/Overview';
import { Budget } from './tabs/Budget';
import { Guests } from './tabs/Guests';
import { Venues } from './tabs/Venues';
import { Checklist } from './tabs/Checklist';
import { Vendors } from './tabs/Vendors';
import { Seating } from './tabs/Seating';
import { Timeline } from './tabs/Timeline';
import { Registry } from './tabs/Registry';
import { Gifts } from './tabs/Gifts';
import { Honeymoon } from './tabs/Honeymoon';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const theme = useStore((s) => s.settings.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenMobileNav={() => setMobileNavOpen(true)}
      />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-8 md:flex md:gap-8">
        <Nav
          active={activeTab}
          onChange={setActiveTab}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />

        <main className="flex-1 min-w-0">
          {activeTab === 'overview' && <Overview onJump={setActiveTab} />}
          {activeTab === 'budget' && <Budget />}
          {activeTab === 'guests' && <Guests />}
          {activeTab === 'venues' && <Venues />}
          {activeTab === 'checklist' && <Checklist />}
          {activeTab === 'vendors' && <Vendors />}
          {activeTab === 'seating' && <Seating />}
          {activeTab === 'timeline' && <Timeline />}
          {activeTab === 'registry' && <Registry />}
          {activeTab === 'gifts' && <Gifts />}
          {activeTab === 'honeymoon' && <Honeymoon />}
        </main>
      </div>

      <footer className="no-print py-6 text-center text-xs text-muted">
        Made with care • <SyncIndicator />
      </footer>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ConfirmDialog />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgb(var(--c-surface))',
            color: 'rgb(var(--c-ink))',
            border: '1px solid rgb(var(--c-border))',
            fontSize: 13,
          },
        }}
      />
    </div>
  );
}

export default App;
