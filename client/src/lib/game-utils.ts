// Slot machine symbols
export const SLOT_SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "🔔", "💎", "7️⃣", "🍀", "⭐", "🎰"];

// Slot machine payouts
export const SLOT_PAYOUTS = {
  "🍒🍒🍒": 1.2,
  "🍋🍋🍋": 1.5,
  "🍊🍊🍊": 2,
  "🍇🍇🍇": 3,
  "🔔🔔🔔": 5,
  "💎💎💎": 10,
  "7️⃣7️⃣7️⃣": 25,
  "🍀🍀🍀": 75,
  "⭐⭐⭐": 250,
  "🎰🎰🎰": 1000,
  // Special patterns
  "pair": 0.4,
  "diagonal": 1.5,
  "middle_row": 1.2,
  "full_grid": 20,
};

// Format currency value with coins
export const formatCurrency = (value: number | string) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return numValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' coins';
};

// Format multiplier value
export const formatMultiplier = (value: number | string) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return `${numValue.toFixed(2)}×`;
};

// Get time ago string
export const timeAgo = (date: Date | string) => {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return `${interval} year${interval === 1 ? '' : 's'} ago`;
  
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `${interval} month${interval === 1 ? '' : 's'} ago`;
  
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `${interval} day${interval === 1 ? '' : 's'} ago`;
  
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `${interval} hour${interval === 1 ? '' : 's'} ago`;
  
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `${interval} minute${interval === 1 ? '' : 's'} ago`;
  
  return `${Math.floor(seconds)} second${seconds === 1 ? '' : 's'} ago`;
};

// Generate a random float between min and max
export const randomFloat = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};

// Clamp a value between min and max
export const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

// Get game icon based on game type
export const getGameIcon = (gameType: string) => {
  switch (gameType.toLowerCase()) {
    case 'slots':
      return 'ri-slot-machine-line';
    case 'dice':
      return 'ri-dice-line';
    case 'crash':
      return 'ri-rocket-line';
    default:
      return 'ri-gamepad-line';
  }
};

// Function to create points for a crash game curve
export const generateCrashCurvePoints = (
  crashPoint: number,
  width: number,
  height: number,
  maxPoints = 100
) => {
  // Generate points for a curve that starts at the bottom left (0,height)
  // and increases exponentially up to the crash point
  const points = [];
  const maxX = width;
  const maxY = height;
  
  // The x-coordinate at which the crash happens
  const crashX = width * 0.8;
  
  for (let i = 0; i <= maxPoints; i++) {
    const progress = i / maxPoints;
    const x = progress * crashX;
    
    // Calculate y using an exponential function
    // Higher crashPoint means the curve goes higher faster
    const exponentialFactor = Math.pow(progress, 1 / crashPoint);
    const y = maxY - (exponentialFactor * maxY);
    
    points.push({ x, y });
    
    // Stop at crash point
    if (progress >= 1) break;
  }
  
  return points;
};
