import { round2 } from "@/lib/accounting/math";

export type DepreciationMethod = "declining_30" | "straight_20" | "straight_25" | "building_4";

export type FixedAssetInput = {
  id: string;
  description: string;
  category: string;
  acquisitionDate: Date;
  acquisitionCost: number;
  depreciationMethod: string;
  disposalDate: Date | null;
  disposalValue: number | null;
};

export type DepreciationResult = {
  assetId: string;
  description: string;
  acquisitionCost: number;
  method: string;
  yearDepreciation: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  isDisposed: boolean;
  disposalGainLoss: number;
};

/**
 * Calculate straight-line depreciation for one year.
 * rate = annual depreciation fraction (e.g. 0.20 = 20%).
 */
const straightLineYear = (cost: number, rate: number, yearsOwned: number): number => {
  const totalDepreciable = cost;
  const yearlyAmount = round2(totalDepreciable * rate);
  // Accumulated cannot exceed cost
  const accumulated = Math.min(round2(yearlyAmount * yearsOwned), cost);
  return Math.min(yearlyAmount, round2(cost - Math.min(round2(yearlyAmount * (yearsOwned - 1)), cost)));
};

const straightLineAccumulated = (cost: number, rate: number, yearsOwned: number): number => {
  return Math.min(round2(round2(cost * rate) * yearsOwned), cost);
};

/**
 * Calculate declining-balance (30%) depreciation for one year.
 * Each year: depreciation = netBookValue × 30%.
 */
const decliningBalanceYear = (cost: number, ratePerYear: number, yearsOwned: number): number => {
  let nbv = cost;
  let depreciationThisYear = 0;
  for (let year = 1; year <= yearsOwned; year++) {
    depreciationThisYear = round2(nbv * ratePerYear);
    if (year < yearsOwned) {
      nbv = round2(nbv - depreciationThisYear);
    }
  }
  return depreciationThisYear;
};

const decliningBalanceAccumulated = (cost: number, ratePerYear: number, yearsOwned: number): number => {
  let nbv = cost;
  for (let year = 0; year < yearsOwned; year++) {
    nbv = round2(nbv * (1 - ratePerYear));
  }
  return round2(cost - nbv);
};

/**
 * Calculate depreciation for an asset over a given tax year.
 * Returns the depreciation charge for that calendar year only.
 */
export const calculateAssetDepreciation = (
  asset: FixedAssetInput,
  taxYear: number
): DepreciationResult => {
  const acquisitionYear = asset.acquisitionDate.getFullYear();
  const cost = round2(asset.acquisitionCost);

  // Asset not yet acquired in this tax year
  if (acquisitionYear > taxYear) {
    return {
      assetId: asset.id,
      description: asset.description,
      acquisitionCost: cost,
      method: asset.depreciationMethod,
      yearDepreciation: 0,
      accumulatedDepreciation: 0,
      netBookValue: cost,
      isDisposed: false,
      disposalGainLoss: 0
    };
  }

  // Disposed before this year
  const disposalYear = asset.disposalDate?.getFullYear() ?? null;
  const isDisposed = disposalYear !== null && disposalYear < taxYear;
  if (isDisposed) {
    return {
      assetId: asset.id,
      description: asset.description,
      acquisitionCost: cost,
      method: asset.depreciationMethod,
      yearDepreciation: 0,
      accumulatedDepreciation: cost,
      netBookValue: 0,
      isDisposed: true,
      disposalGainLoss: 0
    };
  }

  // Disposed during this year – half-year depreciation then disposal
  const disposedThisYear = disposalYear === taxYear;

  // Years from acquisition to START of this tax year
  const yearsBeforeThisYear = taxYear - acquisitionYear;
  // Full years accumulated before this year starts
  const yearsNow = yearsBeforeThisYear + 1; // including this year

  let yearDep = 0;
  let accDep = 0;

  switch (asset.depreciationMethod) {
    case "declining_30":
      accDep = decliningBalanceAccumulated(cost, 0.3, yearsBeforeThisYear);
      yearDep = disposedThisYear
        ? round2(decliningBalanceYear(cost, 0.3, yearsNow) / 2) // half-year in disposal year
        : decliningBalanceYear(cost, 0.3, yearsNow);
      break;

    case "straight_20":
      accDep = straightLineAccumulated(cost, 0.2, yearsBeforeThisYear);
      yearDep = disposedThisYear
        ? round2(straightLineYear(cost, 0.2, yearsNow) / 2)
        : straightLineYear(cost, 0.2, yearsNow);
      break;

    case "straight_25":
      accDep = straightLineAccumulated(cost, 0.25, yearsBeforeThisYear);
      yearDep = disposedThisYear
        ? round2(straightLineYear(cost, 0.25, yearsNow) / 2)
        : straightLineYear(cost, 0.25, yearsNow);
      break;

    case "building_4":
      accDep = straightLineAccumulated(cost, 0.04, yearsBeforeThisYear);
      yearDep = disposedThisYear
        ? round2(straightLineYear(cost, 0.04, yearsNow) / 2)
        : straightLineYear(cost, 0.04, yearsNow);
      break;

    default:
      yearDep = 0;
      accDep = 0;
  }

  // In disposal year: calculate gain/loss
  let disposalGainLoss = 0;
  if (disposedThisYear && asset.disposalValue !== null) {
    const totalAccDep = round2(accDep + yearDep);
    const nbvAtDisposal = Math.max(0, round2(cost - totalAccDep));
    disposalGainLoss = round2(asset.disposalValue - nbvAtDisposal);
  }

  const totalAccumulated = round2(accDep + yearDep);
  const netBookValue = Math.max(0, round2(cost - totalAccumulated));

  return {
    assetId: asset.id,
    description: asset.description,
    acquisitionCost: cost,
    method: asset.depreciationMethod,
    yearDepreciation: yearDep,
    accumulatedDepreciation: totalAccumulated,
    netBookValue,
    isDisposed: disposedThisYear,
    disposalGainLoss
  };
};

/**
 * Calculate total depreciation for all assets in a given tax year.
 */
export const calculateTotalDepreciation = (
  assets: FixedAssetInput[],
  taxYear: number
): {
  totalYearDepreciation: number;
  totalDisposalGains: number;
  totalDisposalLosses: number;
  details: DepreciationResult[];
} => {
  const details = assets.map((asset) => calculateAssetDepreciation(asset, taxYear));

  const totalYearDepreciation = round2(
    details.reduce((sum, d) => sum + d.yearDepreciation, 0)
  );
  const totalDisposalGains = round2(
    details.filter((d) => d.disposalGainLoss > 0).reduce((sum, d) => sum + d.disposalGainLoss, 0)
  );
  const totalDisposalLosses = round2(
    details.filter((d) => d.disposalGainLoss < 0).reduce((sum, d) => sum + Math.abs(d.disposalGainLoss), 0)
  );

  return { totalYearDepreciation, totalDisposalGains, totalDisposalLosses, details };
};
