const OpenAI = require('openai').default;
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const apiKey = envContent.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]?.trim();
const naverId = envContent.match(/^NAVER_CLIENT_ID=(.+)$/m)?.[1]?.trim();
const naverSecret = envContent.match(/^NAVER_CLIENT_SECRET=(.+)$/m)?.[1]?.trim();

// Simulate the Naver RAG fetch
async function fetchNaverContext(query) {
  if (!naverId || !naverSecret) { console.log('No Naver keys'); return []; }

  const endpoints = [
    { type: 'news', url: 'https://openapi.naver.com/v1/search/news.json' },
    { type: 'blog', url: 'https://openapi.naver.com/v1/search/blog.json' },
  ];

  const results = [];
  for (const { type, url } of endpoints) {
    try {
      const params = new URLSearchParams({ query, display: '5', start: '1', sort: 'sim' });
      const res = await fetch(`${url}?${params}`, {
        headers: { 'X-Naver-Client-Id': naverId, 'X-Naver-Client-Secret': naverSecret },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of data.items) {
        results.push({
          title: item.title.replace(/<[^>]*>/g, ''),
          description: (item.description || '').replace(/<[^>]*>/g, ''),
          link: item.originallink || item.link,
          source: type,
        });
      }
    } catch (e) { console.error(`Naver ${type} error:`, e.message); }
  }
  return results;
}

async function test() {
  const query = '캔트비블루';

  console.log('=== Step 1: Naver RAG fetch ===');
  const items = await fetchNaverContext(query);
  console.log(`Found ${items.length} Naver results`);
  for (const item of items.slice(0, 3)) {
    console.log(`  [${item.source}] ${item.title}`);
  }

  const contextBlock = items.length > 0
    ? '\n\n--- Naver Search Results (use as reference) ---\n' +
      items.map((item, i) => `[${i+1}] (${item.source}) ${item.title}\n${item.description}\nURL: ${item.link}`).join('\n\n')
    : '';

  console.log('\n=== Step 2: GPT with Naver context ===');
  const systemPrompt = `You are a research assistant.\n${contextBlock}`;

  const client = new OpenAI({ apiKey });
  const stream = await client.chat.completions.create({
    model: 'gpt-4o-mini-search-preview',
    max_tokens: 1000,
    stream: true,
    web_search_options: {},
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '캔트비블루 알려줘' },
    ],
  });

  let text = '';
  for await (const chunk of stream) {
    const t = chunk.choices[0]?.delta?.content;
    if (t) { text += t; process.stdout.write(t); }
  }
  console.log('\n\n--- Done, length:', text.length);
}

test().catch(console.error);
