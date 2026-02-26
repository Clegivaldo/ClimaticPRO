# Requirements Document

## Introduction

Este documento especifica os requisitos para a criação de aplicativos móveis nativos para Android e iOS baseados no PWA React existente "Climatic Pro". O sistema incluirá apps móveis nativos, uma plataforma web React aprimorada, e um backend PostgreSQL com Prisma ORM. O objetivo é fornecer uma experiência mobile nativa mantendo a funcionalidade completa do PWA atual, incluindo monitoramento de sensores ambientais via BLE, assistente de IA, alertas, exportação de dados e gerenciamento de dispositivos.

## Glossary

- **Mobile_App**: Aplicativo nativo para Android e iOS
- **Web_Platform**: Aplicação web React (PWA existente mantido/aprimorado)
- **Backend_API**: Servidor backend com PostgreSQL e Prisma ORM
- **BLE_Scanner**: Módulo de escaneamento Bluetooth Low Energy para descoberta de sensores
- **Sensor**: Dispositivo IoT que coleta dados ambientais (temperatura, umidade, CO2, PM2.5, etc.)
- **AI_Assistant**: Assistente inteligente baseado em Gemini AI para análise de dados dos sensores
- **User**: Usuário final que utiliza o aplicativo mobile ou web
- **Device_Type**: Categoria de sensor (JHT Gateway F525, JHT-UP 39F5, Wifi-PT100 35F5, JW-U Water)
- **Alert_System**: Sistema de notificações para valores fora dos limites configurados
- **Export_Module**: Módulo para exportação de dados históricos em formatos CSV/PDF
- **Authentication_Service**: Serviço de autenticação via código de verificação (email/telefone)

## Requirements

### Requirement 1: Cross-Platform Mobile Development

**User Story:** Como desenvolvedor, eu quero escolher a melhor tecnologia para desenvolvimento mobile cross-platform, para que eu possa maximizar o compartilhamento de código e manter a qualidade nativa.

#### Acceptance Criteria

1. THE Mobile_App SHALL suportar Android (API 24+) e iOS (iOS 13+)
2. THE Mobile_App SHALL compartilhar no mínimo 70% do código entre plataformas Android e iOS
3. THE Mobile_App SHALL utilizar React Native OU Flutter como framework de desenvolvimento
4. WHERE React Native é escolhido, THE Mobile_App SHALL utilizar Expo para gerenciamento de build e dependências nativas
5. WHERE Flutter é escolhido, THE Mobile_App SHALL utilizar packages oficiais do Flutter para funcionalidades nativas
6. THE Mobile_App SHALL manter performance nativa com tempo de inicialização inferior a 3 segundos
7. THE Mobile_App SHALL suportar hot reload durante desenvolvimento

### Requirement 2: User Authentication

**User Story:** Como usuário, eu quero fazer login no aplicativo usando meu email ou telefone, para que eu possa acessar meus dispositivos de forma segura.

#### Acceptance Criteria

1. WHEN um User fornece um email ou telefone válido, THE Authentication_Service SHALL enviar um código de verificação
2. WHEN um User insere o código de verificação correto, THE Authentication_Service SHALL retornar um token JWT válido
3. THE Authentication_Service SHALL armazenar o token de forma segura no dispositivo (Keychain/Keystore)
4. WHEN o token expira, THE Mobile_App SHALL redirecionar o User para a tela de login
5. THE Mobile_App SHALL suportar modo demo sem autenticação para visualização de dados mockados
6. IF o User insere credenciais inválidas 3 vezes consecutivas, THEN THE Authentication_Service SHALL implementar rate limiting de 60 segundos

### Requirement 3: Device Discovery via BLE

**User Story:** Como usuário, eu quero escanear e descobrir sensores BLE próximos, para que eu possa adicionar novos dispositivos ao meu monitoramento.

#### Acceptance Criteria

