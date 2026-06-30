const API_URL = "http://127.0.0.1:8000/api";

// Elementi DOM
const authPanel = document.getElementById('authPanel');
const workspacePanel = document.getElementById('workspacePanel');
const employeeView = document.getElementById('employeeView');
const adminView = document.getElementById('adminView');
const loginForm = document.getElementById('loginForm');
const reportForm = document.getElementById('reportForm');
const employeeNameSpan = document.getElementById('employeeName');
const loginError = document.getElementById('loginError');
const reportSuccess = document.getElementById('reportSuccess');

// Al caricamento della pagina, controlla se c'è già una sessione attiva
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        showWorkspace(user);
    }
});

// GESTIONE LOGIN
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';

    const name = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, password })
        });

        if (!response.ok) {
            throw new Error('Nome utente o password errati');
        }

        const userData = await response.json();
        // Salviamo l'utente nel localStorage
        localStorage.setItem('user', JSON.stringify(userData));
        showWorkspace(userData);

    } catch (error) {
        loginError.innerText = error.message;
        loginError.style.display = 'block';
    }
});

// MOSTRA SCHERMATA CORRETTA IN BASE AL RUOLO
function showWorkspace(user) {
    authPanel.style.display = 'none';
    workspacePanel.style.display = 'block';
    employeeNameSpan.innerText = user.name;

    if (user.role === 'admin') {
        adminView.style.display = 'block';
        employeeView.style.display = 'none';
        setupAdminDashboard();
    } else {
        employeeView.style.display = 'block';
        adminView.style.display = 'none';
    }
}

// INVIO DEL REPORT GIORNALIERO
reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    reportSuccess.style.display = 'none';
    
    const user = JSON.parse(localStorage.getItem('user'));
    const activityInput = document.getElementById('activityInput');

    try {
        const response = await fetch(`${API_URL}/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user.user_id,
                activity: activityInput.value.trim()
            })
        });

        if (response.ok) {
            reportSuccess.style.display = 'block';
            activityInput.value = ''; // Svuota il campo
        }
    } catch (error) {
        alert("Errore nell'invio del report");
    }
});

// LOGOUT
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.reload();
});

// LOGICA DASHBOARD CAPO (SOLO SE RUOLO ADMIN)
function setupAdminDashboard() {
    const filterBtn = document.getElementById('filterBtn');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const reportGrid = document.getElementById('reportGrid');

    // Imposta di default le date della settimana corrente
    const today = new Date();
    endDateInput.value = today.toISOString().split('T')[0];
    const monday = new Date(today.setDate(today.getDate() - today.getDay() + 1));
    startDateInput.value = monday.toISOString().split('T')[0];

    filterBtn.addEventListener('click', async () => {
        const start = startDateInput.value;
        const end = endDateInput.value;

        try {
            const response = await fetch(`${API_URL}/reports/summary?start_date=${start}&end_date=${end}`);
            const data = await response.json();

            reportGrid.innerHTML = ''; // Svuota griglia precedente

            if (data.length === 0) {
                reportGrid.innerHTML = '<p class="no-data">Nessun report inserito in questo intervallo di date.</p>';
                return;
            }

            // Raggruppiamo i dati per Dipendente per fare un layout pulito a colonne
            const grouped = {};
            data.forEach(item => {
                if (!grouped[item.Dipendente]) grouped[item.Dipendente] = [];
                grouped[item.Dipendente].push(item);
            });

            // Generiamo le card per la griglia (CSS Grid)
            for (const employee in grouped) {
                const card = document.createElement('div');
                card.className = 'employee-column';
                
                let listHtml = `<h3 class="employee-column__name">${employee}</h3><ul class="employee-column__list">`;
                grouped[employee].forEach(report => {
                    listHtml += `<li class="employee-column__item">
                        <small class="employee-column__date">${report.date}</small>
                        <p class="employee-column__text">${report.activity}</p>
                    </li>`;
                });
                listHtml += '</ul>';
                
                card.innerHTML = listHtml;
                reportGrid.appendChild(card);
            }

        } catch (error) {
            console.error("Errore nel recupero dati", error);
        }
    });

    // Avvia la prima ricerca automatica al caricamento
    filterBtn.click();
}