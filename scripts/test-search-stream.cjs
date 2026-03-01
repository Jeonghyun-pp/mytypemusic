const OpenAI = require('openai').default;
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const apiKey = envContent.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]?.trim();

const client = new OpenAI({ apiKey });

async function test() {
  try {
    const createParams = {
      model: 'gpt-4o-mini-search-preview',
      max_tokens: 2000,
      stream: true,
      web_search_options: {},
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant for a Korean Instagram card-news magazine.',
        },
        { role: 'user', content: '캔트비블루 알려줘' },
      ],
    };

    const stream = await client.chat.completions.create(createParams);

    let fullText = '';
    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      const text = choice.delta?.content;
      if (text) {
        fullText += text;
        process.stdout.write(text);
      }
      const ann = choice.delta?.annotations;
      if (ann && Array.isArray(ann) && ann.length > 0) {
        console.log('\n[ANN]:', JSON.stringify(ann));
      }
    }
    console.log('\n--- DONE, length:', fullText.length);
  } catch (err) {
    console.error('ERROR:', err.message);
    if (err.status) console.error('Status:', err.status);
    if (err.error) console.error('Body:', JSON.stringify(err.error));
  }
}

test();
