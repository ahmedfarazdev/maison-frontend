import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import AppLayout from "./components/layout/AppLayout";

// ---- Page imports ----
import Dashboard from "./pages/Dashboard";
import Station0 from "./pages/stations/Station0";
import Station1 from "./pages/stations/Station1";
import Station2 from "./pages/stations/Station2";
import Station3 from "./pages/stations/Station3";
import Station4 from "./pages/stations/Station4";
import Station5 from "./pages/stations/Station5";
import Station6 from "./pages/stations/Station6";
import ManualDecant from "./pages/ManualDecant";
import CreateProducts from "./pages/production/CreateProducts";
import ProductionJobs from "./pages/production/ProductionJobs";
import ProductionManagement from "./pages/production/ProductionManagement";
import OneTimeOrderProduction from "./pages/production/OneTimeOrderProduction";
import SubscriptionCycleProduction from "./pages/production/SubscriptionCycleProduction";
import JobBoard from "./pages/jobs/JobBoard";
import DayTracker from "./pages/DayTracker";
import VaultGuardian from "./pages/VaultGuardian";
// Deprecated: WorkAllocation, ShiftHandover, JobCreation — redirected to /ops/*
import OrderGrouping from "./pages/OrderGrouping";
import OperatorPerformance from "./pages/OperatorPerformance";
import OneTimeOrders from "./pages/orders/OneTimeOrders";
import Subscriptions from "./pages/orders/Subscriptions";
import PerfumeOfTheMonth from "./pages/PerfumeOfTheMonth";
import SealedVault from "./pages/inventory/SealedVault";
import DecantingPool from "./pages/inventory/DecantingPool";
import PackagingInventory from "./pages/inventory/PackagingInventory";
import StockReconciliation from "./pages/inventory/StockReconciliation";
import PerfumeMaster from "./pages/master/PerfumeMaster";
import BrandsPage from "./pages/master/BrandsPage";
import {
  AuraDefinitions, FragranceFamilies, FiltersAndTags, PricingRules,
} from "./pages/master/MasterDataPages";
import VaultLocationsPage from "./pages/master/VaultLocationsPage";
import SuppliersFullPage from "./pages/master/SuppliersPage";
import SyringesRegistryPage from "./pages/master/SyringesRegistryPage";
import PackagingSKUsPage from "./pages/master/PackagingSKUsPage";
import SupplierAnalyticsPage from "./pages/master/SupplierAnalyticsPage";
import Ledger from "./pages/Ledger";
import InventoryCostReport from "./pages/reports/InventoryCostReport";
import SupplierSpendReport from "./pages/reports/SupplierSpendReport";
import PackagingCostReport from "./pages/reports/PackagingCostReport";
import UnifiedProcurementReport from "./pages/reports/UnifiedProcurementReport";
import MarginAnalysisReport from "./pages/reports/MarginAnalysisReport";
import PurchaseOrders from "./pages/procurement/PurchaseOrders";
import QuickPO from "./pages/procurement/QuickPO";
import Settings from "./pages/Settings";
import PrintQueue from "./pages/PrintQueue";
import CustomerProfiles from "./pages/crm/CustomerProfiles";
import DailyOpsReport from "./pages/reports/DailyOpsReport";
import Returns from "./pages/orders/Returns";
import Exchanges from "./pages/orders/Exchanges";
import ProductPnL from "./pages/reports/ProductPnL";
import SubscriptionHealth from "./pages/crm/SubscriptionHealth";
import PromoCodes from "./pages/crm/PromoCodes";
import InvoiceGenerator from "./pages/reports/InvoiceGenerator";
import BOMSetup from "./pages/bom/BOMSetup";
import EndProducts from "./pages/bom/EndProducts";
import BOMsCreation from "./pages/bom/BOMsCreation";
import ComponentLibrary from "./pages/bom/ComponentLibrary";
import OrderMapping from "./pages/bom/OrderMapping";
import InventoryImpact from "./pages/bom/InventoryImpact";
import SetupGuide from "./pages/bom/SetupGuide";
import DecantingGuide from "./pages/guides/DecantingGuide";
import InventoryGuide from "./pages/guides/InventoryGuide";
import ProcurementGuide from "./pages/guides/ProcurementGuide";
import MasterDataGuide from "./pages/guides/MasterDataGuide";
import UserAccessGuide from "./pages/guides/UserAccessGuide";
import OperationsGuide from "./pages/guides/OperationsGuide";
import ProductsGuide from "./pages/guides/ProductsGuide";
import OrdersGuide from "./pages/guides/OrdersGuide";
import BOMPricingReport from "./pages/reports/BOMPricingReport";
import RevenueComparison from "./pages/reports/RevenueComparison";
import ReportsGuide from "./pages/reports/ReportsGuide";
import WelcomeDashboard from "./pages/WelcomeDashboard";
import Capsules from "./pages/capsules/Capsules";
import CapsulePerformance from "./pages/capsules/CapsulePerformance";
import EmVault from "./pages/em-vault/EmVault";
import EmVaultAccess from "./pages/em-vault/EmVaultAccess";
import Gifting from "./pages/gifting/Gifting";
import GiftSubscriptions from "./pages/gifting/GiftSubscriptions";
import GiftSets from "./pages/gifting/GiftSets";
import GiftCards from "./pages/gifting/GiftCards";
import CorporateGifting from "./pages/gifting/CorporateGifting";
import GiftSetPerformance from "./pages/gifting/GiftSetPerformance";
import DemandPlanning from "./pages/subscriptions/DemandPlanning";
import PerfumeForecast from "./pages/subscriptions/PerfumeForecast";
import SellThroughReport from "./pages/reports/SellThroughReport";
import NotesLibrary from "./pages/master/NotesLibrary";
import OrderDefinitions from "./pages/setup/OrderDefinitions";
import SubscriptionPricingSetup from "./pages/setup/SubscriptionPricingSetup";
import OperationsConfig from "./pages/setup/OperationsConfig";
import OperationalDefaults from "./pages/setup/OperationalDefaults";
import RTSFinance from "./pages/inventory/RTSFinance";
import RTSLedger from "./pages/inventory/RTSLedger";
import PodDashboard from "./pages/ops/PodDashboard";
import ProductionQueue from "./pages/ops/ProductionQueue";
import FulfillmentQueue from "./pages/ops/FulfillmentQueue";
import MasterDashboard from "./pages/ops/MasterDashboard";
import JobLedger from "./pages/ops/JobLedger";
import AuraKeyProcessing from "./pages/orders/AuraKeyProcessing";
import ReadyProductFulfillment from "./pages/orders/ReadyProductFulfillment";
import JobAllocation from "./pages/jobs/JobAllocation";
import Fulfillment from "./pages/fulfillment/Fulfillment";
import Shipping from "./pages/fulfillment/Shipping";
import ShippingLedger from "./pages/fulfillment/ShippingLedger";
import ReadyToShipModule from "./pages/ready-to-ship/ReadyToShipModule";
import SubscriptionCyclesModule from "./pages/subscription-cycles/SubscriptionCyclesModule";
import OneTimeOrdersModule from "./pages/one-time-orders/OneTimeOrdersModule";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      {/* Redirect root to welcome */}
      <Route path="/"><Redirect to="/welcome" /></Route>

      {/* All pages wrapped in AppLayout */}
      <Route path="/welcome">{() => <AppLayout><WelcomeDashboard /></AppLayout>}</Route>
      <Route path="/dashboard">{() => <AppLayout><Dashboard /></AppLayout>}</Route>

      {/* Station 0 — shared */}
      <Route path="/stations/0-stock-register">{() => <AppLayout><Station0 /></AppLayout>}</Route>

      {/* ═══════════════════════════════════════════════════ */}
      {/* PRODUCTION PLANNING (legacy routes still accessible) */}
      {/* ═══════════════════════════════════════════════════ */}
      <Route path="/ready-to-ship">{() => <AppLayout><ReadyToShipModule /></AppLayout>}</Route>
      <Route path="/ready-to-ship/create"><Redirect to="/ready-to-ship" /></Route>
      <Route path="/ready-to-ship/jobs">{() => <AppLayout><ProductionJobs /></AppLayout>}</Route>
      <Route path="/ready-to-ship/rts-finance">{() => <AppLayout><RTSFinance /></AppLayout>}</Route>
      <Route path="/ready-to-ship/rts-ledger">{() => <AppLayout><RTSLedger /></AppLayout>}</Route>
      <Route path="/subscription-cycles">{() => <AppLayout><SubscriptionCyclesModule /></AppLayout>}</Route>
      <Route path="/one-time-orders">{() => <AppLayout><OneTimeOrdersModule /></AppLayout>}</Route>

      {/* Legacy redirects for old production paths */}
      <Route path="/production/management"><Redirect to="/ready-to-ship" /></Route>
      <Route path="/production/create"><Redirect to="/ready-to-ship/create" /></Route>
      <Route path="/production/jobs"><Redirect to="/ready-to-ship/jobs" /></Route>
      <Route path="/production/one-time"><Redirect to="/one-time-orders" /></Route>
      <Route path="/production/subscription"><Redirect to="/subscription-cycles" /></Route>

      {/* ═══════════════════════════════════════════════════ */}
      {/* OPERATIONS — Pod Architecture */}
      {/* ═══════════════════════════════════════════════════ */}
      <Route path="/ops/pod-dashboard">{() => <AppLayout><PodDashboard /></AppLayout>}</Route>
      <Route path="/ops/production-queue">{() => <AppLayout><ProductionQueue /></AppLayout>}</Route>
      <Route path="/ops/fulfillment-queue">{() => <AppLayout><FulfillmentQueue /></AppLayout>}</Route>
      <Route path="/ops/master-dashboard">{() => <AppLayout><MasterDashboard /></AppLayout>}</Route>
      <Route path="/ops/job-allocation">{() => <AppLayout><JobAllocation /></AppLayout>}</Route>
      <Route path="/ops/job-ledger">{() => <AppLayout><JobLedger /></AppLayout>}</Route>

      {/* Legacy redirects for removed pages */}
      <Route path="/ops/order-grouping">{() => <AppLayout><OrderGrouping /></AppLayout>}</Route>
      <Route path="/order-grouping"><Redirect to="/ops/order-grouping" /></Route>
      <Route path="/jobs/allocation"><Redirect to="/ops/job-allocation" /></Route>
      <Route path="/jobs/team-assignments"><Redirect to="/ops/pod-dashboard" /></Route>
      <Route path="/jobs/station-assignments"><Redirect to="/ops/pod-dashboard" /></Route>

      {/* ═══════════════════════════════════════════════════ */}
      {/* POD FRAMEWORK — Station Ops (no S-numbers) */}
      {/* ═══════════════════════════════════════════════════ */}
      <Route path="/ops/picking">{() => <AppLayout><Station2 /></AppLayout>}</Route>
      <Route path="/ops/labeling">{() => <AppLayout><Station3 /></AppLayout>}</Route>
      <Route path="/ops/decanting">{() => <AppLayout><Station4 /></AppLayout>}</Route>
      <Route path="/ops/qc-assembly">{() => <AppLayout><Station5 /></AppLayout>}</Route>
      <Route path="/ops/shipping">{() => <AppLayout><Shipping /></AppLayout>}</Route>

      {/* Legacy S-number station path redirects */}
      <Route path="/stations/1-job-board"><Redirect to="/ops/pod-dashboard" /></Route>
      <Route path="/stations/2-picking"><Redirect to="/ops/picking" /></Route>
      <Route path="/stations/3-labeling"><Redirect to="/ops/labeling" /></Route>
      <Route path="/stations/4-decanting"><Redirect to="/ops/decanting" /></Route>
      <Route path="/stations/5-qc-assembly"><Redirect to="/ops/qc-assembly" /></Route>
      <Route path="/stations/6-shipping-dispatch"><Redirect to="/ops/shipping" /></Route>
      <Route path="/stations/3-prep-label"><Redirect to="/ops/labeling" /></Route>
      <Route path="/stations/4-batch-decant"><Redirect to="/ops/decanting" /></Route>
      <Route path="/stations/5-fulfillment"><Redirect to="/ops/qc-assembly" /></Route>
      <Route path="/stations/6-shipping"><Redirect to="/ops/shipping" /></Route>
      <Route path="/stations/6-final-check"><Redirect to="/ops/shipping" /></Route>
      <Route path="/stations/picking"><Redirect to="/ops/picking" /></Route>
      <Route path="/stations/labeling"><Redirect to="/ops/labeling" /></Route>
      <Route path="/stations/decanting"><Redirect to="/ops/decanting" /></Route>
      <Route path="/stations/qc-assembly"><Redirect to="/ops/qc-assembly" /></Route>
      <Route path="/stations/shipping-dispatch"><Redirect to="/ops/shipping" /></Route>

      <Route path="/manual-decant">{() => <AppLayout><ManualDecant /></AppLayout>}</Route>

      <Route path="/day-tracker">{() => <AppLayout><DayTracker /></AppLayout>}</Route>
      <Route path="/vault-guardian">{() => <AppLayout><VaultGuardian /></AppLayout>}</Route>
      {/* Legacy redirects for deprecated ops pages */}
      <Route path="/task-tracker"><Redirect to="/ops/pod-dashboard" /></Route>
      <Route path="/job-creation"><Redirect to="/ops/job-allocation" /></Route>
      <Route path="/work-allocation"><Redirect to="/ops/pod-dashboard" /></Route>
      <Route path="/shift-handover"><Redirect to="/ops/pod-dashboard" /></Route>
      <Route path="/operator-performance"><Redirect to="/reports/operator-performance" /></Route>
      <Route path="/reports/operator-performance">{() => <AppLayout><OperatorPerformance /></AppLayout>}</Route>

      {/* Orders / CRM */}
      <Route path="/orders/one-time">{() => <AppLayout><OneTimeOrders /></AppLayout>}</Route>
      <Route path="/orders/subscriptions">{() => <AppLayout><Subscriptions /></AppLayout>}</Route>
      <Route path="/orders/potm">{() => <AppLayout><PerfumeOfTheMonth /></AppLayout>}</Route>
      <Route path="/orders/customers">{() => <AppLayout><CustomerProfiles /></AppLayout>}</Route>
      <Route path="/orders/returns">{() => <AppLayout><Returns /></AppLayout>}</Route>
      <Route path="/orders/exchanges">{() => <AppLayout><Exchanges /></AppLayout>}</Route>
      <Route path="/orders/aura-key">{() => <AppLayout><AuraKeyProcessing /></AppLayout>}</Route>
      <Route path="/orders/ready-products">{() => <AppLayout><ReadyProductFulfillment /></AppLayout>}</Route>

      {/* CRM */}
      <Route path="/crm/customers">{() => <AppLayout><CustomerProfiles /></AppLayout>}</Route>
      <Route path="/crm/subscription-health">{() => <AppLayout><SubscriptionHealth /></AppLayout>}</Route>
      <Route path="/crm/promo-codes">{() => <AppLayout><PromoCodes /></AppLayout>}</Route>
      <Route path="/orders/subscription-health"><Redirect to="/reports/subscription-health" /></Route>
      <Route path="/reports/invoices">{() => <AppLayout><InvoiceGenerator /></AppLayout>}</Route>

      {/* Inventory (Ready-to-Ship route is first match above) */}
      <Route path="/inventory/sealed-vault">{() => <AppLayout><SealedVault /></AppLayout>}</Route>
      <Route path="/inventory/decanting-pool">{() => <AppLayout><DecantingPool /></AppLayout>}</Route>
      <Route path="/inventory/packaging">{() => <AppLayout><PackagingInventory /></AppLayout>}</Route>
      <Route path="/inventory/reconciliation">{() => <AppLayout><StockReconciliation /></AppLayout>}</Route>

      {/* Master Data */}
      <Route path="/master/perfumes">{() => <AppLayout><PerfumeMaster /></AppLayout>}</Route>
      <Route path="/master/brands">{() => <AppLayout><BrandsPage /></AppLayout>}</Route>
      <Route path="/master/auras">{() => <AppLayout><AuraDefinitions /></AppLayout>}</Route>
      <Route path="/master/families">{() => <AppLayout><FragranceFamilies /></AppLayout>}</Route>
      <Route path="/master/filters">{() => <AppLayout><FiltersAndTags /></AppLayout>}</Route>
      <Route path="/master/pricing">{() => <AppLayout><PricingRules /></AppLayout>}</Route>
      <Route path="/master/locations">{() => <AppLayout><VaultLocationsPage /></AppLayout>}</Route>
      <Route path="/master/suppliers">{() => <AppLayout><SuppliersFullPage /></AppLayout>}</Route>
      <Route path="/master/syringes">{() => <AppLayout><SyringesRegistryPage /></AppLayout>}</Route>
      <Route path="/master/packaging-skus">{() => <AppLayout><PackagingSKUsPage /></AppLayout>}</Route>
      <Route path="/master/supplier-analytics"><Redirect to="/reports/supplier-analytics" /></Route>
      <Route path="/reports/supplier-analytics">{() => <AppLayout><SupplierAnalyticsPage /></AppLayout>}</Route>

      {/* Capsules */}
      <Route path="/capsules">{() => <AppLayout><Capsules /></AppLayout>}</Route>
      <Route path="/capsules/performance">{() => <AppLayout><CapsulePerformance /></AppLayout>}</Route>

      {/* Em Vault */}
      <Route path="/em-vault">{() => <AppLayout><EmVault /></AppLayout>}</Route>
      <Route path="/em-vault/access">{() => <AppLayout><EmVaultAccess /></AppLayout>}</Route>

      {/* Subscription Management */}
      <Route path="/subscriptions/cycles">{() => <AppLayout><Subscriptions /></AppLayout>}</Route>
      <Route path="/subscriptions/forecast">{() => <AppLayout><PerfumeForecast /></AppLayout>}</Route>
      <Route path="/subscriptions/demand">{() => <AppLayout><DemandPlanning /></AppLayout>}</Route>
      <Route path="/subscriptions/active-cycle">{() => <AppLayout><SubscriptionCycleProduction /></AppLayout>}</Route>
      <Route path="/subscriptions/cycle-history">{() => <AppLayout><SubscriptionCyclesModule /></AppLayout>}</Route>

      {/* Gifting */}
      <Route path="/gifting">{() => <AppLayout><Gifting /></AppLayout>}</Route>
      <Route path="/gifting/subscriptions">{() => <AppLayout><GiftSubscriptions /></AppLayout>}</Route>
      <Route path="/gifting/sets">{() => <AppLayout><GiftSets /></AppLayout>}</Route>
      <Route path="/gifting/cards">{() => <AppLayout><GiftCards /></AppLayout>}</Route>
      <Route path="/gifting/corporate">{() => <AppLayout><CorporateGifting /></AppLayout>}</Route>
      <Route path="/gifting/performance">{() => <AppLayout><GiftSetPerformance /></AppLayout>}</Route>

      {/* Ledger */}
      <Route path="/ledger">{() => <AppLayout><Ledger /></AppLayout>}</Route>
      <Route path="/ledger/timeline">{() => <AppLayout><Ledger defaultTab="timeline" /></AppLayout>}</Route>
      <Route path="/ledger/bottle">{() => <AppLayout><Ledger defaultTab="bottle" /></AppLayout>}</Route>
      <Route path="/ledger/decant">{() => <AppLayout><Ledger defaultTab="decant" /></AppLayout>}</Route>
      <Route path="/ledger/purchase">{() => <AppLayout><Ledger defaultTab="purchase" /></AppLayout>}</Route>
      <Route path="/ledger/shipping">{() => <AppLayout><ShippingLedger /></AppLayout>}</Route>

      {/* Procurement */}
      <Route path="/procurement/purchase-orders">{() => <AppLayout><PurchaseOrders /></AppLayout>}</Route>
      <Route path="/procurement/quick-po">{() => <AppLayout><QuickPO /></AppLayout>}</Route>
      <Route path="/procurement/packaging-pos"><Redirect to="/procurement/purchase-orders" /></Route>

      {/* Reports */}
      <Route path="/reports/guide">{() => <AppLayout><ReportsGuide /></AppLayout>}</Route>
      <Route path="/reports/cost">{() => <AppLayout><InventoryCostReport /></AppLayout>}</Route>
      <Route path="/reports/supplier-spend">{() => <AppLayout><SupplierSpendReport /></AppLayout>}</Route>
      <Route path="/reports/packaging-cost">{() => <AppLayout><PackagingCostReport /></AppLayout>}</Route>
      <Route path="/reports/procurement">{() => <AppLayout><UnifiedProcurementReport /></AppLayout>}</Route>
      <Route path="/reports/margin-analysis">{() => <AppLayout><MarginAnalysisReport /></AppLayout>}</Route>
      <Route path="/reports/daily-ops">{() => <AppLayout><DailyOpsReport /></AppLayout>}</Route>
      <Route path="/reports/product-pnl">{() => <AppLayout><ProductPnL /></AppLayout>}</Route>
      <Route path="/reports/subscription-health">{() => <AppLayout><SubscriptionHealth /></AppLayout>}</Route>
      <Route path="/reports/bom-pricing">{() => <AppLayout><BOMPricingReport /></AppLayout>}</Route>
      <Route path="/reports/revenue-comparison">{() => <AppLayout><RevenueComparison /></AppLayout>}</Route>
      <Route path="/reports/sell-through">{() => <AppLayout><SellThroughReport /></AppLayout>}</Route>

      {/* BOM */}
      <Route path="/bom/end-products">{() => <AppLayout><EndProducts /></AppLayout>}</Route>
      <Route path="/bom/boms-creation">{() => <AppLayout><BOMsCreation /></AppLayout>}</Route>
      <Route path="/bom/setup"><Redirect to="/bom/end-products" /></Route>
      <Route path="/bom/components">{() => <AppLayout><ComponentLibrary /></AppLayout>}</Route>
      <Route path="/bom/order-mapping">{() => <AppLayout><OrderMapping /></AppLayout>}</Route>
      <Route path="/bom/inventory-impact">{() => <AppLayout><InventoryImpact /></AppLayout>}</Route>
      <Route path="/bom/guide">{() => <AppLayout><SetupGuide /></AppLayout>}</Route>

      {/* Setup Guides */}
      <Route path="/guides/user-access">{() => <AppLayout><UserAccessGuide /></AppLayout>}</Route>
      <Route path="/guides/decanting">{() => <AppLayout><DecantingGuide /></AppLayout>}</Route>
      <Route path="/guides/inventory">{() => <AppLayout><InventoryGuide /></AppLayout>}</Route>
      <Route path="/guides/procurement">{() => <AppLayout><ProcurementGuide /></AppLayout>}</Route>
      <Route path="/guides/master-data">{() => <AppLayout><MasterDataGuide /></AppLayout>}</Route>
      <Route path="/guides/operations">{() => <AppLayout><OperationsGuide /></AppLayout>}</Route>
      <Route path="/guides/products">{() => <AppLayout><ProductsGuide /></AppLayout>}</Route>
      <Route path="/guides/orders">{() => <AppLayout><OrdersGuide /></AppLayout>}</Route>

      {/* System Setup */}
      <Route path="/system-setup/order-definitions">{() => <AppLayout><OrderDefinitions /></AppLayout>}</Route>
      <Route path="/system-setup/operations">{() => <AppLayout><OperationsConfig /></AppLayout>}</Route>
      <Route path="/system-setup/operational-defaults">{() => <AppLayout><OperationalDefaults /></AppLayout>}</Route>
      <Route path="/system-setup/fragrance-families"><Redirect to="/master/families" /></Route>
      <Route path="/system-setup/filters-tags"><Redirect to="/master/filters" /></Route>
      <Route path="/system-setup/pricing-rules"><Redirect to="/master/pricing" /></Route>
      <Route path="/system-setup/subscription-pricing">{() => <AppLayout><SubscriptionPricingSetup /></AppLayout>}</Route>
      <Route path="/system-setup/notes-library">{() => <AppLayout><NotesLibrary /></AppLayout>}</Route>

      {/* Operations */}
      <Route path="/print-queue">{() => <AppLayout><PrintQueue /></AppLayout>}</Route>

      {/* Settings */}
      <Route path="/settings">{() => <AppLayout><Settings /></AppLayout>}</Route>

      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route>{() => <AppLayout><NotFound /></AppLayout>}</Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
