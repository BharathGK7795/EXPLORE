/* ----------------------------------------------------
   DigitalHub - Learn Module logic
   ---------------------------------------------------- */

const learnModule = {
    courses: [],
    currentCourse: null,
    currentProgress: null,
    
    // Quiz state
    quizQuestions: [],
    selectedAnswers: [],
    currentQuestionIndex: 0,

    init(courseId = null) {
        if (courseId) {
            this.loadCourseReader(courseId);
        } else {
            this.exitCourseReader();
            this.loadCourses();
        }
    },

    // 1. Course Catalog loading
    async loadCourses() {
        try {
            const listGrid = document.getElementById("courses-list-grid");
            listGrid.innerHTML = `
                <div class="py-4 text-center text-secondary col-span-2">
                    <i class="fa-solid fa-spinner fa-spin"></i> Loading courses catalog...
                </div>
            `;
            
            this.courses = await api.get("/learn/courses");
            listGrid.innerHTML = "";
            
            if (this.courses.length === 0) {
                listGrid.innerHTML = `<p class="text-secondary">No courses found in database.</p>`;
                return;
            }

            this.courses.forEach(course => {
                const card = document.createElement("div");
                card.className = "glass-card course-card";
                
                card.innerHTML = `
                    <div class="course-card-header">
                        <span class="course-category-badge">${course.category}</span>
                        <span class="user-badge-tag">${course.difficulty}</span>
                    </div>
                    <div class="course-card-body">
                        <h3>${course.title}</h3>
                        <p class="text-secondary">${course.description}</p>
                    </div>
                    <div class="course-card-footer">
                        <div class="reco-tags-row">
                            ${course.tags.map(tag => `<span class="reco-tag-item">#${tag}</span>`).join("")}
                        </div>
                        <button class="btn btn-primary" onclick="app.navigate('#learn/${course.id}')">Start Learning</button>
                    </div>
                `;
                
                listGrid.appendChild(card);
            });
        } catch (err) {
            app.showToast("Failed to load courses: " + err.message, "error");
        }
    },

    // 2. Course Reader & Progress Management
    async loadCourseReader(courseId) {
        try {
            document.getElementById("courses-catalog-view").classList.add("hidden");
            const readerView = document.getElementById("course-reader-view");
            readerView.classList.remove("hidden");
            
            // Clean active screens
            document.getElementById("quiz-card-view").classList.add("hidden");
            document.getElementById("quiz-results-view").classList.add("hidden");

            // Fetch course details
            this.currentCourse = await api.get(`/learn/courses/${courseId}`);
            
            // Set text values
            document.getElementById("reader-category").innerText = this.currentCourse.category;
            document.getElementById("reader-title").innerText = this.currentCourse.title;
            
            const diffTag = document.getElementById("reader-difficulty");
            diffTag.innerText = this.currentCourse.difficulty;
            
            // Set chapters HTML
            const body = document.getElementById("reader-content-body");
            body.innerHTML = "";
            this.currentCourse.content.forEach(chapter => {
                const chapBlock = document.createElement("div");
                chapBlock.className = "course-chapter-block";
                chapBlock.innerHTML = `
                    <h3>${chapter.title}</h3>
                    <p>${chapter.text}</p>
                `;
                body.appendChild(chapBlock);
            });

            // Handle progress fetch if authenticated
            if (api.isAuthenticated()) {
                this.currentProgress = await api.get(`/learn/courses/${courseId}/progress`);
                this.updateReaderFooter();
            } else {
                document.getElementById("reader-footer-actions").innerHTML = `
                    <p class="text-secondary mb-2 small text-right">Log in to complete quiz and earn HubPoints.</p>
                    <button class="btn btn-primary" onclick="app.showAuthModal('login')">Log In to Start Quiz</button>
                `;
            }
        } catch (err) {
            app.showToast(err.message, "error");
            this.exitCourseReader();
        }
    },

    updateReaderFooter() {
        const footer = document.getElementById("reader-footer-actions");
        footer.innerHTML = "";
        
        if (this.currentProgress && this.currentProgress.completed) {
            footer.innerHTML = `
                <div class="text-right">
                    <span class="badge badge-yellow-glow mb-2">Completed ✓ (Score: ${this.currentProgress.quiz_score.toFixed(1)}%)</span>
                    <br>
                    <button class="btn btn-secondary" onclick="learnModule.startQuiz()">Retake Checkpoint</button>
                </div>
            `;
        } else {
            footer.innerHTML = `
                <button class="btn btn-primary" onclick="learnModule.startQuiz()">Take Module Quiz (+50 HP)</button>
            `;
        }
    },

    exitCourseReader() {
        this.currentCourse = null;
        this.currentProgress = null;
        document.getElementById("courses-catalog-view").classList.remove("hidden");
        document.getElementById("course-reader-view").classList.add("hidden");
    },

    // 3. Quiz Module Wizard
    startQuiz() {
        this.quizQuestions = this.currentCourse.quiz_questions;
        this.selectedAnswers = new Array(this.quizQuestions.length).fill(-1);
        this.currentQuestionIndex = 0;
        
        document.getElementById("quiz-card-view").classList.remove("hidden");
        document.getElementById("quiz-results-view").classList.add("hidden");
        
        this.renderQuizQuestion();
        
        // Scroll quiz into view
        document.getElementById("quiz-card-view").scrollIntoView({ behavior: 'smooth' });
    },

    renderQuizQuestion() {
        const qCount = document.getElementById("quiz-question-counter");
        qCount.innerText = `${this.currentQuestionIndex + 1}/${this.quizQuestions.length}`;

        const qContainer = document.getElementById("quiz-questions-container");
        qContainer.innerHTML = "";

        const question = this.quizQuestions[this.currentQuestionIndex];
        const qBlock = document.createElement("div");
        qBlock.className = "quiz-question-wrapper";
        
        const optionLetters = ["A", "B", "C", "D"];
        qBlock.innerHTML = `
            <div class="quiz-question-text">${question.question}</div>
            <div class="quiz-options-list">
                ${question.options.map((option, optIdx) => `
                    <div class="quiz-option-item ${this.selectedAnswers[this.currentQuestionIndex] === optIdx ? 'selected' : ''}" 
                         onclick="learnModule.selectQuizAnswer(${optIdx})">
                        <span class="option-letter">${optionLetters[optIdx]}</span>
                        <span>${option}</span>
                    </div>
                `).join("")}
            </div>
        `;
        qContainer.appendChild(qBlock);

        // Update Wizard actions buttons
        const prevBtn = document.getElementById("quiz-prev-btn");
        const nextBtn = document.getElementById("quiz-next-btn");
        const submitBtn = document.getElementById("quiz-submit-btn");

        prevBtn.disabled = this.currentQuestionIndex === 0;

        if (this.currentQuestionIndex === this.quizQuestions.length - 1) {
            nextBtn.classList.add("hidden");
            submitBtn.classList.remove("hidden");
        } else {
            nextBtn.classList.remove("hidden");
            submitBtn.classList.add("hidden");
        }

        // Hook click listeners
        prevBtn.onclick = () => {
            if (this.currentQuestionIndex > 0) {
                this.currentQuestionIndex--;
                this.renderQuizQuestion();
            }
        };

        nextBtn.onclick = () => {
            if (this.currentQuestionIndex < this.quizQuestions.length - 1) {
                if (this.selectedAnswers[this.currentQuestionIndex] === -1) {
                    app.showToast("Please choose an option before proceeding.", "info");
                    return;
                }
                this.currentQuestionIndex++;
                this.renderQuizQuestion();
            }
        };

        submitBtn.onclick = () => this.submitQuizAnswers();
    },

    selectQuizAnswer(optionIndex) {
        this.selectedAnswers[this.currentQuestionIndex] = optionIndex;
        // Re-render question to display selected state
        this.renderQuizQuestion();
    },

    async submitQuizAnswers() {
        // Double check all are answered
        if (this.selectedAnswers.includes(-1)) {
            app.showToast("Please answer all questions before submitting.", "info");
            return;
        }

        try {
            const results = await api.post(`/learn/courses/${this.currentCourse.id}/submit-quiz`, {
                answers: this.selectedAnswers
            });
            
            this.renderQuizResults(results);
        } catch (err) {
            app.showToast("Failed submitting quiz answers: " + err.message, "error");
        }
    },

    renderQuizResults(results) {
        // Hide questions panel, show results panel
        document.getElementById("quiz-questions-container").innerHTML = "";
        document.getElementById("quiz-prev-btn").classList.add("hidden");
        document.getElementById("quiz-next-btn").classList.add("hidden");
        document.getElementById("quiz-submit-btn").classList.add("hidden");
        document.getElementById("quiz-question-counter").parentElement.classList.add("hidden");

        const resultsView = document.getElementById("quiz-results-view");
        resultsView.classList.remove("hidden");

        const pointsText = results.points_earned > 0 
            ? `<div class="badge badge-purple-glow mt-2"><i class="fa-solid fa-coins"></i> +${results.points_earned} HubPoints Awarded!</div>` 
            : `<div class="text-secondary small">Quiz retaken or failed. No new points awarded.</div>`;

        resultsView.innerHTML = `
            <div class="quiz-results-card">
                <i class="fa-solid ${results.passed ? 'fa-circle-check text-glow-green' : 'fa-triangle-exclamation text-glow-red'}" style="font-size: 40px;"></i>
                <h3>${results.passed ? 'Check-point Passed!' : 'Requires Revision'}</h3>
                <div class="results-score-glow ${results.passed ? '' : 'failed'}">${results.score.toFixed(0)}%</div>
                <p class="text-secondary">${results.passed ? 'Excellent work! You have mastered these module concepts.' : 'Minimum pass score is 70%. We recommend re-reading chapters and trying again.'}</p>
                ${pointsText}
                <div class="mt-4">
                    <button class="btn btn-secondary" onclick="learnModule.closeQuizResults()">Close Checkpoint</button>
                </div>
            </div>
        `;
        
        // Refresh User profile in header (update points / badges)
        app.checkAuth();
    },

    closeQuizResults() {
        document.getElementById("quiz-card-view").classList.add("hidden");
        document.getElementById("quiz-results-view").classList.add("hidden");
        
        // Refresh reader state details
        this.loadCourseReader(this.currentCourse.id);
    },

    // 4. NLP Summary Text generation
    async generateSummary() {
        const text = document.getElementById("nlp-text-input").value;
        const count = document.getElementById("summary-length").value;

        if (!text.trim()) {
            app.showToast("Please enter or paste text to summarize.", "info");
            return;
        }

        try {
            const summaryBox = document.getElementById("summary-output-box");
            summaryBox.classList.remove("hidden");
            
            document.getElementById("summary-result-text").innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating study notes...`;
            document.getElementById("summary-result-keywords").innerHTML = "";

            const results = await api.post("/learn/summarize", {
                text: text,
                sentences_count: parseInt(count)
            });

            if (!results.summary) {
                document.getElementById("summary-result-text").innerText = "Extractive parsing failed. Make sure the document is structured into correct sentences.";
                return;
            }

            document.getElementById("summary-result-text").innerText = results.summary;
            
            // Keywords
            const kwContainer = document.getElementById("summary-result-keywords");
            kwContainer.innerHTML = "";
            results.key_points.forEach(word => {
                const span = document.createElement("span");
                span.className = "entity-badge";
                span.innerText = `#${word}`;
                kwContainer.appendChild(span);
            });
        } catch (err) {
            app.showToast("NLP summary error: " + err.message, "error");
        }
    }
};
document.addEventListener("user-authenticated", () => {
    // If user signs in while looking at reader, reloadreader state to fetch progress
    if (window.location.hash.startsWith("#learn/")) {
        const courseId = window.location.hash.split("/")[1];
        learnModule.loadCourseReader(courseId);
    }
});
