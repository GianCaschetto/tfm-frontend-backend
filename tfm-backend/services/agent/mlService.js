import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.join(__dirname, '..', '..', 'scripts', 'ml-predict.py');
const MODELS_PATH = path.join(__dirname, '..', '..', 'ml-models');

function runPythonPredict(input) {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [SCRIPT_PATH], {
      env: { ...process.env, MODELS_PATH: MODELS_PATH }
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (data) => { stdout += data.toString(); });
    py.stderr.on('data', (data) => { stderr += data.toString(); });

    py.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python script exited with code ${code}: ${stderr}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });

    py.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });

    py.stdin.write(JSON.stringify(input));
    py.stdin.end();
  });
}

export async function predictDemand({ productName, productId, date, daysAhead }) {
  const result = await runPythonPredict({
    model: 'demand',
    productName,
    productId,
    date: date || new Date().toISOString().split('T')[0],
    daysAhead: daysAhead || 7
  });
  return result;
}

export async function predictRevenue({ date, daysAhead }) {
  const result = await runPythonPredict({
    model: 'revenue',
    date: date || new Date().toISOString().split('T')[0],
    daysAhead: daysAhead || 7
  });
  return result;
}
