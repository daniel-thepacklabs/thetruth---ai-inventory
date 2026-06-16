import { getSalesProductType } from '../data/parsers.js';

// ── Helpers ──

function dayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=Sun ... 6=Sat
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ── Factor 1: Day-of-Week Weighted Run-Rate ──
// Instead of assuming flat daily rate, weight remaining days by historical
// day-of-week sales distribution (wholesale clusters on weekdays)
function calcDowWeightedProjection(salesData, currentPeriod, dayOfMonth, totalDays) {
  const curMonthItems = salesData.filter(r => r.month === currentPeriod && r.date);
  const mtdRev = curMonthItems.reduce((s, r) => s + r.subtotal, 0);
  const mtdUnits = curMonthItems.reduce((s, r) => s + r.qty, 0);

  // Build day-of-week revenue distribution from all historical data
  const dowRev = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  const dowCount = [0, 0, 0, 0, 0, 0, 0];
  salesData.forEach(r => {
    if (!r.date || r.date.endsWith('-01') && !r.date.startsWith(currentPeriod.slice(0, 7))) return;
    if (!r.date || r.date.length < 10) return;
    const dow = dayOfWeek(r.date);
    dowRev[dow] += r.subtotal;
    dowCount[dow]++;
  });

  const totalDowRev = dowRev.reduce((s, v) => s + v, 0);
  if (totalDowRev === 0) return null;

  // Normalize to relative weights per day-of-week
  const dowWeight = dowRev.map(v => v / totalDowRev * 7);

  // Calculate weight of elapsed days and remaining days
  const [year, mo] = currentPeriod.split('-').map(Number);
  let elapsedWeight = 0, remainingWeight = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dow = new Date(year, mo - 1, d).getDay();
    if (d <= dayOfMonth) elapsedWeight += dowWeight[dow];
    else remainingWeight += dowWeight[dow];
  }

  const totalWeight = elapsedWeight + remainingWeight;
  if (elapsedWeight <= 0) return null;

  const projRev = mtdRev * (totalWeight / elapsedWeight);
  const projUnits = mtdUnits * (totalWeight / elapsedWeight);

  return { projRev, projUnits, dowWeight, confidence: 0.85 };
}

