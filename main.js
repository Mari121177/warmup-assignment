const fs = require("fs");

function parseTimeAmPm(timeStr) {
    const parts = timeStr.trim().toLowerCase().split(' ');
    const [h, m, s] = parts[0].split(':').map(Number);
    const period = parts[1];
    let hours = h;
    if (period === 'am') {
        if (hours === 12) hours = 0;       // 12:xx am → 0:xx (midnight)
    } else {
        if (hours !== 12) hours += 12;     // 1–11 pm → 13–23
    }
    return hours * 3600 + m * 60 + s;
}

function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function getQuotaForDate(dateStr) {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);

    if (year === 2025 && month === 4 && day >= 10 && day <= 30) {
        return 6 * 3600;
    }
    return 8 * 3600 + 24 * 60;
}
function parseTime(timeStr) {
    const [h, m, s] = timeStr.trim().split(':').map(Number);
    return h * 3600 + m * 60 + s;
}
// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss 
// ============================================================
function getShiftDuration(startTime, endTime) {
    const start = parseTimeAmPm(startTime);
    const end = parseTimeAmPm(endTime);
    let diff = end - start;
    if (diff < 0) {
        diff += 24 * 3600;
    }
    return formatTime(diff);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    const start = parseTimeAmPm(startTime);
    const end = parseTimeAmPm(endTime);
    
    const deliveryStart = 8 * 3600;
    const deliveryEnd = 22 * 3600;

    let idle = 0;

    if (start < deliveryStart) {
        idle += Math.min(end, deliveryStart) - start;
    }

    if (end > deliveryEnd) {
        idle += end - Math.max(start, deliveryEnd);
    }

    return formatTime(idle);
}



// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    const shiftDur = parseTime(shiftDuration);
    const idle = parseTime(idleTime);

    let difference = shiftDur - idle;
    
    if (difference < 0) {
        difference = 0;
    }

    return formatTime(difference);

}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    const parts = date.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);

    let quota;

    if (year === 2025 && month === 4 && day >= 10 && day <= 30) {
        quota = 6 * 3600;
    } else {
        quota = 8 * 3600 + 24 * 60;
    }

    const active = parseTime(activeTime);

    return active >= quota;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    const { driverID, driverName, date, startTime, endTime } = shiftObj;

    const content = fs.readFileSync(textFile, { encoding: 'utf8' });
    const lines = content.split('\n');

    // Step 1: Check for duplicate
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const parts = lines[i].split(',');
        if (parts[0].trim() === driverID && parts[2].trim() === date) {
            return {};
        }
    }

    // Step 2: Calculate all derived fields
    const shiftDuration = getShiftDuration(startTime, endTime);
    const idleTime = getIdleTime(startTime, endTime);
    const activeTime = getActiveTime(shiftDuration, idleTime);
    const quota = metQuota(date, activeTime);

    // Step 3: Build the new record object
    const newRecord = {
        driverID,
        driverName,
        date,
        startTime,
        endTime,
        shiftDuration,
        idleTime,
        activeTime,
        metQuota: quota,
        hasBonus: false
    };

    // Step 4: Build the new line to write to file
    const newLine = `${driverID},${driverName},${date},${startTime},${endTime},${shiftDuration},${idleTime},${activeTime},${quota},false`;

    // Step 5: Find where to insert
    let lastIndexOfDriver = -1;
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const parts = lines[i].split(',');
        if (parts[0].trim() === driverID) {
            lastIndexOfDriver = i;
        }
    }

    // Step 6: Insert into correct position
    if (lastIndexOfDriver === -1) {
        // driverID not found, append at end
        lines.push(newLine);
    } else {
        // insert after last record of this driverID
        lines.splice(lastIndexOfDriver + 1, 0, newLine);
    }

    // Step 7: Write back to file
    fs.writeFileSync(textFile, lines.join('\n'), { encoding: 'utf8' });

    return newRecord;
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    const content = fs.readFileSync(textFile, { encoding: 'utf8' });
    const lines = content.split('\n');

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const parts = lines[i].split(',');
        if (parts[0].trim() === driverID && parts[2].trim() === date) {
            parts[parts.length - 1] = String(newValue);
            lines[i] = parts.join(',');
            break;
        }
    }

    fs.writeFileSync(textFile, lines.join('\n'), { encoding: 'utf8' });
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    const content = fs.readFileSync(textFile, { encoding: 'utf8' });
    const lines = content.split('\n');

    // Normalize month to integer for comparison
    const targetMonth = parseInt(month);

    let driverFound = false;
    let count = 0;

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const parts = lines[i].split(',');
        if (parts[0].trim() !== driverID) continue;

        // Driver exists
        driverFound = true;

        // Check if same month
        const recordMonth = parseInt(parts[2].trim().split('-')[1]);
        if (recordMonth !== targetMonth) continue;

        // Check if hasBonus is true
        if (parts[parts.length - 1].trim() === 'true') {
            count++;
        }
    }

    return driverFound ? count : -1;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
   const content = fs.readFileSync(textFile, { encoding: 'utf8' });
    const lines = content.split('\n');

    let totalSeconds = 0;

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const parts = lines[i].split(',');
        if (parts[0].trim() !== driverID) continue;

        const recordMonth = parseInt(parts[2].trim().split('-')[1]);
        if (recordMonth !== parseInt(month)) continue;

        totalSeconds += parseTime(parts[7].trim());
    }

    return formatTime(totalSeconds);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    // Step 1: Read shifts file
    const content = fs.readFileSync(textFile, { encoding: 'utf8' });
    const lines = content.split('\n');

    // Step 2: Read rateFile to get driver's day off
    const rateContent = fs.readFileSync(rateFile, { encoding: 'utf8' });
    const rateLines = rateContent.split('\n');

    // Step 3: Find driver's day off from rateFile
    let dayOff = null;
    for (let i = 0; i < rateLines.length; i++) {
        if (!rateLines[i].trim()) continue;
        const parts = rateLines[i].split(',');
        if (parts[0].trim() === driverID) {
            dayOff = parts[1].trim().toLowerCase();
            break;
        }
    }

    // Step 4: Map day name to day number
    const dayMap = {
        'sunday': 0, 'monday': 1, 'tuesday': 2,
        'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6
    };
    const dayOffNumber = dayMap[dayOff];

    // Step 5: Loop through shifts and add quota
    let totalSeconds = 0;
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const parts = lines[i].split(',');
        if (parts[0].trim() !== driverID) continue;

        const recordMonth = parseInt(parts[2].trim().split('-')[1]);
        if (recordMonth !== parseInt(month)) continue;

        // Check if this date is driver's day off
        const dateStr = parts[2].trim();
        const dateObj = new Date(dateStr);
        if (dateObj.getDay() === dayOffNumber) continue;

        // Add quota for this date
        totalSeconds += getQuotaForDate(dateStr);
    }

    // Step 6: Subtract 2 hours per bonus
    totalSeconds -= bonusCount * 2 * 3600;
    if (totalSeconds < 0) totalSeconds = 0;

    return formatTime(totalSeconds);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    const rateContent = fs.readFileSync(rateFile, { encoding: 'utf8' });
    const rateLines = rateContent.split('\n');

    let basePay = 0;
    let tier = 0;
    for (let i = 0; i < rateLines.length; i++) {
        if (!rateLines[i].trim()) continue;
        const parts = rateLines[i].split(',');
        if (parts[0].trim() === driverID) {
            basePay = parseInt(parts[2].trim());
            tier = parseInt(parts[3].trim());
            break;
        }
    }

    const actualSec = parseTime(actualHours);
    const requiredSec = parseTime(requiredHours);
    const missingSec = Math.max(0, requiredSec - actualSec);

    const tierAllowance = { 1: 50, 2: 20, 3: 10, 4: 3 };
    const allowedSec = tierAllowance[tier] * 3600;

    const excessSec = Math.max(0, missingSec - allowedSec);
    const excessHours = Math.floor(excessSec / 3600);

    const deductionRate = Math.floor(basePay / 185);
    const deduction = excessHours * deductionRate;

    return basePay - deduction;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
