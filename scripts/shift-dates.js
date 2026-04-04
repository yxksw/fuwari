import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const postsDir = path.join(__dirname, '..', 'src', 'content', 'posts');

function getDaysInMonth(m, y) {
    if (m === 2) {
        if ((y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0)) return 29;
        return 28;
    }
    if (m === 4 || m === 6 || m === 9 || m === 11) return 30;
    return 31;
}

function pad(n) {
    return n < 10 ? '0' + n : '' + n;
}

function shiftDate(dateStr) {
    // Regex to match YYYY-MM-DD or YYYY-MM-DD[T ]HH:mm:ss
    const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!match) return dateStr;

    let y = +match[1];
    let m = +match[2];
    let d = +match[3];
    let h = match[4] ? +match[4] : 0;
    let min = match[5] ? +match[5] : 0;
    let sec = match[6] ? +match[6] : 0;

    h -= 8;
    if (h < 0) {
        h += 24;
        d -= 1;
        if (d < 1) {
            m -= 1;
            if (m < 1) {
                m = 12;
                y -= 1;
            }
            d = getDaysInMonth(m, y);
        }
    }

    // Always output with time since we are shifting by hours
    return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:${pad(sec)}`;
}

// Internal tests
const tests = [
    { in: '2024-04-05T05:00:00', out: '2024-04-04T21:00:00' },
    { in: '2024-01-01 04:00:00', out: '2023-12-31T20:00:00' },
    { in: '2024-03-01 04:00:00', out: '2024-02-29T20:00:00' },
    { in: '2025-03-01 04:00:00', out: '2025-02-28T20:00:00' },
    { in: '2024-10-28', out: '2024-10-27T16:00:00' }
];

console.log('Running internal tests...');
for (const t of tests) {
    const res = shiftDate(t.in);
    if (res !== t.out) {
        console.error(`Test failed: In "${t.in}", Expected "${t.out}", Got "${res}"`);
        process.exit(1);
    }
}
console.log('All tests passed!\n');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let lines = content.split(/\r?\n/);
    let changed = false;

    let inFrontmatter = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && line === '---') {
            inFrontmatter = true;
            continue;
        }
        if (inFrontmatter && line === '---') {
            inFrontmatter = false;
            break;
        }

        if (inFrontmatter) {
            // Match published: or updated:
            const match = line.match(/^(published|updated):\s*(['"]?)([^'"]+)\2\s*$/i);
            if (match) {
                const field = match[1];
                const quote = match[2];
                const oldDate = match[3];
                const newDate = shiftDate(oldDate);
                if (oldDate !== newDate) {
                    lines[i] = `${field}: ${quote}${newDate}${quote}`;
                    changed = true;
                }
            }
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        console.log(`Updated: ${path.basename(filePath)}`);
    }
}

const files = fs.readdirSync(postsDir);
for (const file of files) {
    if (file.endsWith('.md')) {
        processFile(path.join(postsDir, file));
    }
}

console.log('\nDone.');
