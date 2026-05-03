import fs from 'fs';
let code = fs.readFileSync('tmp_regression_af.mjs', 'utf8');

const t = new Date();
t.setDate(t.getDate() + 1);
t.setHours(12, 0, 0, 0);
const cashDate = t.toISOString();

t.setHours(14, 0, 0, 0);
const qrisDate = t.toISOString();

code = code.replace(/scheduledStart: now\.toISOString\(\)/g, "scheduledStart: '" + cashDate + "'");
code = code.replace(/scheduledStart: new Date.*toISOString\(\)/g, "scheduledStart: '" + qrisDate + "'");
fs.writeFileSync('tmp_regression_af.mjs', code);
