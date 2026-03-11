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

function parseTime(timeStr) {
    const [h, m, s] = timeStr.trim().split(':').map(Number);
    return h * 3600 + m * 60 + s;
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
    // TODO: Implement this function
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    // TODO: Implement this function
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
    // TODO: Implement this function
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
    // TODO: Implement this function
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
