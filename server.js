require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static('public'));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callGemini(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        })
      }
    );

    const data = await response.json();
    console.log(`Attempt ${i + 1} response:`, JSON.stringify(data).slice(0, 200));

    // 503の場合はリトライ
    if (data.error?.code === 503) {
      if (i < retries - 1) {
        console.log(`503エラー、${(i + 1) * 2}秒後にリトライ...`);
        await sleep((i + 1) * 2000);
        continue;
      }
      throw new Error('SERVICE_UNAVAILABLE');
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!raw) throw new Error('EMPTY_RESPONSE');

    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  }
}

app.post('/api/diagnose', async (req, res) => {
  const { answers } = req.body;

  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: '回答データが不正です' });
  }

  const answersText = answers.map((a, i) => `Q${i+1}: ${a.question}\n回答: ${a.answer}`).join('\n\n');

  const prompt = `あなたはプロのキャリアコンサルタントです。以下のアンケート回答をもとに、転職適性診断を行ってください。

【回答内容】
${answersText}

以下のJSON形式のみで回答してください。説明文やコードブロックは不要です：
{"jobTitle":"職種名","jobSub":"一言説明20字以内","detail":"向いている理由100字","skills":["スキル1","スキル2","スキル3","スキル4"],"action":"アクションプラン2〜3ステップ"}`;

  try {
    const result = await callGemini(prompt);
    res.json(result);
  } catch (err) {
    console.error('Error:', err.message);
    if (err.message === 'SERVICE_UNAVAILABLE') {
      res.status(503).json({ error: 'AIが混雑しています。しばらくしてから再度お試しください。' });
    } else {
      res.status(500).json({ error: '診断に失敗しました。もう一度お試しください。' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});
