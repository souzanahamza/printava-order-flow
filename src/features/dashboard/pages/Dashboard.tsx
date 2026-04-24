import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { AdminDashboard } from "@/features/dashboard/components/AdminDashboard";
import { SalesDashboardSection } from "@/features/dashboard/components/SalesDashboardSection";
import { DesignerDashboard } from "@/features/designer/components/DesignerDashboard";
import { ProductionTaskSection } from "@/features/production/components/ProductionTaskSection";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const {
    loading: roleLoading,
    companyId,
    roles,
    isAdmin,
    isSales,
    isDesigner,
    isProduction,
  } = useUserRole();

  const { data: companyProfile } = useQuery({
    queryKey: ["company-profile", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("currency_id, base_currency:currencies(code, symbol)")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const currency = companyProfile?.base_currency?.code;

  const showAdminBlock = isAdmin && !!companyId;
  const showAdminNoCompany = isAdmin && !companyId;
  const showSalesBlock = isSales && !isAdmin && !!companyId;

  const designerStacked =
    showAdminBlock || showSalesBlock || isProduction;

  const productionStacked = isDesigner || showAdminBlock || showSalesBlock;

  const hasAnyModule =
    showAdminBlock ||
    showAdminNoCompany ||
    showSalesBlock ||
    isDesigner ||
    isProduction;

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const showUnifiedWorkspace = showAdminBlock || showSalesBlock || isDesigner || isProduction;
  const totalStatsCards =
    (showAdminBlock ? 5 : 0) +
    (showSalesBlock ? 4 : 0) +
    (isDesigner ? 4 : 0) +
    (isProduction ? 4 : 0);
  const lgGridColsClass =
    totalStatsCards >= 6
      ? "lg:grid-cols-6"
      : totalStatsCards === 5
        ? "lg:grid-cols-5"
        : totalStatsCards === 4
          ? "lg:grid-cols-4"
          : totalStatsCards === 3
            ? "lg:grid-cols-3"
            : totalStatsCards === 2
              ? "lg:grid-cols-2"
              : "lg:grid-cols-1";
  const defaultOpenSections = [
    (showAdminBlock || showSalesBlock) && "recent-orders-approvals",
    isDesigner && "design-task-pool",
    isProduction && "production-task-queue",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-8">
      {showAdminNoCompany && (
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Your profile is not linked to a company yet. Contact an administrator to assign a company before using the
            admin dashboard.
          </p>
        </div>
      )}

      {showUnifiedWorkspace && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground">
              Your hybrid workspace combines stats and active queues across your assigned roles.
            </p>
          </div>

          <div
            className={cn(
              "grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
              lgGridColsClass
            )}
          >
            {showAdminBlock && (
              <AdminDashboard
                companyId={companyId!}
                currency={currency}
                baseCurrencySymbol={companyProfile?.base_currency?.symbol}
                layout="statsOnly"
              />
            )}
            {showSalesBlock && <SalesDashboardSection layout="statsOnly" />}
            {isDesigner && <DesignerDashboard variant={designerStacked ? "embedded" : "page"} layout="statsOnly" />}
            {isProduction && (
              <ProductionTaskSection variant={productionStacked ? "embedded" : "page"} layout="statsOnly" />
            )}
          </div>

          <Card>
            <Accordion type="multiple" defaultValue={defaultOpenSections} className="w-full">
              {(showAdminBlock || showSalesBlock) && (
                <AccordionItem value="recent-orders-approvals">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <span className="text-lg font-semibold">Recent Orders & Approvals</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="space-y-6">
                      {showAdminBlock && (
                        <AdminDashboard
                          companyId={companyId!}
                          currency={currency}
                          baseCurrencySymbol={companyProfile?.base_currency?.symbol}
                          layout="tasksOnly"
                        />
                      )}
                      {showSalesBlock && <SalesDashboardSection layout="tasksOnly" />}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {isDesigner && (
                <AccordionItem value="design-task-pool">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <span className="text-lg font-semibold">🎨 Design Task Pool</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <DesignerDashboard variant={designerStacked ? "embedded" : "page"} layout="tasksOnly" />
                  </AccordionContent>
                </AccordionItem>
              )}

              {isProduction && (
                <AccordionItem value="production-task-queue">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <span className="text-lg font-semibold">🏭 Production Task Queue</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <ProductionTaskSection variant={productionStacked ? "embedded" : "page"} layout="tasksOnly" />
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </Card>
        </div>
      )}

      {!hasAnyModule && (
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            {roles.length === 0
              ? "No roles are assigned to your account yet. Contact an administrator."
              : "No dashboard modules are available for your current roles. Contact an administrator if you need access."}
          </p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
