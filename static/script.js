const $ = (id) => document.getElementById(id);

const DURATIONS = {
    focus: 25 * 60,
    short: 5 * 60,
    long: 15 * 60
};

const MODE_LABELS = {
    focus: "WAKTU FOKUS",
    short: "WAKTU ISTIRAHAT",
    long: "ISTIRAHAT PANJANG"
};

const storageKey = "focusmate-data-v1";

let mode = "focus";
let remaining = DURATIONS.focus;
let timerInterval = null;
let deadline = null;
let totalFocusSeconds = 0;
let completedSessions = 0;
let currentFilter = "all";
let tasks = [];

function todayKey() {
    const date = new Date();
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

let savedDate = todayKey();

function loadData() {
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey));

        if (!saved) return;

        if (Array.isArray(saved.tasks)) {
            tasks = saved.tasks;
        }

        if (saved.date === savedDate) {
            totalFocusSeconds = Number(saved.totalFocusSeconds) || 0;
            completedSessions = Number(saved.completedSessions) || 0;
        }
    } catch (error) {
        console.warn("Data sebelumnya tidak dapat dibaca.", error);
    }
}

function saveData() {
    try {
        localStorage.setItem(storageKey, JSON.stringify({
            tasks,
            date: savedDate,
            totalFocusSeconds,
            completedSessions
        }));
    } catch (error) {
        console.warn("Data belum berhasil disimpan.", error);
    }
}

