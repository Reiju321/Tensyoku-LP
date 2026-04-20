require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static('public'));

// 診断APIエンドポイント
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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data));

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Raw text:', raw);

    if (!raw) {
      return res.status(500).json({ error: 'Geminiからの応答が空でした' });
    }

    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    res.json(result);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: '診断に失敗しました: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});
