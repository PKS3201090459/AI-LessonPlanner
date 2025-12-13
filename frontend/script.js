// script.js (Папка /frontend) - ФИНАЛЬНЫЙ КОД С УСЛОВНЫМ ВЫВОДОМ AI

// --- Локальное хранилище для данных ---
let lessonArchive = JSON.parse(localStorage.getItem('lessonArchive')) || [];

// --- Глобальные DOM-элементы ---
const lessonForm = document.getElementById('lessonForm');
const statusMessage = document.getElementById('statusMessage');
const resultContainer = document.getElementById('resultContainer');
const resultOutput = document.getElementById('resultOutput');
const downloadDocxBtn = document.getElementById('downloadDocxBtn'); 
const submitBtn = document.getElementById('submitBtn');
const saveBtn = document.getElementById('saveBtn');
const analyticsContent = document.getElementById('analyticsContent');

// Элементы для JSON/копирования - объявлены, но не используются
const jsonTestContainer = document.getElementById('jsonTestContainer');
const jsonTestOutput = document.getElementById('jsonTestOutput');
const copyJsonBtn = document.getElementById('copyJsonBtn');


// --- 1. ФУНКЦИИ УПРАВЛЕНИЯ ИНТЕРФЕЙСОМ ---

function handleTabSwitch() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });

            document.getElementById(tabId).classList.add('active');
            button.classList.add('active');

            if (tabId === 'analytics') {
                renderAnalytics();
            }
        });
    });
}

function showStatus(message, type = '') {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message';
    if (type) {
        statusMessage.classList.add(type);
    }
}

// --- 2. ФУНКЦИЯ ГЕНЕРАЦИИ КОНТЕНТА ---
lessonForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const theme = document.getElementById('theme').value;
    const grade = document.getElementById('grade').value;
    const duration = document.getElementById('duration').value;
    const language = document.querySelector('input[name="language"]:checked').value;
    
    resultContainer.style.display = 'none';
    resultOutput.innerHTML = '';
    if (jsonTestContainer) jsonTestContainer.style.display = 'none'; 
    saveBtn.disabled = true;
    submitBtn.disabled = true;
    
    showStatus(`💫 Генерация плана урока "${theme}" на ${language} язык...`);

    try {
        const response = await fetch('http://localhost:3000/api/generate-lesson', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme, grade, duration, language }),
        });

        const data = await response.json();

        if (data.success) {
            const markdownContent = data.content;
            
            resultOutput.textContent = markdownContent; 
            resultOutput.setAttribute('data-content', markdownContent); 
            
            resultContainer.style.display = 'block';
            showStatus(`🎉 План урока и тест готовы! (${language})`, 'success');
            saveBtn.disabled = false;
        } else {
            showStatus(`❌ Ошибка генерации: ${data.error || 'Неизвестная ошибка.'}`, 'error');
        }

    } catch (error) {
        showStatus(`❌ Критическая ошибка соединения с сервером. Убедитесь, что Node.js сервер запущен на порту 3000.`, 'error');
        console.error("Fetch Error:", error);
    } finally {
        submitBtn.disabled = false;
    }
});


// --- 3. ОБРАБОТЧИКИ ДЕЙСТВИЙ (Сохранение / DOCX) ---

// Сохранение в Архив 
saveBtn.addEventListener('click', function() {
    const theme = document.getElementById('theme').value;
    const grade = document.getElementById('grade').value;
    const generatedContent = resultOutput.getAttribute('data-content');
    
    if (!generatedContent) {
        alert("Нет сгенерированного контента для сохранения.");
        return;
    }

    const newLesson = {
        date: new Date().toLocaleDateString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit' }),
        theme: theme,
        grade: grade,
        generatedContent: generatedContent,
        scores_list: "", 
        avg_score: 0, 
        students_to_repeat: 0 
    };

    lessonArchive.push(newLesson);
    localStorage.setItem('lessonArchive', JSON.stringify(lessonArchive));

    showStatus(`✅ Урок '${theme}' успешно сохранен в локальный архив.`, 'success');
    saveBtn.disabled = true; 
});

