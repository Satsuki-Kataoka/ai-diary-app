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