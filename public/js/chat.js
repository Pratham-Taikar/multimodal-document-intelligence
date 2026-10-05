// ========================================================
// AskMyNotes - Modern AI Academic Studio Client Script
// ========================================================

const subjectId = document.body.dataset.subjectId;
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");
const chatForm = document.getElementById("chat-form");
const sendBtn = document.getElementById("sendBtn");

let messages = JSON.parse(localStorage.getItem("AskMyNotes_chat_" + subjectId)) || [];
let isProcessing = false;
let speakingMessageIdx = null;

// Voice Recognition & Synthesis
let isRecording = false;
let recognition = null;
let currentUtterance = null;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (chatInput) {
            chatInput.value = transcript;
            showToast("Voice captured: " + transcript, "info");
            setTimeout(() => {
                if (chatInput.value.trim()) {
                    chatForm.dispatchEvent(new Event('submit'));
                }
            }, 400);
        }
    };

    recognition.onerror = () => {
        showToast("Could not recognize voice clearly. Please try again.", "error");
        stopVoiceRecording();
    };

    recognition.onend = () => {
        stopVoiceRecording();
    };
}

function startVoiceRecording() {
    if (!recognition) {
        showToast("Voice input is not supported in this browser. Please use Chrome.", "error");
        return;
    }
    if (isRecording) {
        stopVoiceRecording();
        return;
    }
    try {
        recognition.start();
        isRecording = true;
        const btn = document.getElementById("voiceBtn");
        if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-stop text-red-400"></i>`;
            btn.classList.add("recording-pulse", "bg-red-950/60");
        }
        showToast("Listening... Speak your question now", "info");
    } catch (e) {
        showToast("Voice input initialization failed", "error");
    }
}

function stopVoiceRecording() {
    if (recognition && isRecording) {
        try { recognition.stop(); } catch (e) {}
    }
    isRecording = false;
    const btn = document.getElementById("voiceBtn");
    if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-microphone text-sm"></i>`;
        btn.classList.remove("recording-pulse", "bg-red-950/60");
    }
}

function speakAnswer(text) {
    if (!('speechSynthesis' in window) || !text) return;
    try {
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*#`_~]/g, '');
        currentUtterance = new SpeechSynthesisUtterance(cleanText);
        currentUtterance.rate = 1.05;
        
        currentUtterance.onend = () => {
            speakingMessageIdx = null;
            renderMessages();
        };
        currentUtterance.onerror = () => {
            speakingMessageIdx = null;
            renderMessages();
        };

        window.speechSynthesis.speak(currentUtterance);
    } catch (e) {
        console.warn("TTS failed:", e);
        speakingMessageIdx = null;
        renderMessages();
    }
}

function stopSpeaking() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    if (speakingMessageIdx !== null) {
        speakingMessageIdx = null;
        renderMessages();
        showToast("Audio stopped", "info");
    }
}

// ---------------- Toast Notifications (Modern Dark Theme) ----------------
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const bg = type === 'success' ? 'bg-slate-900 border border-emerald-500/40 text-emerald-300' : 
               type === 'error' ? 'bg-slate-900 border border-red-500/40 text-red-300' : 
               'bg-slate-900 border border-indigo-500/40 text-indigo-300';
    const icon = type === 'success' ? 'fa-circle-check text-emerald-400' : 
                 type === 'error' ? 'fa-triangle-exclamation text-red-400' : 
                 'fa-circle-info text-indigo-400';
                 
    toast.className = `${bg} px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-semibold backdrop-blur-md animate-in slide-in-from-bottom duration-200 z-50`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-sm"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ---------------- Studio Tab Switching (Modern Dark Tech Theme) ----------------
function switchTab(tabName) {
    const tabs = ['chat', 'summary', 'flashcards', 'quiz', 'questions', 'research'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        const content = document.getElementById(`tab-content-${t}`);
        if (btn && content) {
            if (t === tabName) {
                btn.className = 'studio-tab-btn active px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20';
                content.classList.remove('hidden');
            } else {
                btn.className = 'studio-tab-btn px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all flex items-center gap-1.5';
                content.classList.add('hidden');
            }
        }
    });

    if (tabName === 'chat' && chatInput) {
        setTimeout(() => chatInput.focus(), 50);
    }
    if (tabName === 'research') {
        loadResearchPaperInfo();
    }
}

function toggleDocSidebar() {
    const sidebar = document.getElementById("doc-sidebar-pane");
    if (sidebar) {
        sidebar.classList.toggle("hidden");
    }
}

