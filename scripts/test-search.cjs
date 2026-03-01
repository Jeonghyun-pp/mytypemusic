const OpenAI = require('openai').default;
const fs = require('fs');

// Read .env manually
const envContent = fs.readFileSync('.env', 'utf8');
const apiKey = envContent.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]?.trim();

const client = new OpenAI({ apiKey });

async function test() {
  try {
    const stream = await client.chat.completions.create({
      model: 'gpt-4o-mini-search-preview',
      max_tokens: 200,
      stream: true,
      web_search_options: {},
      messages: [
        { role: 'system', content: 'You are a research assistant.' },
        { role: 'user', content: '캔트비블루 멤버 알려줘' },
      ],
    });

    let fullText = '';
    let allAnnotations = [];

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const text = choice.delta?.content;
      if (text) {
        fullText += text;
        process.stdout.write(text);
      }

      // Check annotations in delta
      const ann = choice.delta?.annotations;
      if (ann && Array.isArray(ann)) {
        console.log('\n[ANNOTATIONS]:', JSON.stringify(ann));
        allAnnotations.push(...ann);
      }
    }

    console.log('\n\n--- DONE ---');
    console.log('Total annotations found:', allAnnotations.length);
    if (allAnnotations.length > 0) {
      console.log('Sample:', JSON.stringify(allAnnotations[0], null, 2));
    }
  } catch (err) {
    console.error('ERROR:', err.message);
    if (err.status) console.error('Status:', err.status);
    if (err.error) console.error('Body:', JSON.stringify(err.error));
  }
}

test();