1. WHEN um User inicia o escaneamento BLE, THE BLE_Scanner SHALL solicitar permissões de Bluetooth e Localização
2. WHILE o escaneamento está ativo, THE BLE_Scanner SHALL detectar dispositivos BLE em um raio de 10 metros
3. THE BLE_Scanner SHALL identificar Device_Type baseado no advertising data (F525, 39F5, 35F5, JW-U)
4. THE BLE_Scanner SHALL parsear dados de temperatura e umidade do advertising packet conforme especificação do Device_Type
5. WHEN um Sensor é detectado, THE Mobile_App SHALL exibir MAC address, tipo, e dados parseados em tempo real
6. THE BLE_Scanner SHALL atualizar a lista de dispositivos a cada 2 segundos durante escaneamento ativo
7. IF permissões de Bluetooth são negadas, THEN THE Mobile_App SHALL exibir mensagem explicativa e link para configurações

### Requirement 4: Real-Time Sensor Dashboard

**User Story:** Como usuário, eu quero visualizar todos os meus sensores em um dashboard, para que eu possa monitorar rapidamente o status de todos os dispositivos.

#### Acceptance Criteria

1. THE Mobile_App SHALL exibir lista de todos os Sensors associados ao User
2. FOR EACH Sensor, THE Mobile_App SHALL exibir alias, tipo, nível de bateria, status (online/offline), e última sincronização
3. WHEN dados de um Sensor são atualizados, THE Mobile_App SHALL atualizar a interface em até 2 segundos
4. THE Mobile_App SHALL exibir indicadores visuais de alerta quando valores estão fora dos limites configurados
5. WHEN um User toca em um Sensor, THE Mobile_App SHALL navegar para a tela de detalhes do dispositivo
6. THE Mobile_App SHALL implementar pull-to-refresh para atualização manual dos dados
7. WHILE o app está em foreground, THE Mobile_App SHALL atualizar dados automaticamente a cada 60 segundos

### Requirement 5: Sensor Details and Historical Data

**User Story:** Como usuário, eu quero ver detalhes e histórico de um sensor específico, para que eu possa analisar tendências e padrões ao longo do tempo.

#### Acceptance Criteria

1. WHEN um User visualiza detalhes de um Sensor, THE Mobile_App SHALL exibir todos os parâmetros disponíveis (temperatura, umidade, CO2, PM2.5, TVOC, etc.)
2. THE Mobile_App SHALL exibir gráficos de linha para dados históricos com período selecionável (24h, 7d, 30d, 90d)
3. THE Mobile_App SHALL permitir zoom e pan nos gráficos para análise detalhada
4. THE Mobile_App SHALL carregar dados históricos do Backend_API paginados (50 registros por página)
5. WHEN dados históricos não estão disponíveis, THE Mobile_App SHALL exibir mensagem informativa
6. THE Mobile_App SHALL permitir edição do alias do Sensor
7. THE Mobile_App SHALL exibir timestamp da última leitura em formato local do dispositivo

### Requirement 6: AI-Powered Assistant

**User Story:** Como usuário, eu quero conversar com um assistente de IA sobre meus dados de sensores, para que eu possa obter insights e recomendações personalizadas.

#### Acceptance Criteria

1. THE AI_Assistant SHALL utilizar Google Gemini 2.5 Flash Lite para processamento de linguagem natural
2. WHEN um User envia uma mensagem, THE AI_Assistant SHALL responder em até 5 segundos
3. THE AI_Assistant SHALL ter acesso ao contexto de todos os Sensors do User (valores atuais, status, tipo)
4. THE AI_Assistant SHALL alertar automaticamente sobre valores perigosos (CO2 > 1000ppm, Umidade < 30% ou > 70%)
5. THE AI_Assistant SHALL responder em Português do Brasil
6. THE AI_Assistant SHALL formatar respostas usando Markdown simples
7. THE AI_Assistant SHALL limitar respostas a 500 tokens para baixa latência
8. IF a chave de API do Gemini não está configurada, THEN THE Mobile_App SHALL exibir mensagem de serviço indisponível

### Requirement 7: Alert Configuration and Notifications

**User Story:** Como usuário, eu quero configurar alertas para valores fora dos limites, para que eu seja notificado quando condições anormais ocorrerem.

#### Acceptance Criteria

