// ============================================================
// Top Bar — Scan input, camera scanner, search, dark mode, notifications, user
// Design: "Maison Ops" — clean, warm white, gold scan focus
// ============================================================

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ScanBarcode, Search, User, ChevronDown, Moon, Sun, Camera, Activity, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';
import GlobalSearch from '@/components/global/GlobalSearch';
import NotificationBell from '@/components/global/NotificationBell';

const BarcodeScannerDialog = lazy(() => import('@/components/scanner/BarcodeScannerDialog'));
const BottleDetailDrawer = lazy(() => import('@/components/scanner/BottleDetailDrawer'));
const ActivityFeed = lazy(() => import('@/components/global/ActivityFeed'));

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  system_architect: 'System Architect',
  inventory_admin: 'Inventory Admin',
  qc: 'QC',
  viewer: 'Viewer',
  vault_guardian: 'Vault Guardian',
  pod_junior: 'Pod Junior Member',
  pod_leader: 'Pod Leader',
  pod_senior: 'Pod Senior Member',
  user: 'Standard User',
  vault_ops: 'Vault Operations',
  fulfillment_ops: 'Fulfillment Operations',
};

export default function TopBar() {
  const { user, switchRole, logout } = useAuth();
  const { theme, toggleTheme, switchable } = useTheme();
  const [scanValue, setScanValue] = useState('');
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showBottleDetail, setShowBottleDetail] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [resolvedBottleId, setResolvedBottleId] = useState<string | null>(null);
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut: / to focus scan
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        scanRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleScanResult = useCallback((code: string) => {
    setScannedCode(code);
    setShowScanner(false);

    // Try to parse QR JSON to extract bottle ID
    let bottleId: string | null = null;
    try {
      const parsed = JSON.parse(code);
      if (parsed.id) bottleId = parsed.id;
    } catch {
      // Not JSON — check if it's a direct bottle ID or barcode
      if (code.startsWith('BTL-') || code.startsWith('DEC-')) {
        bottleId = code;
      }
    }

    setResolvedBottleId(bottleId);
    setShowBottleDetail(true);
    toast.success('Code scanned', { description: code.substring(0, 50) });
  }, []);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanValue.trim()) return;
    const val = scanValue.trim();
    handleScanResult(val);
    setScanValue('');
  };

  return (
    <>
      <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-3 shrink-0">
        {/* Scan Input */}
        <form onSubmit={handleScan} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={scanRef}
              type="text"
              value={scanValue}
              onChange={e => setScanValue(e.target.value)}
              placeholder='Scan barcode or type ID... (press "/")'
              className={cn(
                'w-full h-9 pl-10 pr-4 text-sm bg-muted/50 border border-border rounded-md',
                'placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50',
                'scan-input transition-all',
              )}
            />
          </div>
          {/* Camera scan button */}
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className={cn(
              'h-9 w-9 flex items-center justify-center rounded-md border border-border transition-all',
              'bg-gradient-to-br from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10',
              'text-amber-600 dark:text-amber-400 hover:shadow-sm',
            )}
            title="Open camera scanner"
          >
            <Camera className="w-4 h-4" />
          </button>
        </form>

        {/* Search — opens GlobalSearch ⌘K */}
        <button
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
          }}
          className="h-9 px-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
        >
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
        </button>

        {/* Activity Feed */}
        <button
          onClick={() => setShowActivityFeed(true)}
          className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="Activity Feed"
        >
          <Activity className="w-4 h-4" />
        </button>

        {/* Dark Mode Toggle */}
        {switchable && toggleTheme && (
          <button
            onClick={toggleTheme}
            className={cn(
              'relative h-9 w-16 rounded-full border border-border transition-colors duration-300',
              theme === 'dark' ? 'bg-zinc-800' : 'bg-amber-50',
            )}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <div
              className={cn(
                'absolute top-1 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm',
                theme === 'dark'
                  ? 'left-[calc(100%-1.75rem)] bg-zinc-600'
                  : 'left-1 bg-amber-400',
              )}
            >
              {theme === 'dark' ? (
                <Moon className="w-3.5 h-3.5 text-blue-200" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-800" />
              )}
            </div>
          </button>
        )}

        {/* Notification Bell */}
        <NotificationBell />

        {/* User / Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
            className="flex items-center gap-2 h-9 px-3 text-sm hover:bg-muted rounded-md transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium leading-none">{user?.fullName || 'User'}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{user ? ROLE_LABELS[user.role] : ''}</p>
            </div>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          {showRoleSwitcher && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowRoleSwitcher(false)} />
              <div className="absolute right-0 top-full mt-1 w-52 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Switch Role (Dev)</p>
                </div>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map(role => (
                  <button
                    key={role}
                    onClick={() => { switchRole(role); setShowRoleSwitcher(false); toast.info(`Switched to ${ROLE_LABELS[role]}`); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors',
                      user?.role === role && 'bg-accent font-medium',
                    )}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sign Out Button */}
        <button
          onClick={logout}
          className={cn(
            'h-9 px-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors',
            'border border-transparent hover:border-destructive/20'
          )}
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden lg:inline font-medium">Sign Out</span>
        </button>
      </header>

      {/* Global Search Dialog (⌘K) */}
      <GlobalSearch />

      {/* Activity Feed Sheet */}
      {showActivityFeed && (
        <Suspense fallback={null}>
          <ActivityFeed open={showActivityFeed} onClose={() => setShowActivityFeed(false)} />
        </Suspense>
      )}

      {/* Camera Scanner Dialog */}
      {showScanner && (
        <Suspense fallback={null}>
          <BarcodeScannerDialog
            open={showScanner}
            onClose={() => setShowScanner(false)}
            onScan={handleScanResult}
          />
        </Suspense>
      )}

      {/* Bottle Detail Drawer */}
      {showBottleDetail && (
        <Suspense fallback={null}>
          <BottleDetailDrawer
            open={showBottleDetail}
            onClose={() => { setShowBottleDetail(false); setScannedCode(null); setResolvedBottleId(null); }}
            bottleId={resolvedBottleId}
            scannedCode={scannedCode}
          />
        </Suspense>
      )}
    </>
  );
}
