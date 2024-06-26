import { assocIn } from "icepick";

import { isNotNull } from "metabase/lib/types";
import { SERIES_SETTING_KEY } from "metabase/visualizations/shared/settings/series";
import type { VisualizationSettings, Card } from "metabase-types/api/card";
import type { Series, TransformedSeries } from "metabase-types/api/dataset";

import { keyForSingleSeries } from "./settings/series";

export const updateSeriesColor = (
  settings: VisualizationSettings,
  seriesKey: string,
  color: string,
) => {
  return assocIn(settings, [SERIES_SETTING_KEY, seriesKey, "color"], color);
};

export const findSeriesByKey = (series: Series, key: string) => {
  return series.find(singleSeries => keyForSingleSeries(singleSeries) === key);
};

export const getOrderedSeries = (
  series: Series,
  settings: VisualizationSettings,
  isReversed?: boolean,
) => {
  if (
    (settings["graph.dimensions"] &&
      settings["graph.dimensions"].length <= 1) ||
    !settings["graph.series_order"]
  ) {
    return series;
  }

  const orderedSeries = settings["graph.series_order"]
    ?.filter(orderedItem => orderedItem.enabled)
    .map(orderedItem => findSeriesByKey(series, orderedItem.key))
    .filter(isNotNull);

  if (isReversed) {
    orderedSeries.reverse();
  }

  if ("_raw" in series) {
    const transformedOrderedSeries = [...orderedSeries] as TransformedSeries;
    transformedOrderedSeries._raw = series._raw;
    return transformedOrderedSeries;
  }

  return orderedSeries;
};

export const getNameForCard = (card: Card) => {
  return card?.name || "";
};
