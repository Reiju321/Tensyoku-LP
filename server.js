require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

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

以下のJSON形式で回答してください（他のテキストは一切不要）：
{
  "jobTitle": "最も適した職種名（具体的に、例：Webマーケター / SNSディレクター）",
  "jobSub": "一言でその職種の魅力（20字以内）",
  "detail": "この人がその職種に向いている理由を、回答内容をもとに具体的に説明（100字程度）",
  "skills": ["必要スキル1", "必要スキル2", "必要スキル3", "必要スキル4"],
  "action": "今すぐできる具体的なアクションプラン（2〜3ステップで、転職エージェントの活用を含める）"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
        })
      }
    );

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '診断に失敗しました' });
  }
});

app.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});
