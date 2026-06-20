/**
 * VolumeChart — DEPRECATED as a separate LWC instance.
 *
 * Volume is now rendered as a sub-scaled HistogramSeries within the main
 * CandlestickChart using priceScaleId + scaleMargins, which eliminates the
 * complexity of a third LWC time-scale sync.
 *
 * This file is kept as a no-op to avoid breaking any existing imports.
 */
export const VolumeChart = null;
