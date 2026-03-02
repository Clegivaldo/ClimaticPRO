import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function updateAppJson(ip) {
  const appJsonPath = path.resolve(__dirname, '..', 'mobile', 'app.json');
  if (!fs.existsSync(appJsonPath)) return false;
  const content = fs.readFileSync(appJsonPath, 'utf8');
  const obj = JSON.parse(content);
  if (!obj.expo) obj.expo = {};
  if (!obj.expo.extra) obj.expo.extra = {};
  obj.expo.extra.EXPO_PUBLIC_API_URL = `http://${ip}:3001/api/v1`;
  fs.writeFileSync(appJsonPath, JSON.stringify(obj, null, 2));
  return true;
}

function updateEnv(ip) {
  const envPath = path.resolve(__dirname, '..', 'mobile', '.env');
  const value = `EXPO_PUBLIC_API_URL=http://${ip}:3001/api/v1\n`;
  fs.writeFileSync(envPath, value);
}

const ip = getLocalIp();
console.log('Detected local IP:', ip);
const changed = updateAppJson(ip);
updateEnv(ip);
if (changed) console.log('Updated mobile/app.json and mobile/.env with', ip);
else console.log('Updated mobile/.env only (app.json not found)');