function checkNewDay() {
    const currentDate = todayKey();

    if (currentDate !== savedDate) {
        savedDate = currentDate;
        totalFocusSeconds = 0;
        completedSessions = 0;
        saveData();
        renderStats();
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function updateTimerDisplay() {
    $("timer-display").textContent = formatTime(remaining);
    $("timer-label").textContent = MODE_LABELS[mode];

    const progress = 1 - remaining / DURATIONS[mode];
    const degrees = Math.max(0, Math.min(360, progress * 360));

    $("timer-circle").style.background =
        `conic-gradient(#3478f6 ${degrees}deg, #dfeaff ${degrees}deg)`;

    document.title = `${formatTime(remaining)} | FocusMate`;
}

function pauseTimer() {
    if (timerInterval !== null) {
        updateRunningTimer();
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateRunningTimer() {
    if (deadline === null) return;

    const previousRemaining = remaining;
    const nextRemaining = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1000)
    );

    if (mode === "focus") {
        totalFocusSeconds += Math.max(0, previousRemaining - nextRemaining);
    }

    remaining = nextRemaining;
    updateTimerDisplay();
    renderStats();

    if (remaining === 0) {
        finishTimer();
    }
}

function finishTimer() {
    if (timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    deadline = null;

    if (mode === "focus") {
        completedSessions++;
        $("timer-status").textContent =
            "Hebat! Sesi fokus selesai. Saatnya istirahat.";
    } else {
        $("timer-status").textContent =
            "Waktu istirahat selesai. Siap fokus kembali?";
    }

    $("start-btn").textContent =
        mode === "focus" ? "▶ Mulai Fokus" : "▶ Mulai Istirahat";

    saveData();
    renderStats();

    alert(
        mode === "focus"
            ? "Sesi fokus selesai! Kamu hebat. Istirahat sejenak, ya."
            : "Istirahat selesai! Saatnya kembali produktif."
    );
}

function startTimer() {
    if (timerInterval !== null) {
        pauseTimer();

        if (timerInterval !== null) return;

        $("start-btn").textContent =
            mode === "focus" ? "▶ Lanjutkan Fokus" : "▶ Lanjutkan";

        $("timer-status").textContent = "Timer dijeda.";
        saveData();
        renderStats();
        return;
    }

    if (remaining <= 0) return;

    deadline = Date.now() + remaining * 1000;

    $("start-btn").textContent = "⏸ Jeda";
    $("timer-status").textContent =
        mode === "focus" ? "Sedang fokus belajar..." : "Sedang beristirahat...";

    timerInterval = setInterval(() => {
        if (deadline === null) return;
        updateRunningTimer();
    }, 250);

    saveData();
}

function setMode(newMode) {
    pauseTimer();

    mode = newMode;
    remaining = DURATIONS[mode];

    document.querySelectorAll(".mode-btn").forEach((button) => {
        button.classList.toggle("active", button.dataset.mode === mode);
    });

    $("start-btn").textContent =
        mode === "focus" ? "▶ Mulai Fokus" : "▶ Mulai Istirahat";

    $("timer-status").textContent =
        mode === "focus"
            ? "Siap memulai sesi belajar?"
            : "Waktunya beristirahat sejenak.";

    updateTimerDisplay();
}

function resetTimer() {
    pauseTimer();

    mode = mode;
    remaining = DURATIONS[mode];

    $("start-btn").textContent =
        mode === "focus" ? "▶ Mulai Fokus" : "▶ Mulai Istirahat";

    $("timer-status").textContent = "Timer siap digunakan.";

    updateTimerDisplay();
    saveData();
    renderStats();
}

function renderTasks() {
    const list = $("task-list");
    list.replaceChildren();

    const filteredTasks = tasks.filter((task) => {
        if (currentFilter === "active") return !task.done;
        if (currentFilter === "done") return task.done;
        return true;
    });

    $("empty-state").style.display =
        filteredTasks.length === 0 ? "block" : "none";

    $("empty-state").textContent =
        tasks.length === 0
            ? "Belum ada tugas. Tambahkan tugas pertamamu!"
            : "Tidak ada tugas pada kategori ini.";

    filteredTasks.forEach((task) => {
        const li = document.createElement("li");
        li.className = "task-item" + (task.done ? " completed" : "");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-checkbox";
        checkbox.checked = task.done;
        checkbox.setAttribute("aria-label", "Tandai tugas selesai");

        checkbox.addEventListener("change", () => {
            task.done = checkbox.checked;
            saveData();
            renderTasks();
            renderStats();
        });

        const name = document.createElement("span");
        name.className = "task-name";
        name.textContent = task.name;

        const removeButton = document.createElement("button");
        removeButton.className = "delete-btn";
        removeButton.textContent = "Hapus";

        removeButton.addEventListener("click", () => {
            tasks = tasks.filter((item) => item.id !== task.id);
            saveData();
            renderTasks();
            renderStats();
        });

        li.append(checkbox, name, removeButton);
        list.appendChild(li);
    });

    $("task-count").textContent = `${tasks.length} tugas`;
}

function renderStats() {
    const minutes = Math.floor(totalFocusSeconds / 60);
    const done = tasks.filter((task) => task.done).length;
    const percent = Math.min(
        100,
        Math.floor(totalFocusSeconds / (120 * 60) * 100)
    );

    $("study-total").textContent = `${minutes} menit`;
    $("task-total").textContent = done;
    $("session-total").textContent = completedSessions;

    $("stat-focus").textContent = `${minutes} menit`;
    $("stat-sessions").textContent = `${completedSessions} sesi`;
    $("stat-tasks").textContent = `${done} tugas`;

    $("progress-bar").style.width = `${percent}%`;
    $("progress-label").textContent = `${minutes} / 120 menit`;

    $("target-status").textContent =
        percent >= 100 ? "Target tercapai! 🎉" : `${percent}% tercapai`;
}

$("start-btn").addEventListener("click", startTimer);
$("reset-btn").addEventListener("click", resetTimer);

document.querySelectorAll(".mode-btn").forEach((button) => {
    button.addEventListener("click", () => {
        setMode(button.dataset.mode);
    });
});

$("task-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("task-input").value.trim();

    if (!name) return;

    tasks.push({
        id: `${Date.now()}-${Math.random()}`,
        name,
        done: false
    });

    $("task-input").value = "";

    saveData();
    renderTasks();
    renderStats();
});

document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;

        document.querySelectorAll(".filter-btn").forEach((item) => {
            item.classList.toggle("active", item === button);
        });

        renderTasks();
    });
});

loadData();
renderTasks();
renderStats();
updateTimerDisplay();

setInterval(checkNewDay, 60000);