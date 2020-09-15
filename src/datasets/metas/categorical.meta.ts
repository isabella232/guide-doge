import { CategoricalQuery } from '../queries/categorical.query';
import { LegendItemStyle as BarChartLegendItemStyle } from '../../d3/bar-chart.d3';
import { LegendItemStyle as PieChartLegendItemStyle } from '../../d3/pie-chart.d3';
import { MetaType, XYChartMeta } from './types';
import { summarizationModuleImporter } from '../../components/chart-summarization/chart-summarization.importer';

export type BarChartMeta = XYChartMeta<MetaType.BAR_CHART, CategoricalQuery<BarChartLegendItemStyle>>;
export type PieChartMeta = XYChartMeta<MetaType.PIE_CHART, CategoricalQuery<PieChartLegendItemStyle>>;

export function createBarChartMeta(
  title: string,
  queryData: CategoricalQuery<BarChartLegendItemStyle>,
): BarChartMeta {
  return {
    type: MetaType.BAR_CHART,
    title,
    queryData,
    a11yModuleImporters: [
      summarizationModuleImporter,
    ],
  };
}

export function createPieChartMeta(
  title: string,
  queryData: CategoricalQuery<PieChartLegendItemStyle>,
): PieChartMeta {
  return {
    type: MetaType.PIE_CHART,
    title,
    queryData,
    a11yModuleImporters: [
      summarizationModuleImporter,
    ],
  };
}

