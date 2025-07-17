require('dotenv').config(); // .envファイルを読み込む

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = 3000;

// データベース設定
const db = new sqlite3.Database('./diary.db');
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS diaries (id INTEGER PRIMARY KEY, date TEXT, emotion TEXT, title TEXT, content TEXT, ai_comment TEXT)");
});

// Google AI設定
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

app.use(express.json());
app.use(express.static('public'));

// API: 日記を保存
app.post('/api/diaries', async (req, res) => {
    const { emotion, title, content } = req.body;
    if (!content || !title) return res.status(400).json({ error: '内容を入力してください' });

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `あなたはユーザーに寄り添う、優しいカウンセラーです。以下の日記に対して、ポジティブで短いコメントを返してください。\n\n気分：${emotion}\n日記：${content}`;
        
        const result = await model.generateContent(prompt);
        const aiComment = (await result.response).text();

        const date = new Date().toISOString();
        const stmt = db.prepare("INSERT INTO diaries (date, emotion, title, content, ai_comment) VALUES (?, ?, ?, ?, ?)");
        stmt.run(date, emotion, title, content, aiComment, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, ai_comment: aiComment });
        });
        stmt.finalize();

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'AIコメントの生成または保存に失敗しました。' });
    }
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
    // 直近30件の日記を取得
    db.all("SELECT emotion, content FROM diaries ORDER BY date DESC LIMIT 30", [], async (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'データベースの読み込みに失敗しました。' });
        }
        if (rows.length === 0) {
            return res.json({ summary: "まだ日記がありません。まとめを作るには、もっと日記を書きましょう！" });
        }

        // AIに渡すためのテキストを作成
        const diaryTexts = rows.map(row => `気分:${row.emotion}, 内容:${row.content}`).join('\n---\n');
        
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `以下の複数の日記から、全体的な感情の傾向や特筆すべき出来事を分析し、ユーザーに寄り添う優しいカウンセラーのように、丁寧な口調で要約してください。\n\n${diaryTexts}`;

            const result = await model.generateContent(prompt);
            const summary = (await result.response).text();
            res.json({ summary });
        } catch (error) {
            console.error("Summary generation failed:", error);
            res.status(500).json({ error: "まとめの生成に失敗しました。" });
        }
    });
});

// API: 今日の日記を取得する
app.get('/api/diaries/today', (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    db.get("SELECT * FROM diaries WHERE date LIKE ?", [`${today}%`], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            res.json(row);
        } else {
            res.status(404).json({ message: '今日の日記はまだありません' });
        }
    });
});

// API: 特定のIDの日記を取得
app.get('/api/diaries/:id', (req, res) => {
    const id = req.params.id; // URLからIDを取得
    db.get("SELECT * FROM diaries WHERE id = ?", [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: '日記が見つかりません' });
        }
        res.json(row);
    });
});

// API: 既存の日記を更新(追記)する
app.put('/api/diaries/:id', async (req, res) => {
    const { id } = req.params;
    const { emotion, title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ error: 'タイトルと内容を入力してください' });
    }

    try {
        // 更新された内容で、AIに再度コメントを依頼
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `あなたはユーザーに寄り添う、優しいカウンセラーです。以下の更新された日記に対して、ポジティブで短いコメントを返してください。\n\n気分：${emotion}\nタイトル：${title}\n日記：${content}`;
        const result = await model.generateContent(prompt);
        const aiComment = (await result.response).text();

        // UPDATE文でデータベースを更新
        const stmt = db.prepare("UPDATE diaries SET emotion = ?, title = ?, content = ?, ai_comment = ? WHERE id = ?");
        stmt.run(emotion, title, content, aiComment, id, function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ ai_comment: aiComment, message: '日記を更新しました' });
        });
        stmt.finalize();

    } catch (error) {
        console.error("Diary update failed:", error);
        res.status(500).json({ error: '日記の更新に失敗しました' });
    }
});

// API: 特定のIDの日記を削除する
app.delete('/api/diaries/:id', (req, res) => {
    const { id } = req.params;

    db.run("DELETE FROM diaries WHERE id = ?", id, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        // 変更された行が0より大きいか（=削除が成功したか）をチェック
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