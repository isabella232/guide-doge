import { AudificationPreference, Preference } from '../services/preference/types';
import { Datum } from '../d3/xy-chart.d3';

export const mockPreference: Preference = {
  enabled: false,
};

export const mockAudificationPreference: AudificationPreference = {
  ...mockPreference,
  highestPitch: 0,
  lowestPitch: 0,
  noteDuration: 0,
  readAfter: false,
  readBefore: false,
};

export const mockDatum: Datum = {
  date: new Date(),
  value: 0,
};
