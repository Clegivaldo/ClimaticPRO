
// Usamos um proxy (corsproxy.io) para contornar a restrição de CORS do navegador,
// já que o servidor da Jaalee não permite chamadas diretas de localhost ou domínios de preview.
export const API_BASE_URL = "https://corsproxy.io/?https://sensor.jaalee.com/v1/open";

export const MOCK_SENSORS = [
  {
    mac: "A4:C1:38:92:FD:11",
    alias: "Sensor Sala de Estar",
    type: "F525",
    power: 92,
    temperature: 24.4,
    humidity: 23.9,
    co2: 450,
    tvocPpm: 0.12,
    status: 'online',
    lastSync: 'Agora mesmo'
  },
  {
    mac: "B2:D4:56:12:AA:BB",
    alias: "Quarto do Bebê",
    type: "F525",
    power: 78,
    temperature: 22.1,
    humidity: 45.0,
    light: 340,
    pm25: 12,
    status: 'online',
    lastSync: '2m atrás'
  },
  {
    mac: "C3:E5:78:90:CC:DD",
    alias: "Adega de Vinhos",
    type: "F525",
    power: 24,
    temperature: 12.5,
    humidity: 60.2,
    pressure: 1013,
    status: 'online',
    lastSync: '5m atrás'
  },
  {
    mac: "D4:F6:89:01:EE:FF",
    alias: "Garagem",
    type: "F525",
    power: 0,
    temperature: undefined,
    humidity: undefined,
    status: 'offline',
    lastSync: '4h atrás'
  }
];
