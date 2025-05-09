// test-totp.js
import { totp } from 'otplib';

// Configura igual que en tu proyecto
totp.options = { 
  digits: 6,
  period: 30,
  window: 1
};

const secret = "PE3GPKOEITNNAPRUILUZ6V74RLEHGIM2"; // Usa el mismo secreto que en Python

console.log("🔐 Node.js Token Debug:");
console.log("Token:", totp.generate(secret));
console.log("Tiempo restante (s):", totp.timeRemaining());
console.log("Hora actual (UTC):", new Date().toISOString());