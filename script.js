import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- PASTE YOUR FIREBASE CONFIG KEYS HERE ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const testsCol = collection(db, "tests");

// --- GLOBAL STATE ---
let customTests = [];
let currentQuestions = [];
let examName = "";
let timer;
let timeSec = 10800; // 3 Hours
let reviewData = [];

// --- CLOUD SYNC: FETCH DATA ---
onSnapshot(testsCol, (snapshot) => {
    customTests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    window.renderHome();
});

// --- UI NAVIGATION ---
window.showPage = (id) => {
    document.querySelectorAll('.glass-container').forEach(c => c.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

window.renderHome = () => {
    const list = document.getElementById('exam-list');
    list.innerHTML = "<h3>Available Tests</h3>";
    if (customTests.length === 0) {
        list.innerHTML += "<p style='text-align:center; opacity:0.5; padding: 20px;'>No tests in cloud. Use Admin Tools below.</p>";
        return;
    }
    customTests.forEach((t, i) => {
        const div = document.createElement('div');
        div.className = 'test-card';
        div.innerHTML = `
            <button class="glass-btn primary" style="flex-grow:1; margin-right:12px; margin-bottom:0;" onclick="window.startTest(${i})">
                📝 ${t.testName} (${t.questions.length} Qs)
            </button>
            <button class="glass-btn" style="width:auto; margin-bottom:0; font-size: 20px;" onclick="window.deleteTest('${t.id}')">🗑️</button>
        `;
        list.appendChild(div);
    });
};

// --- MANUAL TEST CREATOR ---
window.addQuestionCreatorBox = () => {
    const i = document.querySelectorAll('.q-item').length + 1;
    const area = document.getElementById('creator-questions-area');
    const div = document.createElement('div');
    div.className = 'q-item';
    div.innerHTML = `
        <div style="background:rgba(255,255,255,0.03); padding:20px; border-radius:15px; margin-bottom:20px; border:1px solid rgba(255,255,255,0.1);">
            <h4 style="color:#38bdf8; margin-bottom:10px;">Question ${i}</h4>
            <textarea class="glass-input" id="q-text-${i}" placeholder="Question text"></textarea>
            <input type="file" id="q-img-${i}" class="glass-input" accept="image/*">
            <p style="font-size:12px; color:#aaa; margin-bottom:10px;">Set Options & Select Correct (Circle):</p>
            <div class="creator-option-row"><input type="radio" name="corr-${i}" value="0" checked><input type="text" class="glass-input" id="opt-0-${i}" placeholder="Option A"></div>
            <div class="creator-option-row"><input type="radio" name="corr-${i}" value="1"><input type="text" class="glass-input" id="opt-1-${i}" placeholder="Option B"></div>
            <div class="creator-option-row"><input type="radio" name="corr-${i}" value="2"><input type="text" class="glass-input" id="opt-2-${i}" placeholder="Option C"></div>
            <div class="creator-option-row"><input type="radio" name="corr-${i}" value="3"><input type="text" class="glass-input" id="opt-3-${i}" placeholder="Option D"></div>
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
    if (!name || items.length === 0) return alert("Please fill Test Name and add questions!");

    const btn = document.getElementById('save-btn');
    btn.innerText = "⏳ Syncing to Cloud..."; btn.disabled = true;

    const qs = [];
    try {
        for (let j = 1; j <= items.length; j++) {
            const qTxt = document.getElementById(`q-text-${j}`).value;
            const correctIdx = document.querySelector(`input[name="corr-${j}"]:checked`).value;
            if(!qTxt) throw new Error(`Question ${j} text is missing`);

            qs.push({
                question: qTxt,
                options: [
                    document.getElementById(`opt-0-${j}`).value,
                    document.getElementById(`opt-1-${j}`).value,
                    document.getElementById(`opt-2-${j}`).value,
                    document.getElementById(`opt-3-${j}`).value
                ],
                correctAnswer: parseInt(correctIdx),
                image: await compress(document.getElementById(`q-img-${j}`).files[0])
            });
        }
        await addDoc(testsCol, { testName: name, questions: qs, timestamp: serverTimestamp() });
        alert("✅ Published Successfully!");
        window.returnHome();
    } catch (e) {
        alert("🚨 Error: " + e.message);
        btn.disabled = false; btn.innerText = "💾 Publish to Cloud";
    }
};

window.deleteTest = async (id) => {
    if (confirm("Delete this test from ALL devices?")) await deleteDoc(doc(db, "tests", id));
};

// --- EXAM ENGINE ---
window.startTest = (idx) => {
    const t = customTests[idx];
    examName = t.testName;
    currentQuestions = t.questions;
    document.getElementById('current-exam-title').innerText = examName;
    const area = document.getElementById('quiz-area');
    area.innerHTML = currentQuestions.map((q, i) => `
        <div class="question-box" style="margin-bottom:30px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:20px;">
            <p style="font-size: 18px; margin-bottom: 15px;"><strong>${i+1}. ${q.question}</strong></p>
            ${q.image ? `<img src="${q.image}" style="max-width:100%; border-radius:12px; margin-bottom:15px; display:block;">` : ''}
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
    let score = 0; reviewData = [];
    currentQuestions.forEach((q, i) => {
        const sel = document.querySelector(`input[name="q-${i}"]:checked`);
        const uIdx = sel ? parseInt(sel.value) : null;
        const ok = uIdx === q.correctAnswer;
        if (ok) score++;
        reviewData.push({ ...q, uAns: sel ? q.options[uIdx] : "Not Answered", ok });
    });
    document.getElementById('score-text').innerText = `${score} / ${currentQuestions.length}`;
    document.getElementById('review-area').innerHTML = reviewData.map(r => `
        <div style="border-left:4px solid ${r.ok?'#22c55e':'#ef4444'}; padding: 15px; margin-bottom:15px; background: rgba(255,255,255,0.02); border-radius: 8px;">
            <p><strong>${r.question}</strong></p>
            ${r.image ? `<img src="${r.image}" style="max-width:120px; border-radius:6px; margin: 10px 0;">` : ''}
            <p style="color:#22c55e">Correct Answer: ${r.options[r.correctAnswer]}</p>
            ${!r.ok ? `<p style="color:#ef4444">Your Answer: ${r.uAns}</p>` : ''}
        </div>
    `).join('');
    window.showPage('result-page');
};

// --- PDF EXPORT ---
window.downloadResults = () => {
    const el = document.createElement('div');
    el.style.color = "#000"; el.style.padding = "30px"; el.style.background = "#fff";
    el.innerHTML = `<h1 style="text-align:center; color:#1e88e5;">Result: ${examName}</h1><h3 style="text-align:center;">Score: ${document.getElementById('score-text').innerText}</h3><hr style="margin:20px 0;">` + reviewData.map(r => `
        <div style="margin-bottom:20px; page-break-inside: avoid; border-bottom: 1px solid #eee; padding-bottom: 15px;">
            <p style="font-size: 16px;"><strong>${r.question}</strong></p>
            ${r.image ? `<img src="${r.image}" style="max-width:300px; margin: 10px 0; display:block;">` : ''}
            <p><strong>Status:</strong> ${r.ok ? '<span style="color:green">CORRECT</span>' : '<span style="color:red">WRONG</span>'}</p>
            <p><strong>Correct Answer:</strong> ${r.options[r.correctAnswer]}</p>
        </div>
    `).join('');
    html2pdf().from(el).set({ margin: 10, filename: `${examName}_Result.pdf`, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).save();
};

window.handleJSONUpload = (e) => {
    const f = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            await addDoc(testsCol, { testName: f.name.replace('.json',''), questions: data, timestamp: serverTimestamp() });
            alert("✅ Cloud Sync Complete!");
        } catch (err) { alert("Invalid JSON file."); }
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