1. THE Mobile_App SHALL permitir configuração de limites mínimos e máximos para cada parâmetro do Sensor
2. WHEN um valor de Sensor ultrapassa os limites configurados, THE Alert_System SHALL enviar notificação push
3. THE Alert_System SHALL suportar notificações locais (sem servidor) e push notifications (via servidor)
4. THE Mobile_App SHALL permitir ativar/desativar alertas individualmente por Sensor
5. THE Mobile_App SHALL exibir histórico de alertas disparados com timestamp
6. THE Alert_System SHALL implementar cooldown de 15 minutos entre alertas do mesmo tipo para o mesmo Sensor
7. WHERE notificações push são utilizadas, THE Backend_API SHALL integrar com Firebase Cloud Messaging (FCM)

### Requirement 8: Data Export

**User Story:** Como usuário, eu quero exportar dados históricos dos sensores, para que eu possa analisar em ferramentas externas ou compartilhar relatórios.

#### Acceptance Criteria

1. THE Export_Module SHALL suportar exportação em formato CSV
2. THE Export_Module SHALL suportar exportação em formato PDF com gráficos
3. WHEN um User solicita exportação, THE Export_Module SHALL permitir seleção de período (data início e fim)
4. THE Export_Module SHALL permitir seleção de parâmetros a serem incluídos na exportação
5. THE Export_Module SHALL gerar arquivo de exportação em até 10 segundos para datasets de até 10.000 registros
6. THE Mobile_App SHALL permitir compartilhamento do arquivo exportado via share sheet nativo
7. THE Export_Module SHALL incluir metadados (nome do sensor, período, timestamp de geração) no arquivo exportado

### Requirement 9: Backend API with PostgreSQL

**User Story:** Como desenvolvedor, eu quero um backend robusto com PostgreSQL e Prisma, para que eu possa armazenar e consultar dados de forma eficiente e escalável.

#### Acceptance Criteria

1. THE Backend_API SHALL utilizar PostgreSQL como banco de dados relacional
2. THE Backend_API SHALL utilizar Prisma ORM para gerenciamento de schema e queries
3. THE Backend_API SHALL implementar endpoints RESTful para autenticação, dispositivos, dados históricos, e alertas
4. THE Backend_API SHALL implementar índices em colunas frequentemente consultadas (mac, userId, timestamp)
5. THE Backend_API SHALL suportar paginação em todas as listagens com limite máximo de 100 itens por página
6. THE Backend_API SHALL implementar rate limiting de 100 requisições por minuto por usuário
7. THE Backend_API SHALL retornar respostas em formato JSON padronizado com campos code, message, e data
8. THE Backend_API SHALL implementar migrations versionadas via Prisma Migrate

### Requirement 10: Offline Support and Data Sync

**User Story:** Como usuário, eu quero que o app funcione offline, para que eu possa visualizar dados mesmo sem conexão com a internet.

#### Acceptance Criteria

1. THE Mobile_App SHALL armazenar dados de Sensors localmente usando SQLite ou Realm
2. WHEN o dispositivo está offline, THE Mobile_App SHALL exibir dados do cache local
3. WHEN a conexão é restaurada, THE Mobile_App SHALL sincronizar dados locais com o Backend_API
4. THE Mobile_App SHALL exibir indicador visual de status de conexão (online/offline)
5. THE Mobile_App SHALL permitir escaneamento BLE mesmo offline
6. WHILE offline, THE Mobile_App SHALL enfileirar ações do usuário (edição de alias, configuração de alertas) para sincronização posterior
7. THE Mobile_App SHALL resolver conflitos de sincronização usando estratégia "last write wins"

### Requirement 11: Settings and Configuration

**User Story:** Como usuário, eu quero configurar preferências do aplicativo, para que eu possa personalizar minha experiência.

#### Acceptance Criteria

