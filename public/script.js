// DOMContentLoadedイベントリスナーで、HTMLの読み込み完了後にスクリプトを実行
document.addEventListener('DOMContentLoaded', () => {

    // --- ① 使用するHTML要素をまとめて取得 ---
    const form = document.getElementById('diary-form');
    const emotionSelect = document.getElementById('emotion');
    const contentTextarea = document.getElementById('content');
    
    const aiCommentDiv = document.getElementById('ai-comment');
    const commentText = document.getElementById('comment-text');
    
    const diaryList = document.getElementById('diary-list');
    
    const summaryButton = document.getElementById('summary-button');
    const summaryArea = document.getElementById('summary-area');
    const summaryText = document.getElementById('summary-text');

    const calendarEl = document.getElementById('calendar'); // ★カレンダーの要素を追加

    // --- ② カレンダーの初期化 ---
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth', // 月表示
        locale: 'ja', // 日本語化
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        events: [], // ★最初は空。後から日記データをここに入れる
        // ★イベント（日記）をクリックしたときの処理
        eventClick: function(info) {
            // info.event.id には日記のIDが入っている
            showDiaryDetail(info.event.id);
        }
    });
    calendar.render(); // カレンダーを描画
    
    // --- ② イベントリスナーを設定 ---

    // 日記フォームの送信イベント
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // フォームのデフォルトの送信動作をキャンセル

        const emotion = document.getElementById('emotion').value;
        const title = document.getElementById('title').value;
        const content = document.getElementById('content').value;
        
        const response = await fetch('/api/diaries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emotion: emotion,
                title: title,
                content: content
            })
        });

        if (response.ok) {
            const newDiary = await response.json();
            commentText.textContent = newDiary.ai_comment;
            aiCommentDiv.style.display = 'block';
            form.reset(); // フォームの内容をリセット
            loadDiaries(); // 日記リストを更新
        } else {
            alert('日記の保存に失敗しました。');
        }
    });

    // まとめ作成ボタンのクリックイベント
    summaryButton.addEventListener('click', async () => {
        summaryButton.textContent = '作成中...';
        summaryButton.disabled = true;

        const response = await fetch('/api/summary');
        if (response.ok) {
            const data = await response.json();
            summaryText.textContent = data.summary;
            summaryArea.style.display = 'block';
        } else {
            alert('まとめの作成に失敗しました。');
        }

        summaryButton.textContent = '日記のまとめを作成する';
        summaryButton.disabled = false;
    });


    // --- ③ 関数定義 ---

    // 過去の日記一覧をサーバーから取得して表示する関数
    async function loadDiaries() {
        const response = await fetch('/api/diaries');
        const diaries = await response.json();
        
        diaryList.innerHTML = ''; // 表示前にリストをクリア
        
        diaries.forEach(diary => {
            const li = document.createElement('li');
            li.textContent = `${new Date(diary.date).toLocaleDateString()} - ${diary.content.substring(0, 30)}...`;
            
            // [ここからが詳細表示機能の追加部分]
            li.dataset.id = diary.id;      // HTML要素にIDをデータとして埋め込む
            li.style.cursor = 'pointer';   // マウスカーソルを指マークに変更
            li.title = 'クリックして詳細を表示'; // マウスオーバーでヒントを表示
            
            // 各リスト項目にクリックイベントを設定
            li.addEventListener('click', () => {
                showDiaryDetail(diary.id);
            });
            // [ここまでが追加部分]
            
            diaryList.appendChild(li);
        });

        const calendarEvents = diaries.map(diary => {
            // 感情の絵文字を取得
            const emotionOption = document.querySelector(`#emotion option[value="${diary.emotion}"]`);
            const emotionEmoji = emotionOption ? emotionOption.textContent.split(' ')[0] : '📝';
            
            return {
                id: diary.id,
                title: `${emotionEmoji} ${diary.title}`, // ★diary.title を表示
                start: diary.date, // 日記の日付
                allDay: true // 終日のイベントとして表示
            };
        });
        calendar.removeAllEvents(); // 古いイベントをクリア
        calendar.addEventSource(calendarEvents); // 新しい日記データをカレンダーに追加
    
    }

    // [ここからが詳細表示機能の追加部分]
    // 特定のIDの日記詳細を取得して表示する関数
    async function showDiaryDetail(id) {
        const response = await fetch(`/api/diaries/${id}`);
        if (!response.ok) {
            alert('日記の読み込みに失敗しました。');
            return;
        }
        const diary = await response.json();

        // 感情の絵文字を取得
        const emotionOption = document.querySelector(`#emotion option[value="${diary.emotion}"]`);
        const emotionLabel = emotionOption ? emotionOption.textContent : diary.emotion;
        
        // ポップアップ（alert）で詳細を表示
        const detailText = `
日付: ${new Date(diary.date).toLocaleString()}
気分: ${emotionLabel}
タイトル: ${diary.title}
--------------------
【内容】
${diary.content}
--------------------
【AIからのコメント】
${diary.ai_comment}
        `;
        alert(detailText);
    }
    // [ここまでが追加部分]


    // --- ④ 初期化処理 ---
    
    // ページが読み込まれたら、まず日記一覧を読み込む
    loadDiaries();
});