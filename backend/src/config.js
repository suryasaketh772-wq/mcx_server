const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../.env');

// Load environment variables initially
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Config state in memory
const config = {
  apiKey: process.env.SMART_API_KEY || '',
  clientCode: process.env.SMART_CLIENT_CODE || '',
  password: process.env.SMART_PASSWORD || '',
  totpSecret: process.env.SMART_TOTP_SECRET || '',
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development'
};

/**
 * Gets the current active configuration (masked for security)
 */
function getMaskedConfig() {
  return {
    apiKey: config.apiKey ? `${config.apiKey.substring(0, 6)}...${config.apiKey.slice(-4)}` : '',
    clientCode: config.clientCode ? `${config.clientCode.substring(0, 2)}...${config.clientCode.slice(-2)}` : '',
    hasPassword: !!config.password,
    hasTotpSecret: !!config.totpSecret,
    configured: !!(config.apiKey && config.clientCode && config.password && config.totpSecret)
  };
}

/**
 * Updates the configuration in memory and writes it to the .env file.
 */
function updateConfig(newConfig) {
  const updated = {};
  
  if (newConfig.apiKey !== undefined) {
    config.apiKey = newConfig.apiKey;
    updated.SMART_API_KEY = newConfig.apiKey;
  }
  if (newConfig.clientCode !== undefined) {
    config.clientCode = newConfig.clientCode;
    updated.SMART_CLIENT_CODE = newConfig.clientCode;
  }
  if (newConfig.password !== undefined) {
    config.password = newConfig.password;
    updated.SMART_PASSWORD = newConfig.password;
  }
  if (newConfig.totpSecret !== undefined) {
    config.totpSecret = newConfig.totpSecret;
    updated.SMART_TOTP_SECRET = newConfig.totpSecret;
  }

  // Load existing environment contents to preserve other keys if any
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const lines = envContent.split('\n');
  const envMap = {};

  // Parse existing
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      envMap[key] = val;
    }
  });

  // Merge updated values
  Object.keys(updated).forEach(key => {
    envMap[key] = updated[key];
  });

  // Reconstruct file content
  let newEnvContent = '# Angel One SmartAPI Credentials\n';
  Object.keys(envMap).forEach(key => {
    if (['SMART_API_KEY', 'SMART_CLIENT_CODE', 'SMART_PASSWORD', 'SMART_TOTP_SECRET'].includes(key)) {
      newEnvContent += `${key}=${envMap[key]}\n`;
    }
  });

  newEnvContent += `\n# Server Configuration\n`;
  newEnvContent += `PORT=${config.port}\n`;
  newEnvContent += `NODE_ENV=${config.nodeEnv}\n`;

  fs.writeFileSync(envPath, newEnvContent, 'utf8');
  
  // Reload process.env
  process.env.SMART_API_KEY = config.apiKey;
  process.env.SMART_CLIENT_CODE = config.clientCode;
  process.env.SMART_PASSWORD = config.password;
  process.env.SMART_TOTP_SECRET = config.totpSecret;

  return getMaskedConfig();
}

module.exports = {
  config,
  getMaskedConfig,
  updateConfig
};
