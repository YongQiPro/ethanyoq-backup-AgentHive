import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONTEXT_ROOT } from './roundtable-context-file';

const targetProducts = ['ProductA IV', 'ProductA Tabs', 'ProductB IV', 'ProductB Oral'];
const precomputedTargetSegmentFilename = 'targetSegment_four_product_coverage_amount_intermittent_zero_lists.json';

interface LocalEvidenceInput {
  evidenceRequest?: string;
  agentName?: string;
  skillId?: string;
  contextRoot?: string;
}

interface HospitalMasterRow {
  account_id?: string;
  account_name?: string;
  account_classification_name?: string;
  province_name?: string;
  city_name?: string;
  segment_code?: string;
  fn_dm?: string;
  in_dm?: string;
}

interface WideSalesRow {
  account_id?: string;
  account_name?: string;
  segment_code?: string;
  month_cd?: string;
  product_amounts?: Record<string, unknown>;
}

interface ProductHospitalRollup {
  account_id: string;
  account_name: string;
  province_name: string;
  city_name: string;
  classification: string;
  fn_dm: string;
  in_dm: string;
  net_amount: number;
  positiveMonths: Set<string>;
}

interface ProductRollup {
  product: string;
  net_total_amount: number;
  covered_hospital_count: number;
  intermittent_hospital_count: number;
  zero_sale_hospital_count: number;
  top10_by_net_amount: Array<{
    account_id: string;
    account_name: string;
    province_name: string;
    city_name: string;
    classification: string;
    fn_dm: string;
    in_dm: string;
    net_amount: number;
    positive_month_count: number;
    positive_months: string[];
  }>;
}

interface TargetSegmentEvidenceSummary {
  generated_at: string;
  filter: string;
  target_products: string[];
  month_range: string[];
  targetSegment_master_hospital_count: number;
  targetSegment_wide_row_count: number;
  products: ProductRollup[];
}

function shouldResolveTargetSegmentEvidence(input: LocalEvidenceInput): boolean {
  const request = input.evidenceRequest || '';
  const agent = `${input.agentName || ''} ${input.skillId || ''}`;
  if (!/公司上下文|company-context-agent/i.test(agent)) return false;
  return /TARGET_SEGMENT|segment_code|SEGMENT_CODE/i.test(request) &&
    /ProductA|ProductB|Product A|Product B|四个产品|客户|零销售|Top\s*客户|月趋势|覆盖/i.test(request);
}

