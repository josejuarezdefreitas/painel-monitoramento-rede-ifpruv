document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, iniciando aplicação...');

    // --- CONFIGURAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyClh1yCsCpoQtLOBlXenYbot4BazZwUxq8",
        authDomain: "monitoramento-de-rede-ifpruv.firebaseapp.com",
      databaseURL: "https://monitoramento-de-rede-ifpruv-default-rtdb.firebaseio.com",
      projectId: "monitoramento-de-rede-ifpruv",
      storageBucket: "monitoramento-de-rede-ifpruv.firebasestorage.app",
      messagingSenderId: "397380019537",
      appId: "1:397380019537:web:5b58d725232965849a5f70"
};

    // --- INICIALIZAÇÃO DO FIREBASE ---
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase inicializado com sucesso.');
    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
        return;
    }
    const database = firebase.database();
    const devicesRef = database.ref('devices');
    const historyRef = database.ref('history');

    // --- ELEMENTOS DO DOM ---
    const dashboardGrid = document.getElementById('dashboard-grid');
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
    let currentStatuses = {};

    // --- FUNÇÃO PRINCIPAL DE ESCUTA E RENDERIZAÇÃO ---
    function listenForDeviceStatus() {
        devicesRef.on('value', (snapshot) => {
            currentStatuses = snapshot.val() || {};
            renderDashboard(currentStatuses);
        });
    }

    function renderDashboard(statuses) {
        dashboardGrid.innerHTML = '';
        if (Object.keys(statuses).length === 0) {
            dashboardGrid.innerHTML = '<p class="error-message">Nenhum equipamento cadastrado. Clique em "Adicionar Equipamento".</p>';
            return;
        }
        
        const sortedDeviceIds = Object.keys(statuses).sort((a, b) => statuses[a].nome.localeCompare(statuses[b].nome));

        for (const deviceId of sortedDeviceIds) {
            const device = statuses[deviceId];
            const statusClass = device.online ? 'online' : 'offline';
            const card = document.createElement('div');
            card.className = 'device-card';
            card.dataset.deviceId = deviceId;

            card.innerHTML = `
                <div class="card-actions">
                    <button class="edit-btn" title="Editar Dispositivo">✎</button>
                    <button class="delete-btn" title="Excluir Dispositivo">×</button>
                </div>
                <img class="card-image" src="${device.imagem_url || 'https://i.imgur.com/8QMMGba.png'}" alt="Imagem do ${device.nome}" onerror="this.onerror=null;this.src='https://i.imgur.com/8QMMGba.png';">
                <div class="card-header">
                    <h2 class="device-name">${device.nome}</h2>
                    <div class="status-indicator ${statusClass}"></div>
                </div>
                <div class="card-body">
                    <p>IP: <span>${device.ip}</span></p>
                    <p>MAC: <span>${device.mac || 'N/A'}</span></p>
                    <p>Status: <span class="${statusClass}">${device.online ? 'Online' : 'Offline'}</span></p>
                    <p>Latência: <span>${device.latency !== null && device.online ? (device.latency.toFixed(2) + ' ms') : 'N/A'}</span></p>
                    <p><small>Verificado: ${device.last_update || 'N/A'}</small></p>
                </div>
                <div class="card-footer">
                    <a href="${device.url || '#'}" class="access-button" target="_blank" rel="noopener noreferrer">Acessar</a>
                </div>
            `;
            dashboardGrid.appendChild(card);
        }
    }

    // --- FUNÇÃO PARA CARREGAR E RENDERIZAR HISTÓRICO ---
    function showHistoryModal(deviceId) {
        const deviceName = currentStatuses[deviceId]?.nome || 'Dispositivo';
        modalTitle.textContent = `Histórico de: ${deviceName}`;
        uptimeEl.textContent = 'Carregando...';
        avgLatencyEl.textContent = 'Carregando...';
        maxLatencyEl.textContent = 'Carregando...';
        historyModal.classList.add('visible');

        historyRef.child(deviceId).limitToLast(1000).once('value', (snapshot) => {
            if (historyChart) {
                historyChart.destroy();
            }

            const historyDataObj = snapshot.val();
            if (!historyDataObj) {
                uptimeEl.textContent = 'Sem dados';
                avgLatencyEl.textContent = 'Sem dados';
                maxLatencyEl.textContent = 'Sem dados';
                return;
            }
            
            const historyData = Object.values(historyDataObj);
            const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
            
            const recentHistory = historyData.filter(record => (new Date(record.timestamp).getTime()) > twentyFourHoursAgo);
            
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
                options: {
                    scales: {
                        x: {
                            type: 'time',
                            time: { unit: 'hour', displayFormats: { hour: 'HH:mm' } },
                            title: { display: true, text: 'Horário' }
                        },
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Latência (ms)' }
                        }
                    }
                }
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

    deviceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('device-id').value;
        const formData = new FormData(deviceForm);
        const deviceData = Object.fromEntries(formData.entries());
        
        if (id) {
            deviceData.id = id;
            devicesRef.child(id).update(deviceData);
        } else {
            const newId = `dev_${Date.now()}`;
            deviceData.id = newId;
            devicesRef.child(newId).set(deviceData);
        }
        deviceModal.classList.remove('visible');
    });

    dashboardGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.device-card');
        if (!card) return;
        const deviceId = card.dataset.deviceId;
        
        if (e.target.classList.contains('delete-btn')) {
            e.stopPropagation();
            if (confirm(`Tem certeza que deseja excluir "${currentStatuses[deviceId].nome}"?`)) {
                devicesRef.child(deviceId).remove();
                historyRef.child(deviceId).remove();
            }
        } else if (e.target.classList.contains('edit-btn')) {
            e.stopPropagation();
            openDeviceForm(deviceId);
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