// ---------------- Document Management ----------------
async function loadDocuments() {
    const list = document.getElementById("sidebar-doc-list");
    const counter = document.getElementById("doc-counter");
    if (!list) return;

    try {
        const res = await axios.get(`/documents/list/${subjectId}`);
        const files = res.data.files || [];
        if (counter) counter.innerText = `${files.length} document(s) uploaded`;

        if (files.length === 0) {
            list.innerHTML = `
                <div class="text-center py-6 text-slate-500 text-xs italic">
                    No notes uploaded yet.<br>Upload PDF, DOCX, or PPTX above.
                </div>
            `;
            return;
        }

        list.innerHTML = files.map(file => {
            const ext = (file.name || '').split('.').pop().toLowerCase();
            let icon = 'fa-file-lines text-slate-400';
            if (ext === 'pdf') icon = 'fa-file-pdf text-rose-500';
            else if (ext === 'docx' || ext === 'doc') icon = 'fa-file-word text-blue-500';
            else if (ext === 'pptx' || ext === 'ppt') icon = 'fa-file-powerpoint text-amber-500';

            const dateStr = file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : 'Active';

            return `
                <div class="p-2.5 bg-[#0b0f19]/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl flex items-center justify-between gap-2 group transition-colors">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <i class="fa-solid ${icon} text-base flex-shrink-0"></i>
                        <div class="min-w-0">
                            <p class="text-xs font-semibold text-slate-200 truncate" title="${file.name}">${file.name}</p>
                            <p class="text-[10px] text-slate-500">${dateStr}</p>
                        </div>
                    </div>
                    <button onclick="deleteDoc('${file.filename || file.name}')" class="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1" title="Delete">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error("Failed to load documents:", e);
    }
}

async function deleteDoc(filename) {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
        await axios.delete(`/documents/delete/${subjectId}/${encodeURIComponent(filename)}`);
        showToast("Document deleted", "success");
        loadDocuments();
    } catch (e) {
        showToast("Failed to delete document", "error");
    }
}

async function uploadFileList(files) {
    if (!files || !files.length) return;
    const formData = new FormData();
    for (let f of files) formData.append("documents", f);

    try {
        showToast("Processing notes...", "info");
        await axios.post(`/documents/upload/${subjectId}`, formData, {
            headers: { "Content-Type": "multipart/form-data" }
        });
        showToast("Documents uploaded successfully!", "success");
        loadDocuments();
    } catch (err) {
        showToast(err.response?.data?.message || "Upload failed. Please upload PDF, DOCX, or PPTX.", "error");
    }
}

// Drag & Drop
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("sidebar-doc-upload");

if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
        uploadFileList(fileInput.files);
        fileInput.value = "";
    });

    ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            dropzone.classList.add("border-indigo-500", "bg-indigo-500/10");
        });
    });

    ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            dropzone.classList.remove("border-indigo-500", "bg-indigo-500/10");
        });
    });

    dropzone.addEventListener("drop", (e) => {
        uploadFileList(e.dataTransfer.files);
    });
}

// ---------------- Chat Rendering (Modern Dark Tech Theme) ----------------
function renderMessages() {
    if (!chatBox) return;

    if (messages.length === 0) {
        chatBox.innerHTML = `
            <div class="max-w-2xl mx-auto my-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl text-center backdrop-blur-md">
                <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg shadow-indigo-500/30">
                    <i class="fa-solid fa-graduation-cap"></i>
                </div>
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 mb-3">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Strict Grounded Intelligence</span>
                </div>
                <h3 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Ask Anything From Your Notes</h3>
                <p class="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-2 mb-6 leading-relaxed">
                    Ask questions, clarify difficult concepts, or generate revision summaries. Every response is verified and cited directly against your uploaded files.
                </p>

                <!-- 4 Quick Starter Prompt Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                    <div onclick="quickPrompt('Summarize the primary concepts across these notes in bullet points')" class="group p-3.5 rounded-xl border border-slate-800 hover:border-indigo-500/50 bg-[#0b0f19]/70 hover:bg-slate-800/80 cursor-pointer transition-all">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <i class="fa-solid fa-sparkles"></i>
                            </span>
                            <h4 class="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">Summarize Main Concepts</h4>
                        </div>
                        <p class="text-[11px] text-slate-400 line-clamp-2">Get high-yield bullet points summarizing the core themes and principles.</p>
                    </div>

                    <div onclick="quickPrompt('What are the key terms, definitions, and formulas discussed?')" class="group p-3.5 rounded-xl border border-slate-800 hover:border-indigo-500/50 bg-[#0b0f19]/70 hover:bg-slate-800/80 cursor-pointer transition-all">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <i class="fa-solid fa-book-bookmark"></i>
                            </span>
                            <h4 class="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">Key Definitions & Formulas</h4>
                        </div>
                        <p class="text-[11px] text-slate-400 line-clamp-2">Extract critical definitions, mathematical rules, and nomenclature.</p>
                    </div>

                    <div onclick="quickPrompt('Explain the core mechanisms step-by-step with practical examples')" class="group p-3.5 rounded-xl border border-slate-800 hover:border-indigo-500/50 bg-[#0b0f19]/70 hover:bg-slate-800/80 cursor-pointer transition-all">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <i class="fa-solid fa-gears"></i>
                            </span>
                            <h4 class="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">Explain Mechanisms</h4>
                        </div>
                        <p class="text-[11px] text-slate-400 line-clamp-2">Break down complex processes into simple, intuitive sequential steps.</p>
                    </div>

                    <div onclick="quickPrompt('Generate 3 exam-style conceptual practice questions with hints')" class="group p-3.5 rounded-xl border border-slate-800 hover:border-indigo-500/50 bg-[#0b0f19]/70 hover:bg-slate-800/80 cursor-pointer transition-all">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <i class="fa-solid fa-circle-question"></i>
                            </span>
                            <h4 class="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">Self-Test Drill</h4>
                        </div>
                        <p class="text-[11px] text-slate-400 line-clamp-2">Challenge your understanding with grounded exam-style test questions.</p>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    chatBox.innerHTML = messages.map((msg, idx) => {
        // User Message
        if (msg.role === 'user') {
            const timeStr = msg.timestamp ? formatTime(msg.timestamp) : '';
            return `
                <div class="flex justify-end gap-3 items-end mb-4 group">
                    <div class="max-w-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl rounded-tr-xs px-4 sm:px-5 py-3 text-sm shadow-lg shadow-indigo-500/15 border border-indigo-500/30">
                        <p class="leading-relaxed whitespace-pre-wrap">${escapeHtml(msg.text)}</p>
                        ${timeStr ? `<div class="text-[10px] text-indigo-200 text-right mt-1 font-mono">${timeStr}</div>` : ''}
                    </div>
                    <div class="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm" title="You">
                        <i class="fa-solid fa-user text-xs"></i>
                    </div>
                </div>
            `;
        }

        // Assistant Thinking / Streaming State
        if (msg.thinking) {
            return `
                <div class="flex items-start gap-3 mb-4">
                    <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-md shadow-indigo-500/20 animate-pulse">
                        <i class="fa-solid fa-brain"></i>
                    </div>
                    <div class="flex-1 bg-slate-900/90 border border-slate-800 rounded-2xl rounded-tl-xs p-5 shadow-xl max-w-2xl backdrop-blur-md">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-xs font-bold text-white">AskMyNotes AI</span>
                            <span class="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 font-mono">
                                Synthesizing...
                            </span>
                        </div>
                        <div class="flex items-center gap-2 py-2">
                            <span class="w-2 h-2 rounded-full bg-indigo-400 chat-dot-1"></span>
                            <span class="w-2 h-2 rounded-full bg-indigo-400 chat-dot-2"></span>
                            <span class="w-2 h-2 rounded-full bg-indigo-400 chat-dot-3"></span>
                            <span class="text-xs text-slate-400 ml-2 font-medium" id="thinking-status-text">
                                Cross-referencing source notes & formulating answer...
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Standard Assistant Message in Dark Tech Theme
        const confidence = msg.confidence || 'Medium';
        let confBadge = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
        if (confidence === 'High') confBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (confidence === 'Low') confBadge = 'bg-rose-500/10 text-rose-400 border-rose-500/20';

        const isSpeaking = speakingMessageIdx === idx;

        const citationsHtml = (msg.citations && msg.citations.length > 0) ? `
            <div class="mt-4 pt-3 border-t border-slate-800">
                <div class="flex items-center gap-1.5 mb-2">
                    <i class="fa-solid fa-bookmark text-indigo-400 text-xs"></i>
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Citations & Provenance</span>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                    ${msg.citations.map(c => `
                        <span class="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[#0b0f19] hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-colors">
                            <i class="fa-regular fa-file-lines text-[10px] text-indigo-400"></i>
                            <span class="truncate max-w-[200px]">${c.filename}</span>
                            ${c.chunkIndex ? `<span class="bg-indigo-500/20 text-indigo-300 text-[10px] px-1 rounded font-mono">#${c.chunkIndex}</span>` : ''}
                        </span>
                    `).join('')}
                </div>
            </div>
        ` : '';

        const evidenceHtml = (msg.evidence && msg.evidence.length > 0) ? `
            <div class="mt-3">
                <button onclick="toggleEvidence(${idx})" class="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1.5 transition-colors">
                    <i class="fa-solid fa-chevron-down text-[10px] transition-transform duration-200" id="ev-icon-${idx}"></i>
                    <span>View Grounded Excerpts (${msg.evidence.length} source chunks)</span>
                </button>
                <div id="ev-box-${idx}" class="hidden mt-2.5 space-y-2">
                    ${msg.evidence.map((ev, i) => `
                        <div class="bg-[#0b0f19]/90 border-l-2 border-indigo-500 p-3 rounded-r-xl text-xs text-slate-300 leading-relaxed shadow-sm">
                            <div class="flex items-center justify-between font-bold text-[10px] uppercase text-indigo-400 mb-1 font-mono">
                                <span>${ev.source || 'Document'}</span>
                                <span class="text-slate-500">Chunk #${ev.chunk || (i+1)}</span>
                            </div>
                            <blockquote class="italic text-slate-400">"${escapeHtml(ev.text || '')}"</blockquote>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';

        return `
            <div class="flex items-start gap-3 mb-5">
                <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-md shadow-indigo-500/20">
                    <i class="fa-solid fa-brain"></i>
                </div>
                <div class="flex-1 bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl rounded-tl-xs p-5 sm:p-6 shadow-xl max-w-3xl backdrop-blur-md transition-all">
                    <!-- Message Header Bar -->
                    <div class="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-white">AskMyNotes AI</span>
                            <span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${confBadge} font-mono">
                                <span>Confidence: ${confidence}</span>
                            </span>
                        </div>

                        <!-- Action Toolbar -->
                        <div class="flex items-center gap-1">
                            <button onclick="toggleAudio(${idx})" id="audio-btn-${idx}" class="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg text-xs transition-colors" title="${isSpeaking ? 'Stop Reading' : 'Read Aloud'}">
                                <i class="fa-solid ${isSpeaking ? 'fa-circle-stop text-rose-400' : 'fa-volume-high'}"></i>
                            </button>
                            <button onclick="copyToClipboard('${escapeJs(msg.answer)}')" class="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg text-xs transition-colors" title="Copy Answer">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                            <button onclick="voteFeedback(${idx}, 'up')" class="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg text-xs transition-colors" title="Helpful Answer">
                                <i class="fa-regular fa-thumbs-up"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Answer Markdown Content -->
                    <div class="prose-dark text-sm leading-relaxed">
                        ${renderMarkdown(msg.answer)}
                    </div>

                    ${citationsHtml}
                    ${evidenceHtml}
                </div>
            </div>
        `;
    }).join('');

    if (chatBox) {
        setTimeout(() => {
            chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        }, 30);
    }
}

function formatTime(isoString) {
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeJs(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function renderMarkdown(text) {
    if (!text) return '';

    let cleaned = String(text);

    // 0. Remove trailing conversational filler & meta-talk
    cleaned = cleaned.replace(/(?:---\s*)?(?:Would you like to|Let me know if you would like|Feel free to ask if you want|Do you want me to|I hope this helps)[\s\S]*$/i, '').trim();

    // 1. Normalize squashed separators and headings
    cleaned = cleaned.replace(/---\s*(#{1,6}\s+)/g, '\n\n---\n\n$1');
    cleaned = cleaned.replace(/([^\n])\s*(#{1,6}\s+)/g, '$1\n\n$2');

    // 2. Ensure newlines before numbered list items or bullets if squashed inline
    cleaned = cleaned.replace(/([.!?])\s+([0-9]+\.\s+[A-Z])/g, '$1\n\n$2');
    cleaned = cleaned.replace(/([.!?])\s+([*•-]\s+[A-Z])/g, '$1\n\n$2');

    // 3. Clean raw redundant hashtags
    cleaned = cleaned.replace(/#{4,}/g, '###');

    // 4. Clean messy raw LaTeX math artifacts
    // Replace \text{...} with clean text
    cleaned = cleaned.replace(/\\text\{([^{}]+)\}/g, '$1');
    // Replace \frac{a}{b} with a / b
    cleaned = cleaned.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1 / $2');
    // Replace \times with ×, \ge with ≥, \le with ≤
    cleaned = cleaned.replace(/\\times/g, '×').replace(/\\ge\b/g, '≥').replace(/\\le\b/g, '≤');

    // 5. Handle LaTeX equations cleanly ($$math$$ and $math$)
    cleaned = cleaned.replace(/\$\$([\s\S]+?)\$\$/g, '<div class="my-2.5 p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl font-mono text-xs text-indigo-300 overflow-x-auto text-center shadow-inner">$1</div>');
    cleaned = cleaned.replace(/\$([^\$\n]+?)\$/g, '<code class="font-mono text-xs text-indigo-300 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">$1</code>');

    let html = '';
    if (typeof marked !== 'undefined') {
        try {
            marked.setOptions({
                breaks: true,
                gfm: true
            });
            html = marked.parse(cleaned);
        } catch (e) {
            html = escapeHtml(cleaned).replace(/\n/g, '<br>');
        }
    } else {
        html = escapeHtml(cleaned).replace(/\n/g, '<br>');
    }

    // 6. Enhance Diagram callouts into modern dark cards ONLY if they contain real diagrams (filter out disclaimers)
    const isDisclaimer = (txt) => /no visual images|no diagrams? (?:were|are)? (?:embedded|present|found)|not embedded|not shown|while specific diagrams/i.test(txt);

    html = html.replace(/<p><strong>📊 Diagram Reference:<\/strong>([\s\S]*?)<\/p>/gi, function(match, content) {
        if (isDisclaimer(content)) return '';
        return `<div class="diagram-callout"><div class="diagram-callout-header"><i class="fa-solid fa-project-diagram text-indigo-400"></i> Grounded Diagram Citation</div><div class="text-xs text-indigo-200 font-semibold">${content}</div></div>`;
    });
    html = html.replace(/<p><strong>📊 Diagram Analysis &amp; Explanation:<\/strong>([\s\S]*?)<\/p>/gi, function(match, content) {
        if (isDisclaimer(content)) return '';
        return `<div class="diagram-callout"><div class="diagram-callout-header"><i class="fa-solid fa-chart-pie text-violet-400"></i> Diagram Visual Structure &amp; Breakdown</div><div class="text-xs text-slate-300 leading-relaxed">${content}</div></div>`;
    });

    return html;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Answer copied to clipboard!", "success");
    });
}

function toggleEvidence(idx) {
    const box = document.getElementById(`ev-box-${idx}`);
    const icon = document.getElementById(`ev-icon-${idx}`);
    if (box) {
        box.classList.toggle('hidden');
        if (icon) icon.classList.toggle('rotate-180');
    }
}

function toggleAudio(idx) {
    if (speakingMessageIdx === idx) {
        stopSpeaking();
        speakingMessageIdx = null;
        renderMessages();
    } else {
        const msg = messages[idx];
        if (msg && msg.answer) {
            speakingMessageIdx = idx;
            speakAnswer(msg.answer);
            renderMessages();
        }
    }
}

function voteFeedback(idx, type) {
    showToast("Feedback recorded — thank you!", "success");
}

function quickPrompt(text) {
    if (chatInput) {
        chatInput.value = text;
        chatForm.dispatchEvent(new Event('submit'));
    }
}

function clearChat() {
    if (!confirm("Clear this conversation history?")) return;
    messages = [];
    localStorage.removeItem("AskMyNotes_chat_" + subjectId);
    stopSpeaking();
    renderMessages();
    showToast("Chat cleared", "info");
}

// Auto-resizing textarea & Enter key support
if (chatInput) {
    chatInput.addEventListener("input", () => {
        chatInput.style.height = "auto";
        chatInput.style.height = Math.min(chatInput.scrollHeight, 128) + "px";
    });

    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (chatInput.value.trim() && !isProcessing) {
                chatForm.dispatchEvent(new Event("submit"));
            }
        }
    });
}

if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (isProcessing) return;

        const userMsg = chatInput.value.trim();
        if (!userMsg) return;

        isProcessing = true;
        messages.push({ 
            role: "user", 
            text: userMsg, 
            timestamp: new Date().toISOString() 
        });
        chatInput.value = "";
        chatInput.style.height = "auto";
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i>`;
        }

        messages.push({
            role: "assistant",
            thinking: true,
            answer: "",
            confidence: null,
            citations: [],
            evidence: []
        });
        renderMessages();

        try {
            const res = await axios.post("/api/chat/message", {
                chatId: subjectId,
                conversation: messages.slice(0, -1).map(m => ({ role: m.role, text: m.text || m.answer }))
            });

            const data = res.data;
            messages[messages.length - 1] = {
                role: "assistant",
                thinking: false,
                answer: data.answer || data.message || "No answer generated.",
                confidence: data.confidence || "Medium",
                citations: data.citations || [],
                evidence: data.evidence || [],
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            messages[messages.length - 1] = {
                role: "assistant",
                thinking: false,
                answer: "I encountered an error retrieving or reasoning over your notes. Please make sure notes are uploaded and try again.",
                confidence: "Low",
                citations: [],
                evidence: [],
                timestamp: new Date().toISOString()
            };
        } finally {
            localStorage.setItem("AskMyNotes_chat_" + subjectId, JSON.stringify(messages.filter(m => !m.thinking)));
            renderMessages();
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = `<i class="fa-solid fa-paper-plane text-sm"></i>`;
            }
            isProcessing = false;
        }
    });
}

// ---------------- TAB 2: Executive Summarizer (Modern Dark Tech Theme) ----------------
async function requestSummary(type = 'medium') {
    const box = document.getElementById("summary-result-box");
    if (!box) return;

    ['short', 'medium', 'detailed'].forEach(t => {
        const b = document.getElementById(`btn-sum-${t}`);
        if (b) {
            if (t === type) {
                b.className = 'summary-type-btn active px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-sm';
            } else {
                b.className = 'summary-type-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white';
            }
        }
    });

    box.innerHTML = `
        <div class="text-center py-16 text-slate-400">
            <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl mx-auto mb-4 animate-bounce border border-indigo-500/20">
                <i class="fa-solid fa-book-open"></i>
            </div>
            <h4 class="text-base font-bold text-white">Generating ${type.toUpperCase()} Summary...</h4>
            <p class="text-xs text-slate-400 mt-1">Grounding key facts and formulating structured revision points.</p>
        </div>
    `;

    try {
        const res = await axios.post(`/api/study/summary/${subjectId}`, { type });
        const data = res.data;

        const sourcesPills = (data.sources && data.sources.length > 0) ? `
            <div class="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                <span class="font-bold text-[10px] uppercase text-indigo-400 font-mono">Sources:</span>
                ${data.sources.map(s => `<span class="px-2 py-0.5 bg-[#0b0f19] border border-slate-700/80 rounded font-medium text-slate-200">${s}</span>`).join('')}
            </div>
        ` : '';

        box.innerHTML = `
            <div>
                <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                    <span class="text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono">${type} Study Breakdown</span>
                    <button onclick="copyToClipboard(document.getElementById('summary-text-content').innerText)" class="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-medium transition-colors">
                        <i class="fa-regular fa-copy"></i>
                        <span>Copy</span>
                    </button>
                </div>
                ${sourcesPills}
                <div id="summary-text-content" class="prose-dark text-sm text-slate-200 leading-relaxed bg-[#0b0f19]/80 p-6 rounded-2xl border border-slate-800">
                    ${renderMarkdown(data.summary)}
                </div>
            </div>
        `;
        showToast("Summary synthesized successfully", "success");
    } catch (err) {
        box.innerHTML = `
            <div class="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-center text-red-300 text-xs">
                ${err.response?.data?.message || "Failed to generate summary. Please ensure notes are uploaded."}
            </div>
        `;
    }
}

// ---------------- TAB 3: Interactive 3D Flashcards (Modern Dark Tech Theme) ----------------
let flashcardsDeck = [];
let currentCardIndex = 0;
let isFlipped = false;

async function generateFlashcardsDeck() {
    const stage = document.getElementById("flashcard-stage");
    const btn = document.getElementById("btn-gen-flashcards");
    if (!stage) return;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i><span>Generating...</span>`;
    }

    stage.innerHTML = `
        <div class="text-center py-16 text-slate-400">
            <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl mx-auto mb-4 animate-spin border border-indigo-500/20">
                <i class="fa-solid fa-arrows-rotate"></i>
            </div>
            <h4 class="text-base font-bold text-white">Generating Study Flashcards...</h4>
            <p class="text-xs text-slate-400 mt-1">Extracting high-yield concepts & concise answers.</p>
        </div>
    `;

    try {
        const res = await axios.post(`/api/study/flashcards/${subjectId}`, { count: 8 });
        flashcardsDeck = res.data.flashcards || [];
        currentCardIndex = 0;
        isFlipped = false;

        if (flashcardsDeck.length === 0) {
            stage.innerHTML = `<div class="text-xs text-red-400">No flashcards could be generated from the notes.</div>`;
            return;
        }

        renderCurrentFlashcard();
        showToast(`Generated ${flashcardsDeck.length} flashcards!`, "success");
    } catch (err) {
        stage.innerHTML = `
            <div class="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-center text-red-300 text-xs">
                ${err.response?.data?.message || "Failed to generate flashcards. Please upload notes first."}
            </div>
        `;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-arrows-rotate text-xs"></i><span>Generate Card Deck</span>`;
        }
    }
}

function renderCurrentFlashcard() {
    const stage = document.getElementById("flashcard-stage");
    if (!stage || flashcardsDeck.length === 0) return;

    const card = flashcardsDeck[currentCardIndex];
    isFlipped = false;

    stage.innerHTML = `
        <div class="w-full max-w-xl flex flex-col items-center">
            
            <div class="w-full flex items-center justify-between text-xs text-slate-400 mb-3 px-2">
                <span class="font-bold text-white font-mono">Card ${currentCardIndex + 1} of ${flashcardsDeck.length}</span>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    ${card.category || 'High-Yield Concept'}
                </span>
            </div>

            <!-- 3D Perspective Card in Dark Tech Theme -->
            <div class="perspective-1000 w-full cursor-pointer" onclick="flipFlashcard()">
                <div id="flashcard-inner" class="transform-style-3d relative w-full min-h-[260px] rounded-2xl transition-transform duration-500 shadow-2xl border border-slate-800 bg-[#0b0f19]">
                    
                    <!-- Front -->
                    <div class="backface-hidden absolute inset-0 rounded-2xl p-8 flex flex-col justify-between bg-gradient-to-br from-[#0f172a] via-[#0b0f19] to-[#080c14] border border-slate-800">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 font-mono">
                                <i class="fa-regular fa-circle-question"></i>
                                <span>Question / Concept</span>
                            </span>
                            <span class="text-[11px] text-slate-500 font-mono">Click to flip &bull; Space</span>
                        </div>
                        <div class="text-center my-auto py-4">
                            <h3 class="text-lg sm:text-xl font-bold text-white leading-snug">
                                ${escapeHtml(card.front)}
                            </h3>
                        </div>
                        <div class="text-center text-xs text-slate-400 font-medium">
                            <span>Source: ${card.citation || 'Subject Notes'}</span>
                        </div>
                    </div>

                    <!-- Back -->
                    <div class="backface-hidden rotate-y-180 absolute inset-0 rounded-2xl p-8 flex flex-col justify-between bg-gradient-to-br from-indigo-950/40 via-[#0b0f19] to-[#080c14] border border-indigo-500/40">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 font-mono">
                                <i class="fa-solid fa-circle-check"></i>
                                <span>Explanation</span>
                            </span>
                            <span class="text-[11px] text-slate-500 font-mono">Click to flip back</span>
                        </div>
                        <div class="my-auto py-4">
                            <p class="text-sm sm:text-base font-medium text-slate-200 leading-relaxed text-center">
                                ${escapeHtml(card.back)}
                            </p>
                        </div>
                        <div class="text-center text-xs text-indigo-300 font-semibold font-mono">
                            <span>Citation: ${card.citation || 'Document'}</span>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Flashcard Control Bar -->
            <div class="flex items-center gap-3 mt-6">
                <button onclick="prevFlashcard()" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center transition-colors" ${currentCardIndex === 0 ? 'disabled opacity-40' : ''} title="Previous Card">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <button onclick="flipFlashcard()" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-500/20 inline-flex items-center gap-2">
                    <i class="fa-solid fa-arrows-rotate text-xs"></i>
                    <span>Flip Card (Space)</span>
                </button>
                <button onclick="nextFlashcard()" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center transition-colors" ${currentCardIndex === flashcardsDeck.length - 1 ? 'disabled opacity-40' : ''} title="Next Card">
                    <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>

        </div>
    `;
}

function flipFlashcard() {
    const inner = document.getElementById("flashcard-inner");
    if (!inner) return;
    isFlipped = !isFlipped;
    if (isFlipped) {
        inner.classList.add("rotate-y-180");
    } else {
        inner.classList.remove("rotate-y-180");
    }
}

function nextFlashcard() {
    if (currentCardIndex < flashcardsDeck.length - 1) {
        currentCardIndex++;
        renderCurrentFlashcard();
    }
}

function prevFlashcard() {
    if (currentCardIndex > 0) {
        currentCardIndex--;
        renderCurrentFlashcard();
    }
}

window.addEventListener("keydown", (e) => {
    const flashcardStage = document.getElementById("tab-content-flashcards");
    if (flashcardStage && !flashcardStage.classList.contains("hidden")) {
        if (e.code === "Space") {
            e.preventDefault();
            flipFlashcard();
        } else if (e.code === "ArrowRight") {
            nextFlashcard();
        } else if (e.code === "ArrowLeft") {
            prevFlashcard();
        }
    }
});

// ---------------- TAB 4: Interactive Quiz Arena (Modern Dark Tech Theme) ----------------
let currentQuiz = [];
let quizIndex = 0;
let userScore = 0;
let answeredQuestions = new Set();

async function startInteractiveQuiz() {
    const arena = document.getElementById("quiz-arena");
    const btn = document.getElementById("btn-start-quiz");
    if (!arena) return;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i><span>Generating Quiz...</span>`;
    }

    arena.innerHTML = `
        <div class="text-center py-16 text-slate-400">
            <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl mx-auto mb-4 animate-bounce border border-indigo-500/20">
                <i class="fa-solid fa-bullseye"></i>
            </div>
            <h4 class="text-base font-bold text-white">Generating 5 Practice Questions...</h4>
            <p class="text-xs text-slate-400 mt-1">Grounding questions and options directly in your notes.</p>
        </div>
    `;

    try {
        const res = await axios.post(`/api/questions/mcq/${subjectId}`);
        currentQuiz = res.data.questions || [];
        quizIndex = 0;
        userScore = 0;
        answeredQuestions = new Set();

        if (currentQuiz.length === 0) {
            arena.innerHTML = `<div class="text-xs text-red-400 text-center py-10">No questions generated. Please verify notes are uploaded.</div>`;
            return;
        }

        renderQuizQuestion();
        showToast("Practice Assessment Ready!", "success");
    } catch (err) {
        arena.innerHTML = `
            <div class="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-center text-red-300 text-xs">
                ${err.response?.data?.message || "Failed to generate quiz. Please ensure notes are uploaded."}
            </div>
        `;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-play text-xs"></i><span>Generate New Quiz (5 MCQs)</span>`;
        }
    }
}

function renderQuizQuestion() {
    const arena = document.getElementById("quiz-arena");
    if (!arena || currentQuiz.length === 0) return;

    if (quizIndex >= currentQuiz.length) {
        renderQuizCompleted();
        return;
    }

    const q = currentQuiz[quizIndex];
    const progressPercent = ((quizIndex + 1) / currentQuiz.length) * 100;

    arena.innerHTML = `
        <div class="max-w-2xl mx-auto">
            
            <div class="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span class="font-bold text-white font-mono">Question ${quizIndex + 1} of ${currentQuiz.length}</span>
                <span class="font-semibold text-indigo-400 font-mono">Score: ${userScore}/${quizIndex}</span>
            </div>
            <div class="w-full bg-slate-800 rounded-full h-2 mb-6 overflow-hidden">
                <div class="bg-gradient-to-r from-indigo-500 to-violet-600 h-2 rounded-full transition-all duration-300" style="width: ${progressPercent}%"></div>
            </div>

            <!-- Question Card in Dark Tech Theme -->
            <div class="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 mb-5 shadow-xl">
                <div class="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span class="font-bold uppercase tracking-wider text-indigo-400 text-[10px] font-mono">MCQ Drill</span>
                    <span class="font-mono text-[11px]">Citation: ${q.citation || 'Notes'}</span>
                </div>
                <h3 class="text-base sm:text-lg font-bold text-white leading-snug">
                    ${escapeHtml(q.question)}
                </h3>
            </div>

            <!-- Options Grid -->
            <div class="space-y-3" id="quiz-options-container">
                ${['A', 'B', 'C', 'D'].map((letter, i) => {
                    const optText = q.options ? q.options[i] : '';
                    return `
                        <button onclick="handleOptionSelect('${letter}', ${i})" id="opt-btn-${letter}" class="quiz-option-btn w-full p-4 rounded-xl border border-slate-800 hover:border-indigo-500/60 bg-[#0b0f19] hover:bg-slate-800/60 text-left flex items-start gap-3 transition-all">
                            <span class="w-6 h-6 rounded-md bg-slate-800 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0 font-mono">
                                ${letter}
                            </span>
                            <span class="text-sm font-medium text-slate-200 self-center">
                                ${escapeHtml(optText)}
                            </span>
                        </button>
                    `;
                }).join('')}
            </div>

            <div id="quiz-feedback-box" class="mt-6 hidden"></div>

        </div>
    `;
}

function handleOptionSelect(chosenLetter, optionIndex) {
    if (answeredQuestions.has(quizIndex)) return;
    answeredQuestions.add(quizIndex);

    const q = currentQuiz[quizIndex];
    const correctLetter = String(q.correct || '').toUpperCase().trim();
    const isCorrect = chosenLetter === correctLetter;

    if (isCorrect) {
        userScore++;
    }

    ['A', 'B', 'C', 'D'].forEach(letter => {
        const btn = document.getElementById(`opt-btn-${letter}`);
        if (btn) {
            btn.disabled = true;
            if (letter === correctLetter) {
                btn.className = 'w-full p-4 rounded-xl border-2 border-emerald-500 bg-emerald-500/10 text-left flex items-start gap-3 transition-all';
                btn.querySelector('span:first-child').className = 'w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0';
            } else if (letter === chosenLetter && !isCorrect) {
                btn.className = 'w-full p-4 rounded-xl border-2 border-red-500 bg-red-500/10 text-left flex items-start gap-3 transition-all';
                btn.querySelector('span:first-child').className = 'w-6 h-6 rounded-md bg-red-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0';
            } else {
                btn.className = 'w-full p-4 rounded-xl border border-slate-800 bg-[#0b0f19] opacity-40 text-left flex items-start gap-3';
            }
        }
    });

    const feedbackBox = document.getElementById("quiz-feedback-box");
    if (feedbackBox) {
        feedbackBox.classList.remove('hidden');
        feedbackBox.innerHTML = `
            <div class="p-4 rounded-xl ${isCorrect ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200' : 'bg-red-500/10 border border-red-500/30 text-red-200'} mb-4">
                <div class="flex items-center gap-2 font-bold text-sm mb-1">
                    <i class="fa-solid ${isCorrect ? 'fa-circle-check text-emerald-400' : 'fa-circle-xmark text-red-400'}"></i>
                    <span>${isCorrect ? 'Correct!' : `Incorrect. Correct answer is option ${correctLetter}.`}</span>
                </div>
                <p class="text-xs text-slate-300 leading-relaxed">${escapeHtml(q.explanation || '')}</p>
            </div>
            <div class="flex justify-end">
                <button onclick="quizNext()" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 transition-all inline-flex items-center gap-2">
                    <span>${quizIndex === currentQuiz.length - 1 ? 'View Final Results' : 'Next Question'}</span>
                    <i class="fa-solid fa-arrow-right text-xs"></i>
                </button>
            </div>
        `;
    }
}

function quizNext() {
    quizIndex++;
    renderQuizQuestion();
}

function renderQuizCompleted() {
    const arena = document.getElementById("quiz-arena");
    if (!arena) return;

    const percentage = Math.round((userScore / currentQuiz.length) * 100);

    if (typeof confetti === 'function' && percentage >= 60) {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }

    let badgeText = 'Mastery Achieved';
    let badgeColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (percentage < 60) {
        badgeText = 'Review Recommended';
        badgeColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    }

    arena.innerHTML = `
        <div class="max-w-md mx-auto text-center py-8 bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <div class="w-14 h-14 rounded-2xl ${percentage >= 60 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'} flex items-center justify-center text-2xl mx-auto mb-3">
                <i class="fa-solid ${percentage >= 60 ? 'fa-trophy' : 'fa-graduation-cap'}"></i>
            </div>
            <span class="inline-block px-3 py-1 rounded-full text-xs font-semibold ${badgeColor} mb-2 font-mono">
                ${badgeText}
            </span>
            <h3 class="text-xl font-bold text-white">Quiz Completed!</h3>
            <div class="my-5">
                <div class="text-5xl font-extrabold text-white font-mono">${percentage}%</div>
                <div class="text-xs text-slate-400 mt-1">You answered ${userScore} out of ${currentQuiz.length} questions correctly.</div>
            </div>
            <div class="flex justify-center gap-3">
                <button onclick="startInteractiveQuiz()" class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 transition-all">
                    Try Another Quiz
                </button>
                <button onclick="switchTab('flashcards')" class="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition-colors">
                    Review Flashcards
                </button>
            </div>
        </div>
    `;
}

// ---------------- TAB 5: Short Answer Drills (Modern Dark Tech Theme) ----------------
async function generateShortAnswerDrill() {
    const container = document.getElementById("short-answer-container");
    const btn = document.getElementById("btn-gen-short");
    if (!container) return;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i><span>Generating...</span>`;
    }

    container.innerHTML = `
        <div class="text-center py-16 text-slate-400">
            <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl mx-auto mb-4 animate-spin border border-indigo-500/20">
                <i class="fa-solid fa-arrows-rotate"></i>
            </div>
            <h4 class="text-base font-bold text-white">Generating Conceptual Questions...</h4>
            <p class="text-xs text-slate-400 mt-1">Formulating 3 comprehensive short-answer exam questions.</p>
        </div>
    `;

    try {
        const res = await axios.post(`/api/questions/short/${subjectId}`);
        const questions = res.data.questions || [];

        if (questions.length === 0) {
            container.innerHTML = `<div class="text-xs text-red-400 text-center py-8">No short-answer questions generated.</div>`;
            return;
        }

        container.innerHTML = questions.map((q, idx) => `
            <div class="bg-[#0b0f19] border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div class="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span class="font-bold text-indigo-400 text-[10px] uppercase font-mono">Question ${idx + 1}</span>
                    <span class="font-mono text-[11px]">Citation: ${q.citation || 'Subject Notes'}</span>
                </div>
                <h4 class="text-sm font-bold text-white mb-3">${escapeHtml(q.question)}</h4>
                
                <details class="group bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                    <summary class="cursor-pointer text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center justify-between transition-colors">
                        <span>Reveal Verified Model Answer</span>
                        <i class="fa-solid fa-chevron-down text-[10px] group-open:rotate-180 transition-transform"></i>
                    </summary>
                    <div class="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 leading-relaxed">
                        ${escapeHtml(q.answer)}
                    </div>
                </details>
            </div>
        `).join('');

        showToast("Short answers generated", "success");
    } catch (err) {
        container.innerHTML = `
            <div class="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-center text-red-300 text-xs">
                ${err.response?.data?.message || "Failed to generate short answers. Please ensure notes are uploaded."}
            </div>
        `;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-arrows-rotate text-xs"></i><span>Generate Short Answers</span>`;
        }
    }
}

// ---------------- TAB 6: Research Paper Studio (Modern Dark Tech Theme) ----------------
async function requestResearch(mode = 'breakdown') {
    const box = document.getElementById("research-result-box");
    if (!box) return;

    const modes = ['breakdown', 'methodology', 'critique', 'citations'];
    modes.forEach(m => {
        const b = document.getElementById(`btn-res-${m}`);
        if (b) {
            if (m === mode) {
                b.className = 'research-mode-btn active px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-sm flex items-center gap-1.5';
            } else {
                b.className = 'research-mode-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1.5';
            }
        }
    });

    const modeLabels = {
        breakdown: 'Comprehensive Paper Breakdown',
        methodology: 'Methodology & Architecture Deep-Dive',
        critique: 'Critical Peer-Review Critique',
        citations: 'BibTeX, IEEE & APA Citations'
    };

    box.innerHTML = `
        <div class="text-center py-16 text-slate-400">
            <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl mx-auto mb-4 animate-spin border border-indigo-500/20">
                <i class="fa-solid fa-microscope"></i>
            </div>
            <h4 class="text-base font-bold text-white">Analyzing Research Paper (${modeLabels[mode] || mode})...</h4>
            <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Extracting citations, inspecting diagrams, synthesizing methodology, and evaluating rigor.</p>
        </div>
    `;

    try {
        const res = await axios.post(`/api/study/research/${subjectId}`, { mode });
        const data = res.data;

        const filenamePill = data.filename ? `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b0f19] border border-slate-800 text-xs text-slate-300">
                <i class="fa-solid fa-file-pdf text-red-400 text-xs"></i>
                <span class="font-mono text-[11px] truncate max-w-[260px]">${data.filename}</span>
            </span>
        ` : '';

        const copyBtn = `
            <button onclick="copyToClipboard(document.getElementById('research-markdown-content').innerText)" class="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors font-medium">
                <i class="fa-regular fa-copy"></i>
                <span>Copy Analysis</span>
            </button>
        `;

        box.innerHTML = `
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-800 gap-2">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono">${modeLabels[mode] || mode}</span>
                        ${filenamePill}
                    </div>
                    <div>${copyBtn}</div>
                </div>
                
                <div id="research-markdown-content" class="prose-dark text-sm text-slate-200 leading-relaxed bg-[#0b0f19]/80 p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl">
                    ${renderMarkdown(data.result || data.message || 'No analysis available.')}
                </div>
            </div>
        `;
        showToast("Research analysis completed successfully", "success");
    } catch (err) {
        box.innerHTML = `
            <div class="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-center text-red-300 text-xs">
                ${err.response?.data?.message || "Failed to analyze research paper. Please upload a research paper above."}
            </div>
        `;
    }
}

// ---------------- Dedicated Research Paper Upload & Info ----------------
async function handleResearchPaperUpload(file) {
    if (!file) return;

    const btn = document.getElementById("btn-upload-research-paper");
    const btnText = document.getElementById("btn-upload-research-text");
    const nameEl = document.getElementById("research-paper-name");

    const formData = new FormData();
    formData.append("researchPaper", file);

    try {
        if (btn) btn.disabled = true;
        if (btnText) btnText.innerText = "Processing Paper...";
        showToast("Uploading dedicated research paper...", "info");

        const res = await axios.post(`/api/study/research/upload/${subjectId}`, formData, {
            headers: { "Content-Type": "multipart/form-data" }
        });

        showToast("Research paper uploaded successfully!", "success");
        if (nameEl) {
            nameEl.innerText = file.name;
            nameEl.className = "font-mono text-xs text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 truncate max-w-[260px] sm:max-w-md";
        }
        if (btnText) btnText.innerText = "Replace Dedicated Paper";

        // Trigger paper breakdown automatically after upload
        requestResearch('breakdown');
    } catch (err) {
        showToast(err.response?.data?.message || "Failed to upload research paper.", "error");
    } finally {
        if (btn) btn.disabled = false;
        const input = document.getElementById("research-paper-file-input");
        if (input) input.value = "";
    }
}

async function loadResearchPaperInfo() {
    const nameEl = document.getElementById("research-paper-name");
    const btnText = document.getElementById("btn-upload-research-text");
    if (!nameEl) return;

    try {
        const res = await axios.get(`/api/study/research/paper/${subjectId}`);
        const paper = res.data.paper;
        if (paper && paper.name) {
            nameEl.innerText = paper.name;
            nameEl.className = "font-mono text-xs text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 truncate max-w-[260px] sm:max-w-md";
            if (btnText) btnText.innerText = "Replace Dedicated Paper";
        } else {
            nameEl.innerText = "No separate paper uploaded";
            nameEl.className = "font-mono text-xs text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/60 truncate max-w-[260px] sm:max-w-md";
            if (btnText) btnText.innerText = "Upload Dedicated Paper";
        }
    } catch (e) {
        console.warn("Could not fetch research paper info:", e);
    }
}

// ---------------- Initialize Studio ----------------
document.addEventListener("DOMContentLoaded", () => {
    loadDocuments();
    loadResearchPaperInfo();
    renderMessages();
});