// Скачивание DOCX (Фронтенд-генерация)
if (downloadDocxBtn) {
    downloadDocxBtn.addEventListener('click', function() {
        const markdownContent = resultOutput.getAttribute('data-content');
        const theme = document.getElementById('theme').value;

        if (!markdownContent) {
            showStatus("Сначала сгенерируйте контент.", 'error');
            return;
        }

        showStatus("📑 Подготовка документа к скачиванию...", 'success');

        const plainTextContent = markdownContent
            .replace(/\*\*(.*?)\*\*/g, '$1')  
            .replace(/###\s*/g, '\n\n')       
            .replace(/##\s*/g, '\n\n')        
            .replace(/^-/gm, '• ')            
            .replace(/\n\s*\n/g, '\n\n')      
            .replace(/\n\n\n/g, '\n\n');      
        
        const fileContent = `ПЛАН УРОКА И ТЕСТ: ${theme}\n\n========================================\n\n${plainTextContent}`;

        const blob = new Blob([fileContent], { 
            type: 'application/msword;charset=utf-8' 
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${theme.replace(/[^a-z0-9]/gi, '_')}_LessonPlan_Test.doc`; 
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showStatus(`✅ Word-файл '${a.download}' успешно скачан.`, 'success');
    });
}


// --- 4. ЛОГИКА УДАЛЕНИЯ ---
function deleteLesson(index) {
    const lesson = lessonArchive[index];
    if (confirm(`Вы уверены, что хотите удалить урок "${lesson.theme}" от ${lesson.date} (Класс: ${lesson.grade})?`)) {
        lessonArchive.splice(index, 1); 
        localStorage.setItem('lessonArchive', JSON.stringify(lessonArchive));
        renderAnalytics();
        showStatus('✅ Урок успешно удален из архива.', 'success');
    }
}

// --- ФУНКЦИЯ: ОБНОВЛЕНИЕ И РАСЧЕТ ДАННЫХ ---
function updateLessonData(index, scoresString) {
    
    // 1. Парсинг строки баллов
    const scores = scoresString
        .split(/[,\s]+/) // Разделяем по запятым или пробелам
        .map(s => parseInt(s.trim())) // Преобразуем в целые числа
        .filter(n => !isNaN(n) && n >= 0 && n <= 100); // Фильтруем и валидируем (0-100)

    if (scores.length === 0) {
        alert("Пожалуйста, введите корректный список баллов (числа от 0 до 100, разделенные запятыми или пробелами).");
        return;
    }

    const totalStudents = scores.length;
    
    // 2. Расчет среднего балла
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    const avgScore = Math.round(totalScore / totalStudents);
    
    // 3. Расчет учеников, требующих повторения (<= 50 баллов)
    const REPEAT_THRESHOLD = 49;
    const repeaters = scores.filter(score => score <= REPEAT_THRESHOLD).length;

    // 4. Обновляем данные в архиве
    lessonArchive[index].scores_list = scoresString; // Сохраняем исходную строку
    lessonArchive[index].avg_score = avgScore;
    lessonArchive[index].students_to_repeat = repeaters;

    // 5. Сохраняем и перерисовываем
    localStorage.setItem('lessonArchive', JSON.stringify(lessonArchive));
    renderAnalytics();
    showStatus(`✅ Данные для урока "${lessonArchive[index].theme}" обновлены. Средний балл: ${avgScore}%. Нуждаются в повторении: ${repeaters}.`, 'success');
}


// --- 5. РЕНДЕРИНГ АНАЛИТИКИ (Исправлено) ---

function renderAnalytics() {
    analyticsContent.innerHTML = ''; 

    if (lessonArchive.length === 0) {
        analyticsContent.innerHTML = '<p id="noDataMessage">⚠️ Нет сохраненных уроков для анализа. Сгенерируйте и сохраните план на предыдущей вкладке.</p>';
        return;
    }

    // 1. Подготовка и расчет метрик
    const displayData = lessonArchive.map(lesson => {
        // Убедимся, что данные - числа (заменяем 0, если не число)
        let avgScore = typeof lesson.avg_score === 'number' && lesson.avg_score > 0 ? lesson.avg_score : 0;
        let studentsToRepeat = typeof lesson.students_to_repeat === 'number' ? lesson.students_to_repeat : 0;
        
        return {
            ...lesson,
            avg_score: avgScore,
            students_to_repeat: studentsToRepeat,
            isMock: avgScore === 0 
        };
    });
    
    const totalTests = displayData.length;
    // Используем только уроки с ненулевым средним баллом для общего расчета
    const validScores = displayData.map(l => l.avg_score).filter(s => s > 0); 
    
    // Рассчитываем общий средний балл как число (toFixed(1) делаем при выводе)
    const avgScoreOverallNum = validScores.length > 0 ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length : null;
    const avgScoreOverallDisplay = avgScoreOverallNum !== null ? avgScoreOverallNum.toFixed(1) : 'N/A';
    
    // Находим тему с наибольшим количеством учеников, требующих повторения
    const problematicLesson = displayData.reduce((max, lesson) => 
        (max.students_to_repeat > lesson.students_to_repeat ? max : lesson), 
        { students_to_repeat: -1, theme: 'Нет данных' }
    );
    const mostProblematicTheme = problematicLesson.theme;
    
    // Проверка наличия учеников, требующих повторения, в целом
    const hasRepeaters = displayData.some(lesson => lesson.students_to_repeat > 0);


    // 2. Метрики (Используем обновленный расчет и форматирование)
    analyticsContent.innerHTML += `
        <h3>🚨 Ключевые показатели</h3>
        <div class="metric-grid">
            <div class="metric-card">
                <p>Общее число тестов</p>
                <strong>${totalTests}</strong>
            </div>
            <div class="metric-card">
                <p>Средний балл по актуальным данным</p>
                <strong>${avgScoreOverallDisplay}%</strong>
            </div>
            <div class="metric-card">
                <p>Самая проблемная тема</p>
                <strong>${mostProblematicTheme}</strong>
            </div>
        </div>
    `;

    // 3. Предупреждение о необходимости ввода данных (Используем <strong> для жирного шрифта)
    if (displayData.some(d => d.isMock)) {
        analyticsContent.innerHTML += `
            <div class="status-message error" style="margin-top:20px;">
                💡 <strong>Внимание:</strong> Некоторые уроки требуют ввода <strong>списка баллов</strong> для корректного расчета общей статистики.
            </div>
        `;
    }


    // 4. Таблица
    let tableHtml = `
        <h3 style="margin-top: 30px;">📋 Сводка по сохраненным тестам</h3>
        <table class="analytics-table">
            <thead>
                <tr>
                    <th>Дата</th>
                    <th>Тема</th>
                    <th>Класс</th>
                    <th>Баллы учащихся (0-100, ввод)</th>
                    <th>Средний балл (%)</th>
                    <th>Учеников, требующих повторения (&le;50%)</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    lessonArchive.forEach((lesson, index) => {
        const currentLesson = displayData[index]; // Используем обработанные данные
        tableHtml += `
            <tr>
                <td>${currentLesson.date}</td>
                <td>${currentLesson.theme}</td>
                <td>${currentLesson.grade}</td>
                <td>
                    <input type="text" 
                               class="scores-input" 
                               data-index="${index}" 
                               value="${lesson.scores_list}"
                               placeholder="90, 85, 45, 100..."
                               style="width: 150px;">
                </td>
                <td>
                    <strong>${currentLesson.avg_score}%</strong>
                </td>
                <td>
                    <strong>${currentLesson.students_to_repeat}</strong>
                </td>
                <td>
                    <button class="save-data-btn" data-index="${index}">💾 Расчет и сохранение</button>
                    <button class="delete-btn" data-index="${index}">🗑️ Удалить</button>
                </td>
            </tr>
        `;
    });

    tableHtml += `
            </tbody>
        </table>
    `;
    
    analyticsContent.innerHTML += tableHtml;
    
    // 5. Условный Вывод AI (ИМИТАЦИЯ) (Используем <strong>)
    if (hasRepeaters) {
        analyticsContent.innerHTML += `
            <div class="status-message error" style="margin-top:20px;">
                🔥 <strong>Вывод AI (имитация):</strong> Тема <strong>'${mostProblematicTheme}'</strong> требует немедленного повторения.
            </div>
        `;
    }
    
    // 6. Привязка обработчиков событий для кнопок (Остается без изменений)
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const indexToDelete = parseInt(e.target.dataset.index, 10);
            deleteLesson(indexToDelete);
        });
    });
    
    document.querySelectorAll('.save-data-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            const row = e.target.closest('tr');
            
            const scoresInput = row.querySelector('.scores-input');
            
            updateLessonData(index, scoresInput.value);
        });
    });
}


// --- 6. ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    handleTabSwitch();
    
    if (window.location.hash === '#analytics') {
        document.querySelector('.tab-button[data-tab="analytics"]').click();
    } else {
        document.getElementById('generator').classList.add('active');
    }
});