// ── Factor 2: Customer Reorder Cadence ──
// Analyze how often each customer reorders each product type, predict
// how many more reorders to expect this month
function calcReorderCadence(salesData, currentPeriod, dayOfMonth, totalDays) {
  // Group orders by customer + product type + month
  const customerOrders = {}; // customer -> productType -> [dates]
  salesData.forEach(r => {
    if (!r.customer || !r.date || r.date.length < 10) return;
    const [type] = getSalesProductType(r.pid, r.desc);
    const key = `${r.customer}|||${type}`;
    if (!customerOrders[key]) customerOrders[key] = [];
    customerOrders[key].push({ date: r.date, rev: r.subtotal, qty: r.qty, orderId: r.orderId });
  });

  // For each customer-product pair, compute avg reorder interval in days
  const cadences = {}; // customer|||type -> { avgDays, avgRev, avgQty, lastOrderDate }
  for (const [key, orders] of Object.entries(customerOrders)) {
    // Deduplicate by orderId to get unique order dates
    const uniqueOrders = {};
    orders.forEach(o => {
      const oid = o.orderId || o.date;
      if (!uniqueOrders[oid]) uniqueOrders[oid] = { date: o.date, rev: 0, qty: 0 };
      uniqueOrders[oid].rev += o.rev;
      uniqueOrders[oid].qty += o.qty;
    });
    const sorted = Object.values(uniqueOrders).sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) continue;

    const intervals = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1].date);
      const d2 = new Date(sorted[i].date);
      const diff = (d2 - d1) / (1000 * 60 * 60 * 24);
      if (diff > 0 && diff < 120) intervals.push(diff);
    }
    if (!intervals.length) continue;

    const avgDays = median(intervals);
    const avgRev = sorted.reduce((s, o) => s + o.rev, 0) / sorted.length;
    const avgQty = sorted.reduce((s, o) => s + o.qty, 0) / sorted.length;
    const lastOrderDate = sorted[sorted.length - 1].date;

    cadences[key] = { avgDays, avgRev, avgQty, lastOrderDate, orderCount: sorted.length };
  }

  // Project: for each customer-product, did they already order this month?
  // If not, when is the next expected order? If within remaining days, add it.
  const [year, mo] = currentPeriod.split('-').map(Number);
  const monthStart = `${currentPeriod}-01`;
  const monthEnd = `${currentPeriod}-${String(totalDays).padStart(2, '0')}`;

  let expectedRev = 0, expectedUnits = 0;
  let trackedPairs = 0;

  for (const [key, cad] of Object.entries(cadences)) {
    const [customer, type] = key.split('|||');
    // Count orders this month
    const thisMonthOrders = (customerOrders[key] || []).filter(o => o.date >= monthStart && o.date <= monthEnd);
    const uniqueThisMonth = new Set(thisMonthOrders.map(o => o.orderId || o.date)).size;

    // Expected total orders this month based on cadence
    const expectedPerMonth = Math.max(1, 30 / cad.avgDays);
    const remainingExpected = Math.max(0, expectedPerMonth - uniqueThisMonth);

    if (remainingExpected > 0.3) {
      // Weight by how much of the month remains
      const remainingPct = (totalDays - dayOfMonth) / totalDays;
      const adjustedRemaining = remainingExpected * Math.min(1, remainingPct * 1.5);
      expectedRev += adjustedRemaining * cad.avgRev;
      expectedUnits += adjustedRemaining * cad.avgQty;
      trackedPairs++;
    }
  }

  // Add existing MTD actual revenue
  const curMonthItems = salesData.filter(r => r.month === currentPeriod);
  const actualRev = curMonthItems.reduce((s, r) => s + r.subtotal, 0);
  const actualUnits = curMonthItems.reduce((s, r) => s + r.qty, 0);

  if (trackedPairs === 0) return null;

  return {
    projRev: actualRev + expectedRev,
    projUnits: actualUnits + expectedUnits,
    trackedPairs,
    totalCadences: Object.keys(cadences).length,
    confidence: Math.min(0.9, 0.5 + (trackedPairs / Math.max(1, Object.keys(cadences).length)) * 0.4)
  };
}

// ── Factor 3: Trend Momentum (3-month slope) ──
// Linear regression on last 3 completed months to project direction
function calcTrendMomentum(salesData, allMonths, currentPeriod) {
  const completed = allMonths.filter(m => m < currentPeriod).slice(-3);
  if (completed.length < 2) return null;

  const monthRevs = completed.map(m => {
    return salesData.filter(r => r.month === m).reduce((s, r) => s + r.subtotal, 0);
  });
  const monthUnits = completed.map(m => {
    return salesData.filter(r => r.month === m).reduce((s, r) => s + r.qty, 0);
  });

  // Simple linear regression: y = a + b*x
  const n = monthRevs.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const xMean = xs.reduce((s, v) => s + v, 0) / n;
  const yMean = monthRevs.reduce((s, v) => s + v, 0) / n;
  const uMean = monthUnits.reduce((s, v) => s + v, 0) / n;

  let sxy = 0, sxx = 0, sxu = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - xMean) * (monthRevs[i] - yMean);
    sxu += (xs[i] - xMean) * (monthUnits[i] - uMean);
    sxx += (xs[i] - xMean) * (xs[i] - xMean);
  }

  if (sxx === 0) return null;

  const slopeRev = sxy / sxx;
  const slopeUnits = sxu / sxx;
  const interceptRev = yMean - slopeRev * xMean;
  const interceptUnits = uMean - slopeUnits * xMean;

  // Project to next month (x = n)
  const projRev = Math.max(0, interceptRev + slopeRev * n);
  const projUnits = Math.max(0, interceptUnits + slopeUnits * n);

  // Confidence based on R² and sample size
  const ssRes = monthRevs.reduce((s, y, i) => {
    const pred = interceptRev + slopeRev * xs[i];
    return s + (y - pred) ** 2;
  }, 0);
  const ssTot = monthRevs.reduce((s, y) => s + (y - yMean) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return {
    projRev,
    projUnits,
    slopeRev,
    monthlyRevs: completed.map((m, i) => ({ month: m, rev: monthRevs[i] })),
    r2,
    confidence: Math.max(0.3, Math.min(0.7, r2 * 0.5 + (n / 3) * 0.2))
  };
}

