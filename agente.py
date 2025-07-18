import time
from threading import Thread
import firebase_admin
from firebase_admin import credentials, db
from ping3 import ping

# --- Configurações ---
PING_INTERVALO = 10
CAMINHO_CHAVE_FIREBASE = './serviceAccountKey.json'
URL_DATABASE_FIREBASE = 'https://monitoramento-de-rede-ifpruv-default-rtdb.firebaseio.com/'

# --- Inicialização do Firebase Admin ---
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(CAMINHO_CHAVE_FIREBASE)
        firebase_admin.initialize_app(cred, {
            'databaseURL': URL_DATABASE_FIREBASE
        })
    print(">>> Conexão com o Firebase estabelecida com sucesso!")
except Exception as e:
    print(f"!!! ERRO ao inicializar o Firebase: {e}")
    exit()

# --- Worker de Ping ---
def ping_worker():
    print(">>> Agente de Ping iniciado. Enviando dados para o Firebase...")
    devices_ref = db.reference('devices')

    while True:
        try:
            devices_to_ping = devices_ref.get()
            if not devices_to_ping:
                print(f"[{time.strftime('%H:%M:%S')}] Nenhum dispositivo no Firebase.")
                time.sleep(PING_INTERVALO)
                continue

            for device_id, device in devices_to_ping.items():
                ip = device.get('ip')
                if not ip:
                    continue

                latencia_ms = ping(ip, unit='ms', timeout=2)
                status_online = latencia_ms is not False and latencia_ms is not None

                update_data = {
                    "online": status_online,
                    "latency": latencia_ms if status_online else None,
                    "last_update": time.strftime('%Y-%m-%d %H:%M:%S')
                }

                devices_ref.child(device_id).update(update_data)

                history_path = f"history/{device_id}/{time.strftime('%Y-%m-%d %H:%M:%S')}"
                db.reference(history_path).set({
                    "online": status_online,
                    "latency": latencia_ms if status_online else None,
                    "timestamp": time.strftime('%Y-%m-%d %H:%M:%S')
                })

            print(f"[{time.strftime('%H:%M:%S')}] Dispositivos atualizados.")

        except Exception as e:
            print(f"ERRO no ping_worker: {e}")

        time.sleep(PING_INTERVALO)

# --- Execução principal ---
if __name__ == '__main__':
    ping_thread = Thread(target=ping_worker, daemon=True)
    ping_thread.start()

    print(">>> O agente está rodando. Pressione Ctrl+C para sair.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n>>> Agente finalizado.")