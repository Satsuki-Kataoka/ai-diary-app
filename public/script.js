// DOMContentLoadedイベントリスナーで、HTMLの読み込み完了後にスクリプトを実行
document.addEventListener('DOMContentLoaded', () => {

    // --- ① 使用するHTML要素をまとめて取得 ---
    const form = document.getElementById('diary-form');
    const dateInput = document.getElementById('diary-date');
    const diaryIdInput = document.getElementById('diary-id'); // ★隠しフィールド
    const emotionSelect = document.getElementById('emotion');
    const titleInput = document.getElementById('title');
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
        eventClick: (info) => showDiaryDetail(info.event.id),
    });
    calendar.render(); // カレンダーを描画
    
    // --- ② イベントリスナーを設定 ---

    // ★「日記を書く」タブが表示されたときのイベント
    const writeTabButton = document.getElementById('write-tab');
    writeTabButton.addEventListener('shown.bs.tab', () => {
        // 今日の日付を 'YYYY-MM-DD' 形式で取得
        const today = new Date().toISOString().slice(0, 10);
        if (!dateInput.value) { // 日付が空の場合のみ今日の日付を設定
            dateInput.value = today;
        }
        loadDiaryForDate(today); // 今日（デフォルト）の日記を読み込む
    });

    // ★日付ピッカーの値が変更されたときのイベント (新規)
    dateInput.addEventListener('change', () => {
        loadDiaryForDate(dateInput.value);
    });

    // 日記フォームの送信イベント
    form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // ★常にPOSTメソッドで新しいAPIを呼び出す
    const response = await fetch('/api/save-diary', {
        method: 'POST', // 常にPOST
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date: dateInput.value,
            emotion: emotionSelect.value,
            title: titleInput.value,
            content: contentTextarea.value
        })
    });

    if (response.ok) {
        const result = await response.json();
        commentText.textContent = result.ai_comment;
        aiCommentDiv.style.display = 'block';
        loadDiaries(); // 画面を更新
        showToast(result.message || '日記を記録しました！'); // サーバーからのメッセージを表示
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

    // カレンダーのタブが表示された瞬間にカレンダーを再描画するためのイベントリスナー
    const calendarTabButton = document.getElementById('calendar-tab');
    calendarTabButton.addEventListener('shown.bs.tab', () => {
        
        // デバッグ用のメッセージ：これがコンソールに表示されるか確認
        console.log('カレンダータブが表示されました！再描画を試みます。');

        // 100ミリ秒（0.1秒）待ってから実行する。これでほとんどのタイミング問題は解決するはず。
        setTimeout(() => {
            calendar.updateSize();
        }, 100); 
    });
    


    // --- ③ 関数定義 ---

    // 【最終版】指定した日付の日記をフォームに読み込む関数
async function loadDiaryForDate(dateStr) {
    if (!dateStr) return; // 日付が空なら何もしない

    try {
        const response = await fetch(`/api/diaries/date/${dateStr}`);

        if (response.ok) {
            // ★【成功時】日記が見つかった場合
            const diary = await response.json();
            
            // データがあればフォームにセット（更新モード）
            titleInput.value = diary.title;
            emotionSelect.value = diary.emotion;
            contentTextarea.value = diary.content;
            
            // 隠しフィールドにはIDを保持（これはまだ使えます）
            diaryIdInput.value = diary.id;
            
            aiCommentDiv.style.display = 'none';
        } else {
            // ★【失敗時】日記が見つからなかった場合（ここが修正の核心）
            
            // form.reset() をやめて、個別にリセットする
            titleInput.value = '';
            contentTextarea.value = '';
            // emotionSelect はデフォルト（一番上）に戻す
            emotionSelect.selectedIndex = 0; 
            
            // 隠しフィールドのIDは空にする（新規作成モードになる）
            diaryIdInput.value = '';
            
            aiCommentDiv.style.display = 'none';

            // 日付入力欄の値は変更しない！
        }
    } catch (error) {
        console.error('指定日の日記の読み込みに失敗:', error);
    }
}
    
    // ★トースト表示関数 (汎用化)
    function showToast(message) {
        const toastEl = document.getElementById('saveToast');
        toastEl.querySelector('.toast-body');
        toastBody.textContent = message; // メッセージをセット
        const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
        toast.show();
    }

    // 過去の日記一覧をサーバーから取得して表示する関数
    async function loadDiaries() {
        try {
            const response = await fetch('/api/diaries');
            if (!response.ok) {
                console.error('日記一覧の取得に失敗:', response.statusText);
                return;
            }
            const diaries = await response.json();
            diaryList.innerHTML = '';
            diaries.forEach(diary => {
                const listItem = document.createElement('a');
                listItem.href = '#';
                listItem.className = 'list-group-item list-group-item-action';
                listItem.innerHTML = `<div class="d-flex w-100 justify-content-between"><h5 class="mb-1">${diary.title}</h5><small>${new Date(diary.date).toLocaleDateString()}</small></div><p class="mb-1">${diary.content.substring(0, 50)}...</p>`;
                listItem.dataset.id = diary.id;
                listItem.addEventListener('click', (e) => {
                    e.preventDefault();
                    showDiaryDetail(listItem.dataset.id);
                });
                diaryList.appendChild(listItem);
            });
            const calendarEvents = diaries.map(diary => ({
                id: diary.id,
                title: `${document.querySelector(`#emotion option[value="${diary.emotion}"]`)?.textContent.split(' ')[0] || '📝'} ${diary.title}`,
                start: diary.date,
                allDay: true
            }));
            calendar.removeAllEvents();
            calendar.addEventSource(calendarEvents);
            bloomFlowersOnCurtains(diaries);
        } catch(error) {
            console.error('loadDiariesでエラー:', error);
        }
    }


    // 特定のIDの日記詳細を取得して、モーダルで表示する関数
async function showDiaryDetail(id) {
    const response = await fetch(`/api/diaries/${id}`);
    if (!response.ok) {
        alert('日記の読み込みに失敗しました。');
        return;
    }
    const diary = await response.json();
    const emotionOption = document.querySelector(`#emotion option[value="${diary.emotion}"]`);

    // モーダルの各要素にデータをセット
    document.getElementById('diaryDetailModalLabel').textContent = diary.title;
    document.getElementById('modalDate').textContent = new Date(diary.date).toLocaleString();
    document.getElementById('modalEmotion').textContent = emotionOption ? emotionOption.textContent : diary.emotion;
    document.getElementById('modalContent').textContent = diary.content;
    document.getElementById('modalAiComment').textContent = diary.ai_comment;

    // 1. 削除ボタンの要素を取得
    const deleteButton = document.getElementById('delete-button');

    // 2. 削除ボタンにクリックイベントを設定
    //    一度しか実行されないように .onclick を使うか、毎回リスナーを解除するのが安全
    deleteButton.onclick = async () => {
        // 確認ダイアログを表示
        if (confirm('この日記を本当に削除しますか？')) {
            const deleteResponse = await fetch(`/api/diaries/${diary.id}`, {
                method: 'DELETE'
            });

            if (deleteResponse.ok) {
                // 削除に成功したらモーダルを閉じる
                const detailModal = bootstrap.Modal.getInstance(document.getElementById('diaryDetailModal'));
                detailModal.hide();

                // リストとカレンダーを再読み込み
                loadDiaries();
                // フォームをリセット（今日の日記を消した場合のため）
                loadTodaysDiaryIntoForm();
                // 完了通知を表示
                showToast('日記を削除しました！');
            } else {
                alert('日記の削除に失敗しました。');
            }
        }
    };
    // --- ★ここまで ---

    // Bootstrapのモーダルを表示
    const detailModal = new bootstrap.Modal(document.getElementById('diaryDetailModal'));
    detailModal.show();
}

// 左右のカーテンにお花を咲かせる関数（五つ葉バージョン）
function bloomFlowersOnCurtains(diaries) {
    const leftCurtain = document.getElementById('left-curtain');
    const rightCurtain = document.getElementById('right-curtain');

    leftCurtain.innerHTML = '';
    rightCurtain.innerHTML = '';

    diaries.forEach((diary, index) => {
        const flower = document.createElement('div');
        flower.className = 'diary-flower';

        // 1. 5枚の花びらをループで生成
        for (let i = 0; i < 5; i++) {
            const petal = document.createElement('span');
            petal.className = 'petal-shape'; // CSSで定義した花びら用のクラス
            flower.appendChild(petal);
        }

        // 2. 中心の丸を生成
        const centerCircle = document.createElement('span');
        centerCircle.className = 'center-circle'; // CSSで定義した中心用のクラス
        flower.appendChild(centerCircle);

        // 位置、サイズ、色などをランダムに設定
        //const x = Math.random() * 80;
        //const y = 5 + Math.random() * 90;
        const size = 35 + Math.random() * 45; // 少し大きめに
        const rotation = -45 + Math.random() * 90;

        // 縦位置を、画面の上部(10%～35%)と下部(65%～90%)に限定する
        let x;
        if (Math.random() < 0.5) {
            // 50%の確率で、画面の上の方に配置
            x = 5 + Math.random() * 10;
        } else {
            // 残り50%の確率で、画面の下の方に配置
            x = 80 + Math.random() * 10;
        }

        // 縦位置を、画面の上部(10%～35%)と下部(65%～90%)に限定する
        let y;
        if (Math.random() < 0.5) {
            // 50%の確率で、画面の上の方に配置
            y = 5 + Math.random() * 10;
        } else {
            // 残り50%の確率で、画面の下の方に配置
            y = 80 + Math.random() * 10;
        }
        
        const colors = ['#fbc4d4', '#c6dcf2', '#d4e7d4'];
        const colorIndex = new Date(diary.date).getDate() % colors.length;
        const color = colors[colorIndex];
        
        flower.style.setProperty('--flower-color', color);
        
        flower.style.left = `${x}%`;
        flower.style.top = `${y}%`;
        flower.style.width = `${size}px`;
        flower.style.height = `${size}px`;
        
        if (index % 2 === 0) {
            leftCurtain.appendChild(flower);
        } else {
            rightCurtain.appendChild(flower);
        }

        setTimeout(() => {
            flower.style.opacity = '0.9';
            flower.style.transform = `scale(1) rotate(${rotation}deg)`;
        }, 100 * index);
    });
}


    // --- ④ 初期化処理 ---
    
    // ページが読み込まれたら、まず日記一覧を読み込む
    loadDiaries();
});