// ── Factor 4: Velocity Shift (recent 7d vs full MTD) ──
// Detects if sales pace is accelerating or decelerating within the month
function calcVelocityShift(salesData, currentPeriod, dayOfMonth, totalDays) {
  if (dayOfMonth < 8) return null; // Need at least 8 days

  const [year, mo] = currentPeriod.split('-').map(Number);
  const curItems = salesData.filter(r => r.month === currentPeriod && r.date && r.date.length >= 10);
  if (!curItems.length) return null;

  const cutoffDay = dayOfMonth - 7;
  const cutoffDate = `${currentPeriod}-${String(cutoffDay).padStart(2, '0')}`;

  const recent7 = curItems.filter(r => r.date > cutoffDate);
  const earlier = curItems.filter(r => r.date <= cutoffDate);

  const recent7Rev = recent7.reduce((s, r) => s + r.subtotal, 0);
  const earlierRev = earlier.reduce((s, r) => s + r.subtotal, 0);
  const recent7Days = 7;
  const earlierDays = cutoffDay;

  if (earlierDays <= 0 || earlierRev <= 0) return null;

  const recentDailyRate = recent7Rev / recent7Days;
  const earlierDailyRate = earlierRev / earlierDays;
  const velocityRatio = recentDailyRate / earlierDailyRate;

  // Project using recent pace for remaining days
  const remainingDays = totalDays - dayOfMonth;
  const mtdRev = recent7Rev + earlierRev;
  const mtdUnits = curItems.reduce((s, r) => s + r.qty, 0);
  const recent7Units = recent7.reduce((s, r) => s + r.qty, 0);
  const recentUnitRate = recent7Units / recent7Days;

  const projRev = mtdRev + recentDailyRate * remainingDays;
  const projUnits = mtdUnits + recentUnitRate * remainingDays;

  return {
    projRev,
    projUnits,
    velocityRatio,
    recentDailyRate,
    earlierDailyRate,
    confidence: dayOfMonth >= 14 ? 0.8 : 0.5
  };
}

// ── Factor 5: Seasonality (same month prior year) ──
function calcSeasonality(salesData, allMonths, currentPeriod, dayOfMonth, totalDays) {
  const [year, mo] = currentPeriod.split('-').map(Number);
  const lastYearPeriod = `${year - 1}-${String(mo).padStart(2, '0')}`;
  if (!allMonths.includes(lastYearPeriod)) return null;

  const lastYearRev = salesData.filter(r => r.month === lastYearPeriod).reduce((s, r) => s + r.subtotal, 0);
  const lastYearUnits = salesData.filter(r => r.month === lastYearPeriod).reduce((s, r) => s + r.qty, 0);
  if (lastYearRev <= 0) return null;

  // Use YoY growth rate applied to last year's full month
  const completed = allMonths.filter(m => m < currentPeriod).slice(-3);
  const lastYearCompleted = completed.map(m => {
    const [y2, mo2] = m.split('-').map(Number);
    return `${y2 - 1}-${String(mo2).padStart(2, '0')}`;
  }).filter(m => allMonths.includes(m));

  if (!lastYearCompleted.length) {
    return { projRev: lastYearRev, projUnits: lastYearUnits, confidence: 0.3 };
  }

  // Avg YoY growth over recent months
  let growthSum = 0, growthCount = 0;
  completed.forEach(m => {
    const [y2, mo2] = m.split('-').map(Number);
    const lyPeriod = `${y2 - 1}-${String(mo2).padStart(2, '0')}`;
    if (!allMonths.includes(lyPeriod)) return;
    const curRev = salesData.filter(r => r.month === m).reduce((s, r) => s + r.subtotal, 0);
    const lyRev = salesData.filter(r => r.month === lyPeriod).reduce((s, r) => s + r.subtotal, 0);
    if (lyRev > 0) {
      growthSum += (curRev - lyRev) / lyRev;
      growthCount++;
    }
  });

  const avgGrowth = growthCount > 0 ? growthSum / growthCount : 0;
  const projRev = lastYearRev * (1 + avgGrowth);
  const projUnits = lastYearUnits * (1 + avgGrowth);

  return { projRev, projUnits, yoyGrowth: avgGrowth, confidence: 0.4 };
}

