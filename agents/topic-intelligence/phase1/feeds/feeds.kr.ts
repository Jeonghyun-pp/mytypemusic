export type FeedCategory = "music" | "lifestyle";

export type FeedDef = {
  id: string;
  category: FeedCategory;
  title: string;
  url: string;
  publisher?: string;
};

export const KR_FEEDS: FeedDef[] = [
  // ================================================================
  // Music (6+)
  // ================================================================
  {
    id: "yonhap-ent",
    category: "music",
    title: "연합뉴스 연예",
    url: "https://www.yonhapnewstv.co.kr/browse/feed/category/entertainment/news",
    publisher: "연합뉴스TV",
  },
  {
    id: "sbs-kpop",
    category: "music",
    title: "SBS K-POP NEWS",
    url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=09",
    publisher: "SBS",
  },
  {
    id: "mbc-ent",
    category: "music",
    title: "MBC 연예",
    url: "https://imnews.imbc.com/rss/entertainment.xml",
    publisher: "MBC",
  },
  {
    id: "hani-culture",
    category: "music",
    title: "한겨레 문화",
    url: "https://www.hani.co.kr/rss/culture/",
    publisher: "한겨레",
  },
  {
    id: "khan-culture",
    category: "music",
    title: "경향신문 문화",
    url: "https://www.khan.co.kr/rss/rssdata/culture_news.xml",
    publisher: "경향신문",
  },
  {
    id: "kbs-culture",
    category: "music",
    title: "KBS 문화",
    url: "https://news.kbs.co.kr/api/getRss?rssId=culture",
    publisher: "KBS",
  },
  {
    id: "donga-ent",
    category: "music",
    title: "동아일보 연예",
    url: "https://rss.donga.com/entertainment.xml",
    publisher: "동아일보",
  },
  // 인디/록 밴드 관련 피드 (추가 검토 필요)
  // 참고: 대부분의 인디 음악 웹진은 RSS를 제공하지 않거나 불안정함
  // {
  //   id: "indie-music-1",
  //   category: "music",
  //   title: "음악 전문 매체 1",
  //   url: "RSS_URL_HERE",
  //   publisher: "Publisher",
  // },

  // ================================================================
  // Lifestyle (6+)
  // ================================================================
  {
    id: "joongang-lifestyle",
    category: "lifestyle",
    title: "중앙일보 라이프스타일",
    url: "https://rss.joins.com/joins_life_list.xml",
    publisher: "중앙일보",
  },
  {
    id: "khan-life",
    category: "lifestyle",
    title: "경향신문 생활",
    url: "https://www.khan.co.kr/rss/rssdata/life_news.xml",
    publisher: "경향신문",
  },
  {
    id: "hani-life",
    category: "lifestyle",
    title: "한겨레 사회/생활",
    url: "https://www.hani.co.kr/rss/society/",
    publisher: "한겨레",
  },
  {
    id: "donga-life",
    category: "lifestyle",
    title: "동아일보 생활/문화",
    url: "https://rss.donga.com/culture.xml",
    publisher: "동아일보",
  },
  {
    id: "mbc-life",
    category: "lifestyle",
    title: "MBC 생활/문화",
    url: "https://imnews.imbc.com/rss/culture.xml",
    publisher: "MBC",
  },
  {
    id: "kbs-life",
    category: "lifestyle",
    title: "KBS 생활/문화",
    url: "https://news.kbs.co.kr/api/getRss?rssId=economy",
    publisher: "KBS",
  },
  {
    id: "sbs-life",
    category: "lifestyle",
    title: "SBS 생활/문화",
    url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=08",
    publisher: "SBS",
  },
];
