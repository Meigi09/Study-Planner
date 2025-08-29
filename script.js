class StudyPlanner {
  constructor() {
    this.tasks = JSON.parse(localStorage.getItem("studyTasks")) || [];
    this.currentView = "list";
    this.editingTaskId = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.renderTasks();
    this.updateStats();
    this.generateAIPlan();
    this.setupRichTextEditor();
  }

  bindEvents() {
    // Modal events
    document
      .getElementById("addTaskBtn")
      .addEventListener("click", () => this.openModal());
    document
      .getElementById("taskModal")
      .querySelector(".close")
      .addEventListener("click", () => this.closeModal());
    document
      .getElementById("cancelBtn")
      .addEventListener("click", () => this.closeModal());
    document
      .getElementById("taskForm")
      .addEventListener("submit", (e) => this.handleTaskSubmit(e));

    // Search and filter events
    document
      .getElementById("searchInput")
      .addEventListener("input", () => this.renderTasks());
    document
      .getElementById("categoryFilter")
      .addEventListener("change", () => this.renderTasks());
    document
      .getElementById("priorityFilter")
      .addEventListener("change", () => this.renderTasks());
    document
      .getElementById("statusFilter")
      .addEventListener("change", () => this.renderTasks());

    // View toggle events
    document
      .getElementById("listViewBtn")
      .addEventListener("click", () => this.switchView("list"));
    document
      .getElementById("calendarViewBtn")
      .addEventListener("click", () => this.switchView("calendar"));

    // Export/Import events
    document
      .getElementById("exportBtn")
      .addEventListener("click", () => this.exportData());
    document
      .getElementById("importBtn")
      .addEventListener("click", () =>
        document.getElementById("importFile").click()
      );
    document
      .getElementById("importFile")
      .addEventListener("change", (e) => this.importData(e));

    // Close modal on overlay click
    document
      .getElementById("overlay")
      .addEventListener("click", () => this.closeModal());
    document.getElementById("taskModal").addEventListener("click", (e) => {
      if (e.target === document.getElementById("taskModal")) {
        this.closeModal();
      }
    });
  }

  setupRichTextEditor() {
    const toolbar = document.querySelector(".notes-toolbar");
    const editor = document.getElementById("taskNotes");

    toolbar.addEventListener("click", (e) => {
      if (e.target.classList.contains("toolbar-btn")) {
        e.preventDefault();
        const command = e.target.dataset.command;
        document.execCommand(command, false, null);
        e.target.classList.toggle("active");
        editor.focus();
      }
    });

    editor.addEventListener("keyup", () => {
      // Update toolbar button states
      const buttons = toolbar.querySelectorAll(".toolbar-btn");
      buttons.forEach((btn) => {
        const command = btn.dataset.command;
        if (document.queryCommandState(command)) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    });
  }

  openModal(task = null) {
    const modal = document.getElementById("taskModal");
    const overlay = document.getElementById("overlay");
    const form = document.getElementById("taskForm");

    if (task) {
      this.editingTaskId = task.id;
      document.getElementById("modalTitle").textContent = "Edit Task";
      document.getElementById("taskTitle").value = task.title;
      document.getElementById("taskTopic").value = task.topic || "";
      document.getElementById("taskCategory").value = task.category;
      document.getElementById("taskPriority").value = task.priority;
      document.getElementById("taskDeadline").value = task.deadline || "";
      document.getElementById("taskDescription").value = task.description || "";
      document.getElementById("taskNotes").innerHTML = task.notes || "";
    } else {
      this.editingTaskId = null;
      document.getElementById("modalTitle").textContent = "Add New Task";
      form.reset();
      document.getElementById("taskNotes").innerHTML = "";
    }

    modal.classList.add("show");
    overlay.style.display = "block";
    document.body.style.overflow = "hidden";
  }

  closeModal() {
    const modal = document.getElementById("taskModal");
    const overlay = document.getElementById("overlay");

    modal.classList.remove("show");
    overlay.style.display = "none";
    document.body.style.overflow = "auto";

    // Clear toolbar active states
    document.querySelectorAll(".toolbar-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
  }

  handleTaskSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const task = {
      id: this.editingTaskId || Date.now().toString(),
      title: document.getElementById("taskTitle").value,
      topic: document.getElementById("taskTopic").value,
      category: document.getElementById("taskCategory").value,
      priority: document.getElementById("taskPriority").value,
      deadline: document.getElementById("taskDeadline").value,
      description: document.getElementById("taskDescription").value,
      notes: document.getElementById("taskNotes").innerHTML,
      completed: false,
      createdAt: this.editingTaskId
        ? this.tasks.find((t) => t.id === this.editingTaskId).createdAt
        : new Date().toISOString(),
    };

    if (this.editingTaskId) {
      const index = this.tasks.findIndex((t) => t.id === this.editingTaskId);
      this.tasks[index] = { ...this.tasks[index], ...task };
    } else {
      this.tasks.push(task);
    }

    this.saveTasks();
    this.renderTasks();
    this.updateStats();
    this.generateAIPlan();
    this.closeModal();

    this.showNotification(
      this.editingTaskId
        ? "Task updated successfully!"
        : "Task added successfully!"
    );
  }

  deleteTask(taskId) {
    if (confirm("Are you sure you want to delete this task?")) {
      this.tasks = this.tasks.filter((task) => task.id !== taskId);
      this.saveTasks();
      this.renderTasks();
      this.updateStats();
      this.generateAIPlan();
      this.showNotification("Task deleted successfully!");
    }
  }

  toggleTaskComplete(taskId) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      task.completedAt = task.completed ? new Date().toISOString() : null;
      this.saveTasks();
      this.renderTasks();
      this.updateStats();
      this.generateAIPlan();
      this.showNotification(
        task.completed ? "Task completed!" : "Task marked as pending!"
      );
    }
  }

  getFilteredTasks() {
    const searchTerm = document
      .getElementById("searchInput")
      .value.toLowerCase();
    const categoryFilter = document.getElementById("categoryFilter").value;
    const priorityFilter = document.getElementById("priorityFilter").value;
    const statusFilter = document.getElementById("statusFilter").value;

    return this.tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchTerm) ||
        task.topic?.toLowerCase().includes(searchTerm) ||
        task.description?.toLowerCase().includes(searchTerm) ||
        task.notes?.toLowerCase().includes(searchTerm);

      const matchesCategory =
        !categoryFilter || task.category === categoryFilter;
      const matchesPriority =
        !priorityFilter || task.priority === priorityFilter;

      let matchesStatus = true;
      if (statusFilter === "completed") {
        matchesStatus = task.completed;
      } else if (statusFilter === "pending") {
        matchesStatus = !task.completed && !this.isOverdue(task);
      } else if (statusFilter === "overdue") {
        matchesStatus = this.isOverdue(task);
      }

      return (
        matchesSearch && matchesCategory && matchesPriority && matchesStatus
      );
    });
  }

  isOverdue(task) {
    if (!task.deadline || task.completed) return false;
    return new Date(task.deadline) < new Date();
  }

  renderTasks() {
    if (this.currentView === "list") {
      this.renderListView();
    } else {
      this.renderCalendarView();
    }
  }

  renderListView() {
    const container = document.getElementById("tasksContainer");
    const filteredTasks = this.getFilteredTasks();

    if (filteredTasks.length === 0) {
      container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--gray-dark);">
                    <i class="fas fa-tasks" style="font-size: 48px; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>No tasks found</h3>
                    <p>Add your first study task to get started!</p>
                </div>
            `;
      return;
    }

    // Sort tasks by priority and deadline
    filteredTasks.sort((a, b) => {
      const priorityOrder = { High: 3, Medium: 2, Low: 1 };
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      if (a.deadline && b.deadline) {
        return new Date(a.deadline) - new Date(b.deadline);
      }

      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    container.innerHTML = filteredTasks
      .map((task) => this.createTaskHTML(task))
      .join("");
  }

  createTaskHTML(task) {
    const isOverdue = this.isOverdue(task);
    const deadlineFormatted = task.deadline
      ? new Date(task.deadline).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "No deadline";

    return `
            <div class="task-item ${task.completed ? "completed" : ""} ${
      isOverdue ? "overdue" : ""
    }" data-task-id="${task.id}">
                <div class="task-header">
                    <div class="task-info">
                        <h3>${task.title}</h3>
                        ${
                          task.topic
                            ? `<div class="task-topic">${task.topic}</div>`
                            : ""
                        }
                        <div class="task-meta">
                            <span class="category">${task.category}</span>
                            <span class="priority priority-${task.priority.toLowerCase()}">${
      task.priority
    } Priority</span>
                            <span class="deadline">
                                <i class="fas fa-calendar"></i> ${deadlineFormatted}
                            </span>
                            ${
                              isOverdue
                                ? '<span class="overdue-badge" style="background: var(--falu-red); color: white;"><i class="fas fa-exclamation-triangle"></i> Overdue</span>'
                                : ""
                            }
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="btn btn-small ${
                          task.completed ? "btn-secondary" : "btn-primary"
                        }" onclick="studyPlanner.toggleTaskComplete('${
      task.id
    }')">
                            <i class="fas fa-${
                              task.completed ? "undo" : "check"
                            }"></i>
                            ${task.completed ? "Undo" : "Complete"}
                        </button>
                        <button class="btn btn-small btn-secondary" onclick="studyPlanner.openModal(studyPlanner.tasks.find(t => t.id === '${
                          task.id
                        }'))">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-small btn-danger" onclick="studyPlanner.deleteTask('${
                          task.id
                        }')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
                ${
                  task.description
                    ? `<div class="task-description">${task.description}</div>`
                    : ""
                }
                ${
                  task.notes
                    ? `
                    <div class="task-notes">
                        <h4><i class="fas fa-sticky-note"></i> Notes</h4>
                        <div class="task-notes-content">${task.notes}</div>
                    </div>
                `
                    : ""
                }
            </div>
        `;
  }

  renderCalendarView() {
    const container = document.getElementById("calendarContainer");
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    let calendarHTML = `
            <div class="calendar-header" style="text-align: center; margin-bottom: 20px;">
                <h2>${monthNames[currentMonth]} ${currentYear}</h2>
            </div>
            <div class="calendar-grid">
                <div class="calendar-day-header" style="background: var(--bistre); color: white; padding: 10px; text-align: center; font-weight: 600;">Sun</div>
                <div class="calendar-day-header" style="background: var(--bistre); color: white; padding: 10px; text-align: center; font-weight: 600;">Mon</div>
                <div class="calendar-day-header" style="background: var(--bistre); color: white; padding: 10px; text-align: center; font-weight: 600;">Tue</div>
                <div class="calendar-day-header" style="background: var(--bistre); color: white; padding: 10px; text-align: center; font-weight: 600;">Wed</div>
                <div class="calendar-day-header" style="background: var(--bistre); color: white; padding: 10px; text-align: center; font-weight: 600;">Thu</div>
                <div class="calendar-day-header" style="background: var(--bistre); color: white; padding: 10px; text-align: center; font-weight: 600;">Fri</div>
                <div class="calendar-day-header" style="background: var(--bistre); color: white; padding: 10px; text-align: center; font-weight: 600;">Sat</div>
        `;

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const isToday = currentDate.toDateString() === today.toDateString();
      const isCurrentMonth = currentDate.getMonth() === currentMonth;
      const dayTasks = this.tasks.filter((task) => {
        if (!task.deadline) return false;
        const taskDate = new Date(task.deadline);
        return taskDate.toDateString() === currentDate.toDateString();
      });

      calendarHTML += `
                <div class="calendar-day ${
                  !isCurrentMonth ? "other-month" : ""
                } ${isToday ? "today" : ""}">
                    <div class="calendar-day-number">${currentDate.getDate()}</div>
                    ${dayTasks
                      .map(
                        (task) => `
                        <div class="calendar-task ${task.priority.toLowerCase()}-priority ${
                          task.completed ? "completed" : ""
                        }" 
                             onclick="studyPlanner.openModal(studyPlanner.tasks.find(t => t.id === '${
                               task.id
                             }'))"
                             title="${task.title}">
                            ${task.title}
                        </div>
                    `
                      )
                      .join("")}
                </div>
            `;

      currentDate.setDate(currentDate.getDate() + 1);
    }

    calendarHTML += "</div>";
    container.innerHTML = calendarHTML;
  }

  switchView(view) {
    this.currentView = view;

    // Update button states
    document
      .getElementById("listViewBtn")
      .classList.toggle("active", view === "list");
    document
      .getElementById("calendarViewBtn")
      .classList.toggle("active", view === "calendar");

    // Show/hide containers
    document.getElementById("tasksContainer").style.display =
      view === "list" ? "block" : "none";
    document.getElementById("calendarContainer").style.display =
      view === "calendar" ? "block" : "none";

    this.renderTasks();
  }

  updateStats() {
    const total = this.tasks.length;
    const completed = this.tasks.filter((task) => task.completed).length;
    const pending = this.tasks.filter(
      (task) => !task.completed && !this.isOverdue(task)
    ).length;
    const overdue = this.tasks.filter((task) => this.isOverdue(task)).length;

    document.getElementById("totalTasks").textContent = total;
    document.getElementById("completedTasks").textContent = completed;
    document.getElementById("pendingTasks").textContent = pending;
    document.getElementById("overdueTasks").textContent = overdue;
  }

  generateAIPlan() {
    const pendingTasks = this.tasks.filter((task) => !task.completed);
    const aiPlanContainer = document.getElementById("aiPlan");

    if (pendingTasks.length === 0) {
      aiPlanContainer.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-trophy" style="font-size: 24px; color: var(--lion); margin-bottom: 10px;"></i>
                    <p><strong>Congratulations!</strong> You've completed all your tasks! 🎉</p>
                    <p>Add new tasks to get a fresh study plan.</p>
                </div>
            `;
      return;
    }

    // Sort by priority and deadline
    const sortedTasks = pendingTasks.sort((a, b) => {
      const priorityOrder = { High: 3, Medium: 2, Low: 1 };
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      if (a.deadline && b.deadline) {
        return new Date(a.deadline) - new Date(b.deadline);
      }

      return 0;
    });

    const today = new Date();
    const todayTasks = sortedTasks.filter((task) => {
      if (!task.deadline) return false;
      const taskDate = new Date(task.deadline);
      return taskDate.toDateString() === today.toDateString();
    });

    const urgentTasks = sortedTasks.filter((task) => {
      if (!task.deadline) return false;
      const taskDate = new Date(task.deadline);
      const diffTime = taskDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 3 && diffDays >= 0;
    });

    const overdueTasks = sortedTasks.filter((task) => this.isOverdue(task));

    let planHTML = "";

    if (overdueTasks.length > 0) {
      planHTML += `
                <div class="ai-plan-item" style="border-left: 4px solid var(--falu-red); padding-left: 15px; margin-bottom: 15px;">
                    <strong>🚨 Immediate Action Required:</strong>
                    <p>You have ${
                      overdueTasks.length
                    } overdue task(s). Focus on these first:</p>
                    <ul>
                        ${overdueTasks
                          .slice(0, 3)
                          .map(
                            (task) =>
                              `<li>${task.title} (${task.category})</li>`
                          )
                          .join("")}
                    </ul>
                </div>
            `;
    }

    if (todayTasks.length > 0) {
      planHTML += `
                <div class="ai-plan-item" style="border-left: 4px solid var(--brown); padding-left: 15px; margin-bottom: 15px;">
                    <strong>📅 Today's Focus:</strong>
                    <p>Tasks due today:</p>
                    <ul>
                        ${todayTasks
                          .map(
                            (task) =>
                              `<li>${task.title} (${task.priority} priority)</li>`
                          )
                          .join("")}
                    </ul>
                </div>
            `;
    }

    if (urgentTasks.length > 0) {
      planHTML += `
                <div class="ai-plan-item" style="border-left: 4px solid var(--lion); padding-left: 15px; margin-bottom: 15px;">
                    <strong>⏰ This Week's Priorities:</strong>
                    <p>Tasks due within 3 days:</p>
                    <ul>
                        ${urgentTasks
                          .slice(0, 5)
                          .map((task) => {
                            const daysLeft = Math.ceil(
                              (new Date(task.deadline) - today) /
                                (1000 * 60 * 60 * 24)
                            );
                            return `<li>${task.title} (${daysLeft} day${
                              daysLeft !== 1 ? "s" : ""
                            } left)</li>`;
                          })
                          .join("")}
                    </ul>
                </div>
            `;
    }

    // Study recommendations
    const highPriorityTasks = sortedTasks.filter(
      (task) => task.priority === "High"
    ).length;
    const categories = [...new Set(sortedTasks.map((task) => task.category))];

    planHTML += `
            <div class="ai-plan-item" style="border-left: 4px solid var(--peach); padding-left: 15px;">
                <strong>💡 Smart Recommendations:</strong>
                <ul>
                    ${
                      highPriorityTasks > 0
                        ? `<li>Focus on ${highPriorityTasks} high-priority task(s) first</li>`
                        : ""
                    }
                    ${
                      categories.length > 1
                        ? `<li>Balance your study time across ${
                            categories.length
                          } subjects: ${categories.join(", ")}</li>`
                        : ""
                    }
                    <li>Break large tasks into smaller, manageable chunks</li>
                    <li>Take regular breaks to maintain focus and productivity</li>
                    ${
                      overdueTasks.length === 0
                        ? "<li>Great job staying on track! Keep up the momentum 🌟</li>"
                        : ""
                    }
                </ul>
            </div>
        `;

    aiPlanContainer.innerHTML = planHTML;
  }

  exportData() {
    const data = {
      tasks: this.tasks,
      exportDate: new Date().toISOString(),
      version: "1.0",
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study-planner-backup-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showNotification("Data exported successfully!");
  }

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.tasks && Array.isArray(data.tasks)) {
          if (confirm("This will replace all existing tasks. Are you sure?")) {
            this.tasks = data.tasks;
            this.saveTasks();
            this.renderTasks();
            this.updateStats();
            this.generateAIPlan();
            this.showNotification("Data imported successfully!");
          }
        } else {
          throw new Error("Invalid file format");
        }
      } catch (error) {
        alert("Error importing file. Please check the file format.");
      }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = "";
  }

  saveTasks() {
    localStorage.setItem("studyTasks", JSON.stringify(this.tasks));
  }

  showNotification(message) {
    // Create notification element
    const notification = document.createElement("div");
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--brown);
            color: white;
            padding: 15px 20px;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-hover);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// Add notification animations to CSS
const style = document.createElement("style");
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the app
const studyPlanner = new StudyPlanner();

// Add keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Ctrl/Cmd + N to add new task
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault();
    studyPlanner.openModal();
  }

  // Escape to close modal
  if (e.key === "Escape") {
    studyPlanner.closeModal();
  }
});
