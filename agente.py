import time
import logging
from threading import Thread
import firebase_admin
from firebase_admin import credentials, db
from ping3 import ping

# --- Configurações ---
PING_INTERVALO = 10  # Intervalo em segundos entre os ciclos de ping
CAMINHO_CHAVE_FIREBASE = './serviceAccountKey.json'
URL_DATABASE_FIREBASE = 'https://monitoramento-da-rede-ifpruv-default-rtdb.firebaseio.com/'

# --- 1. Configuração do Logging ---
# Em vez de usar print(), vamos usar o módulo logging.
# Isso nos permite registrar mensagens com níveis (INFO, WARNING, ERROR)
# e salvar tudo em um arquivo chamado 'agente.log'.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("agente.log"),  # Salva os logs em um arquivo
        logging.StreamHandler()              # Mostra os logs no console também
    ]
)

# --- Inicialização do Firebase Admin ---
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(CAMINHO_CHAVE_FIREBASE)
        firebase_admin.initialize_app(cred, {
            'databaseURL': URL_DATABASE_FIREBASE
        })
    logging.info("Conexão com o Firebase estabelecida com sucesso!")
except Exception as e:
    logging.error(f"ERRO CRÍTICO ao inicializar o Firebase: {e}")
    exit()

# --- 2. Função de Ping para um Único Dispositivo (para usar com Threads) ---
# Movemos a lógica de ping para uma função separada.
# Cada thread executará esta função para um dispositivo diferente.
def ping_device(device_id, device_info):
    """Executa o ping para um único dispositivo e atualiza o Firebase."""
    ip = device_info.get('ip')
    if not ip:
        logging.warning(f"Dispositivo '{device_id}' não possui um endereço IP. Pulando.")
        return

    try:
        latencia_ms = ping(ip, unit='ms', timeout=2)
        status_online = latencia_ms is not False and latencia_ms is not None

        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')

        update_data = {
            "online": status_online,
            "latency": latencia_ms if status_online else None,
            "last_update": timestamp
        }

        # Atualiza o status principal do dispositivo
        db.reference(f'devices/{device_id}').update(update_data)

        # Adiciona um registro ao histórico
        # Usamos um timestamp numérico para facilitar a ordenação, se necessário no futuro
        history_timestamp = int(time.time())
        history_path = f"history/{device_id}/{history_timestamp}"
        db.reference(history_path).set({
            "online": status_online,
            "latency": latencia_ms if status_online else None,
            "timestamp": timestamp 
        })
        
        # Opcional: log para cada dispositivo pingado com sucesso
        # logging.info(f"Dispositivo {ip} ({device_id}) atualizado: Online={status_online}, Latência={latencia_ms}")

    except Exception as e:
        logging.error(f"Erro ao fazer ping no dispositivo {device_id} ({ip}): {e}")


# --- 3. Worker Principal Refatorado ---
def main_worker():
    logging.info("Agente de monitoramento iniciado. Pressionando Ctrl+C para sair.")
    
    while True:
        try:
            devices_to_ping = db.reference('devices').get()
            if not devices_to_ping:
                logging.info("Nenhum dispositivo encontrado no Firebase para monitorar.")
                time.sleep(PING_INTERVALO)
                continue

            threads = []
            start_time = time.time()
            logging.info(f"Iniciando ciclo de ping para {len(devices_to_ping)} dispositivos...")

            # Cria e inicia uma thread para cada dispositivo
            for device_id, device_info in devices_to_ping.items():
                thread = Thread(target=ping_device, args=(device_id, device_info))
                threads.append(thread)
                thread.start()

            # Espera todas as threads terminarem (opcional, mas bom para controle)
            for thread in threads:
                thread.join()
            
            end_time = time.time()
            cycle_duration = end_time - start_time
            logging.info(f"Ciclo de ping concluído em {cycle_duration:.2f} segundos.")

            # Aguarda o tempo restante até o próximo ciclo
            sleep_time = PING_INTERVALO - cycle_duration
            if sleep_time > 0:
                time.sleep(sleep_time)

        except Exception as e:
            logging.error(f"ERRO no loop principal do worker: {e}")
            time.sleep(PING_INTERVALO) # Espera antes de tentar novamente

# --- Execução principal ---
if __name__ == '__main__':
    worker_thread = Thread(target=main_worker, daemon=True)
    worker_thread.start()

    try:
        # Mantém a thread principal viva para que possamos capturar o Ctrl+C
        while worker_thread.is_alive():
            worker_thread.join(1)
    except KeyboardInterrupt:
        logging.info("Agente finalizado pelo usuário.")