// ── Weighted Ensemble Forecast ──
export function computeForecast(salesData, allMonths, currentPeriod, dayOfMonth, totalDays, mtdOrders) {
  const simpleRunRate = (() => {
    const pct = dayOfMonth / totalDays;
    const items = salesData.filter(r => r.month === currentPeriod);
    const rev = items.reduce((s, r) => s + r.subtotal, 0);
    const units = items.reduce((s, r) => s + r.qty, 0);
    const orders = mtdOrders || new Set(items.filter(r => r.orderId).map(r => r.orderId)).size || 0;
    return { projRev: rev / pct, projUnits: units / pct, projOrders: orders / pct, mtdRev: rev, mtdUnits: units, mtdOrders: orders, confidence: 0.6 };
  })();

  const hasDetailedDates = salesData.some(r => r.date && r.date.length >= 10 && !r.date.endsWith('-01'));

  const dow = hasDetailedDates ? calcDowWeightedProjection(salesData, currentPeriod, dayOfMonth, totalDays) : null;
  const reorder = hasDetailedDates ? calcReorderCadence(salesData, currentPeriod, dayOfMonth, totalDays) : null;
  const trend = calcTrendMomentum(salesData, allMonths, currentPeriod);
  const velocity = hasDetailedDates ? calcVelocityShift(salesData, currentPeriod, dayOfMonth, totalDays) : null;
  const seasonal = calcSeasonality(salesData, allMonths, currentPeriod, dayOfMonth, totalDays);

  // Collect all factors with their confidence weights
  const factors = [];
  factors.push({ name: 'Run Rate', ...simpleRunRate });
  if (dow) factors.push({ name: 'Day-of-Week', ...dow });
  if (reorder) factors.push({ name: 'Reorder Cadence', ...reorder });
  if (trend) factors.push({ name: 'Trend', ...trend });
  if (velocity) factors.push({ name: 'Velocity', ...velocity });
  if (seasonal) factors.push({ name: 'Seasonality', ...seasonal });

  // Weighted average by confidence
  let totalWeight = 0, wRev = 0, wUnits = 0;
  factors.forEach(f => {
    if (f.projRev > 0) {
      wRev += f.projRev * f.confidence;
      wUnits += f.projUnits * f.confidence;
      totalWeight += f.confidence;
    }
  });

  const projRev = totalWeight > 0 ? wRev / totalWeight : simpleRunRate.projRev;
  const projUnits = totalWeight > 0 ? wUnits / totalWeight : simpleRunRate.projUnits;
  const projOrders = simpleRunRate.projOrders; // orders only from run-rate

  return {
    projRev,
    projUnits,
    projOrders,
    mtdRev: simpleRunRate.mtdRev,
    mtdUnits: simpleRunRate.mtdUnits,
    mtdOrders: simpleRunRate.mtdOrders,
    factors,
    factorCount: factors.length,
    hasDetailedDates,
  };
}

