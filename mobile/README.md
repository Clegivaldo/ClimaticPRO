# Climatic Pro - Mobile

Instruções rápidas para rodar o app mobile (Expo).

Pré-requisitos
- Node >= 16
- Yarn or npm
- Expo CLI (opcional): `npm install -g expo-cli`
- Backend da aplicação rodando e acessível (veja backend/README.md)

Configuração do endpoint API

O app utiliza `EXPO_PUBLIC_API_URL` (em `app.json` → `expo.extra`) como base da API.
Por padrão está apontando para um IP local. Ajuste para o endereço da sua máquina/servidor.

- Para emulador Android (emulador padrão do Android Studio) use `http://10.0.2.2:3001/api/v1`.
- Para emulador Genymotion ou dispositivo físico use o IP da sua máquina na rede local, ex: `http://192.168.0.42:3001/api/v1`.

Execução (Desenvolvimento)

Instale dependências:

```bash
cd mobile
npm install
# ou
yarn
```

Iniciar Expo:

```bash
npm run start
# ou
yarn start
```

Abrir no dispositivo/emulador:

- Para Android: `npm run android` (requer Android Studio configurado)
- Para iOS: `npm run ios` (macOS com Xcode)

Bluetooth (BLE)

O projeto suporta três modos:

1. react-native-ble-plx (nativo, mais confiável) — requer build nativo ou `expo-dev-client`/EAS.
2. expo-ble-scanner (plugin gerenciado) — pode exigir EAS dependendo da versão do Expo.
3. Simulação embutida — funciona sem configuração nativa (ideal para desenvolvimento rápido em Expo client).

Se quiser usar BLE real com `react-native-ble-plx` no Expo, siga:

```bash
# Instale o cliente de desenvolvimento e recompile com EAS
npm install -g eas-cli
npx expo install expo-dev-client
eas build --profile development --platform android
```

Observações
- O `mobile/src/services/ble.service.ts` já tenta usar bibliotecas nativas e cai para simulação automaticamente quando ausentes.
- Certifique-se de que o backend esteja aceitando conexões externas (0.0.0.0) e CORS habilitado.

Problemas comuns
- Se `API_BASE_URL` apontar para `localhost` em um dispositivo real, troque pelo IP da máquina.
- Permissões de localização/BLUETOOTH devem ser aceitas no dispositivo Android.

Se quiser, eu realizo as alterações automáticas para adicionar instruções de EAS/DevClient e ajustar `package.json` para facilitar builds.
