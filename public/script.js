// --- まとめ機能のコード ---
const summaryButton = document.getElementById('summary-button');
const summaryArea = document.getElementById('summary-area');
const summaryText = document.getElementById('summary-text');

summaryButton.addEventListener('click', async () => {
    // ボタンを「作成中...」にして、連打できないようにする
    summaryButton.textContent = '作成中...';
    summaryButton.disabled = true;

    // バックエンドにまとめを依頼する
    const response = await fetch('/api/summary');
    if (response.ok) {
        const data = await response.json();
        summaryText.textContent = data.summary;
        summaryArea.style.display = 'block'; // 結果を表示エリアに表示
    } else {
        alert('まとめの作成に失敗しました。');
    }

    // ボタンを元に戻す
    summaryButton.textContent = '日記のまとめを作成する';
    summaryButton.disabled = false;
});

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('diary-form');
    const aiCommentDiv = document.getElementById('ai-comment');
    const commentText = document.getElementById('comment-text');
    const diaryList = document.getElementById('diary-list');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emotion = document.getElementById('emotion').value;
        const content = document.getElementById('content').value;
        
        const response = await fetch('/api/diaries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emotion, content })
        });

        if (response.ok) {
            const newDiary = await response.json();
            commentText.textContent = newDiary.ai_comment;
            aiCommentDiv.style.display = 'block';
            form.reset();
            loadDiaries();
        } else {
            alert('日記の保存に失敗しました。');
        }
    });

    async function loadDiaries() {
        const response = await fetch('/api/diaries');
        const diaries = await response.json();
        diaryList.innerHTML = '';
        diaries.forEach(diary => {
            const li = document.createElement('li');
            li.textContent = `${new Date(diary.date).toLocaleDateString()} - ${diary.content.substring(0, 30)}...`;
            diaryList.appendChild(li);
        });
    }
    loadDiaries();
});