// ── Per-Type Forecast (same multi-factor approach per product type) ──
export function computeForecastByType(salesData, allMonths, currentPeriod, dayOfMonth, totalDays, lastMoPeriod) {
  const pct = dayOfMonth / totalDays;
  const curItems = salesData.filter(r => r.month === currentPeriod);
  const lastMoItems = lastMoPeriod ? salesData.filter(r => r.month === lastMoPeriod) : [];
  const hasDetailedDates = salesData.some(r => r.date && r.date.length >= 10 && !r.date.endsWith('-01'));

  // Build trees
  const buildTree = (data) => {
    const t = {};
    data.forEach(r => {
      const [type, subtype] = getSalesProductType(r.pid, r.desc);
      const key = `${type}|||${subtype}`;
      if (!t[key]) t[key] = { type, subtype, rev: 0, units: 0, items: [] };
      t[key].rev += r.subtotal;
      t[key].units += r.qty;
      t[key].items.push(r);
    });
    return t;
  };

  const currentTree = buildTree(curItems);
  const lastMoTree = buildTree(lastMoItems);

  // For each subcategory, compute multi-factor forecast
  const allKeys = [...new Set([...Object.keys(currentTree), ...Object.keys(lastMoTree)])];

  const rows = allKeys.map(key => {
    const cur = currentTree[key] || { type: key.split('|||')[0], subtype: key.split('|||')[1], rev: 0, units: 0, items: [] };
    const lm = lastMoTree[key] || { rev: 0, units: 0 };

    // Simple run-rate for this subcategory
    const runRateRev = pct > 0 ? cur.rev / pct : 0;
    const runRateUnits = pct > 0 ? cur.units / pct : 0;

    // Trend for this type from prior months
    const completed = allMonths.filter(m => m < currentPeriod).slice(-3);
    const monthRevs = completed.map(m =>
      salesData.filter(r => r.month === m && getSalesProductType(r.pid, r.desc).join('|||') === key.replace('|||', '|||'))
        .reduce((s, r) => s + r.subtotal, 0)
    );

    let trendRev = null;
    if (completed.length >= 2) {
      const n = monthRevs.length;
      const xs = Array.from({ length: n }, (_, i) => i);
      const xMean = xs.reduce((s, v) => s + v, 0) / n;
      const yMean = monthRevs.reduce((s, v) => s + v, 0) / n;
      let sxy = 0, sxx = 0;
      for (let i = 0; i < n; i++) {
        sxy += (xs[i] - xMean) * (monthRevs[i] - yMean);
        sxx += (xs[i] - xMean) * (xs[i] - xMean);
      }
      if (sxx > 0) {
        const slope = sxy / sxx;
        trendRev = Math.max(0, yMean - slope * xMean + slope * n);
      }
    }

    // Velocity shift for this subcategory
    let velocityRev = null;
    if (hasDetailedDates && dayOfMonth >= 8) {
      const subItems = curItems.filter(r => {
        const [t, s] = getSalesProductType(r.pid, r.desc);
        return `${t}|||${s}` === key;
      }).filter(r => r.date && r.date.length >= 10);

      if (subItems.length > 0) {
        const cutoffDate = `${currentPeriod}-${String(dayOfMonth - 7).padStart(2, '0')}`;
        const recent = subItems.filter(r => r.date > cutoffDate);
        const earlier = subItems.filter(r => r.date <= cutoffDate);
        const recentRev = recent.reduce((s, r) => s + r.subtotal, 0);
        const earlierRev = earlier.reduce((s, r) => s + r.subtotal, 0);
        if (earlierRev > 0 && (dayOfMonth - 7) > 0) {
          const recentRate = recentRev / 7;
          const remainingDays = totalDays - dayOfMonth;
          velocityRev = cur.rev + recentRate * remainingDays;
        }
      }
    }

    // Weighted blend
    let wRev = runRateRev * 0.5;
    let wTotal = 0.5;
    if (trendRev !== null && trendRev > 0) { wRev += trendRev * 0.25; wTotal += 0.25; }
    if (velocityRev !== null && velocityRev > 0) { wRev += velocityRev * 0.25; wTotal += 0.25; }
    const projRev = wTotal > 0 ? wRev / wTotal : runRateRev;
    const projUnits = pct > 0 ? cur.units / pct : 0; // units stay run-rate for simplicity

    const vsLastMo = lm.rev > 0 ? ((projRev - lm.rev) / lm.rev * 100) : (projRev > 0 ? 100 : 0);

    return {
      type: cur.type,
      subtype: cur.subtype,
      curRev: cur.rev,
      projRev,
      projUnits: Math.round(projUnits),
      lastMoRev: lm.rev,
      lastMoUnits: lm.units,
      vsLastMo,
    };
  }).sort((a, b) => b.projRev - a.projRev);

  return rows;
}
