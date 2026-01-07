# Contrat d'interface MQTT

Device ID utilisé dans les exemples : `device123`

| Topic                    | Sens            | Rôle (Émetteur) | Rôle (Récepteur) | Description du Payload                        |
| :----------------------- | :-------------- | :-------------- | :--------------- | :-------------------------------------------- |
| `iot/esp32-A1/telemetry` | Device -> Cloud | Device          | Server/Dashboard | Données récurrentes (temp, hum, batterie)     |
| `iot/esp32-A1/event`     | Device -> Cloud | Device          | Server/Dashboard | Événements ponctuels (BOOT, ACK)              |
| `iot/esp32-A1/status`    | Device -> Cloud | Device          | Server/Dashboard | État de connexion (LWT - Last Will Testament) |
| `iot/esp32-A1/cmd`       | Cloud -> Device | Server/User     | Device           | Ordres à exécuter (SET_LED, etc.)             |
