document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyBu40PubBxxbqaAuiSD74MIeorUQn7RDms",
        authDomain: "monitoramento-da-rede-ifpruv.firebaseapp.com",
        projectId: "monitoramento-da-rede-ifpruv",
        storageBucket: "monitoramento-da-rede-ifpruv.appspot.com",
        messagingSenderId: "225581955546",
        appId: "1:225581955546:web:5415b08be0682851be68e3",
        measurementId: "G-WPC319HYPF"
    };
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase inicializado com sucesso.');
        }
    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
        document.body.innerHTML = '<h1 style="color:red; text-align:center;">Erro Crítico: Não foi possível conectar ao Firebase.</h1>';
        return;
    }

    // --- CONSTANTES E REFERÊNCIAS ---
    const database = firebase.database();
    const auth = firebase.auth();
    const devicesRef = database.ref('devices');
    const historyRef = database.ref('history');
    let currentStatuses = {};

    // --- ELEMENTOS DO DOM ---
    const dashboardGrid = document.getElementById('dashboard-grid');
    const searchBar = document.getElementById('search-bar');
    const historyModal = document.getElementById('history-modal');
    const modalTitle = document.getElementById('history-modal-title');
    const uptimeEl = document.getElementById('stat-uptime');
    const avgLatencyEl = document.getElementById('stat-avg-latency');
    const maxLatencyEl = document.getElementById('stat-max-latency');
    const chartCanvas = document.getElementById('history-chart');
    const addDeviceBtn = document.getElementById('add-device-btn');
    const deviceModal = document.getElementById('device-modal');
    const deviceForm = document.getElementById('device-form');
    let historyChart = null;
    const loginForm = document.getElementById('login-form');
    const userInfo = document.getElementById('user-info');
    const userEmailEl = document.getElementById('user-email');
    const logoutBtn = document.getElementById('logout-btn');

    // --- LÓGICA DE AUTENTICAÇÃO ---
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword(email, password).catch(error => {
            console.error('Erro de autenticação:', error);
            alert('Falha no login: ' + error.message);
        });
    });

    logoutBtn.addEventListener('click', () => {
        auth.signOut();
    });

    auth.onAuthStateChanged(user => {
        if (user) {
            loginForm.style.display = 'none';
            userInfo.style.display = 'flex';
            userEmailEl.textContent = user.email;
            document.body.classList.add('logged-in');
        } else {
            loginForm.style.display = 'flex';
            userInfo.style.display = 'none';
            userEmailEl.textContent = '';
            document.body.classList.remove('logged-in');
        }
    });
    
    // --- LÓGICA DE PESQUISA ---
    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        renderDashboard(currentStatuses, searchTerm);
    });

    // --- FUNÇÃO PRINCIPAL DE ESCUTA ---
    function listenForDeviceStatus() {
        devicesRef.on('value', (snapshot) => {
            currentStatuses = snapshot.val() || {};
            renderDashboard(currentStatuses, searchBar.value.toLowerCase());
        });
    }

    // --- FUNÇÃO PRINCIPAL DE RENDERIZAÇÃO ---
    function renderDashboard(statuses, searchTerm = '') {
        dashboardGrid.innerHTML = '';
        
        let filteredDevices = Object.entries(statuses);

        if (searchTerm) {
            filteredDevices = filteredDevices.filter(([id, device]) => {
                return device.nome.toLowerCase().includes(searchTerm) || 
                       (device.ip && device.ip.toLowerCase().includes(searchTerm));
            });
        }

        if (filteredDevices.length === 0) {
            dashboardGrid.innerHTML = '<p style="text-align: center; font-size: 1.2rem; color: var(--text-muted);">Nenhum equipamento encontrado.</p>';
            return;
        }

        const groupedDevices = filteredDevices.reduce((acc, [id, device]) => {
            const group = device.group || 'Outros';
            if (!acc[group]) {
                acc[group] = [];
            }
            acc[group].push([id, device]);
            return acc;
        }, {});

        Object.keys(groupedDevices).sort().forEach(groupName => {
            const devicesInGroup = groupedDevices[groupName];

            const groupTitle = document.createElement('h2');
            groupTitle.className = 'group-title';
            groupTitle.textContent = groupName;
            dashboardGrid.appendChild(groupTitle);

            const groupGrid = document.createElement('div');
            groupGrid.style.display = 'grid';
            groupGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
            groupGrid.style.gap = '20px';

            devicesInGroup.sort(([, a], [, b]) => a.nome.localeCompare(b.nome));

            devicesInGroup.forEach(([deviceId, device]) => {
                const statusClass = device.online ? 'online' : 'offline';
                const card = document.createElement('div');
                card.className = 'device-card';
                card.dataset.deviceId = deviceId;

                card.innerHTML = `
                    <div class="card-actions">
                        <button class="delete-btn" title="Excluir Dispositivo">×</button>
                    </div>
                    <img class="card-image" src="${device.imagem_url || 'https://i.imgur.com/8QMMGba.png'}" alt="Imagem do ${device.nome}" onerror="this.onerror=null;this.src='https://i.imgur.com/8QMMGba.png';">
                    <div class="card-header">
                        <h2 class="device-name">${device.nome}</h2>
                        <div class="status-indicator ${statusClass}"></div>
                    </div>
                    <div class="card-body">
                        <p>IP: <span>${device.ip || 'N/A'}</span></p>
                        <p>MAC: <span>${device.mac || 'N/A'}</span></p>
                        <p>Status: <span class="${statusClass}">${device.online ? 'Online' : 'Offline'}</span></p>
                        <p>Latência: <span>${device.latency != null && device.online ? (device.latency.toFixed(2) + ' ms') : 'N/A'}</span></p>
                    </div>
                    <div class="card-footer">
                        <button class="edit-btn-footer" title="Editar Dispositivo">Editar</button>
                        <a href="${device.url || '#'}" class="access-button" target="_blank" rel="noopener noreferrer">Acessar</a>
                    </div>
                `;
                groupGrid.appendChild(card);
            });
            dashboardGrid.appendChild(groupGrid);
        });
    }

    // --- FUNÇÃO PARA CARREGAR E RENDERIZAR HISTÓRICO ---
    function showHistoryModal(deviceId) {
        if (!auth.currentUser) {
            alert("Você precisa estar logado para ver o histórico.");
            return;
        }
        const deviceName = currentStatuses[deviceId]?.nome || 'Dispositivo';
        modalTitle.textContent = `Histórico de: ${deviceName}`;
        uptimeEl.textContent = 'Carregando...';
        avgLatencyEl.textContent = 'Carregando...';
        maxLatencyEl.textContent = 'Carregando...';
        historyModal.classList.add('visible');

        historyRef.child(deviceId).limitToLast(1000).once('value', (snapshot) => {
            if (historyChart) historyChart.destroy();
            
            const historyDataObj = snapshot.val();
            if (!historyDataObj) {
                uptimeEl.textContent = 'Sem dados';
                avgLatencyEl.textContent = 'Sem dados';
                maxLatencyEl.textContent = 'Sem dados';
                return;
            }
            const historyData = Object.values(historyDataObj);
            const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
            const recentHistory = historyData.filter(record => record.timestamp && (new Date(record.timestamp).getTime()) > twentyFourHoursAgo);
            
            if (recentHistory.length === 0) {
                uptimeEl.textContent = 'Sem dados (24h)';
                avgLatencyEl.textContent = 'Sem dados (24h)';
                maxLatencyEl.textContent = 'Sem dados (24h)';
                return;
            }

            const labels = recentHistory.map(d => new Date(d.timestamp));
            const latencies = recentHistory.map(d => d.latency);
            
            const validPings = latencies.filter(l => typeof l === 'number');
            const uptime = recentHistory.length ? (validPings.length / recentHistory.length * 100) : 0;
            const avgLatency = validPings.length ? (validPings.reduce((a, b) => a + b, 0) / validPings.length) : 0;
            const maxLatency = validPings.length ? Math.max(...validPings) : 0;
            
            uptimeEl.textContent = `${uptime.toFixed(1)}%`;
            avgLatencyEl.textContent = `${avgLatency.toFixed(2)} ms`;
            maxLatencyEl.textContent = `${maxLatency.toFixed(2)} ms`;
            
            historyChart = new Chart(chartCanvas.getContext('2d'), {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Latência (ms)',
                        data: latencies.map((latency, index) => ({x: labels[index], y: latency})),
                        borderColor: 'rgba(46, 204, 113, 1)',
                        backgroundColor: 'rgba(46, 204, 113, 0.2)',
                        fill: true,
                        tension: 0.1,
                        spanGaps: true
                    }]
                },
                options: { scales: { x: { type: 'time', time: { unit: 'hour', displayFormats: { hour: 'HH:mm' } } }, y: { beginAtZero: true } } }
            });
        });
    }

    // --- LÓGICA DOS MODAIS E EVENTOS ---
    function openDeviceForm(deviceId = null) {
        deviceForm.reset();
        const formTitle = document.getElementById('device-form-title');
        const idInput = document.getElementById('device-id');
        if (deviceId && currentStatuses[deviceId]) {
            formTitle.textContent = 'Editar Equipamento';
            const device = currentStatuses[deviceId];
            idInput.value = deviceId;
            Object.keys(device).forEach(key => {
                if (deviceForm.elements[key]) {
                    deviceForm.elements[key].value = device[key];
                }
            });
        } else {
            formTitle.textContent = 'Adicionar Novo Equipamento';
            idInput.value = '';
        }
        deviceModal.classList.add('visible');
    }

    addDeviceBtn.addEventListener('click', () => openDeviceForm());

    function isValidIP(ip) {
        const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    }

    deviceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const ipInput = document.getElementById('device-ip');
        const submitBtn = deviceForm.querySelector('.form-submit-btn');
        if (!isValidIP(ipInput.value)) {
            alert('Por favor, insira um endereço de IP válido.');
            ipInput.focus();
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvando...';
        const id = document.getElementById('device-id').value;
        const formData = new FormData(deviceForm);
        const deviceData = Object.fromEntries(formData.entries());
        const onComplete = (error) => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Salvar Equipamento';
            if (error) {
                alert('Erro ao salvar o equipamento.');
            } else {
                deviceModal.classList.remove('visible');
            }
        };
        if (id) {
            devicesRef.child(id).update(deviceData, onComplete);
        } else {
            const newId = `dev_${Date.now()}`;
            devicesRef.child(newId).set(deviceData, onComplete);
        }
    });

    dashboardGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.device-card');
        if (!card) return;
        const deviceId = card.dataset.deviceId;
        if (e.target.classList.contains('edit-btn-footer')) {
            e.stopPropagation();
            openDeviceForm(deviceId);
        } else if (e.target.classList.contains('delete-btn')) {
            e.stopPropagation();
            if (confirm(`Tem certeza que deseja excluir "${currentStatuses[deviceId].nome}"?`)) {
                devicesRef.child(deviceId).remove();
                historyRef.child(deviceId).remove();
            }
        } else {
            showHistoryModal(deviceId);
        }
    });

    [historyModal, deviceModal].forEach(modal => {
        modal?.querySelector('.modal-close-btn').addEventListener('click', () => {
            modal.classList.remove('visible');
        });
    });

    // --- INICIALIZAÇÃO ---
    listenForDeviceStatus();
});