function parseJsonLines<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function productAmount(row: WideSalesRow, product: string): number {
  const amounts = row.product_amounts;
  if (!amounts || typeof amounts !== 'object') return 0;
  const raw = amounts[product];
  const amount = Number(raw || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function computeTargetSegmentEvidence(contextRoot: string): TargetSegmentEvidenceSummary | null {
  const masterPath = path.join(contextRoot, 'customer_list.jsonl');
  const widePath = path.join(contextRoot, 'sales_wide_table.jsonl');
  const masterRows = parseJsonLines<HospitalMasterRow>(masterPath);
  const salesRows = parseJsonLines<WideSalesRow>(widePath);
  if (masterRows.length === 0 || salesRows.length === 0) return null;

  const targetSegmentMaster = new Map<string, HospitalMasterRow>();
  for (const row of masterRows) {
    const accountCode = String(row.account_id || '').trim();
    if (accountCode && String(row.segment_code || '').trim().toUpperCase() === 'TARGET_SEGMENT') {
      targetSegmentMaster.set(accountCode, row);
    }
  }

  const monthSet = new Set<string>();
  const productRollups = new Map<string, Map<string, ProductHospitalRollup>>();
  let targetSegmentWideRowCount = 0;

  for (const row of salesRows) {
    const accountCode = String(row.account_id || '').trim();
    if (!accountCode) continue;
    if (String(row.segment_code || '').trim().toUpperCase() !== 'TARGET_SEGMENT' && !targetSegmentMaster.has(accountCode)) continue;
    targetSegmentWideRowCount += 1;
    const month = String(row.month_cd || '').trim();
    if (month) monthSet.add(month);
    const master = targetSegmentMaster.get(accountCode) || {};

    for (const product of targetProducts) {
      const amount = productAmount(row, product);
      let hospitalMap = productRollups.get(product);
      if (!hospitalMap) {
        hospitalMap = new Map();
        productRollups.set(product, hospitalMap);
      }
      const current: ProductHospitalRollup = hospitalMap.get(accountCode) || {
        account_id: accountCode,
        account_name: String(row.account_name || master.account_name || accountCode),
        province_name: String(master.province_name || ''),
        city_name: String(master.city_name || ''),
        classification: String(master.account_classification_name || ''),
        fn_dm: String(master.fn_dm || ''),
        in_dm: String(master.in_dm || ''),
        net_amount: 0,
        positiveMonths: new Set<string>(),
      };
      current.net_amount += amount;
      if (amount > 0 && month) current.positiveMonths.add(month);
      hospitalMap.set(accountCode, current);
    }
  }

  const monthRange = Array.from(monthSet).sort();
  const monthCount = Math.max(1, monthRange.length);
  const products: ProductRollup[] = targetProducts.map((product) => {
    const hospitals = Array.from((productRollups.get(product) || new Map<string, ProductHospitalRollup>()).values());
    const positiveHospitals = hospitals.filter((hospital) => hospital.positiveMonths.size > 0);
    const intermittentHospitals = positiveHospitals.filter((hospital) => hospital.positiveMonths.size < monthCount);
    const top10 = positiveHospitals
      .sort((a, b) => b.net_amount - a.net_amount)
      .slice(0, 10)
      .map((hospital) => ({
        account_id: hospital.account_id,
        account_name: hospital.account_name,
        province_name: hospital.province_name,
        city_name: hospital.city_name,
        classification: hospital.classification,
        fn_dm: hospital.fn_dm,
        in_dm: hospital.in_dm,
        net_amount: round2(hospital.net_amount),
        positive_month_count: hospital.positiveMonths.size,
        positive_months: Array.from(hospital.positiveMonths).sort(),
      }));

    return {
      product,
      net_total_amount: round2(hospitals.reduce((sum, hospital) => sum + hospital.net_amount, 0)),
      covered_hospital_count: positiveHospitals.length,
      intermittent_hospital_count: intermittentHospitals.length,
      zero_sale_hospital_count: Math.max(0, targetSegmentMaster.size - positiveHospitals.length),
      top10_by_net_amount: top10,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    filter: "customer_list.segment_code='TARGET_SEGMENT' and sales_wide_table.segment_code='TARGET_SEGMENT', joined by account_id",
    target_products: targetProducts,
    month_range: monthRange,
    targetSegment_master_hospital_count: targetSegmentMaster.size,
    targetSegment_wide_row_count: targetSegmentWideRowCount,
    products,
  };
}

function readPrecomputedTargetSegmentEvidence(contextRoot: string): TargetSegmentEvidenceSummary | null {
  const filePath = path.join(contextRoot, precomputedTargetSegmentFilename);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as TargetSegmentEvidenceSummary;
  } catch {
    return null;
  }
}

function productFact(product: ProductRollup): string {
  const top = product.top10_by_net_amount
    .slice(0, 5)
    .map((item) => `${item.account_name} ${item.net_amount}`)
    .join('；');
  return [
    `TARGET_SEGMENT ${product.product}: 净销售额 ${product.net_total_amount}`,
    `覆盖客户 ${product.covered_hospital_count}`,
    `断续购买客户 ${product.intermittent_hospital_count}`,
    `零销售客户 ${product.zero_sale_hospital_count}`,
    `Top customer：${top || '无'}`,
  ].join('；');
}

export function resolveLocalEvidenceRuntimeOutput(input: LocalEvidenceInput): string | null {
  if (!shouldResolveTargetSegmentEvidence(input)) return null;
  const contextRoot = path.resolve(input.contextRoot || DEFAULT_CONTEXT_ROOT);
  const summary = readPrecomputedTargetSegmentEvidence(contextRoot) || computeTargetSegmentEvidence(contextRoot);
  if (!summary) return null;

  return JSON.stringify({
    status: 'researched',
    resultSummary: `已用本地 context 完成 TARGET_SEGMENT 四产品取数：TARGET_SEGMENT主数据客户 ${summary.targetSegment_master_hospital_count} 家，销售宽表记录 ${summary.targetSegment_wide_row_count} 行，月份 ${summary.month_range[0] || '未知'} 至 ${summary.month_range.at(-1) || '未知'}。`,
    facts: [
      {
        type: 'known_fact',
        content: `TARGET_SEGMENT主数据客户 ${summary.targetSegment_master_hospital_count} 家；TARGET_SEGMENT销售宽表记录 ${summary.targetSegment_wide_row_count} 行；月份范围 ${summary.month_range[0] || '未知'} 至 ${summary.month_range.at(-1) || '未知'}。`,
        source: 'context/customer_list.jsonl; context/sales_wide_table.jsonl',
        status: 'verified',
      },
      ...summary.products.map((product) => ({
        type: 'known_fact',
        content: productFact(product),
        source: `context/${precomputedTargetSegmentFilename}; context/sales_wide_table.jsonl; context/customer_list.jsonl`,
        status: 'verified',
      })),
      {
        type: 'source',
        content: `取数口径：${summary.filter}；coverage=至少一个月份金额>0；intermittent=有正销售但未覆盖全部月份；zero_sale=TARGET_SEGMENT主数据客户在目标产品所有可用月份均无正销售。`,
        source: `context/${precomputedTargetSegmentFilename}; context/data_dictionary.md`,
        status: 'verified',
      },
    ],
    sourceRefs: [
      'context/customer_list.jsonl',
      'context/sales_wide_table.jsonl',
      `context/${precomputedTargetSegmentFilename}`,
      'context/data_dictionary.md',
    ],
  });
}
