import * as math from 'mathjs';
import { OnDestroy, Injectable } from '@angular/core';
import { takeUntil, throttleTime, distinctUntilChanged, pluck, filter, map, shareReplay } from 'rxjs/operators';
import { asyncScheduler, BehaviorSubject, Subject, Observable, of, zip } from 'rxjs';
import { datasets } from '../../datasets';
import { Dataset } from '../../datasets/types';
import { PreferenceItemMeta } from '../preference/types';
import { SummarizationDataSourceService } from './summarization-data-source.service';
import { TrendWeeklyElaborationSummarizationService } from './trend-weekly-elaboration.summarization.service';
import { SummarizationService, BaseConfig } from './summarization.service';
import { SummaryGroup, SummaryVariableOptionPair, Summary } from './types';
import { TimeSeriesPoint } from '../../datasets/metas/types';
import {
  PointMembershipFunction,
  MembershipFunction,
  trapmf,
  trapmfL,
  trapmfR,
  sigmaCountQA,
} from './libs/protoform';
import {
  createLinearModel,
  LinearModel,
  createCenteredMovingAveragePoints,
  additiveDecomposite,
} from './libs/trend';
import {
  timeSeriesPointToNumPoint,
  groupPointsByXWeek,
} from './utils/time-series';
import {
  normalizePoints,
  normalizePointsY,
} from './utils/commons';
import {
  CHART_DIAGONAL_ANGLE
} from './utils/constants';
import { formatY } from '../../utils/formatters';
import { WeekdayWeekendRelativeConfig, WeekdayWeekendRelativeSummarizationService } from './weekday-weekend-relative.summarization.service';

const summarizationName = 'TrendWeeklyComparisonRateService';

export type TrendWeeklyComparisonRateConfig = BaseConfig & WeekdayWeekendRelativeConfig;

export type TrendWeeklyComparisonRateProperties = {
};

const defaultConfig = {
};

@Injectable({
  providedIn: 'any',
})
export class TrendWeeklyComparisonRateSummarizationService extends
  SummarizationService<TimeSeriesPoint, TrendWeeklyComparisonRateProperties, TrendWeeklyComparisonRateConfig>  {

  constructor(
    protected summarizationDataSourceService: SummarizationDataSourceService,
    protected weekdayWeekendRelativeSummarizationService: WeekdayWeekendRelativeSummarizationService,
    protected trendWeeklyElaborationSummarizationService: TrendWeeklyElaborationSummarizationService,
  ) {
    super();
  }

  prepareConfig(config: Partial<TrendWeeklyComparisonRateConfig>): TrendWeeklyComparisonRateConfig {
    return config as TrendWeeklyComparisonRateConfig;
  }

  createProperties$(config: TrendWeeklyComparisonRateConfig): Observable<TrendWeeklyComparisonRateProperties> {
    return of({});
  }

  createSummaries$(config: TrendWeeklyComparisonRateConfig): Observable<SummaryGroup[]> {
    return zip(
      this.weekdayWeekendRelativeSummarizationService.properties$(config),
      this.trendWeeklyElaborationSummarizationService.properties$(config),
    ).pipe(map(([
      { weekdayWeekendEqualValidity },
      { weekPointArrays, weekLinearModels }
    ]) => {
      const numOfWeeks = weekPointArrays.length;
      const ordinalTexts = ['first', 'second', 'third', 'fourth', 'fifth'];
      const summaries: Summary[] = [];

      for (let i = 0; i < numOfWeeks - 1; i++) {
        const eps = 1e-5;
        const currentWeekRate = weekLinearModels[i].gradient + eps;
        const nextWeekRate = weekLinearModels[i + 1].gradient + eps;
        const currentWeekRateAbsolute = Math.abs(currentWeekRate);
        const nextWeekRateAbsolute = Math.abs(nextWeekRate);

        const rateDiff = nextWeekRate - currentWeekRate;
        const rateDiffAbsolute = Math.abs(rateDiff);
        const absoluteRateDiff = nextWeekRateAbsolute - currentWeekRateAbsolute;
        const absoluteRateDiffAbsolute = Math.abs(absoluteRateDiff);

        const weekdayWeekendDescriptor = weekdayWeekendEqualValidity > 0.7 ? '' : 'of weekdays ';

        if (rateDiffAbsolute > 2 && currentWeekRate * nextWeekRate < 0) {
          const getDynamicDescriptor = (v: number) => v >= 0 ? 'increasing' : 'decreasing';
          const currentWeekRateDynamicDescriptor = getDynamicDescriptor(currentWeekRate);
          const nextWeekRateDynamicDescriptor = getDynamicDescriptor(nextWeekRate);
          const text = `The active users <b>${weekdayWeekendDescriptor}</b>was <b>${nextWeekRateDynamicDescriptor}</b> in the <b>${ordinalTexts[i + 1]} week</b> but <b>${currentWeekRateDynamicDescriptor}</b> in the <b>${ordinalTexts[i]} week</b>.`;
          summaries.push({
            text,
            validity: 1.0,
          });
        } else {
          const percentageChange = absoluteRateDiff / currentWeekRateAbsolute * 100;
          const precentageChangeDescriptor = percentageChange >= 0 ? 'more' : 'less';
          const percentageChangeDynamicDescriptor = percentageChange >= 0 ? 'faster' : 'slower';
          const dynamicDescriptor = currentWeekRate >= 0 ? 'increased' : 'decreased';

          const percentageChangeAbsolute = Math.abs(percentageChange);
          const percentageChangeText = percentageChangeAbsolute > 5 && rateDiffAbsolute > 2
            ? `${formatY(percentageChangeAbsolute)}% (${formatY(absoluteRateDiffAbsolute)} ${precentageChangeDescriptor} user ${dynamicDescriptor} per day) ${percentageChangeDynamicDescriptor} than`
            : 'in the same rate as';


          const text = `The active users <b>${weekdayWeekendDescriptor}</b>in the <b>${ordinalTexts[i + 1]} week</b> ${dynamicDescriptor} <b>${percentageChangeText}</b> the <b>${ordinalTexts[i]} week</b>.`;

          summaries.push({
            text,
            validity: 1.0,
          });
        }
      }
      return [{
        title: 'Trend Weekly Comparison - Rate',
        summaries,
      }];

    }));
  }
}