1. THE Mobile_App SHALL permitir configuração de tema (claro/escuro/automático)
2. THE Mobile_App SHALL permitir configuração de unidades de temperatura (Celsius/Fahrenheit)
3. THE Mobile_App SHALL permitir configuração de idioma (Português/Inglês)
4. THE Mobile_App SHALL exibir informações de versão do app e termos de privacidade
5. THE Mobile_App SHALL permitir logout com confirmação
6. THE Mobile_App SHALL permitir configuração da chave de API do Gemini para AI_Assistant
7. THE Mobile_App SHALL permitir visualização e gerenciamento de conexões BLE ativas

### Requirement 12: Web Platform Maintenance

**User Story:** Como usuário web, eu quero que a plataforma web continue funcionando com todas as funcionalidades, para que eu possa escolher entre mobile e web conforme minha necessidade.

#### Acceptance Criteria

1. THE Web_Platform SHALL manter todas as funcionalidades existentes do PWA atual
2. THE Web_Platform SHALL compartilhar a mesma Backend_API com o Mobile_App
3. THE Web_Platform SHALL ser responsiva para desktop, tablet e mobile
4. THE Web_Platform SHALL suportar instalação como PWA em navegadores compatíveis
5. THE Web_Platform SHALL implementar service worker para cache de assets e funcionamento offline
6. THE Web_Platform SHALL utilizar Web Bluetooth API para escaneamento BLE em navegadores compatíveis
7. WHERE Web Bluetooth não é suportado, THE Web_Platform SHALL exibir mensagem informativa

### Requirement 13: BLE Data Parser

**User Story:** Como desenvolvedor, eu quero um parser robusto para dados BLE, para que eu possa decodificar corretamente advertising packets de diferentes tipos de sensores.

#### Acceptance Criteria

1. THE BLE_Parser SHALL suportar formato F525 (JHT Gateway) com fórmula: temperatura = (hex2dec/65535)*175-45, umidade = (hex2dec/65535)*100
2. THE BLE_Parser SHALL suportar formato 39F5 (JHT-UP) com mesma fórmula do F525
3. THE BLE_Parser SHALL suportar formato 35F5 (Wifi-PT100) com conversão IEEE 754 de 32 bits para temperatura
4. THE BLE_Parser SHALL suportar formato JW-U para sensores de água
5. FOR ALL formatos, THE BLE_Parser SHALL retornar valores com precisão de 2 casas decimais
6. IF o advertising data está malformado, THEN THE BLE_Parser SHALL retornar undefined para valores não parseáveis
7. THE BLE_Parser SHALL ser testado com property-based testing para garantir round-trip de parsing

### Requirement 14: Performance and Optimization

**User Story:** Como usuário, eu quero que o aplicativo seja rápido e responsivo, para que eu tenha uma experiência fluida.

#### Acceptance Criteria

1. THE Mobile_App SHALL inicializar em menos de 3 segundos em dispositivos mid-range
2. THE Mobile_App SHALL renderizar listas de até 100 Sensors com scroll suave (60 FPS)
3. THE Mobile_App SHALL implementar lazy loading para imagens e gráficos
4. THE Mobile_App SHALL implementar debouncing de 300ms em campos de busca
5. THE Mobile_App SHALL limitar uso de memória a menos de 150MB em operação normal
6. THE Backend_API SHALL responder a 95% das requisições em menos de 500ms
7. THE Mobile_App SHALL implementar cache de imagens e dados com estratégia LRU (Least Recently Used)

### Requirement 15: Security and Privacy

**User Story:** Como usuário, eu quero que meus dados estejam seguros, para que eu possa confiar no aplicativo com informações sensíveis.

#### Acceptance Criteria

1. THE Backend_API SHALL utilizar HTTPS para todas as comunicações
2. THE Authentication_Service SHALL armazenar senhas com bcrypt (cost factor 12) se autenticação por senha for implementada
3. THE Mobile_App SHALL armazenar tokens JWT em Keychain (iOS) ou Keystore (Android)
4. THE Backend_API SHALL implementar CORS restritivo permitindo apenas origens autorizadas
5. THE Backend_API SHALL sanitizar todas as entradas de usuário para prevenir SQL injection
6. THE Mobile_App SHALL implementar certificate pinning para comunicação com Backend_API
7. THE Backend_API SHALL implementar logs de auditoria para ações sensíveis (login, alteração de configurações)

