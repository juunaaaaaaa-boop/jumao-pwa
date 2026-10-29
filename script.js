
"use strict";

const $ = (selector) => document.querySelector(selector);
const workspace = $("#workspace");
const workspaceBody = $("#workspaceBody");
const workspaceTitle = $("#workspaceTitle");
const toast = $("#toast");

let toastTimeout;
let timerInterval = null;
let remaining = 25 * 60;
let gameBoard = Array(9).fill("");
let gameTurn = "X";
let gameActive = true;

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2200);
}

function loadNotes() {
  try { return localStorage.getItem("juumao-notes") || ""; }
  catch { return ""; }
}

function saveNotes(value) {
  try {
    localStorage.setItem("juumao-notes", value);
    notify("Notes saved on this device.");
  } catch {
    notify("Storage unavailable. Copy your notes before leaving.");
  }
}

function loadTasks() {
  try { return JSON.parse(localStorage.getItem("juumao-tasks") || "[]"); }
  catch { return []; }
}

function saveTasks(tasks) {
  try {
    localStorage.setItem("juumao-tasks", JSON.stringify(tasks));
  } catch {
    notify("Could not save tasks on this device.");
  }
}

function button(label, action) {
  const el = document.createElement("button");
  el.className = "tool-button";
  el.textContent = label;
  el.addEventListener("click", action);
  return el;
}

function panel() {
  workspaceBody.replaceChildren();
  const el = document.createElement("div");
  el.className = "workspace-panel";
  workspaceBody.append(el);
  return el;
}

