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

const summarizationName = 'TrendWeeklyComparisonAverageService';

export type TrendWeeklyComparisonAverageConfig = BaseConfig & WeekdayWeekendRelativeConfig;

export type TrendWeeklyComparisonAverageProperties = {
};

const defaultConfig = {
};

@Injectable({
  providedIn: 'any',
})
export class TrendWeeklyComparisonAverageSummarizationService extends
  SummarizationService<TimeSeriesPoint, TrendWeeklyComparisonAverageProperties, TrendWeeklyComparisonAverageConfig>  {

  constructor(
    protected summarizationDataSourceService: SummarizationDataSourceService,
    protected weekdayWeekendRelativeSummarizationService: WeekdayWeekendRelativeSummarizationService,
    protected trendWeeklyElaborationSummarizationService: TrendWeeklyElaborationSummarizationService,
  ) {
    super();
  }

  prepareConfig(config: Partial<TrendWeeklyComparisonAverageConfig>): TrendWeeklyComparisonAverageConfig {
    return config as TrendWeeklyComparisonAverageConfig;
  }

  createProperties$(config: TrendWeeklyComparisonAverageConfig): Observable<TrendWeeklyComparisonAverageProperties> {
    return of({});
  }

  createSummaries$(config: TrendWeeklyComparisonAverageConfig): Observable<SummaryGroup[]> {
    return this.trendWeeklyElaborationSummarizationService.properties$(config)
      .pipe(map(({ weekPointArrays }) => {
        const numOfWeeks = weekPointArrays.length;

        const weekYAverages = weekPointArrays.map(weekPoints =>
          math.mean(weekPoints.map(({ y }) => y))
        );

        const ordinalTexts = ['first', 'second', 'third', 'fourth', 'fifth'];

        const summaries: Summary[] = [];

        for (let i = 0; i < numOfWeeks - 1; i++) {
          const percentageIncrease = (weekYAverages[i + 1] - weekYAverages[i]) / weekYAverages[i] * 100;
          const percentageChangeDescriptor = percentageIncrease >= 0 ? 'more' : 'less';
          const percentageIncreaseAbsolute = Math.abs(percentageIncrease);
          const percentageChangeText = percentageIncreaseAbsolute > 5
            ? `${formatY(percentageIncreaseAbsolute)}% ${percentageChangeDescriptor} than`
            : 'similar to';

          const text = `The average active users of the <b>${ordinalTexts[i + 1]} week</b> was <b>${percentageChangeText}</b> the <b>${ordinalTexts[i]} week</b>.`;

          summaries.push({
            text,
            validity: 1.0,
          });
        }

        return [{
          title: 'Trend Weekly Comparison - Average',
          summaries,
        }];
      }));
  }
}
