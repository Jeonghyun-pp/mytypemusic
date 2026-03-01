declare module "google-trends-api" {
  interface DailyTrendsOptions {
    geo?: string;
    trendDate?: Date;
    hl?: string;
  }

  interface RealTimeTrendsOptions {
    geo?: string;
    hl?: string;
    category?: string;
  }

  interface RelatedQueriesOptions {
    keyword: string;
    geo?: string;
    hl?: string;
    startTime?: Date;
    endTime?: Date;
  }

  function dailyTrends(options?: DailyTrendsOptions): Promise<string>;
  function realTimeTrends(options?: RealTimeTrendsOptions): Promise<string>;
  function relatedQueries(options?: RelatedQueriesOptions): Promise<string>;
}
