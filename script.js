import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// REPLACE THESE WITH YOUR KEYS FROM FIREBASE CONSOLE
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const testsCol = collection(db, "tests");

// --- STATE ---
let customTests = [];
let currentQuestions = [];
let examName = "";
let timer;
let timeSec = 10800;
let results = [];

// --- CLOUD SYNC ---
onSnapshot(testsCol, (snap) => {
    customTests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.renderHome();
});

// --- GLOBAL ATTACHMENTS (Fixes "Not Working" Buttons) ---
window.showPage = (id) => {
    document.querySelectorAll('.glass-container').forEach(c => c.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

window.renderHome = () => {
    const list = document.getElementById('exam-list');
    list.innerHTML = "<h3>Available Tests</h3>";
    if (customTests.length === 0) {
        list.innerHTML += "<p style='text-align:center; opacity:0.4;'>Cloud is empty. Add a test below.</p>";
        return;
    }
    customTests.forEach((t, i) => {
        const div = document.createElement('div');
        div.className = 'test-card';
        div.innerHTML = `
            <button class="glass-btn primary" style="flex-grow:1; margin-right:10px; margin-bottom:0;" onclick="window.startTest(${i})">
                📝 ${t.testName} (${t.questions.length} Qs)
            </button>
            <button class="glass-btn" style="width:auto; margin-bottom:0;" onclick="window.deleteTest('${t.id}')">🗑️</button>
        `;
        list.appendChild(div);
    });
};

window.addQuestionCreatorBox = () => {
    const i = document.querySelectorAll('.q-item').length + 1;
    const area = document.getElementById('creator-questions-area');
    const div = document.createElement('div');
    div.className = 'q-item';
    div.innerHTML = `
        <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; margin-bottom:15px;">
            <h4>Question ${i}</h4>
            <textarea class="glass-input" id="q-text-${i}" placeholder="Question text"></textarea>
            <input type="file" id="q-img-${i}" class="glass-input" accept="image/*">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <input type="text" class="glass-input" id="opt-0-${i}" placeholder="Option A">
                <input type="text" class="glass-input" id="opt-1-${i}" placeholder="Option B">
                <input type="text" class="glass-input" id="opt-2-${i}" placeholder="Option C">
                <input type="text" class="glass-input" id="opt-3-${i}" placeholder="Option D">
            </div>
            <p style="font-size:12px; margin-top:5px;">Select Correct Index (0=A, 1=B, 2=C, 3=D)</p>
            <input type="number" class="glass-input" id="q-corr-${i}" min="0" max="3" value="0">
        </div>
    `;
    area.appendChild(div);
};

async function compress(file) {
    if (!file) return null;
    return new Promise(res => {
        const r = new FileReader();
        r.readAsDataURL(file);
        r.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const cvs = document.createElement('canvas');
                const scale = Math.min(800 / img.width, 1);
                cvs.width = img.width * scale;
                cvs.height = img.height * scale;
                cvs.getContext('2d').drawImage(img, 0, 0, cvs.width, cvs.height);
                res(cvs.toDataURL('image/jpeg', 0.6));
            };
        };
    });
}

window.saveCustomTest = async () => {
    const name = document.getElementById('new-test-name').value;
    const items = document.querySelectorAll('.q-item');
    if (!name || items.length === 0) return alert("Missing data");

    const btn = document.getElementById('save-btn');
    btn.innerText = "Syncing..."; btn.disabled = true;

    const qs = [];
    for (let j = 1; j <= items.length; j++) {
        qs.push({
            question: document.getElementById(`q-text-${j}`).value,
            options: [
                document.getElementById(`opt-0-${j}`).value,
                document.getElementById(`opt-1-${j}`).value,
                document.getElementById(`opt-2-${j}`).value,
                document.getElementById(`opt-3-${j}`).value
            ],
            correctAnswer: parseInt(document.getElementById(`q-corr-${j}`).value),
            image: await compress(document.getElementById(`q-img-${j}`).files[0])
        });
    }
    await addDoc(testsCol, { testName: name, questions: qs });
    window.returnHome();
};

window.deleteTest = async (id) => {
    if (confirm("Delete everywhere?")) await deleteDoc(doc(db, "tests", id));
};

window.startTest = (idx) => {
    const t = customTests[idx];
    examName = t.testName;
    currentQuestions = t.questions;
    document.getElementById('current-exam-title').innerText = examName;
    const area = document.getElementById('quiz-area');
    area.innerHTML = currentQuestions.map((q, i) => `
        <div class="question-box" style="margin-bottom:20px; border-bottom:1px solid #333; padding-bottom:15px;">
            <p><strong>${i+1}. ${q.question}</strong></p>
            ${q.image ? `<img src="${q.image}" style="max-width:100%; border-radius:8px; margin:10px 0;">` : ''}
            ${q.options.map((o, oi) => `
                <label class="option-label"><input type="radio" name="q-${i}" value="${oi}"> ${o}</label>
            `).join('')}
        </div>
    `).join('');
    window.showPage('quiz-page');
    window.runTimer();
};

window.runTimer = () => {
    timeSec = 10800;
    clearInterval(timer);
    timer = setInterval(() => {
        timeSec--;
        const h = Math.floor(timeSec / 3600), m = Math.floor((timeSec % 3600) / 60), s = timeSec % 60;
        document.getElementById('timer').innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        if (timeSec <= 0) window.submitTest();
    }, 1000);
};

window.submitTest = () => {
    clearInterval(timer);
    let score = 0; results = [];
    currentQuestions.forEach((q, i) => {
        const sel = document.querySelector(`input[name="q-${i}"]:checked`);
        const uIdx = sel ? parseInt(sel.value) : null;
        const ok = uIdx === q.correctAnswer;
        if (ok) score++;
        results.push({ ...q, uAns: sel ? q.options[uIdx] : "None", ok });
    });
    document.getElementById('score-text').innerText = `${score} / ${currentQuestions.length}`;
    document.getElementById('review-area').innerHTML = results.map(r => `
        <div style="border-left:4px solid ${r.ok?'#22c55e':'#ef4444'}; padding-left:10px; margin-bottom:15px;">
            <p>${r.question}</p>
            <p style="color:#22c55e">Correct: ${r.options[r.correctAnswer]}</p>
            ${!r.ok ? `<p style="color:#ef4444">Yours: ${r.uAns}</p>` : ''}
        </div>
    `).join('');
    window.showPage('result-page');
};

window.downloadResults = () => {
    const el = document.createElement('div');
    el.style.color = "#000"; el.style.padding = "20px";
    el.innerHTML = `<h1 style="text-align:center;">Result: ${examName}</h1><hr>` + results.map(r => `
        <div style="margin-bottom:15px;">
            <p><strong>${r.question}</strong></p>
            ${r.image ? `<img src="${r.image}" style="max-width:300px;">` : ''}
            <p>Result: ${r.ok ? 'CORRECT' : 'WRONG'}</p>
            <p>Correct Answer: ${r.options[r.correctAnswer]}</p>
        </div>
    `).join('');
    html2pdf().from(el).save(`${examName}_Result.pdf`);
};

window.handleJSONUpload = (e) => {
    const f = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const data = JSON.parse(ev.target.result);
        await addDoc(testsCol, { testName: f.name.replace('.json',''), questions: data });
        alert("Synced!");
    };
    reader.readAsText(f);
};

window.returnHome = () => location.reload();

document.addEventListener('mousemove', (e) => {
    document.querySelectorAll('.glass-container').forEach(c => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mouse-x', `${e.clientX - r.left}px`);
        c.style.setProperty('--mouse-y', `${e.clientY - r.top}px`);
    });
});