import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  SurchargeTier,
  SubscriptionHypeMultiplier,
  MlDiscount,
  AlaCartePricingMultiplier,
  TwoMlTier,
} from '@/types';

interface PricingRulesData {
  surcharges: SurchargeTier[];
  subHypeMultipliers: SubscriptionHypeMultiplier[];
  mlDiscounts: MlDiscount[];
  alacarteMultipliers: AlaCartePricingMultiplier[];
  twoMlTiers: TwoMlTier[];
}

interface UsePricingRulesResult {
  data: PricingRulesData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePricingRules(): UsePricingRulesResult {
  const query = useQuery({
    queryKey: ['pricing-rules'],
    queryFn: async (): Promise<PricingRulesData> => {
      const [surcharges, subHypeMultipliers, mlDiscounts, alacarteMultipliers, twoMlTiers] = await Promise.all([
        api.master.pricingRules.surcharges(),
        api.master.pricingRules.subHypeMultipliers(),
        api.master.pricingRules.mlDiscounts(),
        api.master.pricingRules.alacarteMultipliers(),
        api.master.pricingRules.twoMlTiers(),
      ]);

      return {
        surcharges,
        subHypeMultipliers,
        mlDiscounts,
        alacarteMultipliers,
        twoMlTiers,
      };
    },
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query.refetch]);

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch,
  };
}
