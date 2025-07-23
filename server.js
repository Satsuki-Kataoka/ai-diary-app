// server.js 【最終版】

require('dotenv').config();

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = 3000;

// DB設定
const db = new sqlite3.Database('./diary.db');
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS diaries (id INTEGER PRIMARY KEY, date TEXT, emotion TEXT, title TEXT, content TEXT, ai_comment TEXT)");
});

// Google AI設定
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

app.use(express.json());
app.use(express.static('public'));


// === APIエンドポイント定義 ===

// API: 指定した日付の日記を取得する
app.get('/api/diaries/date/:dateStr', (req, res) => {
    const dateStr = req.params.dateStr;
    db.get("SELECT * FROM diaries WHERE date LIKE ?", [`${dateStr}%`], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            res.json(row);
        } else {
            res.status(404).json({ message: 'その日の日記はまだありません' });
        }
    });
});

// API: 特定のIDの日記を取得
app.get('/api/diaries/:id', (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM diaries WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: '日記が見つかりません' });
        res.json(row);
    });
});

// API: 過去の日記一覧を取得
app.get('/api/diaries', (req, res) => {
    db.all("SELECT * FROM diaries ORDER BY date DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API: 日記のまとめを生成
app.get('/api/summary', async (req, res) => {
    db.all("SELECT emotion, title, content FROM diaries ORDER BY date DESC LIMIT 30", [], async (err, rows) => {
        if (err || rows.length === 0) return res.json({ summary: "まだ日記がありません。" });
        const diaryTexts = rows.map(row => `気分:${row.emotion}, タイトル:${row.title}, 内容:${row.content}`).join('\n---\n');
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            const prompt = `以下の複数の日記から、全体的な感情の傾向や特筆すべき出来事を分析し、優しいカウンセラーのように要約してください。\n\n${diaryTexts}`;
            const result = await model.generateContent(prompt);
            res.json({ summary: (await result.response).text() });
        } catch (error) {
            res.status(500).json({ error: "まとめの生成に失敗しました。" });
        }
    });
});

// API: 日記を賢く保存（新規作成 or 更新）
app.post('/api/save-diary', async (req, res) => {
    const { date: dateStr, emotion, title, content } = req.body;
    if (!dateStr || !title || !content) {
        return res.status(400).json({ error: '日付、タイトル、内容をすべて入力してください。' });
    }

    try {
        // まず、その日付の日記が既に存在するかを調べる
        db.get("SELECT * FROM diaries WHERE date LIKE ?", [`${dateStr}%`], async (err, row) => {
            if (err) return res.status(500).json({ error: 'データベース検索エラー' });

            // AIにコメントを依頼（新規でも更新でも必要）
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            const prompt = `あなたはユーザーに寄り添う、優しいカウンセラーです。以下の日記に対して、ポジティブで短いコメントを返してください。\n\n気分：${emotion}\nタイトル：${title}\n日記：${content}`;
            const result = await model.generateContent(prompt);
            const aiComment = (await result.response).text();

            if (row) {
                // ★日記が存在した場合 → 更新(UPDATE)処理
                const stmt = db.prepare("UPDATE diaries SET emotion = ?, title = ?, content = ?, ai_comment = ? WHERE id = ?");
                stmt.run(emotion, title, content, aiComment, row.id, function (err) {
                    if (err) return res.status(500).json({ error: '日記の更新に失敗しました' });
                    res.json({ ai_comment: aiComment, message: '日記を更新しました' });
                });
                stmt.finalize();
            } else {
                // ★日記が存在しない場合 → 新規作成(INSERT)処理
                const stmt = db.prepare("INSERT INTO diaries (date, emotion, title, content, ai_comment) VALUES (?, ?, ?, ?, ?)");
                stmt.run(dateStr, emotion, title, content, aiComment, function(err) {
                    if (err) return res.status(500).json({ error: '日記の保存に失敗しました' });
                    res.json({ id: this.lastID, ai_comment: aiComment });
                });
                stmt.finalize();
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'AIコメントの生成または保存に失敗しました。' });
    }
});

// API: 日記を削除
app.delete('/api/diaries/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM diaries WHERE id = ?", id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes > 0) {
            res.json({ message: '日記を削除しました' });
        } else {
            res.status(404).json({ error: '削除対象の日記が見つかりません' });
        }
    });
});


app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました`);
});