function openWorkspace(name) {
  workspace.hidden = false;
  workspaceTitle.textContent = ({
    notes: "Quick Notes",
    tasks: "Task Board",
    timer: "Focus Timer",
    games: "Mini Games"
  })[name] || "Workspace";

  const p = panel();

  if (name === "notes") {
    const label = document.createElement("label");
    label.className = "field-label";
    label.textContent = "YOUR THOUGHTS";
    const area = document.createElement("textarea");
    area.placeholder = "Write something worth remembering...";
    area.value = loadNotes();
    const save = button("Save notes", () => saveNotes(area.value));
    const clear = button("Clear", () => {
      area.value = "";
      saveNotes("");
    });
    p.append(label, area);
    const row = document.createElement("div");
    row.className = "tool-row";
    row.append(save, clear);
    p.append(row);
  }

  if (name === "tasks") {
    const form = document.createElement("form");
    const input = document.createElement("input");
    input.placeholder = "Add a task...";
    input.maxLength = 180;
    input.required = true;
    input.setAttribute("aria-label", "New task");
    form.append(input, button("Add task", () => {}));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      const tasks = loadTasks();
      tasks.push({ id: Date.now() + Math.random(), text: value, done: false });
      saveTasks(tasks);
      openWorkspace("tasks");
      notify("Task added.");
    });
    p.append(form);
    const list = document.createElement("ul");
    list.className = "task-list";
    const tasks = loadTasks();

    if (!tasks.length) {
      const empty = document.createElement("p");
      empty.textContent = "No tasks yet. Add your first one above.";
      empty.style.color = "#929292";
      p.append(empty);
    }

    tasks.forEach((task) => {
      const li = document.createElement("li");
      if (task.done) li.classList.add("done");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = task.done;
      check.style.width = "auto";
      check.addEventListener("change", () => {
        const updated = loadTasks().map((item) =>
          item.id === task.id ? { ...item, done: check.checked } : item
        );
        saveTasks(updated);
        openWorkspace("tasks");
      });
      const text = document.createElement("span");
      text.textContent = task.text;
      const del = document.createElement("button");
      del.className = "delete-task";
      del.textContent = "Delete";
      del.addEventListener("click", () => {
        saveTasks(loadTasks().filter((item) => item.id !== task.id));
        openWorkspace("tasks");
        notify("Task deleted.");
      });
      li.append(check, text, del);
      list.append(li);
    });
    p.append(list);
  }

  if (name === "timer") {
    const display = document.createElement("div");
    display.className = "timer-display";
    display.setAttribute("aria-live", "off");
    const updateDisplay = () => {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      display.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };
    const presets = document.createElement("div");
    presets.className = "tool-row";
    [5, 15, 25, 45].forEach((mins) => {
      presets.append(button(`${mins} min`, () => {
        clearInterval(timerInterval);
        timerInterval = null;
        remaining = mins * 60;
        updateDisplay();
      }));
    });
    const controls = document.createElement("div");
    controls.className = "tool-row";
    const start = button("Start", () => {
      if (timerInterval) return;
      timerInterval = setInterval(() => {
        if (remaining > 0) {
          remaining--;
          updateDisplay();
        } else {
          clearInterval(timerInterval);
          timerInterval = null;
          notify("Focus session complete.");
        }
      }, 1000);
    });
    const pause = button("Pause", () => {
      clearInterval(timerInterval);
      timerInterval = null;
    });
    const reset = button("Reset", () => {
      clearInterval(timerInterval);
      timerInterval = null;
      remaining = 25 * 60;
      updateDisplay();
    });
    controls.append(start, pause, reset);
    p.append(display, presets, controls);
    updateDisplay();
  }

  if (name === "games") {
    const score = document.createElement("p");
    score.style.color = "#aaa";
    const board = document.createElement("div");
    board.className = "game-board";
    const message = document.createElement("p");
    const reset = button("New round", resetGame);
    function renderGame() {
      board.replaceChildren();
      gameBoard.forEach((value, index) => {
        const cell = document.createElement("button");
        cell.className = "game-cell";
        cell.textContent = value;
        cell.setAttribute("aria-label", `Cell ${index + 1} ${value || "empty"}`);
        cell.addEventListener("click", () => playCell(index, message, score));
        board.append(cell);
      });
      score.textContent = `Turn: ${gameTurn}`;
    }
    function finishGame(text) {
      gameActive = false;
      message.textContent = text;
    }
    function checkWinner(mark) {
      const wins = [
        [0,1,2], [3,4,5], [6,7,8],
        [0,3,6], [1,4,7], [2,5,8],
        [0,4,8], [2,4,6]
      ];
      return wins.some((line) => line.every((i) => gameBoard[i] === mark));
    }
    function resetGame() {
      gameBoard = Array(9).fill("");
      gameTurn = "X";
      gameActive = true;
      message.textContent = "";
      renderGame();
    }
    function playCell(index, msg) {
      if (!gameActive || gameBoard[index]) return;
      gameBoard[index] = gameTurn;
      if (checkWinner(gameTurn)) {
        renderGame();
        finishGame(`${gameTurn} wins!`);
        return;
      }
      if (gameBoard.every(Boolean)) {
        renderGame();
        finishGame("Draw. Start another round.");
        return;
      }
      gameTurn = gameTurn === "X" ? "O" : "X";
      renderGame();
    }
    p.append(board, score, message, reset);
    renderGame();
  }

  workspace.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelectorAll(".open-app").forEach((btn) => {
  btn.addEventListener("click", () => {
    openWorkspace(btn.closest(".app-card").dataset.app);
  });
});

$("#closeWorkspace").addEventListener("click", () => {
  workspace.hidden = true;
  clearInterval(timerInterval);
  timerInterval = null;
  $("#apps").scrollIntoView({ behavior: "smooth" });
});

$("#focusBtn").addEventListener("click", () => {
  document.body.classList.toggle("focus-mode");
  const active = document.body.classList.contains("focus-mode");
  $("#focusBtn").textContent = active ? "Exit focus ×" : "Focus mode ◉";
  if (active) window.scrollTo({ top: 0, behavior: "smooth" });
});

const quotes = [
  "You don't have to do everything.\nYou just have to start somewhere.",
  "Make room for what matters.",
  "Small progress is still progress.",
  "Create quietly. Let the work speak.",
  "Your attention is a limited resource. Spend it well."
];

$("#newQuote").addEventListener("click", () => {
  const current = $("#quoteText").textContent;
  const choices = quotes.filter((quote) => quote.replace("\n", " ") !== current);
  const quote = choices[Math.floor(Math.random() * choices.length)];
  $("#quoteText").textContent = quote;
});

let deferredInstall = null;
const installBtn = $("#installBtn");

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstall = event;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredInstall) {
    notify("Open the browser menu and choose Install app or Add to Home screen.");
    return;
  }
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  installBtn.hidden = true;
});

window.addEventListener("appinstalled", () => {
  notify("JUUMAO installed.");
  installBtn.hidden = true;
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      notify("Offline mode could not be enabled.");
    });
  });
    }
                
